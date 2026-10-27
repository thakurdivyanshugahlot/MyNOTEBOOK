import { inngestClient } from "../client.js";

import { queryChannel } from "./channels.js";

import {
  buildQueryVariants,
  retrieveRelevantChunks,
} from "../../services/query.service.js";

import { streamGroundedAnswer } from "../../services/chat.service.js";

export const queryNotebook = inngestClient.createFunction(
  {
    id: "query-notebook",
    retries: 3,
    triggers: [{ event: "notebook/query.requested" }],
  },
  async ({ event, step }) => {
    const { notebookId, query, requestId, topK } = event.data;

    const channel = queryChannel({ requestId });
    const normalizedQuery = query.trim();

    // 1. Build query variants
    const variantPlan = await step.run("build-query-variants", async () => {
      return buildQueryVariants(normalizedQuery);
    });

    // 2. Retrieve relevant chunks
    const chunks = await step.run("retrieve-relevant-chunks", async () => {
      return retrieveRelevantChunks({
        notebookId,
        variants: variantPlan.variants,
        topK,
      });
    });

    // 3. No relevant chunks
    if (chunks.length === 0) {
      await step.run("publish-empty-answer", async () => {
        await inngestClient.realtime.publish(channel.token, {
          content:
            "I couldn't find anything in this notebook's sources that answers that question.",
        });
      });

      await step.realtime.publish("query-done", channel.done, {
        citations: [],
      });

      return { notebookId, query: normalizedQuery, chunksFound: 0 };
    }

    // 4. Stream the grounded answer inside ONE step, so it runs once
    const result = await step.run("generate-answer", async () => {
      let citations = [];
      let errorMessage = null;

      // Send tokens in small batches instead of one HTTP call per token
      let buffer = "";
      let lastFlush = Date.now();

      const flush = async () => {
        if (!buffer) return;
        const content = buffer;
        buffer = "";
        lastFlush = Date.now();
        await inngestClient.realtime.publish(channel.token, { content });
      };

      await streamGroundedAnswer({
        query: normalizedQuery,
        chunks,
        writeEvent: async (payload) => {
          if (payload.type === "token") {
            buffer += payload.content;
            if (buffer.length >= 30 || Date.now() - lastFlush >= 150) {
              await flush();
            }
          } else if (payload.type === "done") {
            await flush();
            citations = payload.citations ?? [];
          } else if (payload.type === "error") {
            await flush();
            errorMessage = payload.message ?? "Query failed";
          }
        },
      });

      await flush();
      return { citations, errorMessage };
    });

    // 5. Durable final events, published after the streaming step finishes
    if (result.errorMessage) {
      await step.realtime.publish("query-error", channel.error, {
        message: result.errorMessage,
      });
    } else {
      await step.realtime.publish("query-done", channel.done, {
        citations: result.citations,
      });
    }

    return {
      notebookId,
      originalQuery: variantPlan.originalQuery,
      rewrittenQuery: variantPlan.rewritten,
      stepBackQuery: variantPlan.stepBack,
      subQueries: variantPlan.subQueries,
      hydeText: variantPlan.hyde,
      chunksFound: chunks.length,
    };
  },
);