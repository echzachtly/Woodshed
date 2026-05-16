import dynamic from "next/dynamic";
import { YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED } from "@/lib/youtube/constants";

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

/**
 * Phase 5 dev route — isolated YouTube practice workspace (no upload workspace edits).
 * Client-only mount avoids transient hydration mismatches from local persisted state.
 *
 * Set `NEXT_PUBLIC_WOODSHED_YOUTUBE_WORKSPACE=true` and restart `next dev`.
 */
export default function YoutubeWorkspaceDevPage() {
  return (
    <div className="min-h-screen bg-[#060504]">
      {!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED ? (
        <main className="mx-auto max-w-2xl px-6 py-12 text-stone-100">
          <h1 className="text-xl font-semibold tracking-tight">
            YouTube workspace prototype disabled
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-400">
            Enable{" "}
            <code className="rounded bg-stone-900 px-1.5 py-0.5 text-xs text-amber-200">
              NEXT_PUBLIC_WOODSHED_YOUTUBE_WORKSPACE=true
            </code>{" "}
            in your environment and restart the dev server.
          </p>
        </main>
      ) : (
        <YoutubeWorkspace />
      )}
    </div>
  );
}
