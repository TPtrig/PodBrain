"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AudioLines, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { getDemoTask, isDemoModeEnabled } from "@/lib/demo";

type TaskStatusResponse = {
  success: boolean;
  task_id: string;
  status: string;
  message: string;
  error?: string | null;
};

const trivia = [
  "Whisper performs better on clean mono audio streams than noisy stereo mixes.",
  "A curated RAG index often outperforms larger unfiltered transcript dumps.",
  "Action-oriented takeaways lead to better retrieval quality than vague summaries.",
  "Podcast episodes with chapter marks can be chunked with higher semantic precision.",
  "Short, explicit user edits create stronger vector memory than raw model outputs.",
  "Retrieval grounding reduces hallucination risk in long-form conversational QA.",
  "Human-in-the-loop curation is the fastest quality lever in hackathon RAG demos."
];

const statusMap: Record<string, string> = {
  queued: "Queued and waiting for worker slot...",
  downloading: "Downloading Audio...",
  transcribing: "Transcribing with Whisper...",
  extracting: "Extracting Insights with GPT...",
  completed: "Completed",
  failed: "Processing failed"
};

export default function LoadingClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [task, setTask] = useState<TaskStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triviaIndex, setTriviaIndex] = useState(0);

  const taskId = searchParams.get("taskId") ?? "";
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000", []);
  const isDemoMode = useMemo(() => isDemoModeEnabled(), []);

  useEffect(() => {
    const rotate = window.setInterval(() => {
      setTriviaIndex((idx) => (idx + 1) % trivia.length);
    }, 5000);
    return () => window.clearInterval(rotate);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setError("Missing taskId. Please start from the landing page.");
      return;
    }

    if (isDemoMode) {
      const demo = getDemoTask(taskId);
      if (!demo) {
        setError("Demo task not found. Please restart from landing page.");
        return;
      }

      const states = ["queued", "downloading", "transcribing", "extracting", "completed"];
      let index = 0;
      setTask({ success: true, task_id: taskId, status: states[0], message: statusMap[states[0]] });

      const timer = window.setInterval(() => {
        index += 1;
        const next = states[Math.min(index, states.length - 1)];
        setTask({ success: true, task_id: taskId, status: next, message: statusMap[next] });

        if (next === "completed") {
          window.clearInterval(timer);
          window.setTimeout(() => {
            router.replace(`/dashboard?taskId=${encodeURIComponent(taskId)}`);
          }, 650);
        }
      }, 2200);

      return () => window.clearInterval(timer);
    }

    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch(`${apiBase}/api/tasks/${encodeURIComponent(taskId)}`, {
          method: "GET",
          cache: "no-store"
        });
        const data = (await response.json()) as TaskStatusResponse;

        if (!response.ok) {
          throw new Error((data as { detail?: string }).detail ?? "Failed to fetch task status.");
        }

        if (stopped) {
          return;
        }

        setTask(data);

        if (data.status === "completed") {
          router.replace(`/dashboard?taskId=${encodeURIComponent(taskId)}`);
          return;
        }

        if (data.status === "failed") {
          setError(data.error || "Task failed. Please try another URL.");
        }
      } catch (pollError) {
        if (stopped) {
          return;
        }
        const message = pollError instanceof Error ? pollError.message : "Unexpected polling error.";
        setError(message);
      }
    };

    poll();
    const interval = window.setInterval(poll, 2500);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [apiBase, isDemoMode, router, taskId]);

  const visualState = task?.status ?? "queued";
  const statusText = task?.message || statusMap[visualState] || "Preparing...";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(76,108,171,0.24),_transparent_18%),radial-gradient(circle_at_85%_10%,_rgba(86,141,255,0.16),_transparent_16%),linear-gradient(160deg,#050915_0%,#0a1222_45%,#0b1528_100%)] px-6 py-10 md:px-10">
      <section className="mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,18,34,0.92),rgba(8,14,26,0.94))] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-xl md:p-10">
        <div className="pointer-events-none absolute" />

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            {isDemoMode ? (
              <p className="mb-4 rounded-full border border-teal/20 bg-teal/10 px-4 py-2 text-xs text-teal">
                Demo simulation in progress. Live mode will keep polling FastAPI background tasks.
              </p>
            ) : null}

            <p className="inline-flex items-center gap-2 rounded-full border border-[#6ba5ff]/20 bg-[#21416a]/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b9d5ff]">
              <WandSparkles className="h-3.5 w-3.5" />
              Inspiration Intake
            </p>

            <h1 className="mt-5 text-4xl leading-[0.95] text-white md:text-5xl" style={{ fontFamily: "var(--font-heading)" }}>
              {statusMap[visualState] ?? "Processing..."}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/62">{statusText}</p>

            {error ? (
              <div className="mt-6 rounded-[24px] border border-[#b23a2d]/20 bg-[#f9e9e7] px-4 py-4 text-sm text-[#8f2f25]">{error}</div>
            ) : (
              <div className="mt-6 rounded-[24px] border border-white/10 bg-white/6 p-4">
                <div className="mb-4 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/48">
                  <span>Background parse</span>
                  <span>{visualState}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full animate-pulse rounded-full bg-gradient-to-r from-[#99c4c0] via-teal to-coral"
                    style={{ width: visualState === "queued" ? "18%" : visualState === "downloading" ? "42%" : visualState === "transcribing" ? "68%" : "86%" }}
                  />
                </div>
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-white/54">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  Task ID: <span className="font-mono">{taskId || "N/A"}</span>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(18,34,58,0.88),rgba(10,21,38,0.96))] p-6 shadow-[0_18px_42px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex items-center justify-between">
              <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8caee6]">
                <Sparkles className="h-3.5 w-3.5" />
                Smart Trivia Loader
              </p>
              <span className="rounded-full bg-white/8 px-3 py-1 text-[11px] text-white/55">
                {triviaIndex + 1}/{trivia.length}
              </span>
            </div>

            <div className="rounded-[22px] bg-white/6 px-4 py-5">
              <p className="min-h-24 text-sm leading-relaxed text-white/80">{trivia[triviaIndex]}</p>
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-white/54">
              <AudioLines className="h-3.5 w-3.5" />
              Parsing content in background... / 内容正在后台解析...
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
