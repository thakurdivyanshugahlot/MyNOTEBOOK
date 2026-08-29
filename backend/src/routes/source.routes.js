import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { prisma } from "../config/prisma.js";
import { deleteSourceVectors } from "../config/qdrant.js";

import { currentUserId } from "../middleware/auth.js";
import { inngestClient } from "../inngest/client.js";

const router = Router();

const EXTENSION_TO_TYPE = {
  ".pdf": "pdf",
  ".txt": "text",
  ".vtt": "vtt",
  ".srt": "vtt",
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!EXTENSION_TO_TYPE[ext]) {
    return cb(
      new Error(
        `Invalid source: unsupported file extension "${ext}". Allowed: ${Object.keys(EXTENSION_TO_TYPE).join(", ")}`,
      ),
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// List sources for a notebook — only if the notebook belongs to this user
router.get("/notebooks/:notebookId/sources", async (req, res) => {
  const notebook = await prisma.notebook.findUnique({
    where: { id: req.params.notebookId },
  });
  if (!notebook || notebook.userId !== currentUserId(req)) {
    return res
      .status(404)
      .json({ success: false, error: "Notebook not found" });
  }

  const sources = await prisma.source.findMany({
    where: { notebookId: req.params.notebookId },
    orderBy: { createdAt: "asc" },
  });
  res.json({ success: true, sources });
});

// Upload a file-based source: pdf / text / vtt (or srt)
router.post("/notebooks/:notebookId/sources/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Attach a file under field name "file".',
      });
    }

    const notebook = await prisma.notebook.findUnique({
      where: { id: req.params.notebookId },
    });
    if (!notebook || notebook.userId !== currentUserId(req)) {
      await fs.unlink(req.file.path).catch(() => {});
      return res
        .status(404)
        .json({ success: false, error: "Notebook not found" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const type = EXTENSION_TO_TYPE[ext];

    try {
      const source = await prisma.source.create({
        data: {
          notebookId: notebook.id,
          type,
          originalName: req.file.originalname,
          filePath: req.file.path,
          status: "uploading",
        },
      });

      await inngestClient.send({
        name: "source/index.requested",
        data: {
          sourceId: source.id,
        },
      });

      return res.status(202).json({ success: true, source });
    } catch (dbErr) {
      console.error("Failed to create source:", dbErr);
      return res
        .status(500)
        .json({ success: false, error: "Failed to create source" });
    }
  });
});

// Add a link-based source: website or youtube
router.post("/notebooks/:notebookId/sources/link", async (req, res) => {
  const { type, url } = req.body;

  if (!["website", "youtube"].includes(type)) {
    return res
      .status(400)
      .json({ success: false, error: '"type" must be "website" or "youtube"' });
  }
  if (typeof url !== "string" || url.trim().length === 0) {
    return res
      .status(400)
      .json({ success: false, error: '"url" must be a non-empty string' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ success: false, error: "Invalid URL" });
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: req.params.notebookId },
  });
  if (!notebook || notebook.userId !== currentUserId(req)) {
    return res
      .status(404)
      .json({ success: false, error: "Notebook not found" });
  }

  const source = await prisma.source.create({
    data: {
      notebookId: notebook.id,
      type,
      originalName: url,
      sourceUrl: url,
      status: "uploading",
    },
  });

  await inngestClient.send({
    name: "source/index.requested",
    data: {
      sourceId: source.id,
    },
  });

  res.status(202).json({ success: true, source });
});

// Remove a source — only if its parent notebook belongs to this user
router.delete("/sources/:id", async (req, res) => {
  const source = await prisma.source.findUnique({
    where: { id: req.params.id },
    include: { notebook: true },
  });

  if (!source || source.notebook.userId !== currentUserId(req)) {
    return res.status(404).json({ success: false, error: "Source not found" });
  }

  await deleteSourceVectors(source.id);

  if (source.filePath) {
    await fs.unlink(source.filePath).catch(() => {});
  }

  await prisma.source.delete({ where: { id: source.id } });

  res.json({ success: true });
});

// Re-index a source — only if its parent notebook belongs to this user
router.post("/sources/:id/reindex", async (req, res) => {
  const source = await prisma.source.findUnique({
    where: { id: req.params.id },
    include: { notebook: true },
  });

  if (!source || source.notebook.userId !== currentUserId(req)) {
    return res.status(404).json({ success: false, error: "Source not found" });
  }

  await prisma.source.update({
    where: { id: source.id },
    data: { status: "indexing", errorMessage: null },
  });

  await inngestClient.send({
    name: "source/index.requested",
    data: {
      sourceId: source.id,
    },
  });

  res.json({ success: true });
});

export default router;
