"use client";

/**
 * Dev sandbox — validates Phase 4 {@link YoutubeIframePlaybackSurface} against live iframe playback.
 *
 * **Not shipped to users.** Requires `NEXT_PUBLIC_WOODSHED_YOUTUBE_PROTOTYPE=true`.
 * Navigate to `/dev/youtube-prototype`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { MediaPlaybackSurface } from "@/lib/audio-engine";
import {
  YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID,
  YOUTUBE_PROTOTYPE_ENABLED,
} from "@/lib/youtube/constants";
import type { YoutubeIframePlayerLike } from "@/lib/youtube/iframe-player-types";
import { loadYoutubeIframeApi } from "@/lib/youtube/load-youtube-iframe-api";
import { extractYoutubeVideoId } from "@/lib/youtube/parse-video-id";
import { YoutubeIframePlaybackSurface } from "@/lib/youtube/youtube-playback-surface";
import { describeYoutubeIframeError } from "@/lib/youtube/youtube-errors";

const DEFAULT_WATCH_URL = `https://www.youtube.com/watch?v=${YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID}`;

const RATE_PRESETS = [0.25, 0.5, 1, 1.25, 1.5] as const;

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function YoutubePrototypePlayer() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubeIframePlayerLike | null>(null);
  const seekSecondsRef = useRef<HTMLInputElement>(null);

  const [videoInput, setVideoInput] = useState(DEFAULT_WATCH_URL);
  const resolvedId = useMemo(() => extractYoutubeVideoId(videoInput), [videoInput]);

  const [status, setStatus] = useState<
    "idle" | "loading_api" | "loading_player" | "ready" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [surface, setSurface] = useState<MediaPlaybackSurface | null>(null);
  const [, setUiPulse] = useState(0);

  /** Periodic UI refresh — iframe API has no fine-grained `timeupdate`; polling is intentional here. */
  useEffect(() => {
    if (!surface) return;
    const id = window.setInterval(() => setUiPulse((n) => n + 1), 120);
    return () => clearInterval(id);
  }, [surface]);

  useEffect(() => {
    if (!YOUTUBE_PROTOTYPE_ENABLED || !resolvedId) {
      setSurface(null);
      setStatus("idle");
      return undefined;
    }

    let cancelled = false;

    setStatus("loading_api");
    setErrorMessage(null);

    const boot = async () => {
      try {
        await loadYoutubeIframeApi();
        const mountEl = hostRef.current;
        if (cancelled || !mountEl) return;

        playerRef.current?.destroy?.();
        playerRef.current = null;
        setSurface(null);

        setStatus("loading_player");

        const YT = window.YT;
        if (!YT?.Player) {
          throw new Error("YT.Player constructor missing after iframe_api load.");
        }

        const player = new YT.Player(mountEl, {
          videoId: resolvedId,
          width: "640",
          height: "360",
          playerVars: {
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              const s = new YoutubeIframePlaybackSurface(player);
              setSurface(s);
              setStatus("ready");
              if (process.env.NODE_ENV === "development") {
                console.info("[Woodshed YouTube prototype] Player ready", {
                  videoId: resolvedId,
                  duration: s.getDuration(),
                });
              }
            },
            onError: (evt: { data: number }) => {
              if (cancelled) return;
              const msg = describeYoutubeIframeError(evt.data);
              setErrorMessage(msg);
              setStatus("error");
              setSurface(null);
              console.warn("[Woodshed YouTube prototype] Player error", evt.data, msg);
            },
          },
        });

        /** Capture immediately so Strict Mode / route teardown can destroy mid-bootstrap. */
        playerRef.current = player;
      } catch (e) {
        if (cancelled) return;
        const detail = e instanceof Error ? e.message : String(e);
        setErrorMessage(detail);
        setStatus("error");
        setSurface(null);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setSurface(null);
    };
  }, [resolvedId]);

  useEffect(() => {
    if (!surface || process.env.NODE_ENV !== "development") return;
    const id = window.setInterval(() => {
      console.debug("[Woodshed YouTube prototype] clock", {
        t: surface.getCurrentTime(),
        dur: surface.getDuration(),
        playing: surface.isPlaying(),
      });
    }, 2000);
    return () => clearInterval(id);
  }, [surface]);

  const applyParsedInput = useCallback(() => {
    const id = extractYoutubeVideoId(videoInput);
    if (!id) {
      setErrorMessage("Could not parse a valid YouTube video id from that input.");
      setStatus("error");
      return;
    }
    setErrorMessage(null);
  }, [videoInput]);

  const togglePlay = useCallback(() => {
    if (!surface) return;
    if (surface.isPlaying()) surface.pause();
    else void surface.play();
  }, [surface]);

  const seekRelative = useCallback(
    (delta: number) => {
      if (!surface) return;
      surface.seek(surface.getCurrentTime() + delta);
    },
    [surface],
  );

  const seekToField = useCallback(
    (raw: string) => {
      if (!surface) return;
      const n = Number.parseFloat(raw);
      if (!Number.isFinite(n)) return;
      surface.seek(n);
    },
    [surface],
  );

  if (!YOUTUBE_PROTOTYPE_ENABLED) return null;

  const liveTime = surface?.getCurrentTime() ?? 0;
  const liveDur = surface?.getDuration() ?? 0;

  return (
    <div className="max-w-3xl space-y-4 text-stone-200">
      <p className="text-sm leading-relaxed text-stone-400">
        Phase 4 adapter sandbox — playback stays inside Google&apos;s iframe (no audio download /
        extraction). Hook points for future workspace wiring live in{" "}
        <code className="rounded bg-stone-900 px-1 py-0.5 text-xs text-violet-200">
          YoutubeIframePlaybackSurface
        </code>{" "}
        implementing{" "}
        <code className="rounded bg-stone-900 px-1 py-0.5 text-xs text-violet-200">
          MediaPlaybackSurface
        </code>
        .
      </p>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Watch URL or video id
        </label>
        <input
          value={videoInput}
          onChange={(e) => setVideoInput(e.target.value)}
          className="rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none ring-violet-500/40 focus-visible:ring-2"
          spellCheck={false}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border border-stone-600 bg-stone-900 px-3 py-1.5 text-xs hover:bg-stone-800"
            onClick={applyParsedInput}
          >
            Validate parse
          </button>
          {!resolvedId ? (
            <span className="text-xs text-amber-400/90">
              Input does not resolve to an 11-character id yet.
            </span>
          ) : (
            <span className="text-xs text-stone-500">
              Resolved id:{" "}
              <code className="text-stone-300">{resolvedId}</code>
            </span>
          )}
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/35 px-3 py-2 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="text-xs text-stone-500">
        Loader status: <span className="text-stone-300">{status}</span>
      </div>

      <div
        ref={hostRef}
        className="max-h-[360px] max-w-[640px] overflow-hidden rounded-lg border border-stone-700 bg-black shadow-lg shadow-black/40"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!surface}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={togglePlay}
        >
          {surface?.isPlaying() ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          disabled={!surface}
          className="rounded-md border border-stone-600 px-3 py-1.5 text-xs hover:bg-stone-900 disabled:opacity-40"
          onClick={() => seekRelative(-5)}
        >
          −5s
        </button>
        <button
          type="button"
          disabled={!surface}
          className="rounded-md border border-stone-600 px-3 py-1.5 text-xs hover:bg-stone-900 disabled:opacity-40"
          onClick={() => seekRelative(5)}
        >
          +5s
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-stone-500">
          Seek (seconds)
          <input
            ref={seekSecondsRef}
            type="number"
            step="0.1"
            disabled={!surface}
            defaultValue={0}
            key={resolvedId ?? "none"}
            className="w-28 rounded border border-stone-700 bg-stone-950 px-2 py-1 text-sm disabled:opacity-40"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                seekToField((e.target as HTMLInputElement).value);
              }
            }}
          />
        </label>
        <button
          type="button"
          disabled={!surface}
          className="rounded-md border border-stone-600 px-3 py-1.5 text-xs hover:bg-stone-900 disabled:opacity-40"
          onClick={() => seekToField(seekSecondsRef.current?.value ?? "")}
        >
          Seek
        </button>
      </div>

      <div className="rounded-md border border-stone-800 bg-stone-950/80 px-3 py-2 font-mono text-xs text-stone-300">
        <div>
          currentTime: {formatClock(liveTime)} ({liveTime.toFixed(2)}s)
        </div>
        <div>
          duration: {formatClock(liveDur)} ({liveDur.toFixed(2)}s)
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="self-center text-xs text-stone-500">Playback rate</span>
        {RATE_PRESETS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={!surface}
            className="rounded border border-stone-700 px-2 py-1 text-xs hover:bg-stone-900 disabled:opacity-40"
            onClick={() => surface?.setPlaybackRate(r)}
          >
            {r}x
          </button>
        ))}
      </div>
    </div>
  );
}
