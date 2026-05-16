"use client";

/**
 * Phase 5–6 — **isolated YouTube practice workspace** (dev-only).
 *
 * **Why separate from `woodshed-workspace.tsx`:**
 * Production remains WaveSurfer/upload-centric; merging iframe playback + synthetic timeline into that
 * module would balloon conditionals and risk regressions. This shell proves `MediaPlaybackSurface`,
 * `NeutralTimelinePrototype`, and `buildPlaybackLoopRail` compose for non-upload sources.
 *
 * **Phase 6:** Dexie-backed session lifecycle (`youtube-dexie-project.ts`) — stores metadata + phrases +
 * practice prefs only (no audio bytes). Reload streams via YouTube iframe API using persisted `videoId`.
 *
 * **Future intent:** Fold proven patterns behind `mediaSource.kind` routing once prod import UX lands.
 *
 * Phase 6B — **Synthetic timeline authoring** stays here so production upload keeps WaveSurfer-only
 * region plugins; gestures map pixels→seconds locally (`NeutralTimelineAuthoringConfig`).
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
import {
  NeutralTimelinePrototype,
  type SyntheticTimelineAuthoringConfig,
} from "@/components/neutral-timeline/neutral-timeline-prototype";
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
import {
  loadProject,
  saveProject,
} from "@/lib/project-db";
import type { ValidatedYoutubeDexieProjectMeta } from "@/lib/youtube/youtube-dexie-project";
import {
  captureYoutubeDexieProjectPayload,
  hydrateYoutubeDexieIntoStore,
  listValidatedYoutubeDexieProjects,
  validateYoutubeDexieProjectMeta,
} from "@/lib/youtube/youtube-dexie-project";
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

  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [savedYoutubeProjects, setSavedYoutubeProjects] = useState<
    ValidatedYoutubeDexieProjectMeta[]
  >([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [persistenceHint, setPersistenceHint] = useState<string | null>(null);
  const [persistenceErr, setPersistenceErr] = useState<string | null>(null);
  /** Phase 6B — synthetic strip only (`NeutralTimelinePrototype`); upload workspace unchanged */
  const [syntheticTimelineMode, setSyntheticTimelineMode] = useState<"pan" | "edit">(
    "pan",
  );
  const [syntheticEditTool, setSyntheticEditTool] = useState<"section" | "focus">(
    "section",
  );

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
    mediaSource,
    projectId,
    projectName,
    bootstrapFromDuration,
    setProjectMeta,
    setPlaying,
    setCurrentTime,
    setDuration,
    setMinPxPerSec,
    exitPhraseFitAfterUserNavigation,
    selectLoop,
    addLoopCandidate,
    cycleLoopPlaybackMode,
    setActiveLoopTempoFromPercent,
    resetWorkspace,
    createPhraseFromShiftDrag,
    createFocusSegmentFromShiftDrag,
    renameLoop,
    selectSegment,
    updateLoopBounds,
    updateSegment,
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
      mediaSource: s.mediaSource,
      projectId: s.projectId,
      projectName: s.projectName,
      bootstrapFromDuration: s.bootstrapFromDuration,
      setProjectMeta: s.setProjectMeta,
      setPlaying: s.setPlaying,
      setCurrentTime: s.setCurrentTime,
      setDuration: s.setDuration,
      setMinPxPerSec: s.setMinPxPerSec,
      exitPhraseFitAfterUserNavigation: s.exitPhraseFitAfterUserNavigation,
      selectLoop: s.selectLoop,
      addLoopCandidate: s.addLoopCandidate,
      cycleLoopPlaybackMode: s.cycleLoopPlaybackMode,
      setActiveLoopTempoFromPercent: s.setActiveLoopTempoFromPercent,
      resetWorkspace: s.resetWorkspace,
      createPhraseFromShiftDrag: s.createPhraseFromShiftDrag,
      createFocusSegmentFromShiftDrag: s.createFocusSegmentFromShiftDrag,
      renameLoop: s.renameLoop,
      selectSegment: s.selectSegment,
      updateLoopBounds: s.updateLoopBounds,
      updateSegment: s.updateSegment,
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

  const refreshSavedYoutubeProjects = useCallback(async () => {
    try {
      const rows = await listValidatedYoutubeDexieProjects();
      setSavedYoutubeProjects(rows);
    } catch {
      setPersistenceErr("Could not read Dexie projects.");
    }
  }, []);

  useEffect(() => {
    if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) return;
    void refreshSavedYoutubeProjects();
  }, [refreshSavedYoutubeProjects]);

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
                const st = useWoodshedStore.getState();
                if (st.loops.length === 0) {
                  bootstrapFromDuration(dur);
                  setProjectMeta(null, `YouTube (${resolvedId})`, {
                    kind: "youtube",
                    videoId: resolvedId,
                    canonicalUrl: canonicalWatchUrl(resolvedId),
                    durationSeconds: dur,
                  });
                } else {
                  setDuration(Math.max(st.duration || 0, dur));
                  const ms = st.mediaSource;
                  if (ms.kind === "youtube") {
                    setProjectMeta(st.projectId, st.projectName, {
                      ...ms,
                      videoId: resolvedId,
                      canonicalUrl: canonicalWatchUrl(resolvedId),
                      durationSeconds: dur,
                    });
                  }
                }
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
    sessionGeneration,
    bootstrapFromDuration,
    setProjectMeta,
    setPlaying,
    setCurrentTime,
    setDuration,
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

  const handleCreateYoutubeProjectSession = useCallback(() => {
    setPersistenceErr(null);
    setPersistenceHint(null);
    resetWorkspace();
    setSessionGeneration((n) => n + 1);
  }, [resetWorkspace]);

  const handleSaveYoutubeDexieProject = useCallback(async () => {
    const st = useWoodshedStore.getState();
    if (st.mediaSource.kind !== "youtube") {
      setPersistenceErr(
        "Wait until the iframe session is active before saving.",
      );
      return;
    }
    setPersistenceErr(null);
    setSaveBusy(true);
    try {
      const payload = captureYoutubeDexieProjectPayload({
        projectId: st.projectId,
        projectName: st.projectName,
        mediaSource: st.mediaSource,
        loops: st.loops,
        activeLoopId: st.activeLoopId,
        durationSeconds: st.duration,
        minPxPerSec: st.minPxPerSec,
        loopPlaybackEnabled: st.loopPlaybackEnabled,
        loopPracticeScope: st.loopPracticeScope,
        activeSegmentId: st.activeSegmentId,
        lastPracticeSegmentIdByPhrase: st.lastPracticeSegmentIdByPhrase,
      });
      await saveProject(payload);
      const ms = payload.mediaSource;
      if (!ms || ms.kind !== "youtube") {
        throw new Error("Save payload missing YouTube mediaSource.");
      }
      st.setProjectMeta(payload.id, payload.name, ms);
      setPersistenceHint(`Saved locally (${payload.name}).`);
      await refreshSavedYoutubeProjects();
    } catch (e) {
      setPersistenceErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  }, [refreshSavedYoutubeProjects]);

  const handleLoadYoutubeDexieProject = useCallback(async (id: string) => {
    setPersistenceErr(null);
    try {
      const row = await loadProject(id);
      if (!row) {
        setPersistenceErr("Dexie row missing.");
        return;
      }
      const v = validateYoutubeDexieProjectMeta(row);
      if (!v.ok) {
        setPersistenceErr(v.reason);
        return;
      }
      hydrateYoutubeDexieIntoStore(v.meta);
      setVideoInput(v.meta.mediaSource.canonicalUrl);
      setPersistenceHint(`Loaded '${v.meta.name}'.`);
      setSessionGeneration((n) => n + 1);
      setErrorMessage(null);
    } catch (e) {
      setPersistenceErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

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

  const youtubeSyntheticAuthoring = useMemo<
    SyntheticTimelineAuthoringConfig | undefined
  >(() => {
    if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED || !(duration > 0)) return undefined;
    return {
      enabled: true,
      interactionMode: syntheticTimelineMode,
      onInteractionModeChange: setSyntheticTimelineMode,
      editTool: syntheticEditTool,
      onEditToolChange: setSyntheticEditTool,
      activePhraseId: activeLoopId,
      onPhraseBandDragCreate: (startSec, endSec) => {
        exitPhraseFitAfterUserNavigation();
        const phrase = createPhraseFromShiftDrag(startSec, endSec);
        if (!phrase) return;
        const ordinal = useWoodshedStore.getState().loops.length;
        renameLoop(phrase.id, `Practice Section ${ordinal}`);
        playbackSurface?.seek(phrase.start);
        setCurrentTime(phrase.start);
      },
      onFocusBandDragCreate: (phraseId, startSec, endSec) => {
        exitPhraseFitAfterUserNavigation();
        const built = createFocusSegmentFromShiftDrag({
          phraseId,
          startSec,
          endSec,
        });
        if (!built) return;
        playbackSurface?.seek(built.seekTo);
        setCurrentTime(built.seekTo);
      },
      onSelectPhrase: (id) => selectLoop(id),
      onSelectFocus: (phraseId, segmentId) =>
        selectSegment(phraseId, segmentId),
      onPhraseBoundsCommit: (phraseId, startSec, endSec) =>
        updateLoopBounds(phraseId, startSec, endSec),
      onSegmentBoundsCommit: (phraseId, segmentId, startSec, endSec) =>
        updateSegment(phraseId, segmentId, {
          startTime: startSec,
          endTime: endSec,
        }),
    };
  }, [
    activeLoopId,
    createFocusSegmentFromShiftDrag,
    createPhraseFromShiftDrag,
    duration,
    exitPhraseFitAfterUserNavigation,
    playbackSurface,
    renameLoop,
    selectLoop,
    selectSegment,
    syntheticEditTool,
    syntheticTimelineMode,
    updateLoopBounds,
    updateSegment,
    setCurrentTime,
  ]);

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
          Dev · Phase 5–6 · YouTube workspace
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-stone-50">
          Isolated practice shell (iframe playback + synthetic timeline)
        </h1>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500">
          Shared store + desktop transport + inspector + loop rails — without WaveSurfer.
          Phase 6 adds Dexie-only persistence for YouTube metadata + phrases + practice prefs (no audio bytes).
          Restart / looping semantics mirror production via{" "}
          <code className="rounded bg-stone-900 px-1 py-0.5 text-[10px] text-violet-200">
            buildPlaybackLoopRail
          </code>
          .
        </p>

        <p className="mt-2 font-mono text-[10px] text-stone-600">
          {projectId ? `${projectName} · ${projectId}` : `${projectName} · unsaved`}
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

        <div className="mt-4 flex max-w-3xl flex-col gap-2 border-t border-stone-800/70 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            className="rounded-md border border-stone-600 bg-stone-900 px-3 py-2 text-xs font-medium text-stone-100 hover:bg-stone-800"
            onClick={handleCreateYoutubeProjectSession}
          >
            New YouTube session
          </button>
          <button
            type="button"
            disabled={
              saveBusy ||
              mediaSource.kind !== "youtube" ||
              !(duration > 0)
            }
            className="rounded-md bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => void handleSaveYoutubeDexieProject()}
          >
            {saveBusy ? "Saving…" : "Save to Dexie"}
          </button>
          <select
            className="max-w-full rounded-md border border-stone-700 bg-stone-950 px-2 py-2 text-xs text-stone-200 sm:max-w-xs"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) void handleLoadYoutubeDexieProject(id);
              e.target.value = "";
            }}
          >
            <option value="">Load saved YouTube project…</option>
            {savedYoutubeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.mediaSource.videoId}
              </option>
            ))}
          </select>
        </div>
        {persistenceHint ? (
          <p className="mt-2 text-xs text-emerald-400/85">{persistenceHint}</p>
        ) : null}
        {persistenceErr ? (
          <p className="mt-2 text-xs text-amber-400/90">{persistenceErr}</p>
        ) : null}
      </header>

      {errorMessage ? (
        <div className="mx-4 mt-3 rounded-md border border-red-900/55 bg-red-950/35 px-3 py-2 text-sm text-red-100 sm:mx-6">
          <p>{errorMessage}</p>
          {loops.length > 0 ? (
            <p className="mt-2 border-t border-red-900/45 pt-2 text-xs leading-relaxed text-red-100/85">
              Practice Sections / Focus Loops in memory are unchanged — change the URL, pick another saved session, or continue editing; Save writes the latest Dexie snapshot when playback works again.
            </p>
          ) : null}
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
          authoring={youtubeSyntheticAuthoring}
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
