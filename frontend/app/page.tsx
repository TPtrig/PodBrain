"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import {
  Bell,
  Brain,
  CirclePlus,
  ImagePlus,
  Link2,
  LoaderCircle,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  Waves
} from "lucide-react";
import { demoChatAnswer, isDemoModeEnabled } from "@/lib/demo";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  contexts?: string[];
  createdAt: number;
};

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  messageCount: number;
  podcastIds: string[];
  createdAt: number;
  updatedAt: number;
};

type PodcastAsset = {
  id: string;
  title: string;
  url: string;
  sourceLabel: string;
  taskId?: string;
  createdAt: number;
};

type TakeawayItem = {
  id: string;
  podcastId: string;
  podcastTitle: string;
  podcastUrl: string;
  text: string;
  enabled: boolean;
  taskId?: string;
  persisted: boolean;
  itemId?: string;
};

type ParseState = {
  running: boolean;
  conversationId: string | null;
  stageIndex: number;
  triviaIndex: number;
  taskId: string | null;
  trivia: string[];
  domain: string;
  modeLabel: string;
};

type InputAttachment = {
  id: string;
  name: string;
  kind: "image" | "file";
};

type ConversationSummaryApi = {
  id: string;
  title: string;
  message_count: number;
  podcast_count: number;
  created_at: string;
  updated_at: string;
};

type ConversationMessageApi = {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
};

type TaskStatusApi = {
  success: boolean;
  task_id: string;
  conversation_id?: string | null;
  status: string;
  message: string;
  audio_url?: string | null;
  transcript?: string | null;
  title?: string | null;
  summary?: string | null;
  takeaways?: string[] | null;
  error?: string | null;
};

type BrainItemApi = {
  id: string;
  task_id: string;
  podcast_title: string;
  podcast_url: string;
  text: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type ChatApiResponse = {
  success: boolean;
  answer: string;
  contexts: string[];
  context_count: number;
};

type LoaderTriviaApi = {
  success: boolean;
  domain?: string;
  trivia?: string[];
};

type InsightNodeApi = {
  label: string;
  summary: string;
  evidence: string[];
};

type InsightClusterApi = {
  success: boolean;
  cluster_date: string;
  title: string;
  overview: string;
  hidden_commonality: string;
  nodes: InsightNodeApi[];
  prompt_preview: {
    system: string;
    user: string;
  };
};

type SerendipityHintApi = {
  success: boolean;
  hint: string;
  matched_items: string[];
  prompt_preview: {
    system: string;
    user: string;
  };
};

type CanvasDetail = {
  title: string;
  summary: string;
  evidence: string[];
};

type KnowledgeGraphNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  tier: "core" | "satellite";
};

type KnowledgeGraphEdge = {
  from: string;
  to: string;
  label: string;
};

type InboxItem =
  | {
      id: string;
      kind: "graph";
      title: string;
      summary: string;
      createdAtLabel: string;
      unread: boolean;
      graph: {
        title: string;
        summary: string;
        nodes: KnowledgeGraphNode[];
        edges: KnowledgeGraphEdge[];
        chips: string[];
      };
    }
  | {
      id: string;
      kind: "push";
      title: string;
      summary: string;
      createdAtLabel: string;
      unread: boolean;
      relatedIsland: string;
      suggestion: string;
      evidence: string[];
    };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const loaderTriviaByDomain: Record<string, string[]> = {
  "Computer Vision": [
    "Vision Transformers treat an image as a sequence of patches, which lets attention replace classic convolutions.",
    "CLIP aligned images and language so effectively that zero-shot classification became practical for many downstream tasks.",
    "In segmentation pipelines, annotation quality often improves results more than architectural novelty.",
    "Latent diffusion works in compressed feature space, which is a major reason image generation became much cheaper.",
    "Feature drift in video models can emerge from scene cuts faster than from object motion itself."
  ],
  "NLP / LLM / RAG": [
    "RAG quality often drops because retrieval returns plausible text, not because the generator is weak.",
    "Chunk overlap is a recall tool, but too much overlap can quietly reduce diversity in retrieved evidence.",
    "A small curated memory base usually beats a large noisy index for grounded chat demos.",
    "Embedding models encode similarity, but system prompts still decide whether the final answer stays honest.",
    "The fastest RAG gain in product teams is often better memory curation, not a bigger model."
  ],
  Podcast: [
    "Podcast retention improves when listeners rewrite ideas into decisions instead of summaries.",
    "Host transitions and ad breaks are natural chunk boundaries for long-form audio indexing.",
    "A good episode title can improve later retrieval because it becomes a strong semantic anchor.",
    "Audio with consistent loudness usually transcribes better than audio with the same bitrate but uneven dynamics.",
    "Chapterized podcasts create cleaner knowledge graphs because topic shifts are already partially labeled."
  ]
};

const parseStages = [
  "Reading signal from your source...",
  "Parsing media in background...",
  "Drafting takeaways and links...",
  "Preparing Inspiration memory..."
];

const legacyCards = [
  "**EXTRACT:** Parse and draft takeaways automatically.",
  "**CURATE:** Enable/disable or delete takeaways in Global RAG Builder.",
  "**CHAT:** Answer grounded on globally selected memory."
];

const presetIslandModules = [
  {
    id: "llm",
    label: "LLM",
    role: "main" as const,
    summary: "Large language models act as the cognitive core of the stack: instruction following, abstraction, synthesis, and adaptive response generation all depend on the model layer staying stable and steerable.",
    details: [
      "Model selection should optimize for reliability before novelty when the product surface is grounded reasoning.",
      "Prompt scaffolding defines how well the model respects memory boundaries and fallback behavior.",
      "Latency, context window, and instruction hierarchy all shape the perceived intelligence of the assistant.",
      "The core LLM should synthesize across islands without collapsing them into generic summaries."
    ]
  },
  {
    id: "harness-engineering",
    label: "Harness Engineering",
    role: "small" as const,
    summary: "Harness engineering is the evaluation and orchestration shell around the model: test prompts, regression suites, routing controls, and failure probes keep the product honest.",
    details: [
      "Build prompt harnesses that replay critical user flows before every iteration.",
      "Keep adversarial test cases near the product, not buried inside model research notes.",
      "Evaluation harnesses should measure groundedness, not only fluency.",
      "The harness is where product quality becomes inspectable instead of anecdotal."
    ]
  },
  {
    id: "fine-tune",
    label: "Fine Tune",
    role: "small" as const,
    summary: "Fine-tuning is the specialization layer: it narrows behavior, compresses style, and can reduce prompt burden when a repeatable interaction pattern already exists.",
    details: [
      "Fine-tune only after retrieval, prompting, and evaluation are already coherent.",
      "Use tuning for consistent behavior, not to hide weak product structure.",
      "Dataset quality matters more than dataset size for narrow interaction loops.",
      "A tuned model still needs the same product guardrails around memory and retrieval."
    ]
  },
  {
    id: "machine-learning",
    label: "Machine Learning",
    role: "small" as const,
    summary: "Machine learning remains the substrate underneath the product: ranking, embeddings, clustering, and classification decide what the assistant notices before it speaks.",
    details: [
      "Embedding and ranking layers quietly shape nearly every downstream answer.",
      "Clustering can create product moments when it reveals hidden commonality instead of raw similarity.",
      "Lightweight classifiers often unlock better routing than adding more prompt complexity.",
      "ML infrastructure should expose signal, not just scores."
    ]
  },
  {
    id: "agent-orchestration",
    label: "Agent Orchestration",
    role: "small" as const,
    summary: "Agent orchestration coordinates tools, memory, and specialized prompts into one visible workflow. It is the layer that turns isolated model calls into product behavior.",
    details: [
      "Route subtasks explicitly so the user can understand where synthesis is coming from.",
      "Agent chains should be short, legible, and easy to interrupt.",
      "Memory, parsing, and synthesis agents need different constraints and different success metrics.",
      "Good orchestration feels calm because each agent has a sharply defined job."
    ]
  }
];

const presetKnowledgeGraph = {
  title: "20:00 Knowledge Graph Refresh",
  summary:
    "The nightly agent clusters today's material into a stable graph: `LLM` remains the cognitive core while evaluation, tuning, statistical signal, and orchestration stay visible as linked operating layers.",
  nodes: [
    { id: "llm", label: "LLM", x: 50, y: 48, tier: "core" as const },
    { id: "harness-engineering", label: "Harness Engineering", x: 20, y: 22, tier: "satellite" as const },
    { id: "fine-tune", label: "Fine Tune", x: 78, y: 20, tier: "satellite" as const },
    { id: "machine-learning", label: "Machine Learning", x: 78, y: 78, tier: "satellite" as const },
    { id: "agent-orchestration", label: "Agent Orchestration", x: 22, y: 80, tier: "satellite" as const }
  ],
  edges: [
    { from: "llm", to: "harness-engineering", label: "regression guardrails" },
    { from: "llm", to: "fine-tune", label: "behavior compression" },
    { from: "llm", to: "machine-learning", label: "ranking + embeddings" },
    { from: "llm", to: "agent-orchestration", label: "tool routing" },
    { from: "machine-learning", to: "fine-tune", label: "loss shaping" },
    { from: "harness-engineering", to: "agent-orchestration", label: "eval loop" }
  ],
  chips: ["Nightly agent run", "20:00 schedule", "Clustered memory", "Knowledge graph ready"]
};

const initialInboxItems: InboxItem[] = [
  {
    id: "graph-nightly-2000",
    kind: "graph",
    title: "20:00 nightly graph is ready",
    summary: "The agent turned today's five operating themes into one linked knowledge graph for review.",
    createdAtLabel: "Scheduled for 20:00",
    unread: true,
    graph: presetKnowledgeGraph
  }
];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function makeLocalConversation(): Conversation {
  const now = Date.now();
  return {
    id: makeId("conv"),
    title: "New Chat",
    messages: [],
    messageCount: 0,
    podcastIds: [],
    createdAt: now,
    updatedAt: now
  };
}

function parseIsoToMillis(value?: string | null): number {
  if (!value) {
    return Date.now();
  }
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? Date.now() : ts;
}

function summarizeTextTitle(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "New Chat";
  }
  const cap = /[\u4e00-\u9fa5]/.test(cleaned) ? 18 : 34;
  if (cleaned.length <= cap) {
    return cleaned;
  }
  return `${cleaned.slice(0, cap)}...`;
}

function derivePodcastTitle(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");
    const slug = u.pathname.split("/").filter(Boolean).slice(-1)[0] ?? "episode";
    const compact = slug.replace(/[-_]/g, " ").slice(0, 32);
    return `Source from ${host}: ${compact || "untitled"}`;
  } catch {
    return "Captured Source";
  }
}

function extractUrls(raw: string): string[] {
  const matches = raw.match(/https?:\/\/[^\s]+/g);
  return matches ? Array.from(new Set(matches.map((value) => value.trim()))) : [];
}

function pickLoaderDomain(raw: string): keyof typeof loaderTriviaByDomain {
  const normalized = raw.toLowerCase();
  if (/(vision|image|clip|video|multimodal|camera|pixel)/.test(normalized)) {
    return "Computer Vision";
  }
  if (/(rag|llm|embedding|retriev|prompt|language|agent|nlp)/.test(normalized)) {
    return "NLP / LLM / RAG";
  }
  return "Podcast";
}

function createFallbackTrivia(seed: string) {
  const domain = pickLoaderDomain(seed);
  return {
    domain,
    trivia: loaderTriviaByDomain[domain]
  };
}

function makeMockTitle(rawInput: string, attachments: InputAttachment[]): string {
  const firstUrl = extractUrls(rawInput)[0];
  if (firstUrl) {
    return derivePodcastTitle(firstUrl);
  }
  if (attachments.length) {
    return `Visual note: ${summarizeTextTitle(attachments[0].name)}`;
  }
  const compact = summarizeTextTitle(rawInput);
  return compact === "New Chat" ? "Captured text note" : `Text note: ${compact}`;
}

function mockTakeawaysFromInput(rawInput: string, attachments: InputAttachment[]): string[] {
  const title = makeMockTitle(rawInput, attachments);
  const domain = pickLoaderDomain(`${rawInput} ${attachments.map((item) => item.name).join(" ")}`);
  const domainLead =
    domain === "Computer Vision"
      ? "Visual material benefits from object-level grouping before retrieval."
      : domain === "NLP / LLM / RAG"
        ? "Curated memory and precise retrieval usually matter more than model size."
        : "Long-form listening becomes useful when it is rewritten into portable decisions.";

  return [
    `${title}: capture the strongest claim first, not the whole source.`,
    domainLead,
    "Promote only high-signal takeaways into the shared memory layer.",
    "Keep source context attached so later answers can stay grounded.",
    "Use synthesis notes to connect this source with older discoveries."
  ];
}

function describeInputMode(rawInput: string, attachments: InputAttachment[]): string {
  if (extractUrls(rawInput).length > 0 && attachments.length > 0) {
    return "Link + image intake";
  }
  if (extractUrls(rawInput).length > 0) {
    return "Media link intake";
  }
  if (attachments.length > 0) {
    return "Image intake";
  }
  return "Text intake";
}

function localIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createLocalSerendipityHint(seed: string, takeaways: TakeawayItem[]): string | null {
  const lowered = seed.toLowerCase();
  const match = takeaways.find((item) => {
    const text = item.text.toLowerCase();
    return lowered
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4)
      .some((token) => text.includes(token));
  });
  if (!match) {
    return null;
  }
  return `Serendipity: this new thread echoes ${summarizeTextTitle(match.text)}.`;
}

function createPresetSerendipityInboxItem(seed: string): InboxItem | null {
  const normalized = seed.toLowerCase();

  if (/(loss|optimizer|optim|gradient|training|finetune|fine tune)/.test(normalized)) {
    return {
      id: "push-loss-match",
      kind: "push",
      title: "Old optimization note can validate this",
      summary: "You are revisiting training dynamics. A stored note about loss-shaping and behavior compression lines up with this thread.",
      createdAtLabel: "New push",
      unread: true,
      relatedIsland: "Fine Tune",
      suggestion: "你现在关注的这个问题，和你三个月前存的一篇关于损失函数优化的笔记刚好能印证，要不要看看？",
      evidence: [
        "Fine Tune: dataset quality matters more than dataset size for narrow loops.",
        "Machine Learning: loss shaping and ranking layers define what the system notices."
      ]
    };
  }

  if (/(agent|workflow|orchestrat|tool|route)/.test(normalized)) {
    return {
      id: "push-agent-match",
      kind: "push",
      title: "This workflow echoes your orchestration map",
      summary: "Your new idea overlaps with the orchestration fabric already stored in the demo memory map.",
      createdAtLabel: "New push",
      unread: true,
      relatedIsland: "Agent Orchestration",
      suggestion: "你现在关注的这个工作流问题，和你之前存下来的 Agent Orchestration 设计刚好能互相补强，要不要直接展开看看？",
      evidence: [
        "Agent Orchestration: route subtasks explicitly so synthesis stays legible.",
        "Harness Engineering: evaluation loops should remain close to the routed workflow."
      ]
    };
  }

  if (/(eval|benchmark|test|harness|regression)/.test(normalized)) {
    return {
      id: "push-harness-match",
      kind: "push",
      title: "Evaluation memory matches this question",
      summary: "A previously stored harness note can pressure-test the idea you are typing now.",
      createdAtLabel: "New push",
      unread: true,
      relatedIsland: "Harness Engineering",
      suggestion: "你现在这个判断题，和你之前那条关于 prompt regression 的记录刚好能互证，要不要调出来一起看？",
      evidence: [
        "Harness Engineering: replay critical prompt flows before every iteration.",
        "LLM: prompt scaffolding decides how well the model respects memory boundaries."
      ]
    };
  }

  if (/(embedding|ranking|cluster|ml|retriev)/.test(normalized)) {
    return {
      id: "push-ml-match",
      kind: "push",
      title: "Signal layer already has a matching fragment",
      summary: "A stored memory about embeddings and ranking overlaps with this fresh input.",
      createdAtLabel: "New push",
      unread: true,
      relatedIsland: "Machine Learning",
      suggestion: "你现在关注的这个检索信号问题，和你之前记下的 embedding / ranking 思路是同一条线，要不要一起看？",
      evidence: [
        "Machine Learning: embedding and ranking layers quietly shape downstream answers.",
        "LLM: model behavior is only as grounded as the retrieval signal beneath it."
      ]
    };
  }

  return null;
}

function buildFallbackCanvasDetail(label: string, highlights: string[]): CanvasDetail {
  return {
    title: label,
    summary: `This island captures a recurring thread around ${label.toLowerCase()} and turns it into a reusable prompt for later synthesis.`,
    evidence: highlights.length ? highlights : ["Waiting for stronger evidence from parsed memory."]
  };
}

function stageIndexForTaskStatus(status: string): number {
  if (status === "transcribing") {
    return 1;
  }
  if (status === "extracting") {
    return 2;
  }
  if (status === "completed") {
    return 3;
  }
  return 0;
}

function podcastIdForTask(taskId: string): string {
  return `task-${taskId}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => ({}))) as T & { detail?: string };
  if (!response.ok) {
    throw new Error(payload.detail || `Request failed with ${response.status}`);
  }
  return payload as T;
}

async function apiCreateConversation(title?: string) {
  return apiFetch<{ success: boolean; conversation: ConversationSummaryApi }>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ title })
  });
}

async function apiListConversations() {
  return apiFetch<{ success: boolean; conversations: ConversationSummaryApi[] }>("/api/conversations", {
    method: "GET"
  });
}

async function apiGetConversation(conversationId: string) {
  return apiFetch<{
    success: boolean;
    conversation: ConversationSummaryApi;
    messages: ConversationMessageApi[];
  }>(`/api/conversations/${encodeURIComponent(conversationId)}`, { method: "GET" });
}

async function apiCreateProcess(url: string, openaiApiKey: string, conversationId: string) {
  return apiFetch<{ success: boolean; task_id: string; status: string; message: string }>("/api/process", {
    method: "POST",
    body: JSON.stringify({ url, openaiApiKey, conversationId })
  });
}

async function apiParseMedia(content: string, mediaUrl: string | null, contentType: string, conversationId: string) {
  return apiFetch<{ success: boolean; task_id: string; status: string; message: string; mode: string }>("/api/parse_media", {
    method: "POST",
    body: JSON.stringify({ content, mediaUrl, contentType, conversationId })
  });
}

async function apiGetTask(taskId: string) {
  return apiFetch<TaskStatusApi>(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "GET" });
}

async function apiSaveBrain(taskId: string, takeaways: string[], openaiApiKey: string) {
  return apiFetch<{ success: boolean; task_id: string; saved_count: number; item_ids?: string[]; message: string }>("/api/brain/save", {
    method: "POST",
    body: JSON.stringify({ taskId, takeaways, openaiApiKey })
  });
}

async function apiListBrainItems() {
  return apiFetch<{ success: boolean; items: BrainItemApi[] }>("/api/brain/items", { method: "GET" });
}

async function apiUpdateBrainItem(itemId: string, enabled: boolean) {
  return apiFetch<{ success: boolean; item: BrainItemApi }>(`/api/brain/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled })
  });
}

async function apiDeleteBrainItem(itemId: string) {
  return apiFetch<{ success: boolean }>(`/api/brain/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE"
  });
}

async function apiChat(question: string, conversationId: string, openaiApiKey: string) {
  return apiFetch<ChatApiResponse>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ question, conversationId, topK: 4, openaiApiKey })
  });
}

async function apiGetLoaderTrivia(conversationId?: string) {
  const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : "";
  return apiFetch<LoaderTriviaApi>(`/api/get_loader_trivia${query}`, { method: "GET" });
}

async function apiGetLatestInsight() {
  return apiFetch<InsightClusterApi>("/api/insights/latest", { method: "GET" });
}

async function apiAutoCluster(clusterDate?: string) {
  const query = clusterDate ? `?clusterDate=${encodeURIComponent(clusterDate)}` : "";
  return apiFetch<{ success: boolean; cluster_date: string; generated: boolean; cluster?: InsightClusterApi | null }>(
    `/api/insights/auto_cluster${query}`,
    { method: "POST" }
  );
}

async function apiSerendipityHint(content: string, conversationId?: string) {
  return apiFetch<SerendipityHintApi>("/api/serendipity_hint", {
    method: "POST",
    body: JSON.stringify({ content, conversationId, limit: 3 })
  });
}

function summaryToConversation(summary: ConversationSummaryApi): Conversation {
  return {
    id: summary.id,
    title: summary.title,
    messages: [],
    messageCount: summary.message_count,
    podcastIds: [],
    createdAt: parseIsoToMillis(summary.created_at),
    updatedAt: parseIsoToMillis(summary.updated_at)
  };
}

export default function Page() {
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [activePanel, setActivePanel] = useState<"chat" | "builder" | "inbox">("chat");
  const [leftPaneWidth, setLeftPaneWidth] = useState(280);
  const [rightPaneWidth, setRightPaneWidth] = useState(520);
  const [dragPane, setDragPane] = useState<"left" | "right" | null>(null);

  const [podcasts, setPodcasts] = useState<PodcastAsset[]>([]);
  const [takeaways, setTakeaways] = useState<TakeawayItem[]>([]);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [attachments, setAttachments] = useState<InputAttachment[]>([]);

  const [parseState, setParseState] = useState<ParseState>({
    running: false,
    conversationId: null,
    stageIndex: 0,
    triviaIndex: 0,
    taskId: null,
    trivia: loaderTriviaByDomain.Podcast,
    domain: "Podcast",
    modeLabel: "Media link intake"
  });

  const [chatBusy, setChatBusy] = useState(false);
  const [savingBrain, setSavingBrain] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [insightCluster, setInsightCluster] = useState<InsightClusterApi | null>(null);
  const [serendipityHint, setSerendipityHint] = useState<string | null>(null);
  const [activeCanvasDetail, setActiveCanvasDetail] = useState<CanvasDetail | null>(null);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>(initialInboxItems);
  const [selectedInboxItemId, setSelectedInboxItemId] = useState<string>(initialInboxItems[0]?.id ?? "");

  const pollTimerRef = useRef<number | null>(null);
  const triviaTimerRef = useRef<number | null>(null);
  const serendipityTimerRef = useRef<number | null>(null);
  const deliveredPushIdsRef = useRef<Set<string>>(new Set());

  const isDemoMode = useMemo(() => isDemoModeEnabled(), []);

  const effectiveActiveConversationId = useMemo(() => {
    if (!conversations.length) {
      return "";
    }
    if (activeConversationId && conversations.some((c) => c.id === activeConversationId)) {
      return activeConversationId;
    }
    return conversations[0].id;
  }, [activeConversationId, conversations]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === effectiveActiveConversationId) ?? conversations[0],
    [conversations, effectiveActiveConversationId]
  );

  const enabledTakeaways = useMemo(() => takeaways.filter((t) => t.enabled), [takeaways]);
  const liveDraftTakeaways = useMemo(() => takeaways.filter((item) => !item.persisted), [takeaways]);
  const selectedDraftCount = useMemo(() => liveDraftTakeaways.filter((item) => item.enabled).length, [liveDraftTakeaways]);
  const liveDraftCount = liveDraftTakeaways.length;

  const upsertConversation = (conversationId: string, mutator: (conversation: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === conversationId ? mutator(c) : c)));
  };

  const appendMessage = (conversationId: string, message: ChatMessage) => {
    upsertConversation(conversationId, (c) => {
      const nextMessages = [...c.messages, message];
      return {
        ...c,
        messages: nextMessages,
        messageCount: nextMessages.length,
        updatedAt: Date.now()
      };
    });
  };

  const ensurePodcast = (podcast: PodcastAsset) => {
    setPodcasts((prev) => {
      const idx = prev.findIndex((p) => p.id === podcast.id);
      if (idx === -1) {
        return [podcast, ...prev];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...podcast };
      return next;
    });
  };

  const applyConversationDetail = (conversationId: string, summary: ConversationSummaryApi, messages: ConversationMessageApi[]) => {
    setConversations((prev) => {
      const existing = prev.find((c) => c.id === conversationId);
      const nextMessages = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: parseIsoToMillis(msg.created_at)
      }));

      const nextConversation: Conversation = {
        id: summary.id,
        title: summary.title,
        messages: nextMessages,
        messageCount: summary.message_count,
        podcastIds: existing?.podcastIds ?? [],
        createdAt: parseIsoToMillis(summary.created_at),
        updatedAt: parseIsoToMillis(summary.updated_at)
      };

      if (!existing) {
        return [nextConversation, ...prev];
      }

      return prev.map((c) => (c.id === conversationId ? nextConversation : c));
    });
  };

  const loadConversationDetail = async (conversationId: string) => {
    if (isDemoMode) {
      return;
    }
    const detail = await apiGetConversation(conversationId);
    applyConversationDetail(conversationId, detail.conversation, detail.messages);
  };

  const refreshBrainItems = async () => {
    if (isDemoMode) {
      return;
    }

    const payload = await apiListBrainItems();

    const savedItems: TakeawayItem[] = payload.items.map((item) => ({
      id: `saved-${item.id}`,
      itemId: item.id,
      taskId: item.task_id,
      podcastId: podcastIdForTask(item.task_id),
      podcastTitle: item.podcast_title,
      podcastUrl: item.podcast_url,
      text: item.text,
      enabled: item.enabled,
      persisted: true
    }));

    setTakeaways((prev) => {
      const drafts = prev.filter((t) => !t.persisted);
      return [...savedItems, ...drafts];
    });

    for (const item of payload.items) {
      ensurePodcast({
        id: podcastIdForTask(item.task_id),
        title: item.podcast_title,
        url: item.podcast_url,
        sourceLabel: "Saved to Inspiration memory",
        taskId: item.task_id,
        createdAt: parseIsoToMillis(item.created_at)
      });
    }
  };

  const refreshInsightCluster = async (triggerGeneration = false) => {
    if (isDemoMode) {
      return;
    }

    try {
      if (triggerGeneration) {
        await apiAutoCluster(localIsoDate());
      }
      const latest = await apiGetLatestInsight();
      setInsightCluster(latest);
    } catch {
      setInsightCluster(null);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setBootstrapping(true);
      setHint(null);

      if (isDemoMode) {
        const seed = makeLocalConversation();
        setConversations([seed]);
        setActiveConversationId(seed.id);
        setBootstrapping(false);
        return;
      }

      try {
        const listPayload = await apiListConversations();
        let summaries = listPayload.conversations;

        if (!summaries.length) {
          const created = await apiCreateConversation("New Chat");
          summaries = [created.conversation];
        }

        setConversations(summaries.map(summaryToConversation));
        const nextActive = summaries[0].id;
        setActiveConversationId(nextActive);

        await Promise.all([loadConversationDetail(nextActive), refreshBrainItems(), refreshInsightCluster(true)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to initialize workspace.";
        setHint(message);
      } finally {
        setBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored =
      window.sessionStorage.getItem("inspiration:openai-key") ??
      window.sessionStorage.getItem("podbrain:openai-key") ??
      "";
    setOpenaiApiKey(stored);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (openaiApiKey.trim()) {
      window.sessionStorage.setItem("inspiration:openai-key", openaiApiKey);
      return;
    }

    window.sessionStorage.removeItem("inspiration:openai-key");
  }, [openaiApiKey]);

  useEffect(() => {
    const source = messageInput.trim();
    if (serendipityTimerRef.current) {
      window.clearTimeout(serendipityTimerRef.current);
      serendipityTimerRef.current = null;
    }

    if (!source || source.length < 18) {
      setSerendipityHint(null);
      return;
    }

    const localHint = createLocalSerendipityHint(source, enabledTakeaways);
    if (isDemoMode) {
      setSerendipityHint(localHint);
      return;
    }

    serendipityTimerRef.current = window.setTimeout(() => {
      void apiSerendipityHint(source, activeConversation?.id)
        .then((payload) => {
          setSerendipityHint(payload.hint || localHint);
        })
        .catch(() => {
          setSerendipityHint(localHint);
        });
    }, 650);

    return () => {
      if (serendipityTimerRef.current) {
        window.clearTimeout(serendipityTimerRef.current);
        serendipityTimerRef.current = null;
      }
    };
  }, [activeConversation?.id, enabledTakeaways, isDemoMode, messageInput]);

  useEffect(() => {
    const source = messageInput.trim();
    if (source.length < 18) {
      return;
    }

    const presetPush = createPresetSerendipityInboxItem(source);
    const nextPush: InboxItem | null =
      presetPush ??
      (serendipityHint
        ? {
            id: "push-llm-match",
            kind: "push",
            title: "A memory fragment wants your attention",
            summary: serendipityHint,
            createdAtLabel: "New push",
            unread: true,
            relatedIsland: "LLM",
            suggestion: serendipityHint,
            evidence: [
              "LLM: the core model should synthesize across islands without flattening them.",
              "Harness Engineering: memory-aware prompts should stay inspectable."
            ]
          }
        : null);

    if (!nextPush || deliveredPushIdsRef.current.has(nextPush.id)) {
      return;
    }

    deliveredPushIdsRef.current.add(nextPush.id);
    setInboxItems((prev) => [nextPush, ...prev]);
    setSelectedInboxItemId(nextPush.id);
  }, [messageInput, serendipityHint]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
      if (triviaTimerRef.current) {
        window.clearInterval(triviaTimerRef.current);
      }
      if (serendipityTimerRef.current) {
        window.clearInterval(serendipityTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dragPane) {
      return;
    }

    const handleWidth = 12;
    const minCenterWidth = 560;
    const minLeftWidth = 240;
    const maxLeftWidth = 420;
    const minRightWidth = 380;
    const maxRightWidth = 700;

    const handleMove = (event: MouseEvent) => {
      const layout = layoutRef.current;
      if (!layout) {
        return;
      }

      const rect = layout.getBoundingClientRect();
      if (dragPane === "left") {
        const dynamicMax = Math.max(minLeftWidth, rect.width - rightPaneWidth - handleWidth * 2 - minCenterWidth);
        setLeftPaneWidth(clamp(event.clientX - rect.left, minLeftWidth, Math.min(maxLeftWidth, dynamicMax)));
        return;
      }

      const proposedRight = rect.right - event.clientX;
      const dynamicMax = Math.max(minRightWidth, rect.width - leftPaneWidth - handleWidth * 2 - minCenterWidth);
      setRightPaneWidth(clamp(proposedRight, minRightWidth, Math.min(maxRightWidth, dynamicMax)));
    };

    const handleUp = () => {
      setDragPane(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragPane, leftPaneWidth, rightPaneWidth]);

  const createNewChat = async () => {
    if (isDemoMode) {
      const next = makeLocalConversation();
      setConversations((prev) => [next, ...prev]);
      setActiveConversationId(next.id);
      setActivePanel("chat");
      setHint(null);
      return;
    }

    try {
      const payload = await apiCreateConversation("New Chat");
      const next = summaryToConversation(payload.conversation);
      setConversations((prev) => [next, ...prev]);
      setActiveConversationId(next.id);
      setActivePanel("chat");
      setHint(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create conversation.";
      setHint(message);
    }
  };

  const applyLoaderTrivia = async (seed: string, conversationId?: string) => {
    const fallback = createFallbackTrivia(seed);
    setParseState((prev) => ({
      ...prev,
      domain: fallback.domain,
      trivia: fallback.trivia,
      triviaIndex: 0
    }));

    try {
      const payload = await apiGetLoaderTrivia(conversationId);
      const nextTrivia = payload.trivia?.filter((item) => item.trim()) ?? [];
      if (!nextTrivia.length) {
        return;
      }
      setParseState((prev) => ({
        ...prev,
        domain: payload.domain?.trim() || prev.domain,
        trivia: nextTrivia,
        triviaIndex: 0
      }));
    } catch {
      // Frontend falls back to local trivia until the mock backend endpoint lands.
    }
  };

  const beginTriviaRotation = () => {
    if (triviaTimerRef.current) {
      window.clearInterval(triviaTimerRef.current);
    }
    triviaTimerRef.current = window.setInterval(() => {
      setParseState((prev) => {
        const total = prev.trivia.length || 1;
        return { ...prev, triviaIndex: (prev.triviaIndex + 1) % total };
      });
    }, 3600);
  };

  const clearParseTimers = () => {
    if (triviaTimerRef.current) {
      window.clearInterval(triviaTimerRef.current);
      triviaTimerRef.current = null;
    }
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const finishParse = () => {
    clearParseTimers();
    setParseState({
      running: false,
      conversationId: null,
      stageIndex: 0,
      triviaIndex: 0,
      taskId: null,
      trivia: loaderTriviaByDomain.Podcast,
      domain: "Podcast",
      modeLabel: "Media link intake"
    });
  };

  const addAttachmentList = (files: File[]) => {
    if (!files.length) {
      return;
    }

    setAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: makeId("asset"),
        name: file.name,
        kind: (file.type.startsWith("image/") ? "image" : "file") as InputAttachment["kind"]
      }))
    ]);
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== attachmentId));
  };

  const onInputPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageFiles = Array.from(event.clipboardData.files);
    if (imageFiles.length) {
      addAttachmentList(imageFiles);
    }
  };

  const onFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    addAttachmentList(files);
    event.target.value = "";
  };

  const handleTaskCompleted = async (task: TaskStatusApi, conversationId: string, inputUrl: string) => {
    const taskId = task.task_id;
    const podcastId = podcastIdForTask(taskId);
    const title = (task.title || "").trim() || derivePodcastTitle(inputUrl);
    const url = (task.audio_url || "").trim() || inputUrl.trim();

    ensurePodcast({
      id: podcastId,
      taskId,
      title,
      url,
      sourceLabel: "Parsed from backend",
      createdAt: Date.now()
    });

    upsertConversation(conversationId, (c) => ({
      ...c,
      podcastIds: c.podcastIds.includes(podcastId) ? c.podcastIds : [podcastId, ...c.podcastIds],
      updatedAt: Date.now()
    }));

    const incomingTakeaways = (task.takeaways ?? []).map((text, index) => ({
      id: `draft-${taskId}-${index}`,
      podcastId,
      podcastTitle: title,
      podcastUrl: url,
      text,
      enabled: true,
      taskId,
      persisted: false
    }));

    setTakeaways((prev) => {
      const withoutOldDrafts = prev.filter((item) => !(item.taskId === taskId && !item.persisted));
      return [...incomingTakeaways, ...withoutOldDrafts];
    });

    try {
      await loadConversationDetail(conversationId);
    } catch {
      appendMessage(conversationId, {
        id: makeId("msg"),
        role: "assistant",
        content: `Parsed source completed: ${title}. Review takeaways in Global RAG Builder.`,
        createdAt: Date.now()
      });
    }

    setMessageInput("");
    setAttachments([]);
    setHint("Parsing completed. Draft takeaways were added to Inspiration Builder.");
    await refreshInsightCluster(true);
  };

  const pollTaskUntilDone = (taskId: string, conversationId: string, inputUrl: string) => {
    const poll = async () => {
      try {
        const task = await apiGetTask(taskId);
        setParseState((prev) => ({
          ...prev,
          taskId,
          stageIndex: stageIndexForTaskStatus(task.status)
        }));

        if (task.status === "completed") {
          await handleTaskCompleted(task, conversationId, inputUrl);
          finishParse();
          return;
        }

        if (task.status === "failed") {
          setHint(task.error || "Parsing failed. Please try another audio URL.");
          finishParse();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Task polling failed.";
        setHint(message);
        finishParse();
      }
    };

    poll();
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
    }
    pollTimerRef.current = window.setInterval(poll, 2500);
  };

  const startParseAudio = async () => {
    const targetConversation = activeConversation;
    const rawInput = messageInput.trim();
    const rawUrl = extractUrls(rawInput)[0] ?? "";
    const key = openaiApiKey.trim();
    const modeLabel = describeInputMode(rawInput, attachments);
    const shouldUseLegacyPodcastPipeline =
      !attachments.length &&
      !!rawUrl &&
      (rawInput === rawUrl || rawInput.replace(/\s+/g, " ").trim() === rawUrl);

    if (!targetConversation) {
      setHint("Create a conversation first.");
      return;
    }
    if (!rawInput && !attachments.length) {
      setHint("Paste text, an image, or a media link to begin.");
      return;
    }
    if (!isDemoMode && shouldUseLegacyPodcastPipeline && !key) {
      setHint("OpenAI API key is required for parsing.");
      return;
    }
    if (parseState.running) {
      return;
    }

    setHint(null);
    setParseState({
      running: true,
      conversationId: targetConversation.id,
      stageIndex: 0,
      triviaIndex: 0,
      taskId: null,
      trivia: loaderTriviaByDomain.Podcast,
      domain: "Podcast",
      modeLabel
    });
    void applyLoaderTrivia(
      `${rawInput} ${enabledTakeaways.map((item) => item.text).join(" ")} ${attachments.map((item) => item.name).join(" ")}`,
      targetConversation.id
    );
    beginTriviaRotation();

    if (isDemoMode) {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }

      let steps = 0;
      pollTimerRef.current = window.setInterval(() => {
        steps += 1;

        setParseState((prev) => ({
          ...prev,
          stageIndex: Math.min(prev.stageIndex + 1, parseStages.length - 1)
        }));

        if (steps >= parseStages.length) {
          clearParseTimers();

          const podcastId = makeId("pod");
          const title = makeMockTitle(rawInput, attachments);
          const sourceUrl = rawUrl || `mock://${modeLabel.toLowerCase().replace(/\s+/g, "-")}`;
          const podcast: PodcastAsset = {
            id: podcastId,
            title,
            url: sourceUrl,
            sourceLabel: isDemoMode ? "Demo parser" : "Frontend mock parser",
            createdAt: Date.now()
          };

          ensurePodcast(podcast);

          const drafts: TakeawayItem[] = mockTakeawaysFromInput(rawInput, attachments).map((text) => ({
            id: makeId("tk"),
            podcastId,
            podcastTitle: title,
            podcastUrl: sourceUrl,
            text,
            enabled: true,
            persisted: false
          }));

          setTakeaways((prev) => [...drafts, ...prev]);
          upsertConversation(targetConversation.id, (c) => ({
            ...c,
            podcastIds: c.podcastIds.includes(podcastId) ? c.podcastIds : [podcastId, ...c.podcastIds],
            updatedAt: Date.now()
          }));

          appendMessage(targetConversation.id, {
            id: makeId("msg"),
            role: "assistant",
            content: `${isDemoMode ? "Demo" : "Mock"} parse completed: ${title}. Review takeaways in Global RAG Builder.`,
            createdAt: Date.now()
          });

          setMessageInput("");
          setAttachments([]);
          setHint(
            isDemoMode
              ? "Demo parse completed. Draft takeaways were added to Inspiration Builder."
              : "Frontend mock parse completed. Backend media parser will replace this in the next step."
          );
          void refreshInsightCluster(true);
          finishParse();
        }
      }, 1700);
      return;
    }

    try {
      const payload = shouldUseLegacyPodcastPipeline
        ? await apiCreateProcess(rawUrl, key, targetConversation.id)
        : await apiParseMedia(
            rawInput || attachments.map((item) => item.name).join(", "),
            rawUrl || null,
            modeLabel.toLowerCase().replace(/\s+/g, "_"),
            targetConversation.id
          );
      setParseState((prev) => ({ ...prev, taskId: payload.task_id }));
      pollTaskUntilDone(payload.task_id, targetConversation.id, rawUrl || rawInput || modeLabel);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start parse task.";
      setHint(message);
      finishParse();
    }
  };

  const sendMessage = async () => {
    if (!activeConversation) {
      return;
    }

    const question = messageInput.trim();
    const key = openaiApiKey.trim();
    if (!question) {
      return;
    }
    if (!isDemoMode && !key) {
      setHint("OpenAI API key is required for chat.");
      return;
    }

    setHint(null);
    const convId = activeConversation.id;

    appendMessage(convId, {
      id: makeId("msg"),
      role: "user",
      content: question,
      createdAt: Date.now()
    });

    setMessageInput("");
    setChatBusy(true);

    if (isDemoMode) {
      window.setTimeout(() => {
        const result = demoChatAnswer(question, enabledTakeaways.map((t) => t.text));
        appendMessage(convId, {
          id: makeId("msg"),
          role: "assistant",
          content: result.answer,
          contexts: result.contexts,
          createdAt: Date.now()
        });
        setChatBusy(false);
      }, 650);
      return;
    }

    try {
      const result = await apiChat(question, convId, key);
      appendMessage(convId, {
        id: makeId("msg"),
        role: "assistant",
        content: result.answer,
        contexts: result.contexts,
        createdAt: Date.now()
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed.";
      appendMessage(convId, {
        id: makeId("msg"),
        role: "assistant",
        content: message,
        createdAt: Date.now()
      });
    } finally {
      setChatBusy(false);
    }
  };

  const saveSelectedToBrain = async () => {
    const key = openaiApiKey.trim();
    if (!isDemoMode && !key) {
      setHint("OpenAI API key is required to save selected takeaways.");
      return;
    }

    const selectedDrafts = takeaways.filter((item) => item.enabled && !item.persisted);
    if (!selectedDrafts.length) {
      setHint("No selected draft takeaways to save.");
      return;
    }

    if (isDemoMode) {
      const ids = new Set(selectedDrafts.map((item) => item.id));
      setTakeaways((prev) =>
        prev.map((item) => {
          if (!ids.has(item.id)) {
            return item;
          }
          return {
            ...item,
            persisted: true,
            itemId: item.itemId ?? `demo-${item.id}`
          };
        })
      );
      setHint(`Demo saved ${selectedDrafts.length} takeaway(s) to local memory.`);
      return;
    }

    const byTask = new Map<string, string[]>();
    for (const item of selectedDrafts) {
      if (!item.taskId) {
        continue;
      }
      const bucket = byTask.get(item.taskId) ?? [];
      bucket.push(item.text);
      byTask.set(item.taskId, bucket);
    }

    if (!byTask.size) {
      setHint("Selected drafts have no valid task mapping.");
      return;
    }

    setSavingBrain(true);
    setHint(null);

    try {
      for (const [taskId, texts] of byTask.entries()) {
        await apiSaveBrain(taskId, texts, key);
      }

      const selectedIds = new Set(selectedDrafts.map((item) => item.id));
      setTakeaways((prev) => prev.filter((item) => !selectedIds.has(item.id)));

      await refreshBrainItems();
      setHint(`Saved ${selectedDrafts.length} takeaway(s) to Inspiration memory.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save selected takeaways.";
      setHint(message);
    } finally {
      setSavingBrain(false);
    }
  };

  const toggleTakeawayEnabled = async (takeawayId: string) => {
    const target = takeaways.find((item) => item.id === takeawayId);
    if (!target) {
      return;
    }

    const nextEnabled = !target.enabled;
    setTakeaways((prev) => prev.map((item) => (item.id === takeawayId ? { ...item, enabled: nextEnabled } : item)));

    if (isDemoMode || !target.persisted || !target.itemId) {
      return;
    }

    try {
      await apiUpdateBrainItem(target.itemId, nextEnabled);
    } catch (error) {
      setTakeaways((prev) => prev.map((item) => (item.id === takeawayId ? { ...item, enabled: !nextEnabled } : item)));
      const message = error instanceof Error ? error.message : "Failed to update takeaway toggle.";
      setHint(message);
    }
  };

  const deleteTakeaway = async (takeawayId: string) => {
    const target = takeaways.find((item) => item.id === takeawayId);
    if (!target) {
      return;
    }

    setTakeaways((prev) => prev.filter((item) => item.id !== takeawayId));

    if (isDemoMode || !target.persisted || !target.itemId) {
      return;
    }

    try {
      await apiDeleteBrainItem(target.itemId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete takeaway.";
      setHint(message);
      await refreshBrainItems();
    }
  };

  const deletePodcast = async (podcastId: string) => {
    const related = takeaways.filter((item) => item.podcastId === podcastId);
    const persistedIds = related.filter((item) => item.persisted && item.itemId).map((item) => item.itemId as string);

    setPodcasts((prev) => prev.filter((podcast) => podcast.id !== podcastId));
    setTakeaways((prev) => prev.filter((item) => item.podcastId !== podcastId));
    setConversations((prev) =>
      prev.map((conversation) => ({
        ...conversation,
        podcastIds: conversation.podcastIds.filter((id) => id !== podcastId),
        updatedAt: Date.now()
      }))
    );

    if (isDemoMode || !persistedIds.length) {
      return;
    }

    const results = await Promise.allSettled(persistedIds.map((itemId) => apiDeleteBrainItem(itemId)));
    if (results.some((result) => result.status === "rejected")) {
      setHint("Some saved items failed to delete. Synced the latest memory items.");
      await refreshBrainItems();
    }
  };

  const setAllDraftTakeawaysEnabled = (enabled: boolean) => {
    setTakeaways((prev) => prev.map((item) => (item.persisted ? item : { ...item, enabled })));
  };

  const conversationList = useMemo(() => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt), [conversations]);

  const groupedTakeaways = useMemo(() => {
    return podcasts
      .map((podcast) => ({
        podcast,
        items: takeaways.filter((item) => item.podcastId === podcast.id)
      }))
      .filter((group) => group.items.length > 0);
  }, [podcasts, takeaways]);

  const podcastById = useMemo(() => {
    const map = new Map<string, PodcastAsset>();
    for (const podcast of podcasts) {
      map.set(podcast.id, podcast);
    }
    return map;
  }, [podcasts]);

  const unreadInboxCount = useMemo(() => inboxItems.filter((item) => item.unread).length, [inboxItems]);
  const unreadGraphCount = useMemo(() => inboxItems.filter((item) => item.kind === "graph" && item.unread).length, [inboxItems]);
  const unreadPushCount = useMemo(() => inboxItems.filter((item) => item.kind === "push" && item.unread).length, [inboxItems]);
  const selectedInboxItem = useMemo(
    () => inboxItems.find((item) => item.id === selectedInboxItemId) ?? inboxItems[0] ?? null,
    [inboxItems, selectedInboxItemId]
  );

  const openInboxItem = (itemId: string) => {
    setSelectedInboxItemId(itemId);
    setInboxItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, unread: false } : item)));
  };

  const markAllInboxItemsRead = () => {
    setInboxItems((prev) => prev.map((item) => ({ ...item, unread: false })));
  };

  const presetMainIsland = presetIslandModules[0];
  const presetSmallIslands = presetIslandModules.slice(1);
  const canvasLabels = presetIslandModules.map((item) => item.label);
  const todayIntention = summarizeTextTitle(presetMainIsland.summary);
  const insightHighlights = presetSmallIslands.map((item) => summarizeTextTitle(item.summary));
  const hiddenCommonality =
    "These five islands describe the modern AI product stack: model core, evaluation shell, specialization layer, statistical substrate, and orchestration fabric.";
  const openCanvasDetail = (label: string) => {
    const preset = presetIslandModules.find((item) => item.label === label);
    setActiveCanvasDetail(
      preset
        ? {
            title: preset.label,
            summary: preset.summary,
            evidence: preset.details
          }
        : buildFallbackCanvasDetail(label, insightHighlights)
    );
    setActivePanel("builder");
  };
  const visibleTakeawayGroups = groupedTakeaways;

  const getConversationTitle = (conversation: Conversation): string => {
    if (conversation.title && conversation.title.trim() && conversation.title !== "New Chat") {
      return summarizeTextTitle(conversation.title);
    }

    const firstUser = conversation.messages.find((message) => message.role === "user" && message.content.trim());
    if (firstUser) {
      return summarizeTextTitle(firstUser.content);
    }

    const latestPodcastId = conversation.podcastIds[0];
    if (latestPodcastId) {
      const podcast = podcastById.get(latestPodcastId);
      if (podcast) {
        return summarizeTextTitle(podcast.title);
      }
    }

    return "New Chat";
  };

  return (
    <main className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(76,108,171,0.24),_transparent_18%),radial-gradient(circle_at_85%_10%,_rgba(86,141,255,0.16),_transparent_16%),linear-gradient(160deg,#050915_0%,#0a1222_45%,#0b1528_100%)] px-4 py-4 text-white md:px-6">
      <div
        ref={layoutRef}
        className="mx-auto grid h-full w-full max-w-[1720px] items-stretch gap-0"
        style={{ gridTemplateColumns: `${leftPaneWidth}px 12px minmax(0,1fr) 12px ${rightPaneWidth}px` }}
      >
        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,17,30,0.92),rgba(7,13,24,0.96))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="border-b border-white/8 px-4 py-4">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#90a6d2]">
              <Sparkles className="h-3.5 w-3.5" />
              Inspiration
            </p>
            <div className="grid gap-2">
              <button
                onClick={() => void createNewChat()}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <CirclePlus className="h-4 w-4" />
                New Thread
              </button>
              <button
                onClick={() => setActivePanel("builder")}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#204169,#315f96)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              >
                <Brain className="h-4 w-4" />
                Builder {liveDraftCount}
              </button>
              <button
                onClick={() => {
                  setActivePanel("chat");
                  void createNewChat();
                }}
                className="inline-flex items-center justify-center rounded-[18px] border border-[#6ba5ff]/28 bg-[#193152] px-4 py-3 text-left text-sm font-medium text-[#b9d5ff] transition hover:bg-[#23416a]"
              >
                New Chat
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
            <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">Conversations</p>
            <div className="space-y-1.5">
              {conversationList.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setActivePanel("chat");
                    setActiveCanvasDetail(null);
                    void loadConversationDetail(conversation.id);
                  }}
                  className={`w-full rounded-[18px] border px-3 py-3 text-left text-sm transition ${
                    conversation.id === effectiveActiveConversationId
                      ? "border-[#6ba5ff]/40 bg-[#21416a]/70 text-[#b9d5ff]"
                      : "border-white/8 bg-white/5 text-white/68 hover:bg-white/10"
                  }`}
                >
                  <p className="line-clamp-1 font-medium">{getConversationTitle(conversation)}</p>
                  <p className="mt-1 text-[11px] text-white/40">{conversation.messageCount} messages</p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="group flex h-full items-center justify-center">
          <button
            type="button"
            aria-label="Resize left and center panels"
            onMouseDown={() => setDragPane("left")}
            className="relative h-full w-full cursor-col-resize"
          >
            <span className="absolute left-1/2 top-1/2 h-24 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition group-hover:bg-[#6ba5ff]/60" />
          </button>
        </div>

        <section className="mx-1 flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(8,14,26,0.94))] shadow-[0_24px_70px_rgba(0,0,0,0.42)]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl text-white md:text-[2rem]" style={{ fontFamily: "var(--font-heading)" }}>
                  {activePanel === "builder" ? "Global RAG Builder" : activePanel === "inbox" ? "Agent Inbox" : "Chat Workspace"}
                </h1>
                <p className="mt-1 text-sm text-white/56">
                  {activePanel === "builder"
                    ? "Curate memory after clicking an island or parsing a new source."
                    : activePanel === "inbox"
                      ? "Review nightly graph updates and serendipity pushes without mixing them into Builder."
                      : "A fixed widescreen workspace for intake, grounded chat, and synthesis."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActivePanel("inbox");
                    if (selectedInboxItem) {
                      openInboxItem(selectedInboxItem.id);
                    }
                  }}
                  className="relative inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#204169,#315f96)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  <Bell className="h-4 w-4" />
                  Agent Inbox
                  {unreadInboxCount > 0 ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#df4b57] px-1 text-[10px] font-bold text-white">
                      {unreadInboxCount}
                    </span>
                  ) : null}
                </button>
                <button
                  onClick={() => markAllInboxItemsRead()}
                  disabled={unreadInboxCount === 0}
                  className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs text-white/72 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Mark all read
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {activePanel === "inbox" ? (
              <div className="space-y-4">
                <section className="rounded-[24px] border border-[#6ba5ff]/16 bg-[linear-gradient(180deg,rgba(14,25,44,0.94),rgba(9,17,31,0.98))] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ec4ff]">Agent Inbox</p>
                      <p className="mt-1 text-sm text-white/62">Nightly 20:00 graph refresh and serendipity pushes arrive here as unread mail.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs text-white/72">
                        Knowledge Graph
                        {unreadGraphCount > 0 ? (
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#df4b57] px-1 text-[10px] font-bold text-white">
                            {unreadGraphCount}
                          </span>
                        ) : null}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1.5 text-xs text-white/72">
                        Serendipity Push
                        {unreadPushCount > 0 ? (
                          <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#df4b57] px-1 text-[10px] font-bold text-white">
                            {unreadPushCount}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {inboxItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openInboxItem(item.id)}
                          className={`w-full rounded-[20px] border px-4 py-3 text-left transition ${
                            selectedInboxItem?.id === item.id
                              ? "border-[#6ba5ff]/30 bg-[#193152]"
                              : "border-white/8 bg-white/[0.04] hover:bg-white/[0.08]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9ec4ff]">
                                {item.kind === "graph" ? "Knowledge Graph" : "Serendipity Push"}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-1 text-xs text-white/52">{item.createdAtLabel}</p>
                            </div>
                            {item.unread ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#df4b57]" /> : null}
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-white/64">{item.summary}</p>
                        </button>
                      ))}
                    </div>

                    {selectedInboxItem ? (
                      selectedInboxItem.kind === "graph" ? (
                        <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ec4ff]">Knowledge Graph Preview</p>
                              <h3 className="mt-2 text-xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                                {selectedInboxItem.graph.title}
                              </h3>
                            </div>
                            <span className="rounded-full bg-white/6 px-3 py-1 text-[11px] text-white/72">Nightly agent run · 20:00</span>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-white/68">{selectedInboxItem.graph.summary}</p>

                          <div className="mt-4 overflow-hidden rounded-[22px] bg-[linear-gradient(180deg,rgba(8,16,29,0.98),rgba(11,21,39,0.96))] p-4">
                            <svg viewBox="0 0 100 100" className="h-64 w-full">
                              {selectedInboxItem.graph.edges.map((edge) => {
                                const from = selectedInboxItem.graph.nodes.find((node) => node.id === edge.from);
                                const to = selectedInboxItem.graph.nodes.find((node) => node.id === edge.to);
                                if (!from || !to) {
                                  return null;
                                }
                                return (
                                  <g key={`${edge.from}-${edge.to}`}>
                                    <path
                                      d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${Math.min(from.y, to.y) - 12} ${to.x} ${to.y}`}
                                      fill="none"
                                      stroke="rgba(126,173,255,0.34)"
                                      strokeWidth="1.4"
                                      className="energy-line"
                                    />
                                    <text
                                      x={(from.x + to.x) / 2}
                                      y={(from.y + to.y) / 2}
                                      textAnchor="middle"
                                      className="fill-white/55 text-[3px]"
                                    >
                                      {edge.label}
                                    </text>
                                  </g>
                                );
                              })}
                              {selectedInboxItem.graph.nodes.map((node) => (
                                <g key={node.id}>
                                  <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={node.tier === "core" ? 12 : 8}
                                    fill={node.tier === "core" ? "rgba(103,151,231,0.94)" : "rgba(44,72,122,0.96)"}
                                    stroke="rgba(222,236,255,0.45)"
                                    strokeWidth="1.2"
                                  />
                                  <circle
                                    cx={node.x}
                                    cy={node.y}
                                    r={node.tier === "core" ? 7 : 4}
                                    fill="rgba(217,233,255,0.16)"
                                  />
                                  <text
                                    x={node.x}
                                    y={node.y + (node.tier === "core" ? 20 : 15)}
                                    textAnchor="middle"
                                    className="fill-white text-[4px]"
                                  >
                                    {node.label}
                                  </text>
                                </g>
                              ))}
                            </svg>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedInboxItem.graph.chips.map((chip) => (
                              <span key={chip} className="rounded-full bg-white/6 px-3 py-1 text-[11px] text-white/72">
                                {chip}
                              </span>
                            ))}
                          </div>
                        </article>
                      ) : (
                        <article className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ec4ff]">Serendipity Push</p>
                          <h3 className="mt-2 text-xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                            {selectedInboxItem.title}
                          </h3>
                          <p className="mt-3 text-base leading-relaxed text-white/78">{selectedInboxItem.suggestion}</p>
                          <p className="mt-4 text-sm leading-relaxed text-white/64">{selectedInboxItem.summary}</p>
                          <div className="mt-4 space-y-2">
                            {selectedInboxItem.evidence.map((item) => (
                              <div key={item} className="rounded-[18px] bg-white/6 px-3 py-3 text-sm text-white/74">
                                {item}
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <span className="rounded-full bg-[#21416a]/70 px-3 py-1 text-[11px] text-[#b9d5ff]">
                              Related island: {selectedInboxItem.relatedIsland}
                            </span>
                            <button
                              onClick={() => openCanvasDetail(selectedInboxItem.relatedIsland)}
                              className="rounded-full bg-[linear-gradient(135deg,#204169,#315f96)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                            >
                              Open in Builder
                            </button>
                          </div>
                        </article>
                      )
                    ) : null}
                  </div>
                </section>
              </div>
            ) : activePanel === "builder" ? (
              <div className="space-y-4">

                <section className="rounded-[24px] border border-white/8 bg-white/[0.045] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/46">Live Takeaways</p>
                      <p className="mt-1 text-sm text-white/62">
                        {liveDraftCount
                          ? `${selectedDraftCount} selected / ${liveDraftCount} live draft takeaway${liveDraftCount === 1 ? "" : "s"}`
                          : "Parse a source to generate live draft takeaways for selection and saving."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setAllDraftTakeawaysEnabled(true)}
                        disabled={liveDraftCount === 0}
                        className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/74 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setAllDraftTakeawaysEnabled(false)}
                        disabled={liveDraftCount === 0}
                        className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/74 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => void saveSelectedToBrain()}
                        disabled={savingBrain || selectedDraftCount === 0}
                        className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#204169,#315f96)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingBrain ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                        Save selected
                      </button>
                    </div>
                  </div>

                  {!visibleTakeawayGroups.length ? (
                    <div className="mt-4 rounded-[18px] bg-white/[0.04] px-4 py-4 text-sm text-white/52">
                      No live takeaways yet. Paste a link or note in the input area and run parse to populate this panel.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {visibleTakeawayGroups.map(({ podcast, items }) => (
                        <article key={podcast.id} className="rounded-[22px] border border-white/10 bg-white/6 p-4">
                          <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{podcast.title}</p>
                              <p className="mt-1 line-clamp-1 text-xs text-white/50">{podcast.url}</p>
                            </div>
                            <button
                              onClick={() => void deletePodcast(podcast.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-[#b23a2d]/20 bg-[#f8ebe7] px-3 py-1.5 text-[11px] font-semibold text-[#934239]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete source
                            </button>
                          </div>

                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id} className="flex items-start gap-3 rounded-[20px] border border-white/8 bg-white/6 px-3 py-3">
                                <input
                                  type="checkbox"
                                  checked={item.enabled}
                                  onChange={() => {
                                    void toggleTakeawayEnabled(item.id);
                                  }}
                                  className="mt-1 h-4 w-4 rounded border-ink/30 text-teal focus:ring-teal"
                                />
                                <div className="flex-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    <span className="rounded-full bg-[#21416a]/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b9d5ff]">
                                      Draft
                                    </span>
                                  </div>
                                  <p className="text-sm leading-relaxed text-white/78">{item.text}</p>
                                </div>
                                <button
                                  onClick={() => {
                                    void deleteTakeaway(item.id);
                                  }}
                                  className="rounded-full border border-white/8 bg-white/6 p-2 text-white/60 transition hover:text-white"
                                  title="Delete takeaway"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>

                {activeCanvasDetail ? (
                  <section className="rounded-[24px] border border-[#6ba5ff]/20 bg-[linear-gradient(180deg,rgba(18,34,58,0.94),rgba(11,22,40,0.96))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ec4ff]">Island Thread</p>
                        <h2 className="mt-2 text-2xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                          {activeCanvasDetail.title}
                        </h2>
                      </div>
                      <button
                        onClick={() => setActiveCanvasDetail(null)}
                        className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs text-white/70"
                      >
                        Back to full builder
                      </button>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/72">{activeCanvasDetail.summary}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {activeCanvasDetail.evidence.map((item) => (
                        <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/76">
                          {item}
                        </span>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="grid gap-4 xl:grid-cols-2">
                  {presetIslandModules
                    .filter((module) => (activeCanvasDetail ? module.label === activeCanvasDetail.title : true))
                    .map((module) => (
                      <article
                        key={module.id}
                        className={`rounded-[24px] border p-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)] ${
                          module.role === "main"
                            ? "border-[#6ba5ff]/22 bg-[linear-gradient(180deg,rgba(28,49,82,0.86),rgba(13,25,43,0.96))] xl:col-span-2"
                            : "border-white/10 bg-[linear-gradient(180deg,rgba(18,31,52,0.72),rgba(11,21,37,0.9))]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#9ec4ff]">
                              {module.role === "main" ? "Main Island" : "Satellite Island"}
                            </p>
                            <h3 className="mt-2 text-2xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                              {module.label}
                            </h3>
                          </div>
                          {activeCanvasDetail?.title === module.label ? (
                            <span className="rounded-full border border-[#6ba5ff]/24 bg-[#21416a]/70 px-3 py-1 text-[11px] text-[#b9d5ff]">
                              Focused
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-white/72">{module.summary}</p>
                        <div className="mt-4 space-y-2">
                          {module.details.map((detail) => (
                            <div key={detail} className="rounded-[18px] bg-white/6 px-3 py-3 text-sm leading-relaxed text-white/76">
                              {detail}
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                </section>

              </div>
            ) : bootstrapping ? (
              <div className="flex h-full items-center justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/62">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Loading Inspiration workspace...
                </div>
              </div>
            ) : !activeConversation || activeConversation.messages.length === 0 ? (
              <section className="mx-auto flex h-full max-w-4xl flex-col justify-center">
                <p className="inline-flex w-fit items-center gap-2 rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
                  <WandSparkles className="h-3.5 w-3.5" />
                  Active synthesis demo
                </p>
                <h2 className="mt-5 max-w-4xl text-balance text-6xl leading-[0.92] text-white" style={{ fontFamily: "var(--font-heading)" }}>
                  Don&apos;t just collect fragments. Compose them.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/62">
                  Inspiration keeps the original podcast parsing pipeline, but drops it into a quieter midnight interface focused on synthesis instead of clutter.
                </p>
                <div className="mt-8 grid gap-3 md:grid-cols-3">
                  {legacyCards.map((card) => (
                    <article key={card} className="rounded-[22px] bg-white/[0.035] px-4 py-4">
                      <p className="text-xs leading-relaxed text-white/72">{card}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <div className="mx-auto flex max-w-4xl flex-col gap-3">
                {activeConversation.messages.map((message) => (
                  <article
                    key={message.id}
                    className={`rounded-[24px] px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "ml-10 bg-[linear-gradient(135deg,#1b3a61,#274a77)] text-white"
                        : "mr-10 border border-white/10 bg-[linear-gradient(180deg,rgba(14,27,46,0.84),rgba(9,18,32,0.92))] text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === "assistant" && message.contexts && message.contexts.length > 0 ? (
                      <div className="mt-3 rounded-[18px] border border-white/8 bg-white/6 px-3 py-2 text-xs text-white/58">
                        Grounded memory: {message.contexts.join(" | ")}
                      </div>
                    ) : null}
                  </article>
                ))}
                {chatBusy ? (
                  <div className="mr-10 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/6 px-4 py-2 text-xs text-white/62">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Thinking with selected memory...
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(9,17,30,0.86),rgba(7,13,24,0.96))] px-5 py-4">
            {hint ? <p className="mb-3 text-xs text-teal">{hint}</p> : null}
            <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,29,48,0.9),rgba(10,19,34,0.96))] p-4 shadow-[0_20px_44px_rgba(0,0,0,0.34)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7f9bc7]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Multi-modal Input Island
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/70">
                  <ImagePlus className="h-3.5 w-3.5" />
                  Add image
                  <input type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
                </label>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/70">
                  <Link2 className="h-3.5 w-3.5" />
                  {extractUrls(messageInput)[0] ? "External link detected" : "Link-ready"}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/70">
                  <Paperclip className="h-3.5 w-3.5" />
                  {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
                </span>
              </div>

              {attachments.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      onClick={() => removeAttachment(attachment.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/10 px-3 py-1.5 text-xs text-teal"
                    >
                      {attachment.kind === "image" ? <ImagePlus className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
                      {summarizeTextTitle(attachment.name)}
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <div className="flex flex-1 items-end gap-2 rounded-[22px] border border-white/10 bg-[#0f1b30] px-3 py-2">
                  <MessageSquare className="mb-2 h-4 w-4 shrink-0 text-white/42" />
                  <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onPaste={onInputPaste}
                    rows={2}
                    placeholder="Paste a podcast or long-video link, notes, or ask Inspiration about your curated memory..."
                    className="max-h-32 min-h-[52px] w-full resize-none bg-transparent text-sm text-white placeholder:text-white/28 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => void startParseAudio()}
                  disabled={parseState.running}
                  className="inline-flex h-12 items-center justify-center rounded-[18px] bg-teal px-4 text-sm font-semibold text-white transition hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {parseState.running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Waves className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => void sendMessage()}
                  disabled={chatBusy}
                  className="inline-flex h-12 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#1b3a61,#274a77)] px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="group flex h-full items-center justify-center">
          <button
            type="button"
            aria-label="Resize center and right panels"
            onMouseDown={() => setDragPane("right")}
            className="relative h-full w-full cursor-col-resize"
          >
            <span className="absolute left-1/2 top-1/2 h-24 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10 transition group-hover:bg-[#6ba5ff]/60" />
          </button>
        </div>

        <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,14,25,0.88),rgba(7,12,20,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
          <div className="night-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <div className="flex-none">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8caee6]">Islands</p>
              <h3 className="mt-2 text-2xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                Mind Overview & Insights
              </h3>
              {insightCluster ? <p className="mt-2 text-sm text-white/60">{insightCluster.title}</p> : null}
            </div>

            <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-[34px] bg-[radial-gradient(circle_at_20%_20%,rgba(57,83,118,0.38),transparent_30%),radial-gradient(circle_at_82%_18%,rgba(110,150,214,0.18),transparent_18%),radial-gradient(circle_at_65%_75%,rgba(42,83,148,0.2),transparent_20%),linear-gradient(180deg,rgba(5,10,20,0.98),rgba(10,17,31,0.98))]">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(97,143,234,0.14),transparent_28%)]" />
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <span className="star-streak left-[6%] top-[16%]" style={{ animationDelay: "0.2s", animationDuration: "7.4s" }} />
                <span className="star-streak left-[26%] top-[8%]" style={{ animationDelay: "2.1s", animationDuration: "8.2s" }} />
                <span className="star-streak left-[58%] top-[24%]" style={{ animationDelay: "4.3s", animationDuration: "7.8s" }} />
              </div>

              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M27 60 C40 50, 49 48, 60 52" stroke="rgba(133,181,255,0.42)" strokeWidth="0.34" fill="none" className="energy-line" />
                <path d="M45 49 C57 34, 67 31, 80 25" stroke="rgba(98,157,255,0.28)" strokeWidth="0.28" fill="none" className="energy-line" />
                <path d="M42 67 C54 72, 68 72, 82 64" stroke="rgba(98,157,255,0.26)" strokeWidth="0.28" fill="none" className="energy-line" />
                <path d="M32 58 C25 44, 21 35, 15 24" stroke="rgba(133,181,255,0.28)" strokeWidth="0.26" fill="none" className="energy-line" />
              </svg>

              <button
                onClick={() => openCanvasDetail(canvasLabels[0] ?? "Main Island")}
                className="island-pulse island-mass absolute left-[23%] top-[38%] z-10 h-52 w-56 overflow-hidden border border-[#85b5ff]/20 text-white shadow-[0_0_70px_rgba(87,140,255,0.18)] transition hover:scale-[1.02]"
                style={{ borderRadius: "44% 56% 52% 48% / 46% 44% 56% 54%" }}
              >
                <span className="island-shore absolute inset-[10px]" style={{ borderRadius: "43% 57% 51% 49% / 45% 43% 57% 55%" }} />
                <span className="island-ridge absolute left-[16%] top-[18%] h-14 w-20" style={{ borderRadius: "52% 48% 60% 40% / 42% 58% 42% 58%" }} />
                <span className="island-ridge absolute bottom-[18%] right-[16%] h-12 w-24 opacity-70" style={{ borderRadius: "43% 57% 48% 52% / 58% 42% 58% 42%" }} />
                <span className="island-lagoon absolute left-[38%] top-[36%] h-16 w-24" style={{ borderRadius: "48% 52% 45% 55% / 58% 42% 58% 42%" }} />
                <span className="relative z-10 px-6 text-base font-semibold">{canvasLabels[0] ?? "Main Island"}</span>
              </button>

              {canvasLabels.slice(1, 5).map((label, index) => {
                const positions = [
                  { top: "18%", left: "68%" },
                  { top: "68%", left: "70%" },
                  { top: "16%", left: "10%" },
                  { top: "72%", left: "10%" }
                ];
                const radii = [
                  "48% 52% 46% 54% / 58% 42% 58% 42%",
                  "58% 42% 52% 48% / 46% 54% 46% 54%",
                  "46% 54% 58% 42% / 52% 48% 52% 48%",
                  "52% 48% 44% 56% / 56% 44% 56% 44%"
                ];
                const position = positions[index] ?? positions[0];
                return (
                  <button
                    key={label}
                    className="floating-node island-mass absolute z-10 h-20 w-32 overflow-hidden border border-[#85b5ff]/14 px-4 py-2 text-xs text-white/82 shadow-[0_0_28px_rgba(104,145,255,0.14)] transition hover:scale-[1.02]"
                    style={{ ...position, borderRadius: radii[index] }}
                    onClick={() => openCanvasDetail(label)}
                  >
                    <span className="island-shore absolute inset-[6px]" style={{ borderRadius: radii[index] }} />
                    <span className="island-ridge absolute left-[16%] top-[18%] h-5 w-9 opacity-75" style={{ borderRadius: "52% 48% 60% 40% / 42% 58% 42% 58%" }} />
                    <span className="island-ridge absolute bottom-[18%] right-[16%] h-4 w-10 opacity-55" style={{ borderRadius: "43% 57% 48% 52% / 58% 42% 58% 42%" }} />
                    <span className="island-lagoon absolute left-[42%] top-[36%] h-5 w-8 opacity-80" style={{ borderRadius: "48% 52% 45% 55% / 58% 42% 58% 42%" }} />
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid flex-none gap-3">
              <section className="rounded-[24px] bg-white/6 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">Hidden commonality</p>
                <p className="mt-2 text-lg leading-snug text-white">{todayIntention}</p>
                <p className="mt-3 text-sm leading-relaxed text-white/68">{hiddenCommonality}</p>
              </section>

              <section className="rounded-[24px] bg-white/8 px-4 py-4 text-white/80">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">Recent important discoveries</p>
                <div className="mt-3 space-y-2 text-sm">
                  {insightHighlights.length ? insightHighlights.map((item) => <p key={item}>{item}</p>) : <p>Waiting for today&apos;s memory signals.</p>}
                </div>
              </section>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
