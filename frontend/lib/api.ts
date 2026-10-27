export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// --------------------------------------------------
// Auth bridge
// --------------------------------------------------

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(
  fn: () => Promise<string | null>,
) {
  tokenGetter = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = tokenGetter ? await tokenGetter() : null;

  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
}

// --------------------------------------------------
// Types
// --------------------------------------------------

export type SourceStatus =
  | "uploading"
  | "indexing"
  | "ready"
  | "failed";

export type SourceType =
  | "pdf"
  | "text"
  | "vtt"
  | "website"
  | "youtube";

export interface Source {
  id: string;
  notebookId: string;
  type: SourceType;
  originalName: string;
  sourceUrl: string | null;
  filePath: string | null;
  status: SourceStatus;
  chunkCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notebook {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sources: number;
  };
  sources?: Source[];
}

export interface Citation {
  index: number;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  snippet: string;
  startPage: number | null;
  endPage: number | null;
  startTime: number | null;
  startTimestamp: string | null;
  endTimestamp: string | null;
}

// --------------------------------------------------
// Query / Inngest Realtime
// --------------------------------------------------

export interface RealtimeToken {
  key: string;
  apiBaseUrl: string;
}

export interface QuerySession {
  requestId: string;
  realtimeToken: RealtimeToken;
}

// --------------------------------------------------
// Generic response handler
// --------------------------------------------------

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new Error(
      data.error || `Request failed (${res.status})`,
    );
  }

  return data;
}

// --------------------------------------------------
// Notebooks
// --------------------------------------------------

export async function listNotebooks(): Promise<Notebook[]> {
  const res = await fetch(`${API_URL}/notebooks`, {
    headers: await authHeaders(),
  });

  const data = await handle<{ notebooks: Notebook[] }>(
    res,
  );

  return data.notebooks;
}

export async function createNotebook(
  name: string,
): Promise<Notebook> {
  const res = await fetch(`${API_URL}/notebooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ name }),
  });

  const data = await handle<{ notebook: Notebook }>(res);

  return data.notebook;
}

export async function renameNotebook(
  id: string,
  name: string,
): Promise<Notebook> {
  const res = await fetch(`${API_URL}/notebooks/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    body: JSON.stringify({ name }),
  });

  const data = await handle<{ notebook: Notebook }>(res);

  return data.notebook;
}

export async function deleteNotebook(
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/notebooks/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  await handle(res);
}

export async function getNotebook(
  id: string,
): Promise<Notebook> {
  const res = await fetch(`${API_URL}/notebooks/${id}`, {
    headers: await authHeaders(),
  });

  const data = await handle<{ notebook: Notebook }>(res);

  return data.notebook;
}

// --------------------------------------------------
// Sources
// --------------------------------------------------

export async function listSources(
  notebookId: string,
): Promise<Source[]> {
  const res = await fetch(
    `${API_URL}/notebooks/${notebookId}/sources`,
    {
      headers: await authHeaders(),
    },
  );

  const data = await handle<{ sources: Source[] }>(res);

  return data.sources;
}

export async function uploadFileSource(
  notebookId: string,
  file: File,
): Promise<Source> {
  const formData = new FormData();

  formData.append("file", file);

  const res = await fetch(
    `${API_URL}/notebooks/${notebookId}/sources/upload`,
    {
      method: "POST",
      headers: await authHeaders(),
      // Don't manually set Content-Type.
      // Browser sets multipart boundary automatically.
      body: formData,
    },
  );

  const data = await handle<{ source: Source }>(res);

  return data.source;
}

export async function addLinkSource(
  notebookId: string,
  type: "website" | "youtube",
  url: string,
): Promise<Source> {
  const res = await fetch(
    `${API_URL}/notebooks/${notebookId}/sources/link`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        type,
        url,
      }),
    },
  );

  const data = await handle<{ source: Source }>(res);

  return data.source;
}

export async function deleteSource(
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/sources/${id}`, {
    method: "DELETE",
    headers: await authHeaders(),
  });

  await handle(res);
}

export async function reindexSource(
  id: string,
): Promise<void> {
  const res = await fetch(`${API_URL}/sources/${id}/reindex`, {
    method: "POST",
    headers: await authHeaders(),
  });

  await handle(res);
}

// --------------------------------------------------
// Start query
//
// IMPORTANT:
// This does NOT stream.
// It starts the Inngest workflow and returns the
// request ID + client-safe Realtime token.
// --------------------------------------------------

export async function startQuery(
  notebookId: string,
  query: string,
): Promise<QuerySession> {
  const res = await fetch(
    `${API_URL}/notebooks/${notebookId}/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await authHeaders()),
      },
      body: JSON.stringify({
        query,
      }),
    },
  );

  const data = await handle<{
    success: true;
    requestId: string;
    realtimeToken: RealtimeToken;
  }>(res);

  return {
    requestId: data.requestId,
    realtimeToken: data.realtimeToken,
  };
}

// --------------------------------------------------
// Fresh realtime token
//
// Called by useRealtime's token factory on mount and on
// every reconnect, so the WebSocket never reuses a stale
// token.
// --------------------------------------------------

export async function getRealtimeToken(
  notebookId: string,
  requestId: string,
): Promise<RealtimeToken> {
  const res = await fetch(
    `${API_URL}/notebooks/${notebookId}/query/${requestId}/token`,
    {
      method: "POST",
      headers: await authHeaders(),
    },
  );

  const data = await handle<{
    success: true;
    key: string;
    apiBaseUrl: string;
  }>(res);

  return {
    key: data.key,
    apiBaseUrl: data.apiBaseUrl,
  };
}