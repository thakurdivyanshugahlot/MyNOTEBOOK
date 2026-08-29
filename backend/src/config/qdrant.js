import "dotenv/config";
import { QdrantClient } from "@qdrant/js-client-rest";

// --------------------------------------------------
// Environment validation
// --------------------------------------------------

if (!process.env.QDRANT_URL) {
  throw new Error("QDRANT_URL is missing from environment variables");
}

if (!process.env.QDRANT_API_KEY) {
  throw new Error("QDRANT_API_KEY is missing from environment variables");
}

// --------------------------------------------------
// Qdrant client
// --------------------------------------------------

export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// --------------------------------------------------
// Collection configuration
// --------------------------------------------------

export const COLLECTION_NAME =
  process.env.QDRANT_COLLECTION || "notebook_sources";

const VECTOR_SIZE = Number(process.env.EMBEDDING_DIM || 1536);

// --------------------------------------------------
// Ensure collection + payload indexes
// --------------------------------------------------

export async function ensureCollection() {
  const collections = await qdrantClient.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === COLLECTION_NAME,
  );

  if (!exists) {
    await qdrantClient.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: "Cosine",
      },
    });

    console.log(
      `Qdrant collection "${COLLECTION_NAME}" created (dim=${VECTOR_SIZE})`,
    );
  } else {
    console.log(
      `Qdrant collection "${COLLECTION_NAME}" already exists`,
    );
  }

  // These fields are used in your filtering queries.
  await ensurePayloadIndex("sourceId");
  await ensurePayloadIndex("notebookId");
}

// --------------------------------------------------
// Ensure a payload index exists
// --------------------------------------------------

async function ensurePayloadIndex(field) {
  try {
    await qdrantClient.createPayloadIndex(COLLECTION_NAME, {
      field_name: field,
      field_schema: "keyword",
    });

    console.log(`Qdrant payload index created for "${field}"`);
  } catch (err) {
    const message =
      err?.data?.status?.error ||
      err?.message ||
      "";

    // Index already exists → safe to ignore
    if (message.toLowerCase().includes("already exists")) {
      console.log(
        `Qdrant payload index for "${field}" already exists`,
      );

      return;
    }

    throw err;
  }
}

// --------------------------------------------------
// Delete vectors belonging to a source
// --------------------------------------------------

export async function deleteSourceVectors(sourceId) {
  await qdrantClient.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "sourceId",
          match: {
            value: sourceId,
          },
        },
      ],
    },
  });
}

// --------------------------------------------------
// Delete vectors belonging to a notebook
// --------------------------------------------------

export async function deleteNotebookVectors(notebookId) {
  await qdrantClient.delete(COLLECTION_NAME, {
    filter: {
      must: [
        {
          key: "notebookId",
          match: {
            value: notebookId,
          },
        },
      ],
    },
  });
}