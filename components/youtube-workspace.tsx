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
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  warpPlaybackToLoopRailIfNeeded,
} from "@/lib/playback-loop-rail";
import { resolvePlaybackRestartTarget } from "@/lib/playback/restart-target";
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
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";
import {
  applyYoutubeNeutralTimelinePlaybackIntent,
} from "@/lib/youtube/neutral-timeline-playback-intent";
import {
  canEnterPracticeEditMode,
  resolvePracticeEditCompatibility,
  resolvePracticeEditExitCleanup,
} from "@/lib/interaction/practice-edit-mode";
import { useWoodshedStore } from "@/store/woodshed-store";

export type YoutubeWorkspaceHandle = {
  getPlaybackSurface: () => MediaPlaybackSurface | null;
};

export type YoutubeWorkspaceProps = {
  /**
   * `devPage` — `/dev/youtube-workspace` sandbox (resets store on mount, Dexie picker in header).
   * `embedded` — main app shell (store owned by parent routing; compact chrome).
   */
  variant?: "devPage" | "embedded";
  className?: string;
  /**
   * Phone-width embedded shell: capped synthetic timeline, optional {@link children} (e.g. mobile transport),
   * then a constrained YouTube player strip — matches upload-project mobile hierarchy.
   */
  mobileStackedLayout?: boolean;
  children?: ReactNode;
};

const DEFAULT_WATCH_URL = `https://www.youtube.com/watch?v=${YOUTUBE_PROTOTYPE_DEFAULT_VIDEO_ID}`;

/** Same keys/limits as `woodshed-workspace.tsx` — shared `sessionStorage` height for the bottom stack. */
const DESKTOP_BOTTOM_STACK_PX_KEY = "woodshed-desktop-bottom-stack-px";
const DESKTOP_BOTTOM_STACK_MIN = 112;
const DESKTOP_WAVEFORM_MIN = 80;
const DESKTOP_BOTTOM_STACK_MAX_FRAC = 0.58;
/** Desktop YouTube shells — allow faux waveform to reclaim vertical flex space. */
const YOUTUBE_DESKTOP_WAVE_BAND_MAX_PX = 1080;
/** Hysteresis: bottom stack shorter than this nudges Practice Focus layout; taller clears it. */
const YT_PRACTICE_ZEN_BOTTOM_ENTER_PX = 152;
const YT_PRACTICE_ZEN_BOTTOM_EXIT_PX = 208;

function youtubeDisplayTitle(parts: {
  mediaKind: WoodshedMediaSource["kind"];
  mediaTitle?: string | null;
  projectName: string;
}): string {
  if (
    parts.mediaKind === "youtube" &&
    typeof parts.mediaTitle === "string" &&
    parts.mediaTitle.trim().length > 0
  ) {
    return parts.mediaTitle.trim();
  }
  const p = parts.projectName.trim();
  return p.length > 0 ? p : "Session";
}

function canonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export const YoutubeWorkspace = forwardRef<
  YoutubeWorkspaceHandle,
  YoutubeWorkspaceProps
>(function YoutubeWorkspace(props, ref) {
  const variant = props.variant ?? "devPage";
  const rootClassName = props.className;
  const mobileStackedLayout =
    Boolean(props.mobileStackedLayout) && variant === "embedded";
  const stackedChrome = props.children;

  const sectionRef = useRef<HTMLElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YoutubeIframePlayerLike | null>(null);
  const bootstrapPollRef = useRef<number | null>(null);

  const [videoInput, setVideoInput] = useState(() =>
    variant === "embedded"
      ? (() => {
          const ms = useWoodshedStore.getState().mediaSource;
          return ms.kind === "youtube" ? ms.canonicalUrl : "";
        })()
      : DEFAULT_WATCH_URL,
  );
  const resolvedId = useMemo(() => extractYoutubeVideoId(videoInput), [videoInput]);

  const [loadStatus, setLoadStatus] = useState<
    "idle" | "loading_api" | "loading_player" | "ready" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [playbackSurface, setPlaybackSurface] =
    useState<MediaPlaybackSurface | null>(null);
  const playbackSurfaceRef = useRef<MediaPlaybackSurface | null>(null);

  useEffect(() => {
    playbackSurfaceRef.current = playbackSurface;
  }, [playbackSurface]);

  useImperativeHandle(ref, () => ({
    getPlaybackSurface: () => playbackSurfaceRef.current,
  }));

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

  const [practiceFocusZen, setPracticeFocusZen] = useState(false);
  const [linkedFocusHoverId, setLinkedFocusHoverId] = useState<string | null>(
    null,
  );

  const dismissPracticeFocusZen = useCallback(() => {
    setPracticeFocusZen(false);
  }, []);

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

  /** Same rule as `{@link SyntheticTimelineAuthoringConfig.enabled}` — any waveform unlock ⇒ Edit Mode. */
  const youtubeStructuralEditActive = useMemo(
    () =>
      Object.keys(phraseWaveformEditUnlockedById).length > 0 ||
      Object.keys(focusRegionWaveformEditUnlockedById).length > 0,
    [phraseWaveformEditUnlockedById, focusRegionWaveformEditUnlockedById],
  );

  const youtubeSessionPresentation = useMemo(() => {
    const primary = youtubeDisplayTitle({
      mediaKind: mediaSource.kind,
      mediaTitle:
        mediaSource.kind === "youtube"
          ? (mediaSource.title ?? null)
          : undefined,
      projectName,
    });
    const ytVideoId =
      mediaSource.kind === "youtube"
        ? mediaSource.videoId
        : (resolvedId?.trim() ?? "");
    const secondary =
      ytVideoId.length > 0
        ? `YouTube · ${ytVideoId}`
        : "YouTube session";
    return { primary, secondary };
  }, [mediaSource, projectName, resolvedId]);

  /** Dev sandbox resets global session; embedded mode is driven by main-app routing. */
  useEffect(() => {
    if (variant === "embedded") return undefined;
    resetWorkspace();
    return () => resetWorkspace();
  }, [resetWorkspace, variant]);

  const embeddedYoutubeSourceKey = useMemo(() => {
    if (variant !== "embedded" || mediaSource.kind !== "youtube") return "";
    return `${mediaSource.videoId}\u0000${mediaSource.canonicalUrl}`;
  }, [variant, mediaSource]);

  useEffect(() => {
    if (variant !== "embedded") return;
    const ms = useWoodshedStore.getState().mediaSource;
    if (ms.kind !== "youtube") return;
    setVideoInput(ms.canonicalUrl);
  }, [variant, embeddedYoutubeSourceKey]);

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
    if (mobileStackedLayout) return;
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
  }, [mobileStackedLayout]);

  useEffect(() => {
    if (mobileStackedLayout) return;
    const px = desktopBottomStackPx;
    setPracticeFocusZen((prev) => {
      if (px <= YT_PRACTICE_ZEN_BOTTOM_ENTER_PX) return true;
      if (px >= YT_PRACTICE_ZEN_BOTTOM_EXIT_PX) return false;
      return prev;
    });
  }, [desktopBottomStackPx, mobileStackedLayout]);

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
    if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED || variant !== "devPage") return;
    void refreshSavedYoutubeProjects();
  }, [refreshSavedYoutubeProjects, variant]);

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
                  const pname =
                    st.projectName.trim().length > 0
                      ? st.projectName
                      : `YouTube (${resolvedId})`;
                  const canonical =
                    st.mediaSource.kind === "youtube"
                      ? st.mediaSource.canonicalUrl
                      : canonicalWatchUrl(resolvedId);
                  setProjectMeta(st.projectId, pname, {
                    kind: "youtube",
                    videoId: resolvedId,
                    canonicalUrl: canonical,
                    durationSeconds: dur,
                    title:
                      st.mediaSource.kind === "youtube"
                        ? st.mediaSource.title
                        : null,
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
    const phraseUnlockForSynth: Record<string, true> = {
      ...phraseWaveformEditUnlockedById,
      ...(youtubeStructuralEditActive && activeLoopId != null
        ? { [activeLoopId]: true }
        : {}),
    };

    const focusUnlockForSynth: Record<string, true> = {
      ...focusRegionWaveformEditUnlockedById,
      ...(youtubeStructuralEditActive && activeSegmentId != null
        ? { [activeSegmentId]: true }
        : {}),
    };

    const compatibility = resolvePracticeEditCompatibility({
      editableLoopId,
      phraseWaveformEditUnlockedById: phraseUnlockForSynth,
      focusRegionWaveformEditUnlockedById: focusUnlockForSynth,
    });
    return {
      /** Practice Mode ⇒ false (`phrase`/`focus` unlock maps empty). Edit Mode ⇒ true (matches WaveSurfer). */
      enabled: compatibility.editMode,
      activeLoopId,
      phraseWaveformEditUnlockedById: phraseUnlockForSynth,
      focusRegionWaveformEditUnlockedById: focusUnlockForSynth,
      allowBackdropShiftPhraseDraftWhenPractice: true,
      allowInPhraseShiftFocusDraftWhenPractice: true,
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
      onPlaybackIntentTap: (sec) => {
        applyYoutubeNeutralTimelinePlaybackIntent(sec);
        handleNeutralTimelineSeek(sec);
      },
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
    activeSegmentId,
    createFocusSegmentFromShiftDrag,
    createPhraseFromShiftDrag,
    duration,
    editableLoopId,
    exitPhraseFitAfterUserNavigation,
    focusRegionWaveformEditUnlockedById,
    handleNeutralTimelineSeek,
    phraseWaveformEditUnlockedById,
    playbackSurface,
    renameLoop,
    selectLoop,
    selectSegment,
    updateLoopBounds,
    updateSegment,
    setCurrentTime,
    youtubeStructuralEditActive,
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
          /** New phrase from keyboard always allowed — {@link addLoopCandidate} enters Edit Mode via store. */
          if (!(duration > 0)) break;
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
    const compatibility = resolvePracticeEditCompatibility(st);
    if (
      compatibility.editMode &&
      st.editableLoopId != null &&
      st.editableLoopId === activeLoopId
    ) {
      const cleanup = resolvePracticeEditExitCleanup("explicit_done_action");
      if (cleanup.clearEditableLoopId) {
        st.setEditableLoopId(null);
      }
      if (cleanup.clearFocusUnlocks) {
        for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
          st.setFocusRegionWaveformEditUnlocked(sid, false);
        }
      }
      if (cleanup.clearPhraseUnlocks) {
        for (const loopId of Object.keys(st.phraseWaveformEditUnlockedById)) {
          st.setPhraseWaveformEditUnlocked(loopId, false);
        }
      }
      return;
    }
    if (
      !canEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "explicit_edit_action",
      })
    ) {
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
    for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
      st.setFocusRegionWaveformEditUnlocked(sid, false);
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
    if (!playbackSurface) return;
    const st = useWoodshedStore.getState();
    const resolved = resolvePlaybackRestartTarget({
      duration: st.duration,
      loops: st.loops,
      activeLoopId: st.activeLoopId,
      activeSegmentId: st.activeSegmentId,
      loopPlaybackEnabled: st.loopPlaybackEnabled,
      loopPracticeScope: st.loopPracticeScope,
      lastPracticeSegmentIdByPhrase: st.lastPracticeSegmentIdByPhrase,
      currentTime: st.currentTime,
    });
    playbackSurface.seek(resolved.restartTargetSeconds);
    st.setCurrentTime(resolved.restartTargetSeconds);
    if (st.activeLoopId !== resolved.resolvedActiveLoopId) {
      st.setActiveLoopId(resolved.resolvedActiveLoopId);
    }
    if (st.loopPlaybackEnabled !== resolved.resolvedLoopPlaybackEnabled) {
      st.setLoopPlaybackEnabled(resolved.resolvedLoopPlaybackEnabled);
    }
    if (st.loopPracticeScope !== resolved.resolvedLoopPracticeScope) {
      st.setLoopPracticeScope(resolved.resolvedLoopPracticeScope);
    }
    if (st.activeSegmentId !== resolved.resolvedActiveSegmentId) {
      st.setActiveSegmentId(resolved.resolvedActiveSegmentId);
    }
    setCurrentTime(playbackSurface.getCurrentTime());
    void playbackSurface.play();
    setPlaying(true);
  }, [
    playbackSurface,
    setCurrentTime,
    setPlaying,
  ]);

  if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) return null;

  const timelineIdle = !playbackSurface || !(duration > 0);

  return (
    <section
      ref={sectionRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#060504] text-stone-100 outline-none",
        variant === "devPage" && "h-[100dvh]",
        mobileStackedLayout && "min-w-0 overflow-x-hidden",
        rootClassName,
      )}
      tabIndex={-1}
      onKeyDown={handleKeyboard}
      aria-label="Woodshed YouTube workspace"
    >
      {variant === "devPage" ? (
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
      ) : null}

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
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          mobileStackedLayout && "overflow-x-hidden overflow-y-auto",
        )}
      >
        {mobileStackedLayout ? (
          <>
            <div className="relative flex max-h-[min(40svh,268px)] min-h-[104px] shrink-0 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a] shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)]">
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
                  compactLayout
                  playbackActive={isPlaying}
                />
              ) : (
                <div className="flex min-h-[96px] flex-col items-center justify-center px-3 py-4 text-center text-xs leading-snug text-stone-600">
                  {resolvedId
                    ? "Timeline appears once YouTube reports duration."
                    : "Enter a valid video URL to load."}
                </div>
              )}
            </div>
            {stackedChrome ? (
              <div className="min-h-0 w-full min-w-0 shrink-0 overflow-x-hidden">
                {stackedChrome}
              </div>
            ) : null}
            <div className="w-full min-w-0 shrink-0 overflow-hidden border-t border-stone-800/42 bg-[#050403]/98 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5">
              <div className="flex items-center justify-between gap-2 pb-0.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold leading-snug tracking-tight text-stone-100">
                    {youtubeSessionPresentation.primary}
                  </p>
                  <p
                    className="truncate text-[9px] text-stone-500"
                    title={youtubeSessionPresentation.secondary}
                  >
                    {youtubeSessionPresentation.secondary}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-md border border-stone-800/85 bg-black/35 px-2 py-1 text-[10px] font-medium text-stone-400 hover:border-stone-700 hover:bg-stone-950 hover:text-stone-200 touch-manipulation"
                  aria-pressed={youtubeSourceExpanded}
                  onClick={() => setYoutubeSourceExpanded((v) => !v)}
                >
                  {youtubeSourceExpanded ? "Hide" : "Show"}
                </button>
              </div>
              <div className="mx-auto w-full max-w-full overflow-hidden">
                <div
                  ref={hostRef}
                  tabIndex={-1}
                  className={cn(
                    "relative mx-auto w-full max-w-full overflow-hidden rounded-[10px] border border-white/[0.055] bg-[#050403] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none ring-1 ring-black/60",
                    youtubeSourceExpanded
                      ? "aspect-video max-h-[min(26svh,200px)]"
                      : "aspect-video max-h-[64px] opacity-[0.94]",
                  )}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a] shadow-[inset_0_-1px_0_rgba(255,255,255,0.03)] motion-safe:transition-shadow duration-300">
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
                  waveformBandMaxPx={YOUTUBE_DESKTOP_WAVE_BAND_MAX_PX}
                  timelineHoverSegmentId={linkedFocusHoverId}
                  playbackActive={isPlaying}
                  onTimelineFocusSegmentHover={setLinkedFocusHoverId}
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
              className="group relative z-20 flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-y border-stone-800/22 bg-[#090807] outline-none transition-colors duration-200 hover:bg-[#0c0a09] hover:border-stone-700/35 focus-visible:ring-2 focus-visible:ring-violet-500/40"
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
              className="flex w-full min-h-0 shrink-0 flex-col overflow-hidden border-t border-stone-900/35 bg-[#050403]/95 motion-safe:transition-[max-height] motion-safe:duration-200 motion-safe:ease-out sm:flex-row"
              style={{ maxHeight: desktopBottomStackPx }}
            >
              <aside className="flex min-h-0 w-full shrink-0 flex-col bg-[#060504]/90 sm:w-[min(248px,30vw)] sm:max-w-[280px] sm:border-r sm:border-stone-900/42">
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-900/40 px-2 py-0.5 sm:px-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold tracking-tight text-stone-100">
                      {youtubeSessionPresentation.primary}
                    </p>
                    <p
                      className="mt-px truncate text-[10px] text-stone-500"
                      title={youtubeSessionPresentation.secondary}
                    >
                      {youtubeSessionPresentation.secondary}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-stone-800/72 bg-black/30 px-2 py-0.5 text-[10px] font-medium text-stone-500 hover:border-stone-700 hover:bg-stone-950 hover:text-stone-300"
                    aria-pressed={youtubeSourceExpanded}
                    onClick={() => setYoutubeSourceExpanded((v) => !v)}
                  >
                    {youtubeSourceExpanded ? "Smaller" : "Larger"}
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center p-1.5 sm:p-2 sm:pb-1.5">
                  <div
                    ref={hostRef}
                    tabIndex={-1}
                    className={cn(
                      "relative w-full overflow-hidden rounded-[10px] border border-white/[0.055] bg-[#050403] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none ring-1 ring-black/60",
                      youtubeSourceExpanded
                        ? "aspect-video max-h-[min(200px,32vh)] max-w-full"
                        : "aspect-video max-h-[68px] max-w-full opacity-[0.94]",
                    )}
                  />
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden sm:border-l sm:border-stone-900/48">
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
                  interactionModeChip={{
                    editingEnabled: youtubeStructuralEditActive,
                  }}
                />
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-stone-900/40 bg-[#070605]/90">
                  <DesktopInspectorPanel
                    practiceFocusLayout={practiceFocusZen}
                    onDismissPracticeFocusLayout={dismissPracticeFocusZen}
                    onFocusChipHover={setLinkedFocusHoverId}
                    timelineHoverSegmentId={linkedFocusHoverId}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
});

function youtubeClamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

/** Shift = ultra-fine · Alt = medium · default = coarse — matches desktop bracket nudge ladder. */
function youtubeLoopBracketStep(shift: boolean, alt: boolean) {
  if (shift) return 0.012;
  if (alt) return 0.035;
  return 0.08;
}
