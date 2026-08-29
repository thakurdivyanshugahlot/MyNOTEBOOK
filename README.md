# MyNOTEBOOK — AI Research Assistant

A NotebookLM-style app: create notebooks, add sources (PDF, plain text, website URL,
YouTube video, VTT/transcript), and ask grounded questions with citations back to
the exact source.

```
MyNOTEBOOK/
├── backend/     Express API + Inngest workflows + Qdrant + SQLite (Prisma)
└── frontend/    Next.js (App Router) UI
```

## Architecture

**Ingestion (async via Inngest):**
```
Upload/Link → Source row created (status: uploading)
            → Inngest event "source/index.requested" sent
            → indexSource function starts (status: indexing)
                → parse (by type: pdf / text / vtt / website / youtube)
                → chunk (timestamp-aware for vtt/youtube, sliding-window for text/pdf/website)
                → embed (OpenAI text-embedding-3-small, 1536-dim)
                → upsert into Qdrant, tagged with notebookId + sourceId
            → status: ready (or failed, with errorMessage)
```

**Querying (async + streamed via Inngest realtime):**
```
User question
  → POST /api/notebooks/:id/query validates the input and sends "notebook/query.requested"
  → queryNotebook Inngest function rewrites and expands the question
  → it generates HyDE and embedding variants, then searches Qdrant filtered to the notebook
  → results are merged using reciprocal rank fusion and the best chunks are selected
  → the function uses the selected chunks as grounded context for the OpenAI answer
  → tokens are published back to the browser over SSE/realtime and a final "done" event carries citations
```

Why Inngest replaces the older worker queue: the app is event-driven, retries are built in, and the workflow model maps directly to long-running indexing and streaming query jobs without depending on Redis/BullMQ infrastructure.

**Notebook isolation:** every vector stored in Qdrant carries a `notebookId`
in its payload, and every search filters on it. One notebook's sources can
never leak into another's answers.

## Source viewer — what "click a citation" does per type

| Type | Behavior |
|---|---|
| YouTube | Opens the video in a new tab with `&t=<seconds>s` at the cited moment |
| Website | Opens the original URL in a new tab |
| PDF / Text / VTT | Shows the exact cited excerpt in a modal (these are uploaded files with no public URL to deep-link into) |

This is a deliberate scope decision for an assignment timeframe — a true inline
PDF-page-jump viewer (rendering the PDF in-browser and scrolling to the exact
page) is a reasonable v2 addition; for now the cited excerpt + source name is
shown directly, which still satisfies "never receive an answer without knowing
where it came from."

## Setup

### 1. Start Qdrant
```bash
cd backend
docker compose up -d
docker compose ps   # confirm Qdrant is "Up"
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# fill in OPENAI_API_KEY, QDRANT_API_KEY, and Clerk values in .env
npx prisma generate
npx prisma migrate dev --name init
mkdir -p uploads
```

Run the API:
```bash
npm start
```

For local Inngest development, point the dev server at the API endpoint:
```bash
npx inngest dev -u http://localhost:8000/api/inngest
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev         # http://localhost:3000
```

## Environment variables

**backend/.env**
| Var | Purpose |
|---|---|
| `PORT` | API port (default 8000) |
| `DATABASE_URL` | SQLite file path for Prisma, e.g. `file:./dev.db` |
| `QDRANT_URL` | Qdrant REST endpoint, e.g. `http://localhost:6333` |
| `QDRANT_API_KEY` | API key for Qdrant if your instance requires authentication |
| `QDRANT_COLLECTION` | Collection name for all source vectors |
| `OPENAI_API_KEY` | Used for embeddings + chat completions |
| `OPENAI_CHAT_MODEL` | Chat model for answers (default `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | Embedding model (default `text-embedding-3-small`, 1536-dim) |
| `EMBEDDING_DIM` | Must match the embedding model's output size |
| `UPLOAD_DIR` | Where uploaded files land before/while being parsed |
| `RETRIEVAL_TOP_K` | How many chunks to retrieve per query (default 6) |
| `CLERK_SECRET_KEY` | Backend Clerk secret used to validate authenticated requests |

**frontend/.env.local**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL, e.g. `http://localhost:8000/api` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend auth |
| `CLERK_SECRET_KEY` | Clerk secret key for server-side auth in the Next.js app |

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/notebooks` | List notebooks |
| POST | `/api/notebooks` | Create notebook `{ name }` |
| GET | `/api/notebooks/:id` | Get notebook + its sources |
| PATCH | `/api/notebooks/:id` | Rename `{ name }` |
| DELETE | `/api/notebooks/:id` | Delete notebook, its vectors, and its files |
| GET | `/api/notebooks/:id/sources` | List sources in a notebook |
| POST | `/api/notebooks/:id/sources/upload` | Upload pdf/text/vtt (`multipart/form-data`, field `file`) |
| POST | `/api/notebooks/:id/sources/link` | Add website/youtube (`{ type, url }`) |
| DELETE | `/api/sources/:id` | Remove a source (vectors + file + row) |
| POST | `/api/sources/:id/reindex` | Re-run indexing for a source |
| POST | `/api/notebooks/:id/query` | Validates input, creates a realtime token, and emits an Inngest query event to stream results |

## Known limitations (by design, given assignment scope)

- Website parsing is a lightweight fetch + HTML-strip — pages that render
  content client-side via JS won't extract well (no headless browser).
- YouTube transcript fetch depends on the video having captions available;
  videos without any caption track can't be indexed.
- Citation click for uploaded files (pdf/text/vtt) shows the excerpt inline
  rather than opening an inline page-anchored PDF viewer.
- No auth/multi-user support — this is a single-user local app.
