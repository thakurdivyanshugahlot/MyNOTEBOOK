# MyNOTEBOOK — AI Research Assistant

A NotebookLM-style app: create notebooks, add sources (PDF, plain text, website URL,
YouTube video, VTT/transcript), and ask grounded questions with citations back to
the relevant page, timestamp, or excerpt. Sign in with Clerk to keep notebooks
private to your account.

```
MyNOTEBOOK/
├── backend/     Express API + Inngest workflows + Qdrant + SQLite (Prisma)
└── frontend/    Next.js (App Router) UI
```

## Architecture

**User flow:**
1. Sign in or create an account with Clerk.
2. Create a notebook, then open it to manage its sources and ask questions.
3. Add a PDF, text file, VTT/SRT transcript, website URL, or YouTube URL. Files
   are limited to 50 MB. The source list refreshes while a source is being indexed.
4. Once a source is ready, ask a question. The answer streams into the chat and
   citation badges open the cited excerpt, page, or timestamp.

**Ingestion (async via Inngest):**
```
Upload/link → authenticated API creates a source row (status: uploading)
            → event "source/index.requested" sent to Inngest
            → indexSource marks it indexing, parses and chunks the content
            → OpenAI creates embeddings; chunks are stored in Qdrant
            → source status becomes ready (or failed, with an error message)
```

**Querying (async + streamed via Inngest realtime):**
```
Question → authenticated API validates it and sends "notebook/query.requested"
         → queryNotebook rewrites and expands the question, including HyDE
         → searches Qdrant for each variant, filtered to this notebook
         → reciprocal rank fusion selects the most relevant chunks
         → OpenAI streams an answer grounded in those chunks
         → Inngest Realtime sends answer tokens and a final event with citations
```

Inngest runs indexing and query workflows with retries and realtime events. Run
its local development server alongside the API when developing locally.

**Notebook isolation:** every vector stored in Qdrant carries a `notebookId`
in its payload, and every search filters on it. The API also scopes notebooks
and sources to the signed-in Clerk user.

## Source viewer — what "click a citation" does per type

| Type | Behavior |
|---|---|
| YouTube | Opens the video in a new tab with `&t=<seconds>s` at the cited moment |
| Website | Opens the original URL in a new tab |
| PDF | Shows the cited excerpt and page number in a modal; it does not open an inline PDF viewer |
| Text / VTT | Shows the cited excerpt in a modal |

Websites and YouTube videos can be opened at their original URL or cited
timestamp. Uploaded files have no public URL, so the modal shows the excerpt
and any available page or timestamp metadata.

## Setup

### 1. Start Qdrant
```bash
cd backend
docker compose up -d
docker compose ps   # confirm Qdrant is "Up"
```

The compose file also starts Redis, but the current application flow uses
Inngest rather than Redis for its background workflows.

### 2. Backend and Inngest
```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
```

Create `backend/.env` from `.env.example` (PowerShell: `Copy-Item .env.example
.env`; macOS/Linux: `cp .env.example .env`) and set the required OpenAI and
Clerk credentials. `QDRANT_API_KEY` is only needed when your Qdrant instance
requires authentication. Create the upload directory if it does not exist
(PowerShell: `New-Item -ItemType Directory -Force uploads`; macOS/Linux:
`mkdir -p uploads`).

Start the API in one terminal:
```bash
npm start
```

Start the Inngest development server in another terminal, from `backend`:
```bash
npx --ignore-scripts=false inngest-cli@latest dev -u http://localhost:8000/api/inngest
```

### 3. Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env.local` from `.env.local.example` and set
`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to the publishable key for the same Clerk
application used by the backend. For example, in PowerShell use
`Copy-Item .env.local.example .env.local`; on macOS/Linux use
`cp .env.local.example .env.local`. Then start the frontend:
```bash
npm run dev         # http://localhost:3000
```

Open the frontend, sign in or sign up, create a notebook, add a source, and
wait for its status to become `ready` before asking questions.

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
| `CLERK_SECRET_KEY` | Clerk secret key used by the backend to validate authenticated requests |

**frontend/.env.local**
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL, e.g. `http://localhost:8000/api` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for frontend sign-in and session tokens |

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
| POST | `/api/notebooks/:id/query` | Validates input, returns a request ID and realtime token, and emits an Inngest query event |

All notebook and source routes require a valid Clerk session. The frontend
passes its session token to the backend as a bearer token.

## Known limitations

- Website parsing is a lightweight fetch + HTML-strip — pages that render
  content client-side via JS won't extract well (no headless browser).
- YouTube transcript fetch depends on the video having captions available;
  videos without any caption track can't be indexed.
- Citations for uploaded files show the excerpt in a modal; PDFs are not
  rendered in an inline page-anchored viewer.
