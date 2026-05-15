"use client";

/**
 * Phase 5 — **isolated YouTube practice workspace** (dev-only).
 *
 * **Why separate from `woodshed-workspace.tsx`:**
 * Production remains WaveSurfer/upload-centric; merging iframe playback + synthetic timeline into that
 * module would balloon conditionals and risk regressions. This shell proves `MediaPlaybackSurface`,
 * `NeutralTimelinePrototype`, and `buildPlaybackLoopRail` compose for non-upload sources.
 *
 * **Future intent:** Fold proven patterns behind a router/layout choice (`mediaSource.kind`) once
 * persistence + import UX exist — likely extracting shared transport/timeline shells first.
 *
 * **Gaps vs production rollout:** No Dexie/cloud save, no WaveSurfer phrase handles (inspector numeric
 * edits only), coarse iframe clock vs decoded audio, tempo/rate caps vary by video.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { DesktopInspectorPanel } from "@/components/desktop-inspector-panel";
import { DesktopTransportBar } from "@/components/desktop-transport-bar";
import { NeutralTimelinePrototype } from "@/components/neutral-timeline/neutral-timeline-prototype";
import { PhrasePickerList } from "@/components/phrase-picker-list";
import {
  applyPlaybackTempo,
  type MediaPlaybackSurface,
} from "@/lib/audio-engine";
import type { YoutubeIframePlayerLike } from "@/lib/youtube/iframe-player-types";
import { YT_PLAYER_STATE } from "@/lib/youtube/iframe-player-types";
import {
  YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID,
  YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED,
} from "@/lib/youtube/constants";
import { describeYoutubeIframeError } from "@/lib/youtube/youtube-errors";
import { loadYoutubeIframeApi } from "@/lib/youtube/load-youtube-iframe-api";
import { extractYoutubeVideoId } from "@/lib/youtube/parse-video-id";
import { YoutubeIframePlaybackSurface } from "@/lib/youtube/youtube-playback-surface";
import {
  getRestartSeekSeconds,
  warpPlaybackToLoopRailIfNeeded,
} from "@/lib/playback-loop-rail";
import { useWoodshedStore } from "@/store/woodshed-store";

const DEFAULT_WATCH_URL = `https://www.youtube.com/watch?v=${YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID}`;

function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function YoutubeWorkspace() {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubeIframePlayerLike | null>(null);
  const bootstrapPollRef = useRef<number | null>(null);

  const [videoInput, setVideoInput] = useState(DEFAULT_WATCH_URL);
  const resolvedId = useMemo(() => extractYoutubeVideoId(videoInput), [videoInput]);

  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading_api" | "loading_player" | "ready" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackSurface, setPlaybackSurface] =
    useState<MediaPlaybackSurface | null>(null);

  const {
    duration,
    currentTime,
    isPlaying,
    loops,
    activeLoopId,
    activeLoop,
    editableLoopId,
    loopPlaybackEnabled,
    loopPracticeScope,
    activeSegmentId,
    lastPracticeSegmentIdByPhrase,
    minPxPerSec,
    bootstrapFromDuration,
    setProjectMeta,
    setPlaying,
    setCurrentTime,
    setMinPxPerSec,
    exitPhraseFitAfterUserNavigation,
    selectLoop,
    addLoopCandidate,
    cycleLoopPlaybackMode,
    setActiveLoopTempoFromPercent,
    resetWorkspace,
  } = useWoodshedStore(
    useShallow((s) => ({
      duration: s.duration,
      currentTime: s.currentTime,
      isPlaying: s.isPlaying,
      loops: s.loops,
      activeLoopId: s.activeLoopId,
      activeLoop:
        s.activeLoopId != null
          ? s.loops.find((l) => l.id === s.activeLoopId)
          : undefined,
      editableLoopId: s.editableLoopId,
      loopPlaybackEnabled: s.loopPlaybackEnabled,
      loopPracticeScope: s.loopPracticeScope,
      activeSegmentId: s.activeSegmentId,
      lastPracticeSegmentIdByPhrase: s.lastPracticeSegmentIdByPhrase,
      minPxPerSec: s.minPxPerSec,
      bootstrapFromDuration: s.bootstrapFromDuration,
      setProjectMeta: s.setProjectMeta,
      setPlaying: s.setPlaying,
      setCurrentTime: s.setCurrentTime,
      setMinPxPerSec: s.setMinPxPerSec,
      exitPhraseFitAfterUserNavigation: s.exitPhraseFitAfterUserNavigation,
      selectLoop: s.selectLoop,
      addLoopCandidate: s.addLoopCandidate,
      cycleLoopPlaybackMode: s.cycleLoopPlaybackMode,
      setActiveLoopTempoFromPercent: s.setActiveLoopTempoFromPercent,
      resetWorkspace: s.resetWorkspace,
    })),
  );

  const phraseHasFocusRegions = Boolean(activeLoop?.segments?.length);
  const regionContextActive = Boolean(
    activeSegmentId &&
      activeLoop?.segments?.some((x) => x.id === activeSegmentId),
  );

  /** Isolate global session — dev route shares the production store singleton. */
  useEffect(() => {
    resetWorkspace();
    return () => resetWorkspace();
  }, [resetWorkspace]);

  /** Bootstrap / teardown YouTube player when the resolved id changes. */
  useEffect(() => {
    if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED || !resolvedId) {
      setPlaybackSurface(null);
      setLoadStatus("idle");
      return undefined;
    }

    let cancelled = false;

    const clearBootstrapPoll = () => {
      if (bootstrapPollRef.current != null) {
        window.clearInterval(bootstrapPollRef.current);
        bootstrapPollRef.current = null;
      }
    };

    setLoadStatus("loading_api");
    setErrorMessage(null);

    const boot = async () => {
      resetWorkspace();
      try {
        await loadYoutubeIframeApi();
        const mountEl = hostRef.current;
        if (cancelled || !mountEl) return;

        playerRef.current?.destroy?.();
        playerRef.current = null;
        clearBootstrapPoll();
        setPlaybackSurface(null);

        setLoadStatus("loading_player");

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
              const surface = new YoutubeIframePlaybackSurface(player);
              setPlaybackSurface(surface);

              const tryHydrateDuration = (): boolean => {
                const dur = surface.getDuration();
                if (!(dur > 0)) return false;
                clearBootstrapPoll();
                bootstrapFromDuration(dur);
                setProjectMeta(null, `YouTube (${resolvedId})`, {
                  kind: "youtube",
                  videoId: resolvedId,
                  canonicalUrl: canonicalWatchUrl(resolvedId),
                  durationSeconds: dur,
                });
                applyPlaybackTempo(
                  surface,
                  useWoodshedStore.getState().activeLoopTemps(),
                );
                setLoadStatus("ready");
                setPlaying(
                  player.getPlayerState?.() === YT_PLAYER_STATE.PLAYING,
                );
                setCurrentTime(surface.getCurrentTime());
                return true;
              };

              if (!tryHydrateDuration()) {
                bootstrapPollRef.current = window.setInterval(() => {
                  if (cancelled || tryHydrateDuration()) {
                    clearBootstrapPoll();
                  }
                }, 160);
                window.setTimeout(() => clearBootstrapPoll(), 12000);
              }
            },
            onError: (evt: { data: number }) => {
              if (cancelled) return;
              clearBootstrapPoll();
              const msg = describeYoutubeIframeError(evt.data);
              setErrorMessage(msg);
              setLoadStatus("error");
              setPlaybackSurface(null);
            },
          },
        });

        playerRef.current = player;
      } catch (e) {
        if (cancelled) return;
        clearBootstrapPoll();
        const detail = e instanceof Error ? e.message : String(e);
        setErrorMessage(detail);
        setLoadStatus("error");
        setPlaybackSurface(null);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      clearBootstrapPoll();
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      setPlaybackSurface(null);
    };
  }, [
    resolvedId,
    resetWorkspace,
    bootstrapFromDuration,
    setProjectMeta,
    setPlaying,
    setCurrentTime,
  ]);

  /** Mirror WaveSurfer tempo path — YouTube ignores pitch-preservation (`getMediaElement` absent). */
  useEffect(() => {
    if (!playbackSurface || !(duration > 0)) return;
    applyPlaybackTempo(playbackSurface, activeLoop?.tempo ?? 1);
  }, [playbackSurface, duration, activeLoop?.tempo, activeLoop?.id]);

  /** Tight loop boundary + UI clock — iframe has no native `timeupdate`. */
  useEffect(() => {
    if (!isPlaying || !playbackSurface) return;
    let raf = 0;
    let stopped = false;
    const surface = playbackSurface;
    const step = () => {
      if (stopped) return;
      if (!surface.isPlaying()) {
        setPlaying(false);
        setCurrentTime(surface.getCurrentTime());
        return;
      }
      const st = useWoodshedStore.getState();
      warpPlaybackToLoopRailIfNeeded(surface, {
        loops: st.loops,
        activeLoopId: st.activeLoopId,
        loopPlaybackEnabled: st.loopPlaybackEnabled,
        activeSegmentId: st.activeSegmentId,
        loopPracticeScope: st.loopPracticeScope,
        lastPracticeSegmentIdByPhrase: st.lastPracticeSegmentIdByPhrase,
      });
      st.setCurrentTime(surface.getCurrentTime());
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [isPlaying, playbackSurface, setPlaying, setCurrentTime]);

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }, []);

  const handleNeutralTimelineSeek = useCallback(
    (sec: number) => {
      exitPhraseFitAfterUserNavigation();
      playbackSurface?.seek(sec);
      setCurrentTime(sec);
    },
    [playbackSurface, exitPhraseFitAfterUserNavigation, setCurrentTime],
  );

  const handleNeutralTimelinePxPerSec = useCallback(
    (next: number) => {
      exitPhraseFitAfterUserNavigation();
      setMinPxPerSec(next);
    },
    [exitPhraseFitAfterUserNavigation, setMinPxPerSec],
  );

  const handleTransportTogglePlay = useCallback(() => {
    if (!playbackSurface) return;
    if (playbackSurface.isPlaying()) {
      playbackSurface.pause();
      setPlaying(false);
    } else {
      void playbackSurface.play();
      setPlaying(true);
    }
  }, [playbackSurface, setPlaying]);

  const handleTransportEditContext = useCallback(() => {
    const st = useWoodshedStore.getState();
    if (!activeLoopId) return;
    if (st.editableLoopId === activeLoopId) {
      st.setEditableLoopId(null);
      return;
    }
    const loop = st.loops.find((l) => l.id === activeLoopId);
    const segId = st.activeSegmentId;
    const hasSeg = Boolean(
      segId && loop?.segments?.some((s) => s.id === segId),
    );
    if (hasSeg) {
      st.requestInspectorSegmentFieldFocus();
      return;
    }
    st.setEditableLoopId(activeLoopId);
    st.setActiveSegmentId(null);
  }, [activeLoopId]);

  const handleTransportDeleteContext = useCallback(() => {
    const st = useWoodshedStore.getState();
    if (!activeLoopId) return;
    const loop = st.loops.find((l) => l.id === activeLoopId);
    const segId = st.activeSegmentId;
    if (segId && loop?.segments?.some((s) => s.id === segId)) {
      st.removeSegment(activeLoopId, segId);
      return;
    }
    st.removeLoop(activeLoopId);
  }, [activeLoopId]);

  const handleTransportTempo = useCallback(
    (pct: number) => {
      useWoodshedStore.getState().setActiveLoopTempoFromPercent(pct);
      const surface = playbackSurface;
      if (!surface) return;
      applyPlaybackTempo(surface, useWoodshedStore.getState().activeLoopTemps());
    },
    [playbackSurface],
  );

  const handleRestartLoop = useCallback(() => {
    if (!playbackSurface || !activeLoopId) return;
    const st = useWoodshedStore.getState();
    const loop = loops.find((l) => l.id === activeLoopId);
    if (!loop) return;
    playbackSurface.seek(
      getRestartSeekSeconds({
        loop,
        loopPracticeScope: st.loopPracticeScope,
        activeSegmentId: st.activeSegmentId,
        lastPracticeSegmentIdByPhrase: st.lastPracticeSegmentIdByPhrase,
      }),
    );
    setCurrentTime(playbackSurface.getCurrentTime());
    void playbackSurface.play();
    setPlaying(true);
  }, [
    playbackSurface,
    activeLoopId,
    loops,
    setCurrentTime,
    setPlaying,
  ]);

  if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) return null;

  const timelineIdle = !playbackSurface || !(duration > 0);

  return (
    <section className="flex min-h-screen flex-col bg-[#060504] text-stone-100">
      <header className="border-b border-stone-800/80 px-4 py-3 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400">
          Dev · Phase 5 · YouTube workspace
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-stone-50">
          Isolated practice shell (iframe playback + synthetic timeline)
        </h1>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500">
          Uses the shared Zustand store, desktop transport + inspector, and loop rail helpers —
          without WaveSurfer or upload persistence. Restart / phrase vs focus looping matches
          production semantics via{" "}
          <code className="rounded bg-stone-900 px-1 py-0.5 text-[10px] text-violet-200">
            buildPlaybackLoopRail
          </code>
          .
        </p>

        <div className="mt-4 flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="yt-workspace-url">
            YouTube URL or video id
          </label>
          <input
            id="yt-workspace-url"
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            spellCheck={false}
            className="min-w-0 flex-1 rounded-md border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none ring-violet-500/40 focus-visible:ring-2"
          />
          {!resolvedId ? (
            <span className="text-xs text-amber-400/90">
              Paste a watch URL or 11-character id.
            </span>
          ) : (
            <span className="text-xs text-stone-500">
              Resolved{" "}
              <code className="text-stone-300">{resolvedId}</code>
              {" · "}
              <span className="text-stone-600">{loadStatus}</span>
            </span>
          )}
        </div>
      </header>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-red-900/55 bg-red-950/35 px-3 py-2 text-sm text-red-100 sm:mx-6">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex shrink-0 justify-center border-b border-stone-900/80 bg-black/40 px-4 py-4">
        <div
          ref={hostRef}
          className="aspect-video w-full max-w-[720px] overflow-hidden rounded-lg border border-stone-800 bg-black shadow-lg shadow-black/50"
        />
      </div>

      {duration > 0 ? (
        <NeutralTimelinePrototype
          duration={duration}
          currentTime={currentTime}
          loops={loops}
          activeLoopId={activeLoopId}
          activeSegmentId={activeSegmentId}
          pxPerSec={minPxPerSec}
          onPxPerSecChange={handleNeutralTimelinePxPerSec}
          onSeek={handleNeutralTimelineSeek}
        />
      ) : (
        <div className="border-b border-stone-900 bg-[#070605] px-4 py-6 text-center text-sm text-stone-600">
          {resolvedId
            ? "Timeline appears once YouTube reports duration."
            : "Enter a valid video URL to load."}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden lg:gap-px">
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-stone-800/90 bg-[#070605] lg:flex">
          <div className="border-b border-stone-800/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
            Practice Sections
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <PhrasePickerList
              loops={loops}
              activeLoopId={activeLoopId}
              onPickPhrase={(id) => selectLoop(id)}
              showNewPhrase
              onNewPhrase={() => addLoopCandidate()}
            />
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DesktopTransportBar
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            timelineIdle={timelineIdle}
            loopPlaybackEnabled={loopPlaybackEnabled}
            canEnableLoopPlayback={Boolean(
              activeLoop && activeLoop.end > activeLoop.start,
            )}
            loopPracticeScope={loopPracticeScope}
            hasActivePhrase={Boolean(
              activeLoop && activeLoop.end > activeLoop.start,
            )}
            phraseHasFocusRegions={phraseHasFocusRegions}
            regionContextActive={regionContextActive}
            activeLoopId={activeLoopId}
            editableLoopId={editableLoopId}
            onToggleEditContext={handleTransportEditContext}
            onDeleteContext={handleTransportDeleteContext}
            tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
            onTogglePlay={handleTransportTogglePlay}
            onRestartLoop={handleRestartLoop}
            onCycleLoopPlaybackMode={() => cycleLoopPlaybackMode()}
            onTempoSlider={handleTransportTempo}
            formatTime={(t) => formatTime(t)}
          />
          <div className="min-h-0 flex-1 overflow-y-auto border-t border-stone-800/70 bg-[#070605]/95">
            <DesktopInspectorPanel />
          </div>
        </div>
      </div>

      {/* Mobile: phrase picker strip */}
      <div className="border-t border-stone-800 bg-[#070605] px-3 py-2 lg:hidden">
        <PhrasePickerList
          loops={loops}
          activeLoopId={activeLoopId}
          onPickPhrase={(id) => selectLoop(id)}
          showNewPhrase
          onNewPhrase={() => addLoopCandidate()}
          listClassName="max-h-[30vh]"
        />
      </div>
    </section>
  );
}
