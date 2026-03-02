"use client";

/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  ChevronRight,
  CirclePlus,
  KeyRound,
  LibraryBig,
  Link2,
  LoaderCircle,
  MessageSquare,
  Send,
  Sparkles,
  Trash2
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const triviaTips = [
  "Whisper usually performs better when the source audio is clean and stable.",
  "Human curation before vector storage is a major quality boost for RAG.",
  "Ten high-quality takeaways often beat one hundred noisy ones.",
  "Source-linked memory entries make chatbot answers easier to trust.",
  "A strict fallback like 'I don't know' is better than guessing.",
  "Regularly pruning low-value memory improves retrieval precision.",
  "In hackathon demos, a smooth product loop matters more than perfect models."
];

const parseStages = [
  "Downloading Audio...",
  "Transcribing with Whisper...",
  "Extracting Insights...",
  "Finalizing Takeaways..."
];

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
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

function mockTakeawaysFromTitle(title: string): string[] {
  return [
    `${title}: Turn passive listening into concrete action notes.`,
    "Curate first: only high-signal takeaways should enter your brain.",
    "Weekly review loops help keep memory clean and useful.",
    "Grounded chat responses are safer than broad model guesses.",
    "Cross-episode synthesis helps form durable mental models."
  ];
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
    return `Podcast from ${host}: ${compact || "untitled"}`;
  } catch {
    return "Podcast Episode";
  }
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [activePanel, setActivePanel] = useState<"chat" | "builder">("chat");

  const [podcasts, setPodcasts] = useState<PodcastAsset[]>([]);
  const [takeaways, setTakeaways] = useState<TakeawayItem[]>([]);

  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [showParsePanel, setShowParsePanel] = useState(false);
  const [audioUrlInput, setAudioUrlInput] = useState("");

  const [parseState, setParseState] = useState<ParseState>({
    running: false,
    conversationId: null,
    stageIndex: 0,
    triviaIndex: 0,
    taskId: null
  });

  const [chatBusy, setChatBusy] = useState(false);
  const [savingBrain, setSavingBrain] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  const pollTimerRef = useRef<number | null>(null);
  const triviaTimerRef = useRef<number | null>(null);

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
  const selectedCount = enabledTakeaways.length;

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
        sourceLabel: "Saved to Brain",
        taskId: item.task_id,
        createdAt: parseIsoToMillis(item.created_at)
      });
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

        await Promise.all([loadConversationDetail(nextActive), refreshBrainItems()]);
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
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
      if (triviaTimerRef.current) {
        window.clearInterval(triviaTimerRef.current);
      }
    };
  }, []);

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

  const beginTriviaRotation = () => {
    if (triviaTimerRef.current) {
      window.clearInterval(triviaTimerRef.current);
    }
    triviaTimerRef.current = window.setInterval(() => {
      setParseState((prev) => ({ ...prev, triviaIndex: (prev.triviaIndex + 1) % triviaTips.length }));
    }, 5000);
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
      taskId: null
    });
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
        content: `Parsed podcast completed: ${title}. Review takeaways in Global RAG Builder.`,
        createdAt: Date.now()
      });
    }

    setAudioUrlInput("");
    setShowParsePanel(false);
    setHint("Parsing completed. Draft takeaways were added to RAG Builder.");
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
    const rawUrl = audioUrlInput.trim();
    const key = openaiApiKey.trim();

    if (!targetConversation) {
      setHint("Create a conversation first.");
      return;
    }
    if (!rawUrl) {
      setHint("Please paste an audio URL (or podcast page URL).");
      return;
    }
    if (!isDemoMode && !key) {
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
      taskId: null
    });
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
          const title = derivePodcastTitle(rawUrl);
          const podcast: PodcastAsset = {
            id: podcastId,
            title,
            url: rawUrl,
            sourceLabel: "Demo parser",
            createdAt: Date.now()
          };

          ensurePodcast(podcast);

          const drafts: TakeawayItem[] = mockTakeawaysFromTitle(title).map((text) => ({
            id: makeId("tk"),
            podcastId,
            podcastTitle: title,
            podcastUrl: rawUrl,
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
            content: `Demo parse completed: ${title}. Review takeaways in Global RAG Builder.`,
            createdAt: Date.now()
          });

          setAudioUrlInput("");
          setShowParsePanel(false);
          setHint("Demo parse completed. Draft takeaways were added to RAG Builder.");
          finishParse();
        }
      }, 1700);
      return;
    }

    try {
      const payload = await apiCreateProcess(rawUrl, key, targetConversation.id);
      setParseState((prev) => ({ ...prev, taskId: payload.task_id }));
      pollTaskUntilDone(payload.task_id, targetConversation.id, rawUrl);
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
      setHint(`Demo saved ${selectedDrafts.length} takeaway(s) to local brain.`);
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
      setHint(`Saved ${selectedDrafts.length} takeaway(s) to your brain.`);
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
      setHint("Some saved items failed to delete. Synced the latest brain items.");
      await refreshBrainItems();
    }
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
    <main className="h-screen w-full bg-[#efe8d8] p-3 text-ink">
      <div className="mx-auto flex h-full w-full max-w-[1600px] gap-3">
        <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white/90 shadow-soft backdrop-blur">
          <div className="flex h-1/3 min-h-[230px] flex-col gap-3 border-b border-ink/10 p-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-coral" />
              <p className="text-sm font-semibold tracking-wide" style={{ fontFamily: "var(--font-heading)" }}>
                PodBrain Workspace
              </p>
            </div>

            <button
              onClick={() => void createNewChat()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink/90"
            >
              <CirclePlus className="h-4 w-4" />
              New Chat
            </button>

            <button
              onClick={() => setActivePanel("builder")}
              className={`inline-flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${
                activePanel === "builder" ? "border-teal/30 bg-teal/10 text-teal" : "border-ink/15 bg-white text-ink hover:bg-paper"
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Brain className="h-4 w-4" />
                RAG Builder
              </span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-ink/75">{selectedCount}</span>
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-dashed border-ink/20 bg-paper/60 p-2">
              {podcasts.length ? (
                <ul className="space-y-1.5">
                  {podcasts.slice(0, 5).map((podcast) => (
                    <li key={podcast.id} className="rounded-md bg-white px-2 py-1.5 text-xs text-ink/80">
                      <p className="line-clamp-1 font-semibold">{podcast.title}</p>
                      <p className="line-clamp-1 text-[11px] text-ink/60">{podcast.sourceLabel}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-xs text-ink/60">No parsed podcasts yet.</p>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 p-3">
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-ink/60">Conversations</p>
            <div className="h-full space-y-1 overflow-y-auto pr-1">
              {conversationList.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setActiveConversationId(conversation.id);
                    setActivePanel("chat");
                    void loadConversationDetail(conversation.id);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${
                    conversation.id === effectiveActiveConversationId && activePanel === "chat"
                      ? "bg-teal/10 text-teal"
                      : "text-ink/80 hover:bg-paper"
                  }`}
                >
                  <span className="line-clamp-1 pr-2">{getConversationTitle(conversation)}</span>
                  <span className="text-[11px] text-ink/50">{conversation.messageCount}</span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white/92 shadow-soft backdrop-blur">
          <div className="flex-1 overflow-y-auto px-6 pb-52 pt-6 md:px-8">
            {activePanel === "builder" ? (
              <div className="space-y-4">
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-teal">Global RAG Builder</p>
                    <h2 className="text-2xl" style={{ fontFamily: "var(--font-heading)" }}>
                      Curated Podcast Takeaways
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
                      {selectedCount}/{takeaways.length} selected
                    </div>
                    <button
                      onClick={() => void saveSelectedToBrain()}
                      disabled={savingBrain}
                      className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingBrain ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                      Save Selected to My Brain
                    </button>
                  </div>
                </header>

                {!groupedTakeaways.length ? (
                  <div className="rounded-xl border border-dashed border-ink/20 bg-paper/60 p-4 text-sm text-ink/70">
                    No parsed podcast yet. Open a chat and parse audio from the composer area.
                  </div>
                ) : (
                  groupedTakeaways.map(({ podcast, items }) => (
                    <article key={podcast.id} className="rounded-xl border border-ink/10 bg-paper/45 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{podcast.title}</p>
                          <p className="line-clamp-1 text-xs text-ink/60">{podcast.url}</p>
                        </div>
                        <button
                          onClick={() => void deletePodcast(podcast.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#b23a2d]/25 bg-[#f9e9e7] px-2.5 py-1 text-xs font-semibold text-[#8f2f25] hover:bg-[#f6ddd9]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete Podcast
                        </button>
                      </div>

                      <div className="space-y-2">
                        {items.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 rounded-lg border border-ink/10 bg-white p-2.5">
                            <input
                              type="checkbox"
                              checked={item.enabled}
                              onChange={() => {
                                void toggleTakeawayEnabled(item.id);
                              }}
                              className="mt-1 h-4 w-4 rounded border-ink/30 text-teal focus:ring-teal"
                            />
                            <p className="flex-1 text-sm leading-relaxed text-ink/85">{item.text}</p>
                            <button
                              onClick={() => {
                                void deleteTakeaway(item.id);
                              }}
                              className="rounded-md border border-ink/15 bg-white p-1.5 text-ink/60 hover:bg-paper hover:text-ink"
                              title="Delete takeaway"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-5">
                {isDemoMode ? (
                  <p className="inline-flex items-center rounded-full border border-teal/25 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal">
                    Demo mode active: no backend required
                  </p>
                ) : null}

                {bootstrapping ? (
                  <div className="mx-auto mt-20 inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-paper/70 px-4 py-3 text-sm text-ink/70">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Loading workspace...
                  </div>
                ) : !activeConversation || activeConversation.messages.length === 0 ? (
                  <section className="mx-auto max-w-3xl space-y-5 pt-10">
                    <p className="inline-flex items-center gap-2 rounded-full border border-teal/25 bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal">
                      <Sparkles className="h-3.5 w-3.5" />
                      Human-in-the-loop RAG
                    </p>
                    <h1 className="text-balance text-5xl leading-[0.95] text-ink md:text-6xl" style={{ fontFamily: "var(--font-heading)" }}>
                      Don&apos;t just listen. Retain.
                    </h1>
                    <p className="text-balance text-2xl leading-tight text-ink/90 md:text-3xl" style={{ fontFamily: "var(--font-heading)" }}>
                      Turn Podcasts into Your Second Brain.
                    </p>
                    <p className="text-lg leading-relaxed text-ink/80">
                      Start a chat from the bottom composer. Parse one or multiple podcast links inside the conversation,
                      then manage global takeaways from RAG Builder before asking questions.
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        ["Extract", "Parse audio and draft takeaways automatically."],
                        ["Curate", "Enable/disable or delete takeaways in Global RAG Builder."],
                        ["Chat", "Answer grounded on globally selected vector memory."]
                      ].map(([title, desc]) => (
                        <article key={title} className="rounded-xl border border-ink/10 bg-paper/60 p-3">
                          <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
                          <p className="text-xs leading-relaxed text-ink/70">{desc}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                ) : (
                  <div className="mx-auto flex max-w-4xl flex-col gap-3">
                    {activeConversation.messages.map((message) => (
                      <article
                        key={message.id}
                        className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                          message.role === "user" ? "ml-10 bg-ink text-white" : "mr-10 border border-ink/10 bg-paper/65 text-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.role === "assistant" && message.contexts && message.contexts.length > 0 ? (
                          <div className="mt-2 rounded-lg border border-ink/10 bg-white/80 p-2 text-xs text-ink/70">
                            RAG context: {message.contexts.join(" | ")}
                          </div>
                        ) : null}
                      </article>
                    ))}

                    {chatBusy ? (
                      <div className="mr-10 inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-paper/65 px-3 py-2 text-xs text-ink/70">
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        Thinking with selected RAG memory...
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {parseState.running && parseState.conversationId === effectiveActiveConversationId ? (
            <div className="pointer-events-none absolute right-5 top-5 z-30 w-[320px] rounded-xl border border-teal/25 bg-white/96 p-3 shadow-soft">
              <p className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-teal">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Parsing Audio
              </p>
              <p className="text-sm font-semibold text-ink">{parseStages[parseState.stageIndex]}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink/70">{triviaTips[parseState.triviaIndex]}</p>
              {parseState.taskId ? <p className="mt-2 text-[11px] text-ink/50">Task: {parseState.taskId}</p> : null}
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 border-t border-ink/10 bg-white/96 px-5 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2">
              {hint ? <p className="text-xs text-teal">{hint}</p> : null}

              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-paper/55 px-3 py-2">
                <KeyRound className="h-3.5 w-3.5 text-ink/60" />
                <input
                  type="password"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder={isDemoMode ? "OpenAI API Key (optional in demo mode)" : "OpenAI API Key (required for parse/chat/save)"}
                  className="min-w-[220px] flex-1 bg-transparent text-xs text-ink placeholder:text-ink/45 focus:outline-none"
                />
                <p className="text-[11px] text-ink/55">Used only in this session and never stored by backend.</p>
              </div>

              <div className="flex items-end gap-2">
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  rows={2}
                  placeholder="Send a message..."
                  className="max-h-40 min-h-[48px] w-full resize-y rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/45 focus:border-teal focus:outline-none"
                />
                <button
                  onClick={() => void sendMessage()}
                  disabled={chatBusy}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
                  title="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowParsePanel((s) => !s)}
                  className="inline-flex items-center gap-1 rounded-lg border border-ink/15 bg-paper/70 px-2.5 py-1.5 text-xs font-semibold text-ink/80 hover:bg-paper"
                >
                  <LibraryBig className="h-3.5 w-3.5" />
                  Parse Audio
                  <ChevronRight className={`h-3.5 w-3.5 transition ${showParsePanel ? "rotate-90" : ""}`} />
                </button>

                <button
                  onClick={() => setActivePanel("builder")}
                  className="inline-flex items-center gap-1 rounded-lg border border-teal/25 bg-teal/10 px-2.5 py-1.5 text-xs font-semibold text-teal"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Open RAG Builder ({selectedCount})
                </button>
              </div>

              {showParsePanel ? (
                <div className="rounded-xl border border-ink/10 bg-paper/55 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/60">Parse Podcast Inside Current Chat</p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink/45" />
                      <input
                        value={audioUrlInput}
                        onChange={(e) => setAudioUrlInput(e.target.value)}
                        placeholder="Paste .mp3 or podcast URL"
                        className="w-full rounded-lg border border-ink/15 bg-white py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink/45 focus:border-teal focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={() => void startParseAudio()}
                      disabled={parseState.running}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {parseState.running ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                      {parseState.running ? "Parsing..." : "Start Parse"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-ink/60">
                    Multiple podcasts are supported per chat. Takeaways are drafted first, then you choose what to save into vector memory.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
