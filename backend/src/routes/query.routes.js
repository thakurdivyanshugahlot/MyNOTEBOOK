import { Router } from "express";
import "dotenv/config";
import { v4 as uuidv4 } from "uuid";

import { prisma } from "../config/prisma.js";
import { currentUserId } from "../middleware/auth.js";
import { inngestClient } from "../inngest/client.js";
import { queryChannel } from "../inngest/function/channels.js";

const router = Router();

const TOP_K = Number(process.env.RETRIEVAL_TOP_K || 6);

router.post("/notebooks/:notebookId/query", async (req, res) => {
  const { notebookId } = req.params;
  const { query } = req.body;

  if (typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input: "query" must be a non-empty string.',
    });
  }

  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
  });

  if (!notebook || notebook.userId !== currentUserId(req)) {
    return res.status(404).json({
      success: false,
      error: "Notebook not found",
    });
  }

  try {
    const requestId = uuidv4();

    const channel = queryChannel({
      requestId,
    });

    // Server-side realtime token.
    const realtimeToken = await inngestClient.realtime.token({
  channel,
  topics: ["token", "done", "error"],
});

    await inngestClient.send({
  name: "notebook/query.requested",
  data: {
    requestId,
    notebookId,
    query: query.trim(),
    topK: TOP_K,
  },
});

    return res.status(202).json({
  success: true,
  requestId,
  // Only send key + apiBaseUrl — never forward `channel`/`topics`,
  // since JSON.stringify strips the schema's `validate` function and
  // useRealtime would then trust this broken channel over its own local one.
  realtimeToken: {
    key: realtimeToken.key,
    apiBaseUrl: realtimeToken.apiBaseUrl,
  },
});
  } catch (err) {
    console.error("Failed to start query:", err);

    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Failed to start query",
    });
  }
});

export default router;