import { Suspense } from "react";
import LoadingClient from "./loading-client";

export default function LoadingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <div className="inline-flex items-center gap-2 rounded-xl border border-ink/15 bg-white/80 px-4 py-3 text-sm text-ink/80 shadow-soft">
            Loading...
          </div>
        </main>
      }
    >
      <LoadingClient />
    </Suspense>
  );
}
