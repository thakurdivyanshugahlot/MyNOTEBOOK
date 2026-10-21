import "dotenv/config";
import { openai } from "../config/openai.js";
import { generateEmbeddings } from "./embedding.service.js";
import { qdrantClient, COLLECTION_NAME } from "../config/qdrant.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o";
const RRF_K = 60;
const SEARCH_LIMIT_MULTIPLIER = 2;

export async function queryRewriting(query) {
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "query_rewriting",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            stepBack: {
              type: "string",
              description:
                "A broader, higher-level 'step-back' question whose answer gives useful background for the original query.",
            },
            rewritten: {
              type: "string",
              description:
                "The original query with spelling/grammar fixed and made clear and self-contained. Preserve the original intent.",
            },
            subQueries: {
              type: "array",
              description:
                "Exactly 3 focused sub-questions the original query can be decomposed into.",
              items: { type: "string" },
            },
          },
          required: ["stepBack", "rewritten", "subQueries"],
        },
      },
    },
    messages: [
      {
        role: "system",
        content:
          "You are a query understanding assistant for a retrieval system. " +
          "Given a user's question, produce query variants that help retrieve relevant documents. " +
          "Apply three techniques: (1) step-back prompting -> one broader background question; " +
          "(2) query rewriting -> fix typos/grammar and make the query explicit and self-contained; " +
          "(3) sub-query decomposition -> break the query into exactly 3 focused sub-questions. " +
          "Respond ONLY with the structured JSON.",
      },
      { role: "user", content: query },
    ],
  });

  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

  return {
    stepBack: typeof parsed.stepBack === "string" ? parsed.stepBack : "",
    rewritten:
      typeof parsed.rewritten === "string" && parsed.rewritten.trim().length > 0
        ? parsed.rewritten
        : query,
    subQueries: Array.isArray(parsed.subQueries)
      ? parsed.subQueries
          .filter((item) => typeof item === "string" && item.trim().length > 0)
          .slice(0, 3)
      : [],
  };
}

export async function generateHyDE(query) {
  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You are a helpful assistant that generates a short hypothetical passage that could answer the user's question. " +
          "Write only the passage, without citations, source metadata, or any explanation of the process.",
      },
      {
        role: "user",
        content: `Write a concise document-style passage that answers this question:\n\n${query}`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}

export async function buildQueryVariants(query) {
  const rewritten = await queryRewriting(query);
  const hyde = await generateHyDE(rewritten.rewritten);

  return {
    originalQuery: query,
    rewritten: rewritten.rewritten,
    stepBack: rewritten.stepBack,
    subQueries: rewritten.subQueries,
    hyde,
    variants: [
      rewritten.rewritten,
      rewritten.stepBack,
      hyde,
      ...rewritten.subQueries,
    ],
  };
}

function rankByReciprocalRankFusion(searchResults) {
  const merged = new Map();

  for (const resultSet of searchResults) {
    for (let rank = 0; rank < resultSet.length; rank += 1) {
      const result = resultSet[rank];
      const id = String(result.id);
      const score = 1 / (RRF_K + rank + 1);

      if (!merged.has(id)) {
        merged.set(id, {
          id,
          payload: result.payload,
          originalScores: [result.score ?? 0],
          rrfScore: 0,
          topRank: rank + 1,
        });
      }

      const current = merged.get(id);
      current.rrfScore += score;
      current.originalScores.push(result.score ?? 0);
      current.topRank = Math.min(current.topRank, rank + 1);
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    if (b.rrfScore !== a.rrfScore) return b.rrfScore - a.rrfScore;
    const aAvg =
      a.originalScores.reduce((sum, v) => sum + v, 0) / a.originalScores.length;
    const bAvg =
      b.originalScores.reduce((sum, v) => sum + v, 0) / b.originalScores.length;
    return bAvg - aAvg;
  });
}

export async function retrieveRelevantChunks({ notebookId, variants, topK }) {
  const uniqueVariants = Array.from(
    new Set(
      variants.filter(
        (text) => typeof text === "string" && text.trim().length > 0,
      ),
    ),
  );

  if (uniqueVariants.length === 0) {
    return [];
  }

  const embeddings = await generateEmbeddings(uniqueVariants);
  const searchLimit = Math.max(topK * SEARCH_LIMIT_MULTIPLIER, 6);

  // qdrantClient.search() was removed in @qdrant/js-client-rest 1.19+.
  // query() takes `query` instead of `vector` and returns { points: [...] }.
  const searchResults = await Promise.all(
    uniqueVariants.map(async (_, i) => {
      const response = await qdrantClient.query(COLLECTION_NAME, {
        query: embeddings[i],
        limit: searchLimit,
        filter: { must: [{ key: "notebookId", match: { value: notebookId } }] },
        with_payload: true,
      });
      return response.points;
    }),
  );

  const merged = rankByReciprocalRankFusion(searchResults);
  return merged.slice(0, topK).map((item) => ({
    text: item.payload.text,
    sourceId: item.payload.sourceId,
    sourceName: item.payload.sourceName,
    sourceType: item.payload.sourceType,
    sourceUrl: item.payload.sourceUrl,
    chunkIndex: item.payload.chunkIndex,
    startPage: item.payload.startPage,
    endPage: item.payload.endPage,
    startTime: item.payload.startTime,
    startTimestamp: item.payload.startTimestamp,
    endTimestamp: item.payload.endTimestamp,
    score:
      item.originalScores.reduce((sum, v) => sum + v, 0) /
      item.originalScores.length,
  }));
}