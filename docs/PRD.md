# Inspiration 2.0 Product Requirements Document (PRD)

- Version: 2.0
- Date: March 22, 2026
- Product Name: Inspiration
- Legacy Name: PodBrain
- Owner: Product / Design / AI Systems
- Status: Demo-complete, product-definition ready

## 1. Document Purpose

This PRD defines the full product framework for `PodBrain 2.0`, renamed to `Inspiration`.

It covers:

- product vision
- target users and usage scenarios
- user pain points and product solutions
- complete functional scope
- agent-driven capabilities
- current demo implementation scope
- features temporarily reduced or removed from the demo but still part of the intended product design

PRD is sufficient for aligning product scope, UX direction, system capability, and roadmap. If the team later needs execution-level documents, the next layer should be:

- UX spec / IA spec
- Technical design doc
- Delivery roadmap / milestone plan

## 2. Product Summary

Inspiration is an omni-channel personal knowledge agent for fragmented information.

Unlike the original PodBrain, which focused primarily on podcast ingestion and Human-in-the-Loop RAG, Inspiration expands the product into a broader knowledge operating system that can intake:

- podcasts
- long-form video links
- free text notes
- image-based fragments
- future multimodal media inputs

Its purpose is not only to store knowledge, but to actively synthesize it.

Core loop:

1. Ingest fragmented signals from multiple channels.
2. Extract draft memory from raw content.
3. Curate what becomes durable memory.
4. Answer and synthesize from selected memory.
5. Continuously restructure memory through agent-driven clustering and serendipity prompts.

## 3. Product Vision

### 3.1 Vision Statement

Inspiration helps users turn fragmented information into a living, evolving knowledge landscape.

### 3.2 Strategic Shift from PodBrain 1.0 to Inspiration 2.0

PodBrain 1.0 solved a narrow but clear problem:

- convert podcast listening into curated RAG memory

Inspiration 2.0 expands that into a broader product thesis:

- users no longer consume knowledge in one format
- insight is scattered across audio, video, notes, screenshots, and links
- memory systems should not only retrieve what was saved, but actively reveal hidden connections

### 3.3 Product Principle

Inspiration is not a passive archive. It is a proactive synthesis system.

## 4. Problem Statement

Modern knowledge workers face four compounding problems:

### 4.1 Fragmentation

Important ideas are spread across:

- podcasts
- YouTube or long video content
- copied text
- screenshots and image references
- ad hoc notes in chats or documents

There is no unified ingestion surface.

### 4.2 Low Retention

Users consume high volumes of information but fail to retain:

- actionable takeaways
- recurring themes
- cross-source patterns

### 4.3 Low Trust in AI Memory Systems

Most AI knowledge tools automatically store everything, creating:

- noisy vector memory
- weak retrieval precision
- hallucinated answers with unclear grounding

### 4.4 Lack of Serendipity

Traditional note tools store information, but rarely help users discover:

- hidden commonality across topics
- long-range connections between old and new ideas
- prompts for synthesis at the right time

## 5. Target Users

### 5.1 Primary Users

- product managers
- founders and operators
- researchers
- AI builders
- creators and long-form learners
- knowledge workers who capture ideas across multiple channels

### 5.2 Secondary Users

- students working with cross-format learning material
- solo professionals building personal knowledge systems
- technical users exploring AI-native note workflows

## 6. Jobs To Be Done

- "When I discover useful information in any format, I want to quickly capture it into one place without deciding the structure upfront."
- "When AI summarizes content for me, I want to decide what is worth keeping before it becomes memory."
- "When I revisit my knowledge base, I want AI to help me discover connections I would not have noticed myself."
- "When I ask a question, I want the answer grounded in what I explicitly kept."
- "When I type a new idea, I want the system to surface relevant historical memory at the exact moment it becomes useful."

## 7. Core Value Proposition

- Unified multimodal intake instead of format-specific capture
- Human-curated memory instead of indiscriminate storage
- Grounded chat instead of free-form hallucinated synthesis
- Nightly AI restructuring instead of static note accumulation
- Serendipitous prompts instead of passive search-only recall

## 8. Product Positioning

Inspiration sits at the intersection of:

- personal knowledge management
- multimodal ingestion
- Human-in-the-Loop RAG
- proactive AI agents

It is not:

- just a podcast summarizer
- just a note app
- just a chat interface on top of embeddings

It is a memory orchestration layer.

## 9. Product Framework

The product is organized into five major systems:

### 9.1 Omni-Input System

One unified intake surface for:

- external media links
- text fragments
- image attachments
- future multimodal uploads

### 9.2 Extraction System

Transforms raw media into:

- draft takeaways
- structured memory candidates
- metadata for retrieval and synthesis

### 9.3 Curation System

Allows users to:

- review draft memory
- enable or disable takeaways
- delete noise
- save only selected content into durable memory

### 9.4 Grounded Interaction System

Lets users:

- ask follow-up questions
- retrieve only from curated memory
- receive grounded responses with context traces

### 9.5 Synthesis and Agent Layer

Continuously restructures and activates knowledge via:

- nightly clustering
- knowledge graph generation
- serendipity prompts
- inbox-style surfacing of agent outputs

## 10. Main User Scenarios

### Scenario A: Capture from a long podcast or video

User pastes a link.
System parses content, drafts takeaways, and lets the user curate them.

Pain solved:

- users do not need to manually summarize long-form content
- memory stays selective instead of noisy

### Scenario B: Capture a quick text fragment or thought

User types a note or a rough idea into the input island.
System treats it as a fragment that can later be clustered into larger themes.

Pain solved:

- low-friction capture
- no forced categorization at input time

### Scenario C: Trigger contextual recall while typing

User types a new idea.
Serendipity agent recognizes a meaningful historical bridge and pushes an inbox item:

> 你现在关注的这个问题，和你三个月前存的一篇关于损失函数优化的笔记刚好能印证，要不要看看？

Pain solved:

- reduces forgotten historical knowledge
- activates old memory at the moment of need

### Scenario D: Morning or evening synthesis review

User opens the workspace and reviews newly generated knowledge graph outputs and synthesis insights in Agent Inbox.

Pain solved:

- users do not need to manually review all captured fragments
- product creates a higher-level map of what matters

### Scenario E: Ask grounded questions from selected memory

User asks a question inside chat.
System retrieves only from enabled memory.

Pain solved:

- trust
- explainability
- controllable retrieval quality

## 11. User Pain Points to Product Mapping

| User Pain | Product Response |
| --- | --- |
| Information is scattered across formats | Unified multimodal input island |
| I forget what I consumed | Draft takeaway extraction + durable memory |
| AI saves too much useless content | Human curation before durable memory |
| AI answers feel ungrounded | Global RAG Builder + grounded chat |
| My notes never connect to each other | Nightly clustering + knowledge graph |
| Old notes are hard to rediscover at the right time | Serendipity Push |
| Knowledge tools are visually cold and hard to scan | Midnight Islands canvas + Inbox metaphor |

## 12. Feature Set

### 12.1 Current Product-Level Features

#### F1. Conversation Workspace

- GPT-style left sidebar
- new thread creation
- conversation switching
- conversation-based chat history

#### F2. Multi-modal Input Island

- text input
- link input
- image attachment input
- parse and chat controls in one unified area

#### F3. Legacy Podcast Pipeline Compatibility

Must preserve:

- podcast URL resolution
- existing parsing task flow
- takeaway extraction flow
- RAG question-answering interfaces

#### F4. Global RAG Builder

- grouped takeaways by source
- enable / disable per takeaway
- delete source or takeaway
- save selected takeaways into durable memory

#### F5. Grounded Chat

- chat against curated memory
- context-aware answers
- fallback behavior when context is insufficient

#### F6. Midnight Islands Canvas

- right-side knowledge canvas
- one main island plus surrounding satellite islands
- click island to inspect related concept threads

#### F7. Agent Inbox

- inbox as a dedicated product surface
- unread state and red-dot count
- separate from Builder
- stores knowledge graph updates and serendipity pushes

#### F8. Nightly Knowledge Graph

- generated on schedule
- visualizes current knowledge structure
- transforms memory into a graph review artifact

#### F9. Serendipity Push

- triggered when user enters a new idea
- surfaces historically relevant stored memory
- presented as inbox content instead of transient tooltip only

## 13. Agent Architecture

Inspiration introduces an agent layer above raw RAG.

### 13.1 Parsing Agent

Role:

- normalize source input
- parse media
- return draft memory candidates

### 13.2 Curation Agent

Role:

- assist the user in reviewing memory candidates
- keep the final control with the user

### 13.3 Grounding Agent

Role:

- retrieve from curated memory only
- enforce answer boundedness

### 13.4 Nightly Synthesis Agent

Role:

- cluster the day’s fragmented inputs
- generate hidden commonality
- generate the next knowledge graph payload

Current prompt asset:

- `backend/prompts.py`
- `AUTO_CLUSTER_SYSTEM_PROMPT`

### 13.5 Serendipity Agent

Role:

- watch current user input
- match it against historical memory
- produce one concise, high-signal prompt

Current prompt asset:

- `backend/prompts.py`
- `SERENDIPITY_SYSTEM_PROMPT`

## 14. Functional Requirements

### FR-1 Unified Intake

- The product must support text, image, and external media links from one intake area.
- The system must distinguish between parsing flows and chat flows.

### FR-2 Backward Compatibility

- Existing podcast URL parsing must remain available.
- Existing task polling APIs must remain available.
- Existing RAG interfaces must remain available.

### FR-3 Draft Memory Generation

- The system must generate draft takeaways from ingested content.
- Draft takeaways must remain editable and selectable prior to durable storage.

### FR-4 Durable Memory Curation

- Only selected takeaways should become durable memory.
- Users must be able to disable or delete items after creation.

### FR-5 Grounded Retrieval

- Chat answers must use curated memory only.
- The system must return safe fallback language when memory is insufficient.

### FR-6 Knowledge Graph Output

- The system must generate a graph-style synthesis output on a schedule.
- The graph must show cluster nodes and semantic relationships.
- The graph must be reviewable inside Agent Inbox.

### FR-7 Serendipity Push

- The system must inspect live input for semantic overlap with stored memory.
- The system must generate one concise suggestion when overlap is meaningful.
- Push output must be stored in Agent Inbox with unread state.

### FR-8 Agent Inbox

- Inbox must be a standalone panel, separate from Builder.
- Inbox must display unread counts.
- Inbox must clearly separate graph items from serendipity items.

### FR-9 Demo / Live Mode Separation

- Demo mode must work without backend dependency.
- Live mode must continue to support FastAPI + SQLite + Chroma + OpenAI APIs.

## 15. Demo Scope vs Full Product Vision

This section is critical.

The shipped demo is intentionally optimized for product storytelling, not full production behavior.

### 15.1 Implemented in Demo

- fixed midnight visual system
- left conversation sidebar
- multimodal intake UI
- Builder with live takeaway controls
- grounded chat demo flow
- Midnight Islands canvas
- Agent Inbox panel
- preset knowledge graph and serendipity experience
- mock parsing and clustering for demo-safe performance

### 15.2 Reduced or Mocked in Demo

- real multimodal parsing at scale
- full audio/video understanding quality
- stable cloud scheduler
- persistent production-grade inbox history
- production-grade auth and sync

### 15.3 Features Previously Designed but Reduced or Removed for Demo Simplicity

These remain part of the intended product definition even if they were partially removed, simplified, or replaced in the current demo:

#### A. Smart Trivia Loader

Original intent:

- when media parsing starts, show a rotating set of cold facts
- facts should be selected from top knowledge domains in the current RAG Builder
- support Computer Vision, NLP / LLM / RAG, and Podcast knowledge pools

Reason reduced in demo:

- too visually distracting in the final horizontal layout
- conflicted with the cleaner single-input interaction model

#### B. Day / Night Dual Canvas

Original intent:

- daytime: Morning Glimmer
- nighttime: Midnight Islands

Reason reduced in demo:

- visual language split product identity
- final demo direction focused on a consistent dark cinematic system

#### C. Floating Parsing Overlay Under Input

Original intent:

- expansion panel beneath intake island with parsing states and trivia

Reason reduced in demo:

- redundant with the simplified bottom interaction surface
- reduced clarity in a fixed desktop layout

#### D. Full Autonomous Nightly Auto-Clustering Loop

Original intent:

- background scheduled clustering of daily fragments
- creation of next-day synthesis nodes

Demo status:

- backend mock logic and prompts exist
- production-grade scheduler and persistence are not yet fully productized

#### E. Continuous Real-Time Serendipity Surface

Original intent:

- gentle prompt while the user types

Demo evolution:

- converted into `Agent Inbox` items because inbox creates stronger artifact value for demo storytelling

## 16. UX and Information Architecture

### 16.1 Left Panel

- brand and entry controls
- new thread
- builder entry
- conversation list

### 16.2 Middle Panel

Three independent work modes:

- Chat Workspace
- Global RAG Builder
- Agent Inbox

### 16.3 Right Panel

- Midnight Islands visual overview
- concept islands and relationship cues
- synthesis atmosphere rather than utility-first dense controls

## 17. Why Agents Improve This Product

Without agents, the product is only:

- a parser
- a vector store
- a chat UI

With agents, the product becomes:

- a memory orchestrator
- a synthesis engine
- a proactive recall system

Key upgrade:

- From "stored knowledge"
- To "knowledge that reorganizes and calls back to you at the right time"

## 18. Success Metrics

### 18.1 Product Metrics

- intake-to-curation completion rate
- percentage of draft takeaways saved into durable memory
- percentage of chat answers grounded by curated memory
- serendipity push open rate
- knowledge graph review rate

### 18.2 Quality Metrics

- reduction in noisy stored memory
- user-rated trust in answers
- user-rated usefulness of graph synthesis
- precision of serendipity matches

### 18.3 Demo Metrics

- time to first aha moment
- interaction rate with Builder / Inbox / Islands
- reviewer understanding of product differentiation

## 19. Risks and Mitigations

### Risk 1: Product becomes visually impressive but conceptually unclear

Mitigation:

- keep agent outputs grounded in clear memory workflows
- separate Inbox from Builder

### Risk 2: Serendipity feels gimmicky

Mitigation:

- require meaningful historical resonance before generating push
- keep suggestions to one sentence

### Risk 3: Knowledge graph becomes decorative instead of useful

Mitigation:

- tie graph to real clusters, memory nodes, and evidence
- route graph review back into Builder

### Risk 4: Demo oversells backend maturity

Mitigation:

- explicitly label mock logic vs production plan
- preserve legacy live-mode interfaces for technical credibility

## 20. Release Recommendation

For current positioning, the best package is:

- `PRD` as the canonical product definition
- later add `UX spec` if detailed screens need product-design handoff
- later add `technical design doc` if backend agents and deployment are productized

For now, this PRD is the right top-level artifact.

## 21. Appendix: One-Sentence Positioning

Inspiration is a proactive personal knowledge agent that turns fragmented multimodal inputs into curated memory, grounded answers, and agent-generated synthesis.
