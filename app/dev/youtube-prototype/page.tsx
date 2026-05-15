import { YoutubePrototypePlayer } from "@/components/youtube-prototype-player";
import { YOUTUBE_PROTOTYPE_ENABLED } from "@/lib/youtube/constants";

/**
 * Dev-only route — Phase 4 YouTube iframe playback sandbox.
 * Enable `NEXT_PUBLIC_WOODSHED_YOUTUBE_PROTOTYPE=true` locally.
 *
 * Does not alter production workspace routing when the flag is off beyond exposing this URL,
 * which shows setup instructions instead of the iframe player.
 */
export default function YoutubePrototypePage() {
  return (
    <main className="min-h-screen bg-stone-950 px-6 py-10 text-stone-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 border-b border-stone-800 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
            Dev · Phase 4
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            YouTube playback prototype
          </h1>
          <p className="text-sm text-stone-400">
            Validates{" "}
            <code className="rounded bg-stone-900 px-1 py-0.5 text-xs text-violet-200">
              MediaPlaybackSurface
            </code>{" "}
            via the official IFrame Player API only — no upload replacement, no WaveSurfer swap,
            no persistence changes.
          </p>
        </header>

        {!YOUTUBE_PROTOTYPE_ENABLED ? (
          <div className="rounded-lg border border-amber-900/50 bg-amber-950/25 px-4 py-3 text-sm text-amber-100">
            <p className="font-medium text-amber-50">Prototype disabled</p>
            <p className="mt-2 text-amber-100/90">
              Set{" "}
              <code className="rounded bg-stone-950 px-1.5 py-0.5 text-xs text-amber-200">
                NEXT_PUBLIC_WOODSHED_YOUTUBE_PROTOTYPE=true
              </code>{" "}
              in your env and restart the dev server, then reload this page.
            </p>
          </div>
        ) : (
          <YoutubePrototypePlayer />
        )}
      </div>
    </main>
  );
}
