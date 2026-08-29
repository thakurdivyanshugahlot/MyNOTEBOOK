import "dotenv/config";
import { openai } from "../config/openai.js";

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const BATCH_SIZE = 100; // OpenAI embeddings endpoint accepts an array directly

/**
 * Generates embeddings for an array of texts, batching to stay within
 * request limits. Returns vectors in the same order as the input.
 */
export async function generateEmbeddings(texts) {
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    results.push(...response.data.map((d) => d.embedding));
  }

  return results;
}
