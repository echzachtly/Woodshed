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
 * **YouTube source** reuses the desktop store, transport, inspector, and the same **Shift+drag**
 * authoring rule as WaveSurfer (`shiftDragShouldCreateFocusInsideActivePhrase`), on the synthetic
 * timeline only. Authoring / boundary edits follow **`phraseWaveformEditUnlockedById`** /
 * **`focusRegionWaveformEditUnlockedById`** (transport lock + inspector) like desktop WaveSurfer.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { DesktopInspectorPanel } from "@/components/desktop-inspector-panel";
import { DesktopTransportBar } from "@/components/desktop-transport-bar";
import {
  NeutralTimelinePrototype,
  type SyntheticTimelineAuthoringConfig,
} from "@/components/neutral-timeline/neutral-timeline-prototype";
import { cn } from "@/lib/utils";
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
import { isKeyboardFocusInTextField } from "@/lib/woodshed-keyboard";
import { useWoodshedStore } from "@/store/woodshed-store";

const DEFAULT_WATCH_URL = `https://www.youtube.com/watch?v=${YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID}`;

/** Same keys/limits as `woodshed-workspace.tsx` — shared `sessionStorage` height for the bottom stack. */
const DESKTOP_BOTTOM_STACK_PX_KEY = "woodshed-desktop-bottom-stack-px";
const DESKTOP_BOTTOM_STACK_MIN = 112;
const DESKTOP_WAVEFORM_MIN = 80;
const DESKTOP_BOTTOM_STACK_MAX_FRAC = 0.58;

function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function YoutubeWorkspace() {
  const sectionRef = useRef<HTMLElement>(null);
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
  /** Collapsed by default — waveform-equivalent timeline is the primary surface. */
  const [youtubeSourceExpanded, setYoutubeSourceExpanded] = useState(false);

  const youtubeDesktopSplitRef = useRef<HTMLDivElement>(null);
  const youtubeDesktopBottomDragRef = useRef<{
    pointerId: number;
    startY: number;
    startH: number;
  } | null>(null);
  const [desktopBottomStackPx, setDesktopBottomStackPx] = useState(200);
  const desktopBottomStackPxRef = useRef(desktopBottomStackPx);
  desktopBottomStackPxRef.current = desktopBottomStackPx;

  const {
    duration,
    currentTime,
    isPlaying,
    loops,
    activeLoopId,
    activeLoop,
    editableLoopId,
    phraseWaveformEditUnlockedById,
    focusRegionWaveformEditUnlockedById,
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
      phraseWaveformEditUnlockedById: s.phraseWaveformEditUnlockedById,
      focusRegionWaveformEditUnlockedById:
        s.focusRegionWaveformEditUnlockedById,
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

  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DESKTOP_BOTTOM_STACK_PX_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= DESKTOP_BOTTOM_STACK_MIN) {
        setDesktopBottomStackPx(n);
      }
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const clampBottom = () => {
      const root = youtubeDesktopSplitRef.current;
      if (!root) return;
      const h = root.clientHeight;
      if (h <= DESKTOP_WAVEFORM_MIN + DESKTOP_BOTTOM_STACK_MIN) return;
      const maxBottom = Math.min(
        Math.floor(h * DESKTOP_BOTTOM_STACK_MAX_FRAC),
        h - DESKTOP_WAVEFORM_MIN,
      );
      setDesktopBottomStackPx((prev) =>
        Math.min(
          Math.max(prev, DESKTOP_BOTTOM_STACK_MIN),
          Math.max(DESKTOP_BOTTOM_STACK_MIN, maxBottom),
        ),
      );
    };
    clampBottom();
    window.addEventListener("resize", clampBottom);
    return () => window.removeEventListener("resize", clampBottom);
  }, []);

  const onYoutubeDesktopBottomResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      youtubeDesktopBottomDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH: desktopBottomStackPxRef.current,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onYoutubeDesktopBottomResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = youtubeDesktopBottomDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const root = youtubeDesktopSplitRef.current;
      if (!root) return;
      const h = root.clientHeight;
      const maxBottom = Math.min(
        Math.floor(h * DESKTOP_BOTTOM_STACK_MAX_FRAC),
        h - DESKTOP_WAVEFORM_MIN,
      );
      const next = Math.min(
        Math.max(d.startH - (e.clientY - d.startY), DESKTOP_BOTTOM_STACK_MIN),
        Math.max(DESKTOP_BOTTOM_STACK_MIN, maxBottom),
      );
      setDesktopBottomStackPx(next);
    },
    [],
  );

  const onYoutubeDesktopBottomResizePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = youtubeDesktopBottomDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      youtubeDesktopBottomDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be released */
      }
      try {
        sessionStorage.setItem(
          DESKTOP_BOTTOM_STACK_PX_KEY,
          String(Math.round(desktopBottomStackPxRef.current)),
        );
      } catch {
        /* private mode */
      }
    },
    [],
  );

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
            onStateChange: (evt: { data: number }) => {
              if (cancelled) return;
              const sVal = evt.data;
              /** Match transport clock + RAF — BUFFERING stays “playing”. */
              if (sVal === YT_PLAYER_STATE.ENDED) {
                const stEnd = useWoodshedStore.getState();
                stEnd.setPlaying(false);
                try {
                  stEnd.setCurrentTime(player.getCurrentTime?.() ?? 0);
                } catch {
                  /* ignore */
                }
                return;
              }
              const transportOn =
                sVal === YT_PLAYER_STATE.PLAYING ||
                sVal === YT_PLAYER_STATE.BUFFERING;
              useWoodshedStore.getState().setPlaying(transportOn);
            },
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
                const psNow = player.getPlayerState?.();
                setPlaying(
                  psNow === YT_PLAYER_STATE.PLAYING ||
                    psNow === YT_PLAYER_STATE.BUFFERING,
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

  /**
   * iframe clock + loop rail warps — **no native `timeupdate`**.
   * Authoritative playback flag is **`store.isPlaying`** (transport + iframe `onStateChange`).
   * Do **not** gate on {@link YoutubeIframePlaybackSurface.isPlaying} alone — YT often reports
   * `BUFFERING` while audio/time still advance after `PLAYING`; that used to stall this RAF chain.
   */
  useEffect(() => {
    if (!playbackSurface || !isPlaying) return;

    let rafId = 0;
    let stopped = false;
    const surface = playbackSurface;

    const advanceClock = () => {
      const snap = useWoodshedStore.getState();
      warpPlaybackToLoopRailIfNeeded(surface, {
        loops: snap.loops,
        activeLoopId: snap.activeLoopId,
        loopPlaybackEnabled: snap.loopPlaybackEnabled,
        activeSegmentId: snap.activeSegmentId,
        loopPracticeScope: snap.loopPracticeScope,
        lastPracticeSegmentIdByPhrase: snap.lastPracticeSegmentIdByPhrase,
      });
      snap.setCurrentTime(surface.getCurrentTime());
    };

    const tick = () => {
      if (stopped) return;
      const p = playerRef.current;
      let ytState: number | undefined;
      try {
        ytState = p?.getPlayerState?.();
      } catch {
        ytState = undefined;
      }

      if (ytState === YT_PLAYER_STATE.ENDED) {
        setPlaying(false);
        setCurrentTime(surface.getCurrentTime());
        return;
      }

      if (!useWoodshedStore.getState().isPlaying) {
        setCurrentTime(surface.getCurrentTime());
        return;
      }

      advanceClock();
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying, playbackSurface, setCurrentTime, setPlaying]);

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
      activeLoopId,
      phraseWaveformEditUnlockedById,
      focusRegionWaveformEditUnlockedById,
      onShiftPhraseDragCreate: (startSec, endSec) => {
        exitPhraseFitAfterUserNavigation();
        const phrase = createPhraseFromShiftDrag(startSec, endSec);
        if (!phrase) return;
        const ordinal = useWoodshedStore.getState().loops.length;
        renameLoop(phrase.id, `Practice Section ${ordinal}`);
        playbackSurface?.seek(phrase.start);
        setCurrentTime(phrase.start);
      },
      onShiftFocusDragCreate: (phraseId, startSec, endSec) => {
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
    focusRegionWaveformEditUnlockedById,
    phraseWaveformEditUnlockedById,
    playbackSurface,
    renameLoop,
    selectLoop,
    selectSegment,
    updateLoopBounds,
    updateSegment,
    setCurrentTime,
  ]);

  /** Mirrors `woodshed-workspace` desktop keyboard surface (no mobile branch here). */
  const handleKeyboard = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (isKeyboardFocusInTextField(event.target)) {
        return;
      }

      const playback = playbackSurface;
      const modifier = event.shiftKey;
      const stepping = modifier ? 0.05 : 0.75;
      if (event.repeat) return;

      const snapTempoPlayback = () => {
        if (!playbackSurface) return;
        applyPlaybackTempo(
          playbackSurface,
          useWoodshedStore.getState().activeLoopTemps(),
        );
      };

      switch (event.key) {
        case " ": {
          event.preventDefault();
          if (!playback) return;
          /** Match transport — iframe `BUFFERING` is not PLAYING yet `isPlaying()` can be false. */
          const stPlay = useWoodshedStore.getState().isPlaying;
          if (stPlay) {
            playback.pause();
            setPlaying(false);
          } else {
            void playback.play();
            setPlaying(true);
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (!playback || !duration) break;
          playback.seek(
            youtubeClamp(playback.getCurrentTime() - stepping, 0, duration),
          );
          setCurrentTime(playback.getCurrentTime());
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (!playback || !duration) break;
          playback.seek(
            youtubeClamp(playback.getCurrentTime() + stepping, 0, duration),
          );
          setCurrentTime(playback.getCurrentTime());
          break;
        }
        case "=":
        case "+": {
          event.preventDefault();
          useWoodshedStore.getState().bumpTempo(0.05);
          snapTempoPlayback();
          break;
        }
        case "-":
        case "_": {
          event.preventDefault();
          useWoodshedStore.getState().bumpTempo(-0.05);
          snapTempoPlayback();
          break;
        }
        case "a":
        case "A": {
          if (event.metaKey || event.ctrlKey || event.altKey) break;
          event.preventDefault();
          useWoodshedStore.getState().addLoopCandidate();
          break;
        }
        case "r":
        case "R": {
          event.preventDefault();
          const st = useWoodshedStore.getState();
          const loop = st.loops.find((l) => l.id === st.activeLoopId);
          const canEnable = Boolean(loop && loop.end > loop.start);
          if (!canEnable) break;
          st.cycleLoopPlaybackMode();
          break;
        }
        case "PageDown": {
          event.preventDefault();
          const zs = useWoodshedStore.getState();
          zs.exitPhraseFitAfterUserNavigation();
          zs.setMinPxPerSec(zs.minPxPerSec / 1.22);
          break;
        }
        case "PageUp": {
          event.preventDefault();
          const zp = useWoodshedStore.getState();
          zp.exitPhraseFitAfterUserNavigation();
          zp.setMinPxPerSec(zp.minPxPerSec * 1.22);
          break;
        }
        case "[": {
          event.preventDefault();
          useWoodshedStore
            .getState()
            .nudgeLoopEdge(
              "start",
              -youtubeLoopBracketStep(modifier, event.altKey),
            );
          break;
        }
        case "]": {
          event.preventDefault();
          useWoodshedStore
            .getState()
            .nudgeLoopEdge(
              "end",
              youtubeLoopBracketStep(modifier, event.altKey),
            );
          break;
        }
        default:
          break;
      }
    },
    [duration, playbackSurface, setCurrentTime, setPlaying],
  );

  const handleTransportTogglePlay = useCallback(() => {
    if (!playbackSurface) return;
    if (useWoodshedStore.getState().isPlaying) {
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
    <section
      ref={sectionRef}
      className="flex h-[100dvh] min-h-0 flex-1 flex-col overflow-hidden bg-[#060504] text-stone-100 outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyboard}
      aria-label="Woodshed YouTube workspace"
    >
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

      <div
        ref={youtubeDesktopSplitRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a]">
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
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center text-sm text-stone-600">
              {resolvedId
                ? "Timeline appears once YouTube reports duration."
                : "Enter a valid video URL to load."}
            </div>
          )}
        </div>

        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize timeline and bottom panel"
          tabIndex={0}
          className="group relative z-20 flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-y border-stone-800/40 bg-[#0a0806] outline-none hover:bg-stone-900/90 focus-visible:ring-2 focus-visible:ring-violet-500/40"
          onPointerDown={onYoutubeDesktopBottomResizePointerDown}
          onPointerMove={onYoutubeDesktopBottomResizePointerMove}
          onPointerUp={onYoutubeDesktopBottomResizePointerUp}
          onPointerCancel={onYoutubeDesktopBottomResizePointerUp}
          onKeyDown={(e) => {
            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
            e.preventDefault();
            const root = youtubeDesktopSplitRef.current;
            if (!root) return;
            const h = root.clientHeight;
            const maxBottom = Math.min(
              Math.floor(h * DESKTOP_BOTTOM_STACK_MAX_FRAC),
              h - DESKTOP_WAVEFORM_MIN,
            );
            const delta = e.key === "ArrowUp" ? 8 : -8;
            setDesktopBottomStackPx((prev) => {
              const next = Math.min(
                Math.max(prev + delta, DESKTOP_BOTTOM_STACK_MIN),
                Math.max(DESKTOP_BOTTOM_STACK_MIN, maxBottom),
              );
              try {
                sessionStorage.setItem(
                  DESKTOP_BOTTOM_STACK_PX_KEY,
                  String(Math.round(next)),
                );
              } catch {
                /* private mode */
              }
              return next;
            });
          }}
        >
          <span className="pointer-events-none h-1 w-10 rounded-full bg-stone-600/90 group-hover:bg-stone-500" />
        </div>

        <div
          className="flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-stone-800/50 bg-[#050403] sm:flex-row"
          style={{ maxHeight: desktopBottomStackPx }}
        >
          <aside className="flex min-h-0 w-full shrink-0 flex-col border-stone-800/60 bg-[#070605] sm:w-[min(280px,34vw)] sm:max-w-[320px] sm:border-r sm:border-stone-800/60">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-800/70 px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">
                  YouTube source
                </p>
                {resolvedId ? (
                  <p
                    className="truncate font-mono text-[10px] text-stone-600"
                    title={resolvedId}
                  >
                    {resolvedId}
                  </p>
                ) : (
                  <p className="text-[10px] text-stone-600">No video id</p>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md border border-stone-700/80 bg-stone-900/80 px-2 py-1 text-[10px] font-medium text-stone-300 hover:border-stone-600 hover:bg-stone-800 hover:text-stone-100"
                aria-pressed={youtubeSourceExpanded}
                onClick={() => setYoutubeSourceExpanded((v) => !v)}
              >
                {youtubeSourceExpanded ? "Smaller" : "Larger"}
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-2 pt-1.5">
              <div
                ref={hostRef}
                tabIndex={-1}
                className={cn(
                  "w-full overflow-hidden rounded-md border border-stone-800/85 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none",
                  youtubeSourceExpanded
                    ? "aspect-video max-h-[min(220px,35vh)] max-w-full"
                    : "aspect-video max-h-[76px] max-w-full opacity-[0.96]",
                )}
              />
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
      </div>
    </section>
  );
}

function youtubeClamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

/** Shift = ultra-fine · Alt = medium · default = coarse — matches desktop bracket nudge ladder. */
function youtubeLoopBracketStep(shift: boolean, alt: boolean) {
  if (shift) return 0.012;
  if (alt) return 0.035;
  return 0.08;
}
