"use client";

import dynamic from "next/dynamic";

const YoutubeWorkspace = dynamic(
  () => import("@/components/youtube-workspace").then((m) => m.YoutubeWorkspace),
  {
    ssr: false,
    loading: () => (
      <main className="mx-auto max-w-2xl px-6 py-12 text-stone-300">
        Loading YouTube workspace...
      </main>
    ),
  },
);

export function YoutubeWorkspaceClient() {
  return <YoutubeWorkspace />;
}
