import "dotenv/config";

import express from "express";
import cors from "cors";

import { serve } from "inngest/express";

import { inngestClient } from "./inngest/client.js";
import { functions } from "./inngest/index.js";

import notebookRoutes from "./routes/notebook.routes.js";
import sourceRoutes from "./routes/source.routes.js";
import queryRoutes from "./routes/query.routes.js";

import { ensureCollection } from "./config/qdrant.js";

import {
  clerkAuth,
  requireUser,
} from "./middleware/auth.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(clerkAuth);

app.use(
  "/api/inngest",
  serve({
    client: inngestClient,
    functions,
  }),
);

app.use("/api", requireUser, notebookRoutes);
app.use("/api", requireUser, sourceRoutes);
app.use("/api", requireUser, queryRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 8000;

async function bootstrap() {
  try {
    await ensureCollection();
  } catch (err) {
    console.error(
      "Failed to ensure Qdrant collection on startup:",
      err.message,
    );
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();