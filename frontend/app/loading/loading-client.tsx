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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12 md:px-10">
      <section className="relative overflow-hidden rounded-3xl border border-ink/10 bg-white/85 p-7 shadow-soft backdrop-blur md:p-10">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-coral/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-teal/20 blur-2xl" />

        <div className="relative grid gap-8 md:grid-cols-[1.2fr_0.8fr] md:items-center">
          <div>
            {isDemoMode ? (
              <p className="mb-3 rounded-lg border border-teal/25 bg-teal/10 px-3 py-2 text-xs text-teal">
                Demo simulation in progress. Real deployment polls FastAPI background tasks.
              </p>
            ) : null}
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-teal">
              <WandSparkles className="h-3.5 w-3.5" />
              Building Your PodBrain
            </p>

            <h1 className="mb-4 text-3xl leading-tight text-ink md:text-4xl" style={{ fontFamily: "var(--font-heading)" }}>
              {statusMap[visualState] ?? "Processing..."}
            </h1>

            <p className="mb-5 text-sm text-ink/75">{statusText}</p>

            {error ? (
              <div className="rounded-xl border border-[#b23a2d]/25 bg-[#f9e9e7] px-4 py-3 text-sm text-[#8f2f25]">{error}</div>
            ) : (
              <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                <div
                  className="h-full animate-pulse rounded-full bg-gradient-to-r from-teal via-coral to-teal"
                  style={{ width: visualState === "queued" ? "18%" : visualState === "downloading" ? "42%" : visualState === "transcribing" ? "68%" : "86%" }}
                />
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-dashed border-ink/20 bg-paper/70 p-5">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink/60">
              <Sparkles className="h-3.5 w-3.5" />
              Podcast Trivia / AI Tips
            </p>
            <p className="min-h-20 text-sm leading-relaxed text-ink/85">{trivia[triviaIndex]}</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ink/60">
              <AudioLines className="h-3.5 w-3.5" />
              Tip {triviaIndex + 1} of {trivia.length}
            </div>
          </aside>
        </div>

        <div className="relative mt-6 flex items-center gap-2 text-xs text-ink/55">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Task ID: <span className="font-mono">{taskId || "N/A"}</span>
        </div>
      </section>
    </main>
  );
}
