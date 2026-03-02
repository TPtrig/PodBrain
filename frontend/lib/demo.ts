export type DemoTaskData = {
  taskId: string;
  title: string;
  summary: string;
  transcript: string;
  audioUrl: string;
  takeaways: string[];
};

const DEMO_TASK_PREFIX = "podbrain:demo-task:";
const DEMO_CURATED_PREFIX = "podbrain:demo-curated:";

const DEMO_AUDIO =
  "https://file-examples.com/storage/fe7f0c9fdf5f8f53e9f8f9f/2017/11/file_example_MP3_700KB.mp3";

const DEMO_TAKEAWAYS = [
  "Turn long episodes into weekly action notes instead of passive summaries.",
  "Curation quality matters more than chunk quantity for downstream RAG answers.",
  "Run a weekly review loop: capture, edit, prune, and promote only high-signal ideas.",
  "Ground every chatbot response in saved takeaways to reduce hallucinations.",
  "Use simple metadata (theme, timestamp, task_id) to keep retrieval scoped and explainable."
];

const DEMO_TRANSCRIPT = [
  "Host: Welcome back. Today we are focusing on how to build a second brain from podcasts.",
  "Guest: The first step is extraction, but extraction alone is noisy.",
  "Guest: You need a human curation pass where you rewrite vague takeaways into actionable statements.",
  "Host: So the system should reward fewer but stronger takeaways?",
  "Guest: Exactly. Small, high-signal memory beats massive unfiltered transcripts.",
  "Guest: Then attach metadata like topic and timestamp for better retrieval later.",
  "Host: And for chat?",
  "Guest: Force the assistant to answer from curated memory only. If context is missing, it should say it does not know.",
  "Host: That keeps trust high and makes demos much clearer.",
  "Guest: Finally, run a weekly review loop to archive low-value notes and keep your brain clean."
].join(" ");

export function isDemoModeEnabled(): boolean {
  return (process.env.NEXT_PUBLIC_DEMO_MODE ?? "false") === "true";
}

export function createDemoTask(inputUrl: string): DemoTaskData {
  if (typeof window === "undefined") {
    throw new Error("Demo task creation requires browser environment.");
  }

  const taskId = `demo-${Date.now()}`;
  const title = inputUrl.toLowerCase().includes("startup")
    ? "Demo Episode: Startup Systems and Founder Focus"
    : "Demo Episode: Building a Podcast Second Brain";

  const data: DemoTaskData = {
    taskId,
    title,
    summary:
      "This demo episode explains a Human-in-the-Loop RAG flow: extract transcript insights, curate only high-signal takeaways, then chat strictly against curated memory.",
    transcript: DEMO_TRANSCRIPT,
    audioUrl: DEMO_AUDIO,
    takeaways: DEMO_TAKEAWAYS
  };

  window.sessionStorage.setItem(`${DEMO_TASK_PREFIX}${taskId}`, JSON.stringify(data));
  window.sessionStorage.setItem(`${DEMO_CURATED_PREFIX}${taskId}`, JSON.stringify(DEMO_TAKEAWAYS.slice(0, 3)));
  return data;
}

export function getDemoTask(taskId: string): DemoTaskData | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(`${DEMO_TASK_PREFIX}${taskId}`);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as DemoTaskData;
    if (!parsed || !parsed.taskId || !parsed.title) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveDemoCuratedTakeaways(taskId: string, takeaways: string[]): number {
  if (typeof window === "undefined") {
    return 0;
  }

  window.sessionStorage.setItem(`${DEMO_CURATED_PREFIX}${taskId}`, JSON.stringify(takeaways));
  return takeaways.length;
}

export function getDemoCuratedTakeaways(taskId: string): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.sessionStorage.getItem(`${DEMO_CURATED_PREFIX}${taskId}`);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string" && t.trim()) : [];
  } catch {
    return [];
  }
}

export function demoChatAnswer(question: string, curatedTakeaways: string[]): { answer: string; contexts: string[] } {
  const contexts = curatedTakeaways.filter((t) => t.trim());
  if (!contexts.length) {
    return {
      answer: "I don't know based on your saved takeaways.",
      contexts: []
    };
  }

  const keywords = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

  const scored = contexts
    .map((ctx) => {
      const lower = ctx.toLowerCase();
      const score = keywords.reduce((acc, kw) => (lower.includes(kw) ? acc + 1 : acc), 0);
      return { ctx, score };
    })
    .sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, 2).map((item) => item.ctx);

  if (selected.every((item, idx) => scored[idx]?.score === 0)) {
    return {
      answer: "I don't know based on your saved takeaways.",
      contexts: selected
    };
  }

  return {
    answer: `Based on your curated takeaways: ${selected.join(" ")}`,
    contexts: selected
  };
}
