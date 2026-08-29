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
  triggers: [{event: "notebook/query.requested"}],
  },
  async ({ event, step }) => {
    const {
      notebookId,
      query,
      requestId,
      topK,
    } = event.data;

    const channel = queryChannel({
      requestId,
    });

    const normalizedQuery = query.trim();

    // 1. Build query variants
    const variantPlan = await step.run(
      "build-query-variants",
      async () => {
        return buildQueryVariants(normalizedQuery);
      },
    );

    // 2. Retrieve relevant chunks
    const chunks = await step.run(
      "retrieve-relevant-chunks",
      async () => {
        return retrieveRelevantChunks({
          notebookId,
          variants: variantPlan.variants,
          topK,
        });
      },
    );

    // 3. No relevant chunks
    if (chunks.length === 0) {
      await inngestClient.realtime.publish(
        channel.token,
        {
          content:
            "I couldn't find anything in this notebook's sources that answers that question.",
        },
      );

      await step.realtime.publish(
        "query-done",
        channel.done,
        {
          citations: [],
        },
      );

      return {
        notebookId,
        query: normalizedQuery,
        chunksFound: 0,
      };
    }

    // 4. Stream grounded answer
    await streamGroundedAnswer({
      query: normalizedQuery,
      chunks,

      writeEvent: async (payload) => {
        if (payload.type === "token") {
          // High-frequency token streaming:
          // intentionally non-durable
          await inngestClient.realtime.publish(
            channel.token,
            {
              content: payload.content,
            },
          );
        }

        if (payload.type === "done") {
          // Final result: durable
          await step.realtime.publish(
            "query-done",
            channel.done,
            {
              citations: payload.citations ?? [],
            },
          );
        }

        if (payload.type === "error") {
          await step.realtime.publish(
            "query-error",
            channel.error,
            {
              message: payload.message ?? "Query failed",
            },
          );
        }
      },
    });

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