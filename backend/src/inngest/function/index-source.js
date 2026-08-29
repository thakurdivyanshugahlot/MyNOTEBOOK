import "dotenv/config";

import fs from "fs/promises";
import crypto from "crypto";

import { inngestClient } from "../client.js";

import { prisma } from "../../config/prisma.js";

import {
  qdrantClient,
  COLLECTION_NAME,
  deleteSourceVectors,
} from "../../config/qdrant.js";

import { parseSource } from "../../parsers/parseSource.js";

import {
  chunkPlainText,
  chunkPlainTextWithPages,
  chunkSubtitleCues,
} from "../../utils/chunker.js";

import { generateEmbeddings } from "../../services/embedding.service.js";

// --------------------------------------------------
// Create a deterministic UUID for Qdrant points.
// This makes retries idempotent: the same chunk gets
// the same point ID instead of creating duplicates.
// --------------------------------------------------
function createChunkPointId(sourceId, chunkIndex) {
  const hash = crypto
    .createHash("sha256")
    .update(`${sourceId}:${chunkIndex}`)
    .digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join("-");
}

export const indexSource = inngestClient.createFunction(
  {
    id: "index-source",

    retries: 3,

    triggers: [
      {
        event: "source/index.requested",
      },
    ],
  },

  async ({ event, step }) => {
    const { sourceId } = event.data;

    // --------------------------------------------------
    // Validate event payload
    // --------------------------------------------------
    if (!sourceId) {
      throw new Error(
        `source/index.requested received without sourceId: ${JSON.stringify(
          event.data,
        )}`,
      );
    }

    // --------------------------------------------------
    // 1. Load source
    // Small object -> safe to persist as step output
    // --------------------------------------------------
    const source = await step.run("load-source", async () => {
      const source = await prisma.source.findUnique({
        where: {
          id: sourceId,
        },
      });

      if (!source) {
        throw new Error(`Source ${sourceId} not found`);
      }

      return source;
    });

    // --------------------------------------------------
    // 2. Mark source as indexing
    // --------------------------------------------------
    await step.run("mark-indexing", async () => {
      await prisma.source.update({
        where: {
          id: sourceId,
        },

        data: {
          status: "indexing",
          errorMessage: null,
        },
      });
    });

    // --------------------------------------------------
    // 3. Remove old vectors
    // Required for re-indexing
    // --------------------------------------------------
    await step.run("delete-old-vectors", async () => {
      await deleteSourceVectors(sourceId);
    });

    // --------------------------------------------------
    // 4. Parse -> chunk -> embed -> Qdrant
    //
    // IMPORTANT:
    // Large objects NEVER leave this step.
    //
    // We keep parsed/chunks/embeddings/points in memory
    // inside this step and only return a small result.
    // --------------------------------------------------
    const indexingResult = await step.run(
      "process-and-store",
      async () => {
        // ----------------------------------------------
        // Parse
        // ----------------------------------------------
        const parsed = await parseSource(source);

        // ----------------------------------------------
        // Chunk
        // ----------------------------------------------
        const chunks =
          parsed.type === "subtitle"
            ? chunkSubtitleCues(parsed.cues)
            : parsed.pageTexts
              ? chunkPlainTextWithPages(parsed.pageTexts)
              : chunkPlainText(parsed.text);

        if (chunks.length === 0) {
          throw new Error(
            `No extractable content found in "${source.originalName}"`,
          );
        }

        console.log(
          `[Indexing] Source ${sourceId}: ${chunks.length} chunks created`,
        );

        // ----------------------------------------------
        // Embed + store in batches
        // ----------------------------------------------
        const BATCH_SIZE = Number(
          process.env.EMBEDDING_BATCH_SIZE || 50,
        );

        let indexedCount = 0;

        for (
          let start = 0;
          start < chunks.length;
          start += BATCH_SIZE
        ) {
          const batch = chunks.slice(
            start,
            start + BATCH_SIZE,
          );

          console.log(
            `[Indexing] Source ${sourceId}: processing chunks ${
              start + 1
            }-${Math.min(start + BATCH_SIZE, chunks.length)} of ${
              chunks.length
            }`,
          );

          // --------------------------------------------
          // Generate embeddings only for this batch
          // --------------------------------------------
          const embeddings = await generateEmbeddings(
            batch.map((chunk) => chunk.text),
          );

          if (embeddings.length !== batch.length) {
            throw new Error(
              `Embedding count mismatch: received ${embeddings.length} embeddings for ${batch.length} chunks`,
            );
          }

          // --------------------------------------------
          // Create Qdrant points
          // --------------------------------------------
          const points = batch.map((chunk, index) => {
            const chunkIndex =
              chunk.metadata?.chunkIndex ?? start + index;

            return {
              id: createChunkPointId(
                source.id,
                chunkIndex,
              ),

              vector: embeddings[index],

              payload: {
                notebookId: source.notebookId,

                sourceId: source.id,

                sourceName: source.originalName,

                sourceType: source.type,

                sourceUrl: source.sourceUrl ?? null,

                text: chunk.text,

                chunkIndex,

                startPage:
                  chunk.metadata?.startPage ?? null,

                endPage:
                  chunk.metadata?.endPage ?? null,

                startTime:
                  chunk.metadata?.startTime ?? null,

                endTime:
                  chunk.metadata?.endTime ?? null,

                startTimestamp:
                  chunk.metadata?.startTimestamp ?? null,

                endTimestamp:
                  chunk.metadata?.endTimestamp ?? null,
              },
            };
          });

          // --------------------------------------------
          // Upsert this batch
          // --------------------------------------------
          await qdrantClient.upsert(
            COLLECTION_NAME,
            {
              points,
            },
          );

          indexedCount += points.length;
        }

        console.log(
          `[Indexing] Source ${sourceId}: ${indexedCount} chunks indexed successfully`,
        );

        // IMPORTANT:
        // Return ONLY small metadata.
        return {
          chunksIndexed: indexedCount,
        };
      },
    );

    // --------------------------------------------------
    // 5. Mark source as ready
    // --------------------------------------------------
    await step.run("mark-source-ready", async () => {
      await prisma.source.update({
        where: {
          id: sourceId,
        },

        data: {
          status: "ready",
          chunkCount: indexingResult.chunksIndexed,
          errorMessage: null,
        },
      });
    });

    // --------------------------------------------------
    // 6. Delete uploaded local file
    // --------------------------------------------------
    if (source.filePath) {
      await step.run("cleanup-uploaded-file", async () => {
        await fs.unlink(source.filePath).catch(() => {});
      });
    }

    // --------------------------------------------------
    // Final result
    // Small output only
    // --------------------------------------------------
    return {
      sourceId,

      chunksIndexed:
        indexingResult.chunksIndexed,
    };
  },
);