# PodBrain

**Don't just listen. Retain.**  
Turn podcasts into a personal, queryable second brain.

## Live Demo

[https://pod-brain-teal.vercel.app](https://pod-brain-teal.vercel.app)

This GitHub repo is intentionally linked to a **frontend-only demo** on Vercel for easy review.

## Product PRD

- [PodBrain PRD (English)](./docs/PRD.md)

## Why This Product

Podcast learning is high-volume but low-retention. Most people consume content and forget it quickly because there is no structured capture and retrieval loop.

PodBrain solves this by turning long audio into a memory workflow:

1. Extract ideas from podcast content.
2. Curate what actually matters.
3. Chat only on curated memory.

## Core Innovation

**Human-in-the-Loop RAG**

Most RAG systems store everything automatically, which introduces noise. PodBrain takes the opposite approach:

- AI drafts takeaways from transcript content.
- User edits/selects what is high-signal.
- Only selected takeaways are used as memory for retrieval.

This improves trust, precision, and answer quality.

## Product Experience

### 1. Extract

Paste a podcast link or audio URL. The system runs a staged pipeline with transparent loading states:

- Downloading audio
- Transcribing
- Extracting insights

### 2. Curate

Review takeaways in a dedicated RAG Builder:

- Check/uncheck memory items
- Delete low-value entries
- Keep a clean, intentional knowledge base

### 3. Chat

Ask questions in a ChatGPT-style workspace. Answers are grounded in selected memory entries.

## Demo Mode vs Live Mode

### Demo Mode (Public Vercel Link)

- No backend required
- No API key required
- Simulated parse/curate/chat behavior
- Best for portfolio and product storytelling

### Live Mode (Local Full Stack)

- Real FastAPI pipeline
- Real Whisper/GPT/Embedding calls
- SQLite + ChromaDB local persistence
- BYOK (Bring Your Own OpenAI Key)

## Tech Stack

- Frontend: Next.js (App Router), React, Tailwind CSS, Lucide
- Backend: FastAPI (optional for demo)
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
- Practical delivery strategy (demo-first, full-stack optional)
