import { Router } from "express";
import fs from "fs/promises";
import { prisma } from "../config/prisma.js";
import { deleteNotebookVectors } from "../config/qdrant.js";
import { currentUserId } from "../middleware/auth.js";

const router = Router();

// List only this user's notebooks
router.get("/notebooks", async (req, res) => {
  const notebooks = await prisma.notebook.findMany({
    where: { userId: currentUserId(req) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sources: true } } },
  });
  res.json({ success: true, notebooks });
});

// Create a notebook, owned by this user
router.post("/notebooks", async (req, res) => {
  const { name } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: '"name" must be a non-empty string' });
  }

  const notebook = await prisma.notebook.create({
    data: { name: name.trim(), userId: currentUserId(req) },
  });
  res.status(201).json({ success: true, notebook });
});

// Get one notebook with its sources — only if it belongs to this user
router.get("/notebooks/:id", async (req, res) => {
  const notebook = await prisma.notebook.findUnique({
    where: { id: req.params.id },
    include: { sources: { orderBy: { createdAt: "asc" } } },
  });

  if (!notebook || notebook.userId !== currentUserId(req)) {
    return res.status(404).json({ success: false, error: "Notebook not found" });
  }
  res.json({ success: true, notebook });
});

// Rename a notebook — only if it belongs to this user
router.patch("/notebooks/:id", async (req, res) => {
  const { name } = req.body;

  if (typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: '"name" must be a non-empty string' });
  }

  const existing = await prisma.notebook.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== currentUserId(req)) {
    return res.status(404).json({ success: false, error: "Notebook not found" });
  }

  const notebook = await prisma.notebook.update({
    where: { id: req.params.id },
    data: { name: name.trim() },
  });
  res.json({ success: true, notebook });
});

// Delete a notebook (and everything inside it) — only if it belongs to this user
router.delete("/notebooks/:id", async (req, res) => {
  const notebook = await prisma.notebook.findUnique({
    where: { id: req.params.id },
    include: { sources: true },
  });

  if (!notebook || notebook.userId !== currentUserId(req)) {
    return res.status(404).json({ success: false, error: "Notebook not found" });
  }

  await deleteNotebookVectors(notebook.id);

  await Promise.all(
    notebook.sources.filter((s) => s.filePath).map((s) => fs.unlink(s.filePath).catch(() => {}))
  );

  await prisma.notebook.delete({ where: { id: notebook.id } });

  res.json({ success: true });
});

export default router;