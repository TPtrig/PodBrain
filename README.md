# PodBrain

Build a second brain from podcasts with a Human-in-the-Loop RAG workflow.

PodBrain turns podcast audio into transcript insights, lets users curate high-signal takeaways, and then powers chat on top of curated memory only.

## Demo-First Strategy

This repository supports two modes:

- **Demo Mode (Recommended for portfolio / PM interviews):**
  - Frontend-only deployment on Vercel
  - No backend required
  - Simulated parse / curate / chat flow for product storytelling
- **Live Mode (Engineering/full feature mode):**
  - Frontend + FastAPI backend
  - Real transcription/extraction/embedding/RAG flow

## Tech Stack

- Frontend: Next.js (App Router), React, Tailwind CSS, Lucide
- Backend (optional for demo): Python, FastAPI
- AI Models (live mode): OpenAI Whisper, GPT-4o-mini, text-embedding-3-small
- Storage (live mode): SQLite + ChromaDB

## Repo Structure

- `frontend/` Next.js app
- `backend/` FastAPI API server

## 1) Deploy Demo to Vercel (No Backend Needed)

Use this when your goal is product showcase.

### Vercel Project Settings

- **Framework:** Next.js
- **Root Directory:** `frontend`
- **Environment Variables:**
  - `NEXT_PUBLIC_DEMO_MODE=true`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000` (placeholder; ignored in demo mode)

### Result

- App runs fully in demo mode on Vercel
- Parse/curate/chat UX is interactive without backend infra cost

## 2) Run Demo Locally

```bash
cd frontend
npm install
cp .env.example .env.local
# ensure NEXT_PUBLIC_DEMO_MODE=true
npm run dev
```

Open: [http://127.0.0.1:3000](http://127.0.0.1:3000)

## 3) Run Full Stack Locally (Optional)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (Live Mode)

```bash
cd frontend
npm install
cp .env.example .env.local
```

Set in `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_DEMO_MODE=false
```

Then run:

```bash
npm run dev
```

Open: [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Portfolio Positioning Tips

For PM interviews, emphasize:

- Problem framing: passive listening -> retained, queryable knowledge
- Product innovation: Human-in-the-Loop curation before vector memory
- UX choices: loading experience, curation controls, grounded chat behavior
- Delivery strategy: demo-first launch with optional full-stack mode

## Notes

- In demo mode, OpenAI key input is optional and no backend is required.
- In live mode, OpenAI key is required for parse/chat/save flows.
