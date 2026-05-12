"use client";

import dynamic from "next/dynamic";

/**
 * Wavesurfer and friends must stay off the SSR path; Next 15 allows
 * `ssr: false` only inside Client Components.
 */
const WoodshedWorkspace = dynamic(
  () => import("@/components/woodshed-workspace"),
  {
    ssr: false,
    loading: () => (
      <section className="flex h-dvh flex-col items-center justify-center gap-3 bg-stone-950 text-stone-300">
        <div
          aria-hidden
          className="h-8 w-8 animate-pulse rounded-full bg-violet-400/30 ring-1 ring-violet-400/50"
        />
        <p className="text-sm tracking-wide text-stone-400">
          Tuning up the workspace…
        </p>
      </section>
    ),
  },
);

export default function Home() {
  return (
    <main className="h-dvh bg-stone-950 text-stone-50">
      <WoodshedWorkspace />
    </main>
  );
}
