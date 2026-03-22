"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Edit3, LoaderCircle, Save, Send, SquarePen } from "lucide-react";
import {
  demoChatAnswer,
  getDemoCuratedTakeaways,
  getDemoTask,
  isDemoModeEnabled,
  saveDemoCuratedTakeaways
} from "@/lib/demo";

type TaskStatusResponse = {
  success: boolean;
  task_id: string;
  status: string;
  message: string;
  audio_url?: string | null;
  transcript?: string | null;
  title?: string | null;
  summary?: string | null;
  takeaways?: string[] | null;
  error?: string | null;
};

type SaveBrainResponse = {
  success: boolean;
  task_id: string;
  saved_count: number;
  message: string;
};

type ChatResponse = {
  success: boolean;
  answer: string;
  contexts: string[];
  context_count: number;
};

type EditableTakeaway = {
  id: number;
  text: string;
  draft: string;
  selected: boolean;
  editing: boolean;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  contexts?: string[];
};

function makeEditableTakeaways(items: string[]): EditableTakeaway[] {
  return items.map((text, index) => ({
    id: index,
    text,
    draft: text,
    selected: true,
    editing: false
  }));
}

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [task, setTask] = useState<TaskStatusResponse | null>(null);
  const [takeaways, setTakeaways] = useState<EditableTakeaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const [openaiKey, setOpenaiKey] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "assistant",
      content: "Ask me anything from your curated takeaways. I will answer only from retrieved context."
    }
  ]);

  const taskId = searchParams.get("taskId") ?? "";
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000", []);
  const isDemoMode = useMemo(() => isDemoModeEnabled(), []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOpenaiKey(
        window.sessionStorage.getItem("inspiration:openai-key") ?? window.sessionStorage.getItem("podbrain:openai-key") ?? ""
      );
    }
  }, []);

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      setError("Missing taskId. Please start from the landing page.");
      return;
    }

    if (isDemoMode) {
      const demo = getDemoTask(taskId);
      if (!demo) {
        setError("Demo task not found. Please restart from landing page.");
        setLoading(false);
        return;
      }

      setTask({
        success: true,
        task_id: demo.taskId,
        status: "completed",
        message: "Completed",
        audio_url: demo.audioUrl,
        transcript: demo.transcript,
        title: demo.title,
        summary: demo.summary,
        takeaways: demo.takeaways
      });
      setTakeaways(makeEditableTakeaways(demo.takeaways));
      setLoading(false);
      return;
    }

    let stopped = false;

    const fetchTask = async () => {
      try {
        const response = await fetch(`${apiBase}/api/tasks/${encodeURIComponent(taskId)}`, {
          method: "GET",
          cache: "no-store"
        });
        const data = (await response.json()) as TaskStatusResponse;

        if (!response.ok) {
          throw new Error((data as { detail?: string }).detail ?? "Failed to load dashboard data.");
        }

        if (stopped) {
          return;
        }

        setTask(data);

        if (data.status === "failed") {
          setError(data.error || "Task failed. Please go back and try again.");
        }

        if (data.status !== "completed") {
          router.replace(`/loading?taskId=${encodeURIComponent(taskId)}`);
          return;
        }

        const incoming = data.takeaways ?? [];
        setTakeaways(makeEditableTakeaways(incoming));
        setLoading(false);
      } catch (fetchError) {
        if (stopped) {
          return;
        }
        const message = fetchError instanceof Error ? fetchError.message : "Unexpected fetch error.";
        setError(message);
        setLoading(false);
      }
    };

    fetchTask();

    return () => {
      stopped = true;
    };
  }, [apiBase, isDemoMode, router, taskId]);

  const selectedCount = takeaways.filter((item) => item.selected && item.text.trim()).length;

  const toggleSelect = (id: number) => {
    setTakeaways((prev) => prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const startEdit = (id: number) => {
    setTakeaways((prev) => prev.map((item) => (item.id === id ? { ...item, editing: true, draft: item.text } : item)));
  };

  const cancelEdit = (id: number) => {
    setTakeaways((prev) => prev.map((item) => (item.id === id ? { ...item, editing: false, draft: item.text } : item)));
  };

  const commitEdit = (id: number) => {
    setTakeaways((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }
        const nextText = item.draft.trim() || item.text;
        return { ...item, text: nextText, draft: nextText, editing: false };
      })
    );
  };

  const onDraftChange = (id: number, value: string) => {
    setTakeaways((prev) => prev.map((item) => (item.id === id ? { ...item, draft: value } : item)));
  };

  const saveSelected = async () => {
    setSaveMessage(null);
    const selected = takeaways.filter((item) => item.selected && item.text.trim()).map((item) => item.text.trim());

    if (!selected.length) {
      setSaveMessage("Please select at least one takeaway.");
      return;
    }

    if (isDemoMode) {
      const count = saveDemoCuratedTakeaways(taskId, selected);
      setSaveMessage(`Demo saved ${count} takeaway(s) to local memory.`);
      return;
    }

    if (!openaiKey.trim()) {
      setSaveMessage("OpenAI API key is missing in this session. Please start again from landing page.");
      return;
    }

    try {
      setSaveBusy(true);
      const response = await fetch(`${apiBase}/api/brain/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          takeaways: selected,
          openaiApiKey: openaiKey.trim()
        })
      });

      const data = (await response.json()) as SaveBrainResponse & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || "Failed to save takeaways to vector database.");
      }

      setSaveMessage(data.message || `Saved ${data.saved_count} takeaway(s) to Inspiration memory.`);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Unexpected save error.";
      setSaveMessage(message);
    } finally {
      setSaveBusy(false);
    }
  };

  const sendChat = async () => {
    const question = chatInput.trim();
    if (!question) {
      return;
    }

    const userMessage: ChatMessage = { id: Date.now(), role: "user", content: question };
    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput("");

    if (isDemoMode) {
      const contexts = getDemoCuratedTakeaways(taskId);
      const result = demoChatAnswer(question, contexts);
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 20,
          role: "assistant",
          content: result.answer,
          contexts: result.contexts
        }
      ]);
      return;
    }

    if (!openaiKey.trim()) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "OpenAI API key is missing in this session. Please restart from the landing page."
        }
      ]);
      return;
    }

    try {
      setChatBusy(true);
      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          question,
          topK: 4,
          openaiApiKey: openaiKey.trim()
        })
      });

      const data = (await response.json()) as ChatResponse & { detail?: string };
      if (!response.ok) {
        throw new Error(data.detail || "Chat failed.");
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "assistant",
          content: data.answer,
          contexts: data.contexts
        }
      ]);
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : "Unexpected chat error.";
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 3,
          role: "assistant",
          content: `Chat error: ${message}`
        }
      ]);
    } finally {
      setChatBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(76,108,171,0.24),_transparent_18%),radial-gradient(circle_at_85%_10%,_rgba(86,141,255,0.16),_transparent_16%),linear-gradient(160deg,#050915_0%,#0a1222_45%,#0b1528_100%)] px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-5 py-3 text-sm text-white/80 shadow-soft">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading Inspiration review...
        </div>
      </main>
    );
  }

  if (error || !task) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center bg-[radial-gradient(circle_at_top_left,_rgba(76,108,171,0.24),_transparent_18%),radial-gradient(circle_at_85%_10%,_rgba(86,141,255,0.16),_transparent_16%),linear-gradient(160deg,#050915_0%,#0a1222_45%,#0b1528_100%)] px-6">
        <section className="w-full rounded-[28px] border border-[#b23a2d]/20 bg-[#f9e9e7] p-6 text-[#8f2f25] shadow-soft">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide">Inspiration Review Error</p>
          <p className="mb-5 text-sm">{error || "No task data available."}</p>
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-[#8f2f25] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7a281f]"
          >
            Back to Workspace
          </button>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(76,108,171,0.24),_transparent_18%),radial-gradient(circle_at_85%_10%,_rgba(86,141,255,0.16),_transparent_16%),linear-gradient(160deg,#050915_0%,#0a1222_45%,#0b1528_100%)] px-6 pb-48 pt-8 md:px-10">
        <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="mb-2 inline-flex items-center rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              Inspiration Review
            </p>
            <h1 className="mt-3 text-4xl leading-[0.96] text-white md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              {task.title || "Untitled Episode"}
            </h1>
            <p className="mt-3 text-sm text-white/62">Task: {task.task_id}</p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            New Intake
          </button>
        </header>

        {isDemoMode ? (
          <div className="mb-5 rounded-[24px] border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal">
            Demo Mode active: save and chat are running on local mock vector memory. In live mode this is powered by
            FastAPI + ChromaDB retrieval.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <article className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(8,14,26,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <h2 className="mb-3 text-2xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
              Source Context
            </h2>

            {task.audio_url ? (
              <audio controls preload="none" className="mb-4 w-full">
                <source src={task.audio_url} />
                Your browser does not support audio playback.
              </audio>
            ) : (
              <p className="mb-4 rounded-[18px] bg-white/6 px-3 py-2 text-sm text-white/62">Audio URL unavailable for this task.</p>
            )}

            <div className="mb-4 rounded-[22px] border border-white/10 bg-white/6 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/48">Summary</p>
              <p className="text-sm leading-relaxed text-white/80">{task.summary || "No summary generated."}</p>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/48">Full Transcript</p>
              <div className="max-h-[420px] overflow-y-auto rounded-[22px] border border-white/10 bg-[#0f1b30] p-4 text-sm leading-relaxed text-white/78">
                {task.transcript || "Transcript is empty."}
              </div>
            </div>
          </article>

          <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(8,14,26,0.94))] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl text-white" style={{ fontFamily: "var(--font-heading)" }}>
                Global RAG Builder
              </h2>
              <span className="rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
                {selectedCount} selected
              </span>
            </div>

            <div className="space-y-3">
              {takeaways.length ? (
                takeaways.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-white/10 bg-white/6 p-3">
                    <div className="mb-2 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleSelect(item.id)}
                        className="mt-1 h-4 w-4 rounded border-ink/30 text-teal focus:ring-teal"
                      />

                      <div className="w-full">
                        {item.editing ? (
                          <textarea
                            value={item.draft}
                            onChange={(e) => onDraftChange(item.id, e.target.value)}
                            className="min-h-20 w-full resize-y rounded-[16px] border border-white/10 bg-[#0f1b30] p-2 text-sm text-white focus:border-teal focus:outline-none"
                          />
                        ) : (
                          <p className="text-sm leading-relaxed text-white/80">{item.text}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      {item.editing ? (
                        <>
                          <button
                            onClick={() => cancelEdit(item.id)}
                            className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => commitEdit(item.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal/90"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Apply
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(item.id)}
                          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-[18px] border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/70">No takeaways generated.</p>
              )}
            </div>

            <button
              onClick={saveSelected}
              disabled={saveBusy}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saveBusy ? "Saving to Inspiration..." : "Save Selected to Inspiration Memory"}
            </button>

            {saveMessage ? (
              <p className="mt-3 inline-flex items-start gap-2 rounded-[18px] border border-teal/20 bg-teal/10 px-3 py-2 text-xs text-teal">
                <SquarePen className="mt-0.5 h-3.5 w-3.5" />
                {saveMessage}
              </p>
            ) : null}
          </aside>
        </section>
        </div>
      </main>

      <section className="fixed bottom-4 left-4 right-4 z-40 rounded-[28px] border border-white/10 bg-[rgba(9,17,30,0.92)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl md:left-auto md:w-[400px]">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-heading)" }}>
            Inspiration Chat
          </h3>
          <span className="text-[11px] text-white/48">
            {isDemoMode ? "Demo: local mocked retrieval context" : "Grounded on curated vector context"}
          </span>
        </div>

        <div className="mb-3 max-h-64 space-y-2 overflow-y-auto rounded-[22px] border border-white/10 bg-white/6 p-2">
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`rounded-[18px] px-3 py-2 text-xs ${msg.role === "user" ? "ml-8 bg-[linear-gradient(135deg,#1b3a61,#274a77)] text-white" : "mr-8 bg-white/6 text-white"}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {msg.role === "assistant" && msg.contexts && msg.contexts.length > 0 ? (
                <div className="mt-2 rounded-[14px] border border-white/10 bg-white/6 p-2 text-[11px] text-white/60">
                  Context used: {msg.contexts.slice(0, 2).join(" | ")}
                </div>
              ) : null}
            </div>
          ))}
          {chatBusy ? (
            <div className="mr-8 inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-2 text-xs text-white/62">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Thinking...
            </div>
          ) : null}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendChat();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask about this episode..."
            className="w-full rounded-full border border-white/10 bg-[#0f1b30] px-3 py-2 text-xs text-white placeholder:text-white/28 focus:border-teal focus:outline-none"
          />
          <button
            type="submit"
            disabled={chatBusy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-teal text-white hover:bg-teal/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>
    </>
  );
}
