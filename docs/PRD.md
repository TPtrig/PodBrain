# PodBrain Product Requirements Document (PRD)

- Version: 1.0
- Date: March 4, 2026
- Owner: PodBrain Team
- Status: MVP / Portfolio Release

## 1. Product Summary

PodBrain is an AI-powered podcast knowledge workspace designed to improve learning retention.

Instead of saving all auto-generated content into a vector database, PodBrain introduces a **Human-in-the-Loop RAG** flow:

1. Extract transcript insights from podcast audio.
2. Let users curate and control which takeaways are worth keeping.
3. Allow chat retrieval only from curated memory.

This gives users a more trustworthy and higher-signal knowledge assistant.

## 2. Problem Statement

Podcast consumption is high, but practical retention is low. Users often:

- Forget details after listening.
- Lose actionable insights across episodes.
- Distrust generic AI summaries and hallucinated answers.

Traditional RAG pipelines store everything automatically, which increases noise and weakens retrieval quality.

## 3. Goals and Non-Goals

### 3.1 Goals

- Enable users to complete an end-to-end loop in minutes:
  - Ingest -> Extract -> Curate -> Chat
- Improve answer quality by grounding responses in curated memory only.
- Deliver a portfolio-ready demo that clearly communicates product value.
- Keep full-stack live mode available for local technical validation.

### 3.2 Non-Goals (MVP)

- Multi-user collaboration and role permissions.
- Cloud-scale data sync.
- Billing and subscription management.
- Enterprise observability and SLA guarantees.

## 4. Target Users and JTBD

### 4.1 Primary Users

- Knowledge workers
- Product managers
- Founders and operators
- Lifelong learners who consume long-form audio

### 4.2 Jobs-to-be-Done

- "When I listen to podcasts, I want to keep only high-value insights so I can reuse them later."
- "When I ask follow-up questions, I want answers based only on what I explicitly kept."

## 5. Core Value Proposition

- **Signal over noise**: curation before vectorization.
- **Trust by design**: grounded answers with explicit fallback when context is missing.
- **Simple workflow**: one workspace for parsing, filtering, and asking.

## 6. Key User Flows

### 6.1 Ingestion and Parsing

1. User opens a conversation.
2. User pastes a podcast URL or direct audio link.
3. System displays staged processing states and rotating tips.
4. System returns transcript-derived takeaways.

### 6.2 Curation (RAG Builder)

1. User reviews takeaway list.
2. User enables/disables or deletes items.
3. User saves selected items into "My Brain".

### 6.3 Chat

1. User asks a question in chat.
2. System retrieves from curated memory only.
3. If context is insufficient, assistant returns a safe fallback response.

## 7. Functional Requirements

### FR-1 Conversation Workspace

- Create and switch conversations.
- Auto-title conversations based on content.
- Persist messages in live mode.

### FR-2 Podcast Parsing UX

- Parse trigger from current conversation context.
- Display loading states and rotating "Podcast Trivia / AI Tips".
- Return transcript summary and takeaways.

### FR-3 RAG Builder

- Show extracted takeaways grouped by source podcast.
- Allow enable/disable and delete operations.
- Save selected takeaways to vector memory.

### FR-4 Grounded Chat

- Use RAG retrieval from curated memory only.
- Return answer + optional evidence snippets.
- Return fallback "I don't know based on your saved takeaways." when needed.

### FR-5 Demo and Live Modes

- Demo mode: fully runnable without backend.
- Live mode: integrated with FastAPI + OpenAI + SQLite + ChromaDB.

## 8. Non-Functional Requirements

- Fast first-load experience for demo reviewers.
- Clear visual state feedback during async processing.
- Local-only key usage pattern (BYOK) in live mode.
- Reliable local deployment on standard developer laptops.

## 9. Success Metrics

### Product Metrics

- End-to-end completion rate (ingest -> curate -> chat).
- Average curated takeaways per parsed episode.
- Percentage of chat answers grounded by selected memory.

### Demo/Portfolio Metrics

- Demo link visit-to-interaction rate.
- Time to first successful interaction.
- Recruiter/interviewer qualitative feedback on clarity and differentiation.

## 10. Risks and Mitigations

- Risk: Auto-extracted takeaways are noisy.
  - Mitigation: Human curation is mandatory before long-term memory usage.
- Risk: Demo capability misunderstood as full production system.
  - Mitigation: Explicit README labeling for Demo Mode vs Live Mode.
- Risk: Live-mode infra complexity for reviewers.
  - Mitigation: Frontend-only Vercel demo remains primary evaluation path.

## 11. Release Scope

### In Scope (MVP)

- ChatGPT-style workspace UI
- Parse loading experience
- Global RAG Builder controls
- Demo mode on Vercel
- Local full-stack run instructions

### Out of Scope (MVP)

- Team workspaces
- Cross-device cloud sync
- Native mobile apps
- Fine-grained analytics dashboard

## 12. Technical Implementation Notes

### Demo Mode

- Frontend-only behavior with simulated parsing/chat outcomes.
- No backend dependency.
- Suitable for low-cost public showcase deployment.

### Live Mode

- Backend: FastAPI
- AI: OpenAI APIs (Whisper, GPT-4o-mini, embeddings)
- Storage: SQLite + ChromaDB
- Architecture: async task processing + polling + retrieval-based chat

## 13. Future Iteration Ideas

- Edit takeaway text inline and sync updates to memory.
- Add source timestamps and citation jump points.
- Add topic clustering across episodes.
- Export curated memory to Notion/Markdown.
- Add personalized weekly review digest.

---

## Appendix: Positioning Statement

PodBrain is not "just another podcast summarizer." It is a memory quality system: users decide what becomes knowledge, and AI only answers from that approved memory base.
