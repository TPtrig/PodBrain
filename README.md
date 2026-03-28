# Inspiration

**Don’t just collect fragments. Compose them.**  
Turn multimodal inputs into curated memory, grounded answers, and proactive synthesis.

## Product Summary

`Inspiration` is the 2.0 evolution of `PodBrain`.

The product expands from podcast-first memory capture into an omni-channel knowledge agent for:

- podcasts
- long-form video
- text notes
- image-based fragments
- agent-driven synthesis workflows

It preserves the original Human-in-the-Loop RAG foundation while introducing:

- multimodal input
- Global RAG Builder
- Midnight Islands knowledge canvas
- Agent Inbox
- nightly knowledge graph generation
- serendipity prompts that reconnect new ideas to historical memory

## Product PRD

- [Inspiration 2.0 PRD](./docs/PRD.md)

## Why This Product

Modern knowledge work is fragmented across audio, video, notes, screenshots, and links.
Most people capture information in many places, but rarely convert it into reusable memory or synthesis.

Inspiration is designed to solve that through a five-part loop:

1. Extract ideas from podcast content.
2. Curate what actually matters across multimodal fragments.
3. Chat only on curated memory.
4. Generate knowledge structure through agents.
5. Surface hidden connections at the moment they become useful.

## Core Innovation

**Human-in-the-Loop RAG**

Most RAG systems store everything automatically, which introduces noise. Inspiration keeps the opposite principle:

- AI drafts takeaways from source content.
- User edits/selects what is high-signal.
- Only selected takeaways are used as memory for retrieval.

On top of that foundation, Inspiration adds an agent layer for:

- nightly clustering
- knowledge graph generation
- serendipity pushes
- inbox-based review of synthesis outputs

## Product Experience

### 1. Ingest

Use one intake surface for:

- media links
- text fragments
- image attachments

### 2. Curate

Review takeaways in a dedicated RAG Builder:

- Check/uncheck memory items
- Delete low-value entries
- Save only selected memory into the durable layer

### 3. Grounded Chat

Ask questions in a ChatGPT-style workspace. Answers are grounded in selected memory entries.

### 4. Synthesis

Review `Agent Inbox` outputs such as:

- nightly knowledge graphs
- serendipity prompts
- concept bridges across historical memory

## Demo Mode vs Live Mode

### Demo Mode (Public Vercel Link)

- No backend required
- No API key required
- Simulated parse/curate/chat/agent behavior
- Best for portfolio and product storytelling

### Live Mode (Local Full Stack)

- Real FastAPI parsing and retrieval pipeline
- Real Whisper/GPT/Embedding calls
- SQLite + ChromaDB local persistence
- Agent prompts and clustering interfaces available for continued productization

## Tech Stack

- Frontend: Next.js (App Router), React, Tailwind CSS, Lucide
- Backend: FastAPI
- AI (live mode): OpenAI Whisper, GPT-4o-mini, text-embedding-3-small
- Data (live mode): SQLite + ChromaDB

## Local Setup (Optional Full Stack)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
```

Set `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=false
```

Run frontend:

```bash
npm run dev
```

Open: [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Portfolio Context

This project was built as a product-focused AI MVP to demonstrate:

- Problem framing and product narrative
- Human-centered RAG design decisions
- End-to-end UX flow from ingestion to grounded chat
- Agent-driven knowledge synthesis and recall
- Practical delivery strategy (demo-first, full-stack optional)
