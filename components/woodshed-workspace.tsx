"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import WaveSurfer from "wavesurfer.js";

import { DesktopHeaderBar } from "@/components/desktop-header-bar";
import { DesktopInspectorPanel } from "@/components/desktop-inspector-panel";
import { DesktopTransportBar } from "@/components/desktop-transport-bar";
import {
  DesktopPostFocusLoopHintStripe,
  DesktopShiftFocusGuidanceStripe,
} from "@/components/onboarding/desktop-waveform-onboarding";
import { DemoProjectOrientationRibbon } from "@/components/onboarding/demo-project-orientation-ribbon";
import { WorkspaceEmptyState } from "@/components/workspace-empty-state";
import {
  YoutubeWorkspace,
  type YoutubeWorkspaceHandle,
} from "@/components/youtube-workspace";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import {
  MobilePracticeControls,
} from "@/components/mobile-practice-panel";
import { MiniMap } from "@/components/mini-map";
import { useMediaQuery } from "@/hooks/use-media-query";
import { installWaveformPinchZoom } from "@/lib/waveform-mobile-pinch";
import type { VisibleWindow } from "@/lib/waveform-manager";
import {
  applyPlaybackTempo,
  type MediaPlaybackSurface,
} from "@/lib/audio-engine";
import type { PracticeLoop } from "@/lib/loop-engine";
import {
  listProjects,
  loadBlobRecord,
  loadProject as loadDexieProject,
  saveBlobRecord,
  saveProject as saveDexieProject,
  type StoredProjectMeta,
} from "@/lib/project-db";
import { devError, devLog, devWarn } from "@/lib/dev-log";
import { isSupabaseConfigured } from "@/lib/env/public";
import {
  listCloudProjectSummaries,
  loadCloudProject,
  upsertCloudProject,
  type CloudProjectSummary,
} from "@/lib/cloud-projects/client";
import {
  cloudSessionPickerValue,
  isCloudProjectId,
  parseCloudSessionPickerValue,
} from "@/lib/cloud-projects/constants";
import {
  DEMO_PROJECT_DISPLAY_FALLBACK,
  DEMO_PROJECT_ID,
  DEMO_PROJECT_JSON_PATH,
  demoRowsToPracticeLoops,
  formatLoopsJsonForClipboard,
  parseDemoProjectFile,
  resolveDemoAudioBlob,
  type PendingDemoHydration,
} from "@/lib/demo-project";
import {
  FOCUS_REGION_WAVE_PALETTE,
  focusRegionWavePaletteIndex,
} from "@/lib/focus-region-wave-palette";
import { formatFilenameAsProjectName } from "@/lib/format-upload-project-name";
import { resolveFocusPlaybackSegment } from "@/lib/focus-playback-segment";
import {
  buildPlaybackLoopRail,
  getRestartSeekSeconds,
} from "@/lib/playback-loop-rail";
import {
  capturePracticeStatePersistV1,
  normalizePracticeStatePersistV1,
} from "@/lib/practice-state-persist";
import {
  DEFAULT_UPLOAD_MEDIA_SOURCE,
  normalizeMediaSourceFromStoredProject,
  persistMediaSourceForDexieRow,
} from "@/lib/woodshed-media-source";
import { YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED } from "@/lib/youtube/constants";
import {
  captureYoutubeDexieProjectPayload,
  hydrateYoutubeDexieIntoStore,
  validateYoutubeDexieProjectMeta,
} from "@/lib/youtube/youtube-dexie-project";
import { parseYoutubePasteForMediaSource } from "@/lib/youtube/youtube-import";
import { NEUTRAL_TIMELINE_PROTOTYPE_ENABLED } from "@/components/neutral-timeline/constants";
import { NeutralTimelinePrototype } from "@/components/neutral-timeline/neutral-timeline-prototype";
import { isKeyboardFocusInTextField } from "@/lib/woodshed-keyboard";
import {
  enterFocusLoopStructuralEdit,
  enterPracticeSectionStructuralEdit,
  isStructuralPracticeMode,
} from "@/lib/woodshed-enter-region-edit";
import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";
import { nanoid } from "@/lib/id";
import { cn } from "@/lib/utils";
import {
  phraseHandleDiagnosticsEnabled,
  schedulePhraseHandleDiagnostics,
} from "@/lib/woodshed-phrase-handle-diagnostics";
import {
  installRegionsVirtualAppendPhrasePin,
  logRegionElementMountProbe,
  logRegionsPinProbe,
  setActivePhraseRegionVirtualAppendPin,
} from "@/lib/wavesurfer-regions-virtual-append-phrase-pin";
import { normalizeWaveSurferRegionBounds } from "@/lib/wavesurfer-region-time-bounds";
import {
  applyDesktopFocusRegionVisuals,
  applyMobileReadonlyFocusRegionVisuals,
  applyPhraseRegionVisuals,
  focusRegionFillForWave,
  phraseRegionWaveColor,
} from "@/lib/wavesurfer-region-appearance";
import { isWaveSurferAudioDecoded } from "@/lib/wavesurfer-audio-ready";
import { reflowWaveSurferForContainer } from "@/lib/wavesurfer-reflow";
import { applyWheelZoomAnchoredToCursor } from "@/lib/waveform-cursor-zoom";
import {
  DESKTOP_ONBOARDING_UPDATED_EVENT,
  markDesktopFocusLoopCreatedByUser,
} from "@/lib/onboarding/desktop-milestones";
import { markDemoOrientationDismissed } from "@/lib/onboarding/demo-orientation";
import { loadOnboardingDocument } from "@/lib/onboarding/storage";
import { desktopShowShiftFocusCreationGuidance } from "@/lib/onboarding/triggers";
import { peekWaveSurferDom, setWaveNormalizedScroll } from "@/lib/waveform-scroll";
import { shiftDragShouldCreateFocusInsideActivePhrase } from "@/lib/shift-waveform-authoring";
import { installShiftWaveformAuthoringGesture } from "@/lib/shift-waveform-authoring-gesture";
import {
  PLAYHEAD_UI_TIME_MS,
  readPlaybackSeconds,
} from "@/lib/playhead-sync";
import { useShallow } from "zustand/react/shallow";

import { useWoodshedStore } from "@/store/woodshed-store";

/** iOS Safari: combine MIME tokens with extensions so common files stay selectable. */
const DESKTOP_BOTTOM_STACK_PX_KEY = "woodshed-desktop-bottom-stack-px";
const DESKTOP_BOTTOM_STACK_MIN = 112;
const DESKTOP_WAVEFORM_MIN = 80;
const DESKTOP_BOTTOM_STACK_MAX_FRAC = 0.58;

const MOBILE_AUDIO_INPUT_ACCEPT =
  "audio/*,.mp3,.m4a,.aac,.wav,.flac,.aiff,.aif";

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "m4a",
  "aac",
  "wav",
  "flac",
  "aiff",
  "aif",
]);

/** Accept after pick: real `audio/*` MIME, known extension, or empty/unexpected type with known extension. */
function isAllowedUploadedAudioFile(file: File): boolean {
  const mime = (file.type ?? "").trim().toLowerCase();
  if (mime.startsWith("audio/")) return true;

  const dot = file.name.lastIndexOf(".");
  const ext =
    dot >= 0 && dot < file.name.length - 1
      ? file.name.slice(dot + 1).toLowerCase()
      : "";
  if (ext && ALLOWED_AUDIO_EXTENSIONS.has(ext)) return true;

  return false;
}

type RegionsHandle = {
  clearRegions: () => void;
  addRegion: (opts: Record<string, unknown>) => RegionHandle;
};

type RegionHandle = {
  start: number;
  end: number;
  remove: () => void;
  on: (evt: string, cb: (...args: unknown[]) => void) => void;
};

async function loadRegionsFactory(): Promise<unknown> {
  const mod = await import("wavesurfer.js/dist/plugins/regions.esm.js");
  installRegionsVirtualAppendPhrasePin(mod.default as never);
  return mod.default;
}

/**
 * WaveSurfer-backed implementation of {@link MediaPlaybackSurface} (Phase 1 playback boundary).
 *
 * **Source-agnostic (same contract alternate backends will implement):** play/pause/seek,
 * duration/currentTime for transport + loop RAF, `setPlaybackRate` / `getMediaElement` for tempo.
 *
 * **WaveSurfer-specific:** delegates to WaveSurfer’s `<audio>` element and `readPlaybackSeconds`
 * so UI time matches the existing clock semantics.
 *
 * Call sites in this component should use `getPlaybackSurface()` for playback control and
 * keep `wavesurferRef` for waveform-only APIs (regions, zoom, load, DOM).
 */
function createWaveSurferPlaybackSurface(ws: WaveSurfer): MediaPlaybackSurface {
  return {
    getDuration: () => ws.getDuration(),
    getCurrentTime: () => readPlaybackSeconds(ws),
    seek: (t) => ws.setTime(t),
    play: () => {
      void ws.play();
    },
    pause: () => ws.pause(),
    isPlaying: () => ws.isPlaying(),
    setPlaybackRate: (rate: number) => {
      const media = ws.getMediaElement();
      if (media) {
        media.playbackRate = rate;
      }
    },
    getMediaElement: () => ws.getMediaElement() ?? undefined,
  };
}

async function analyzeAudioEnvelope(blob: Blob) {
  const AudioContextCtor =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext;
      }
    ).webkitAudioContext;
  if (!AudioContextCtor) return null;
  const ctx = new AudioContextCtor();
  const buffer = await blob.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buffer.slice(0));
  await ctx.close().catch(() => undefined);
  return decoded;
}

const WoodshedWorkspace = memo(function WoodshedWorkspace() {
  const { user, supabase, refreshUser } = useAuth();
  const [cloudProjects, setCloudProjects] = useState<CloudProjectSummary[]>(
    [],
  );
  const [cloudListError, setCloudListError] = useState<string | null>(null);
  /** Supabase session user id — synced from `getSession` so cloud list/save match auth cookies. */
  const [cloudSessionUserId, setCloudSessionUserId] = useState<string | null>(
    null,
  );
  const [saveBusy, setSaveBusy] = useState(false);
  const [savePendingLabel, setSavePendingLabel] = useState<string | undefined>(
    undefined,
  );
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(
    null,
  );
  const [saveStatusTone, setSaveStatusTone] = useState<
    "neutral" | "progress" | "success" | "error"
  >("neutral");
  const saveStatusClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  /** Desktop: waveform column (flex child) — ResizeObserver reflows WaveSurfer when height changes. */
  const desktopWaveformColumnRef = useRef<HTMLDivElement | null>(null);
  const desktopSplitRef = useRef<HTMLDivElement | null>(null);
  const desktopBottomDragRef = useRef<{
    pointerId: number;
    startY: number;
    startH: number;
  } | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const pendingHydration = useRef<StoredProjectMeta | null>(null);
  const pendingDemoHydrationRef = useRef<PendingDemoHydration | null>(null);
  const loopsSignature = useRef<string>("");
  const wheelBound = useRef(false);
  /** Ignore scroll events briefly after programmatic phrase-fit (avoids fighting `phrase-focus`). */
  const suppressViewportScrollUntilRef = useRef(0);
  /** Stops tight loop RAF from the effect cleanup (see mount IIFE). */
  const cancelPlaybackLoopRef = useRef<(() => void) | null>(null);
  /** Releases the click-drag pan gesture listeners from the effect cleanup. */
  const releasePanRef = useRef<(() => void) | null>(null);
  /** Desktop Shift+drag phrase / focus authoring. */
  const releaseShiftAuthoringRef = useRef<(() => void) | null>(null);
  /** WaveSurfer mount effect reads this ref — keep in sync with `isMobilePractice`. */
  const mobilePracticeModeRef = useRef(false);

  /** Releases two-finger pinch zoom on mobile waveform. */
  const pinchZoomReleaseRef = useRef<(() => void) | null>(null);

  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const youtubeWorkspaceRef = useRef<YoutubeWorkspaceHandle | null>(null);
  const regionsRef = useRef<RegionsHandle | null>(null);
  const phraseHandleDiagCleanupRef = useRef<(() => void) | null>(null);

  const [projects, setProjectsList] = useState<StoredProjectMeta[]>([]);
  /** First Dexie listing finished (empty list ≠ still loading). */
  const [dexieProjectsListed, setDexieProjectsListed] = useState(false);
  /** Cloud summaries fetched at least once when cloud sessions apply; irrelevant when logged out. */
  const [cloudPickerListed, setCloudPickerListed] = useState(false);
  const [demoPickerTitle, setDemoPickerTitle] = useState(
    DEMO_PROJECT_DISPLAY_FALLBACK,
  );
  const [decodedPeaks, setDecodedPeaks] = useState<Float32Array | null>(null);
  const [desktopBottomStackPx, setDesktopBottomStackPx] = useState(200);
  const [viewport, setViewport] = useState<VisibleWindow>({
    startRatio: 0,
    durationRatio: 1,
  });
  /** True while an audio timeline load is expected before decode clears it (covers `duration === 0` gap during `ws.load`). */
  const [audioTimelineLoading, setAudioTimelineLoading] = useState(false);
  /** Increment so header / mobile sheets open the Projects picker for empty workspace CTA. */
  const [projectPickerOpenSignal, setProjectPickerOpenSignal] = useState(0);
  const [importChoiceOpen, setImportChoiceOpen] = useState(false);
  const [youtubeLinkDraft, setYoutubeLinkDraft] = useState("");
  const deferredUploadHydrationRef = useRef<
    | {
        meta: StoredProjectMeta;
        options?: { audioBlob?: Blob };
      }
    | undefined
  >(undefined);
  /** Resume demo load after leaving YouTube shell (WaveSurfer mounts on next paint). */
  const deferredDemoLoadRef = useRef(false);
  /** Object URL for ingest when WaveSurfer is not mounted yet (e.g. leaving YouTube). */
  const pendingWaveSurferObjectUrlRef = useRef<string | null>(null);
  const [waveSurferEpoch, setWaveSurferEpoch] = useState(0);
  const hydrateProjectFnRef = useRef<
    (meta: StoredProjectMeta, options?: { audioBlob?: Blob }) => Promise<void>
  >(() => Promise.resolve());

  const {
    projectName,
    projectId,
    loops,
    activeLoopId,
    editableLoopId,
    duration,
    minPxPerSec,
    loopPlaybackEnabled,
    loopFocusTick,
    isPlaying,
    currentTime,
    activeSegmentId,
    loopPracticeScope,
    lastPracticeSegmentIdByPhrase,
    focusRegionWaveformEditUnlockedById,
    phraseWaveformEditUnlockedById,
    mediaSourceKind,
  } = useWoodshedStore(
    useShallow((s) => ({
      projectName: s.projectName,
      projectId: s.projectId,
      loops: s.loops,
      activeLoopId: s.activeLoopId,
      editableLoopId: s.editableLoopId,
      duration: s.duration,
      minPxPerSec: s.minPxPerSec,
      loopPlaybackEnabled: s.loopPlaybackEnabled,
      loopFocusTick: s.loopFocusTick,
      isPlaying: s.isPlaying,
      currentTime: s.currentTime,
      activeSegmentId: s.activeSegmentId,
      loopPracticeScope: s.loopPracticeScope,
      lastPracticeSegmentIdByPhrase: s.lastPracticeSegmentIdByPhrase,
      focusRegionWaveformEditUnlockedById: s.focusRegionWaveformEditUnlockedById,
      phraseWaveformEditUnlockedById: s.phraseWaveformEditUnlockedById,
      mediaSourceKind: s.mediaSource.kind,
    })),
  );
  const youtubeShellActive =
    YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED && mediaSourceKind === "youtube";

  /**
   * Central playback facade for Phase 1 (YouTube prep): transport, seeks, loop-clock reads,
   * and tempo application must go through `MediaPlaybackSurface`, not raw WaveSurfer.
   * Waveform/regions/zoom/load remain on `wavesurferRef`.
   */
  const getPlaybackSurface = useCallback((): MediaPlaybackSurface | null => {
    if (youtubeShellActive) {
      return youtubeWorkspaceRef.current?.getPlaybackSurface() ?? null;
    }
    const ws = wavesurferRef.current;
    return ws ? createWaveSurferPlaybackSurface(ws) : null;
  }, [youtubeShellActive]);

  const activeLoop = useMemo(
    () => loops.find((l) => l.id === activeLoopId),
    [activeLoopId, loops],
  );

  const phraseHasFocusRegions = useMemo(
    () => Boolean(activeLoop?.segments?.length),
    [activeLoop?.segments],
  );

  const regionContextActive = useMemo(
    () =>
      Boolean(
        activeSegmentId &&
          activeLoop?.segments?.some((s) => s.id === activeSegmentId),
      ),
    [activeSegmentId, activeLoop?.segments],
  );

  const isDemoProject = projectId === DEMO_PROJECT_ID;

  const isMobilePractice = useMediaQuery("(max-width: 768px)");
  mobilePracticeModeRef.current = isMobilePractice;

  const [desktopFocusAuthoringComplete, setDesktopFocusAuthoringComplete] =
    useState(
      () => loadOnboardingDocument().desktop.focusLoopAuthoringComplete,
    );
  /** One brief line after first authored Focus Loop (desktop Phase 3). */
  const [desktopPostFocusCreationHint, setDesktopPostFocusCreationHint] =
    useState(false);

  const [demoOrientationSeen, setDemoOrientationSeen] = useState(
    () => loadOnboardingDocument().desktop.demoOrientationSeen,
  );

  /** Mobile M1 posture — ephemeral, cleared on workspace switches (not persisted). */
  const [mobileEditModeActive, setMobileEditModeActive] = useState(false);

  const dismissDemoOrientation = useCallback(() => {
    markDemoOrientationDismissed();
    setDemoOrientationSeen(true);
  }, []);

  const desktopBottomStackPxRef = useRef(desktopBottomStackPx);
  desktopBottomStackPxRef.current = desktopBottomStackPx;

  useEffect(() => {
    if (isMobilePractice) return;
    try {
      const raw = sessionStorage.getItem(DESKTOP_BOTTOM_STACK_PX_KEY);
      const n = raw ? Number.parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= DESKTOP_BOTTOM_STACK_MIN) {
        setDesktopBottomStackPx(n);
      }
    } catch {
      /* private mode */
    }
  }, [isMobilePractice]);

  useEffect(() => {
    if (isMobilePractice) return;
    const clampBottom = () => {
      const root = desktopSplitRef.current;
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
  }, [isMobilePractice]);

  useEffect(() => {
    if (isMobilePractice) return;
    const el = desktopWaveformColumnRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const scheduleReflow = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        reflowWaveSurferForContainer(
          wavesurferRef.current,
          useWoodshedStore.getState().minPxPerSec,
        );
      });
    };
    const ro = new ResizeObserver(scheduleReflow);
    ro.observe(el);
    scheduleReflow();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [isMobilePractice, desktopBottomStackPx]);

  useEffect(() => {
    setMobileEditModeActive(false);
    if (projectId !== DEMO_PROJECT_ID) return;
    setDemoOrientationSeen(loadOnboardingDocument().desktop.demoOrientationSeen);
  }, [projectId]);

  useEffect(() => {
    if (!isMobilePractice) setMobileEditModeActive(false);
  }, [isMobilePractice]);

  useEffect(() => {
    const onUpd = (e: Event) => {
      const evt = e as CustomEvent<{
        transitionedToComplete?: boolean;
      }>;
      setDesktopFocusAuthoringComplete(
        loadOnboardingDocument().desktop.focusLoopAuthoringComplete,
      );
      if (evt.detail?.transitionedToComplete && !mobilePracticeModeRef.current) {
        setDesktopPostFocusCreationHint(true);
      }
    };
    window.addEventListener(DESKTOP_ONBOARDING_UPDATED_EVENT, onUpd);
    return () =>
      window.removeEventListener(DESKTOP_ONBOARDING_UPDATED_EVENT, onUpd);
  }, []);

  useEffect(() => {
    if (!desktopPostFocusCreationHint) return;
    const timer = window.setTimeout(
      () => setDesktopPostFocusCreationHint(false),
      11_000,
    );
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setDesktopPostFocusCreationHint(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [desktopPostFocusCreationHint]);

  useEffect(() => {
    if (isMobilePractice) setDesktopPostFocusCreationHint(false);
  }, [isMobilePractice]);

  const onDesktopBottomResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      desktopBottomDragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        startH: desktopBottomStackPxRef.current,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const onDesktopBottomResizePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = desktopBottomDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const root = desktopSplitRef.current;
      if (!root) return;
      const h = root.clientHeight;
      const maxBottom = Math.min(
        Math.floor(h * DESKTOP_BOTTOM_STACK_MAX_FRAC),
        h - DESKTOP_WAVEFORM_MIN,
      );
      /** Drag up → taller bottom stack (pull panel up). */
      const next = Math.min(
        Math.max(d.startH - (e.clientY - d.startY), DESKTOP_BOTTOM_STACK_MIN),
        Math.max(DESKTOP_BOTTOM_STACK_MIN, maxBottom),
      );
      setDesktopBottomStackPx(next);
    },
    [],
  );

  const onDesktopBottomResizePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = desktopBottomDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      desktopBottomDragRef.current = null;
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

  /** Align chip highlight with resolver when Focus Loop was entered via loop pill only. */
  const mobileFocusChipSelectedId = useMemo(() => {
    if (!isMobilePractice || !activeLoop?.segments?.length) {
      return activeSegmentId;
    }
    if (activeSegmentId) return activeSegmentId;
    if (loopPracticeScope !== "practice_region") return null;
    const seg = resolveFocusPlaybackSegment({
      loop: activeLoop,
      activeSegmentId: null,
      lastPracticeSegmentIdByPhrase,
    });
    return seg?.id ?? null;
  }, [
    isMobilePractice,
    activeLoop,
    activeSegmentId,
    loopPracticeScope,
    lastPracticeSegmentIdByPhrase,
  ]);

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }, []);

  /**
   * Frame the active phrase inside the waveform viewport with balanced padding.
   *
   * The phrase occupies ~86% of the visible width, leaving ~7% breathing room on
   * each side so it reads as *framed* rather than cropped.
   *
   * The crucial detail: WaveSurfer's wrapper sits behind a horizontal gutter
   * (see `lib/waveform-gutter.ts`), so the wrapper's origin is at
   * `x = WAVEFORM_HORIZONTAL_GUTTER_PX` inside the scroll container, not 0.
   * The naive `loop.start * nextPxPerSec − padPx` formula ignores this and
   * leaves the loop one gutter (~72 px) right of optical center — comfortable
   * lead-in, cramped trail-out. The fix is to add the gutter to the desired
   * scrollLeft so the loop *midpoint* lands at `clientWidth / 2`.
   *
   * Loops near the song's start or end clamp gracefully to `[0, maxScroll]`.
   *
   * Returns false if layout isn't ready (caller falls back to follow mode).
   */
  const fitActivePhraseInViewport = useCallback((loop: PracticeLoop) => {
    const ws = wavesurferRef.current;
    if (!ws || !isWaveSurferAudioDecoded(ws)) return false;
    const span = loop.end - loop.start;
    if (span <= 0) return false;
    const dom = peekWaveSurferDom(ws);
    const container = dom?.scrollContainer;
    if (!container) return false;
    const clientWidth = container.clientWidth;
    if (clientWidth <= 0) return false;

    /** Target phrase width as a fraction of the viewport — controls how much breathing room. */
    const PHRASE_VIEWPORT_RATIO = 0.86;
    const targetWidth = clientWidth * PHRASE_VIEWPORT_RATIO;
    const nextPxPerSec = Math.max(4, Math.min(1500, targetWidth / span));
    useWoodshedStore.getState().setMinPxPerSec(nextPxPerSec);
    ws.zoom(nextPxPerSec);

    /** Center the phrase midpoint in the visible viewport, accounting for the gutter. */
    const loopMidPx = ((loop.start + loop.end) / 2) * nextPxPerSec;
    const desiredScroll =
      WAVEFORM_HORIZONTAL_GUTTER_PX + loopMidPx - clientWidth / 2;

    /**
     * Clamp to [0, maxScroll] using a derived bound. We can't trust
     * `container.scrollWidth` immediately after `ws.zoom()` because layout
     * hasn't flushed yet; derive instead from duration × pxPerSec + both gutters.
     */
    const playback = createWaveSurferPlaybackSurface(ws);
    const duration = playback.getDuration();
    const totalScrollWidth =
      duration * nextPxPerSec + 2 * WAVEFORM_HORIZONTAL_GUTTER_PX;
    const maxScroll = Math.max(0, totalScrollWidth - clientWidth);
    const clampedScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
    ws.setScroll(clampedScroll);
    return true;
  }, []);

  const handleResetZoomFullSong = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isWaveSurferAudioDecoded(ws)) return;
    const st = useWoodshedStore.getState();
    /** Full song is an explicit zoom reset — always leave phrase-focus for follow (matches prior behavior). */
    if (st.viewportMode === "phrase-focus") {
      st.setViewportMode("follow");
    }
    const playback = createWaveSurferPlaybackSurface(ws);
    const d = playback.getDuration();
    const dom = peekWaveSurferDom(ws);
    const clientWidth = dom?.scrollContainer?.clientWidth ?? 0;
    suppressViewportScrollUntilRef.current = performance.now() + 220;
    if (d > 0 && clientWidth > 0) {
      const fitAll = Math.max(
        4,
        Math.min(1500, (clientWidth * 0.98) / d),
      );
      st.setMinPxPerSec(fitAll);
      ws.zoom(fitAll);
      ws.setScroll(0);
    } else {
      st.setMinPxPerSec(50);
      ws.zoom(50);
      ws.setScroll(0);
    }
  }, []);

  const handleDevExportLoopsJson = useCallback(() => {
    const text = formatLoopsJsonForClipboard(useWoodshedStore.getState().loops);
    if (process.env.NODE_ENV === "development") {
      console.log(text);
    }
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }, []);

  useEffect(() => {
    listProjects()
      .then(setProjectsList)
      .catch(() => undefined)
      .finally(() => setDexieProjectsListed(true));
  }, []);

  useEffect(() => {
    if (!supabase) {
      setCloudSessionUserId(null);
      return;
    }
    const syncSession = () => {
      void supabase.auth.getSession().then(({ data: { session } }) => {
        setCloudSessionUserId(session?.user?.id ?? null);
      });
    };
    syncSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudSessionUserId(session?.user?.id ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const refreshCloudProjects = useCallback(async () => {
    if (!supabase) {
      setCloudProjects([]);
      setCloudListError(null);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setCloudProjects([]);
      setCloudListError(null);
      return;
    }
    try {
      const list = await listCloudProjectSummaries(supabase);
      setCloudProjects(list);
      setCloudListError(null);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not refresh cloud projects.";
      console.error("[Woodshed cloud] listCloudProjectSummaries failed:", e);
      setCloudProjects([]);
      setCloudListError(msg);
    }
  }, [supabase]);

  useEffect(() => {
    const needsCloudPickers =
      isSupabaseConfigured() && Boolean(supabase && cloudSessionUserId);
    if (!needsCloudPickers) {
      setCloudPickerListed(true);
      void refreshCloudProjects();
      return;
    }
    setCloudPickerListed(false);
    let cancelled = false;
    void refreshCloudProjects().finally(() => {
      if (!cancelled) setCloudPickerListed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshCloudProjects, cloudSessionUserId, supabase]);

  useEffect(() => {
    void fetch(DEMO_PROJECT_JSON_PATH, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw: unknown) => {
        const p = parseDemoProjectFile(raw);
        if (p?.title) setDemoPickerTitle(p.title);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
  }, []);

  const primeWaveformCaches = useCallback(async (blob: Blob) => {
    try {
      const decoded = await analyzeAudioEnvelope(blob);
      if (!decoded) return;
      setDecodedPeaks(Float32Array.from(decoded.getChannelData(0)));
    } catch {
      /* optional */
    }
  }, []);

  const handleMobilePhraseSelect = useCallback((id: string) => {
    const get = useWoodshedStore.getState;
    get().setActiveSegmentId(null);
    get().selectLoop(id);

    /**
     * Phrase selection must move the real media clock, not only the React transport.
     * A deferred seek after `fitActivePhraseInViewport` could be skipped (e.g. effect
     * ordering / `!ws` clearing a pending ref), leaving WaveSurfer paused at the prior
     * time while the store/UI showed the new phrase — Play then resumed the stale time
     * and the loop rail looked like Play Through.
     */
    const st = get();
    const chosen = st.loops.find((l) => l.id === id);
    const playback = getPlaybackSurface();
    if (playback && chosen && chosen.end > chosen.start) {
      playback.seek(chosen.start);
      st.setCurrentTime(chosen.start);
    }
  }, [getPlaybackSurface]);

  const handleMobileRestartPractice = useCallback(() => {
    const playback = getPlaybackSurface();
    if (!playback || !activeLoopId) return;
    const st = useWoodshedStore.getState();
    const loop = st.loops.find((l) => l.id === activeLoopId);
    if (!loop || loop.end <= loop.start) return;
    const t = getRestartSeekSeconds({
      loop,
      loopPracticeScope: st.loopPracticeScope,
      activeSegmentId: st.activeSegmentId,
      lastPracticeSegmentIdByPhrase: st.lastPracticeSegmentIdByPhrase,
    });
    playback.seek(t);
    st.setCurrentTime(t);
    void playback.play();
  }, [activeLoopId, getPlaybackSurface]);

  const handleMobileFocusSegmentSelect = useCallback(
    (segmentId: string) => {
      if (!activeLoopId) return;
      const playback = getPlaybackSurface();
      const get = useWoodshedStore.getState;
      get().selectSegment(activeLoopId, segmentId);
      get().setLoopPracticeScope("practice_region");
      get().setLoopPlaybackEnabled(true);
      const loop = get().loops.find((l) => l.id === activeLoopId);
      const seg = loop?.segments?.find((s) => s.id === segmentId);
      if (playback && seg && seg.endTime > seg.startTime) {
        playback.seek(seg.startTime);
        get().setCurrentTime(seg.startTime);
      }
    },
    [activeLoopId, getPlaybackSurface],
  );

  const loadBuiltInDemoProject = useCallback(async (): Promise<boolean> => {
    const ws = wavesurferRef.current;
    if (!ws) {
      deferredDemoLoadRef.current = true;
      deferredUploadHydrationRef.current = undefined;
      if (pendingWaveSurferObjectUrlRef.current) {
        URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
        pendingWaveSurferObjectUrlRef.current = null;
      }
      setMobileEditModeActive(false);
      pendingHydration.current = null;
      pendingDemoHydrationRef.current = null;
      useWoodshedStore.getState().resetWorkspace();
      useWoodshedStore.getState().setProjectMeta(
        DEMO_PROJECT_ID,
        demoPickerTitle,
        { ...DEFAULT_UPLOAD_MEDIA_SOURCE },
      );
      setAudioTimelineLoading(true);
      audioBlobRef.current = null;
      loopsSignature.current = "";
      return false;
    }

    deferredDemoLoadRef.current = false;
    deferredUploadHydrationRef.current = undefined;

    setMobileEditModeActive(false);
    pendingHydration.current = null;
    pendingDemoHydrationRef.current = null;
    try {
      const res = await fetch(DEMO_PROJECT_JSON_PATH, { cache: "no-store" });
      if (!res.ok) return false;
      const raw: unknown = await res.json();
      const parsed = parseDemoProjectFile(raw);
      if (!parsed) return false;
      const audioBlob = await resolveDemoAudioBlob(parsed.audioUrl);
      setAudioTimelineLoading(true);
      useWoodshedStore.getState().resetWorkspace();
      pendingDemoHydrationRef.current = parsed;
      audioBlobRef.current = audioBlob;
      loopsSignature.current = "";
      await primeWaveformCaches(audioBlob);
      if (pendingHydration.current) {
        pendingDemoHydrationRef.current = null;
        setAudioTimelineLoading(false);
        return false;
      }
      await ws.load(URL.createObjectURL(audioBlob));
      return true;
    } catch {
      devWarn("Built-in demo could not be loaded");
      setAudioTimelineLoading(false);
      return false;
    }
  }, [primeWaveformCaches, demoPickerTitle]);

  useEffect(() => {
    if (youtubeShellActive) {
      return () => {};
    }

    let destroyed = false;
    const regionFactoryPromise = loadRegionsFactory();
    const initialHost = containerRef.current;
    const starterZoom =
      typeof window === "undefined"
        ? 50
        : useWoodshedStore.getState().minPxPerSec;
    const storeForWsInit = useWoodshedStore.getState();
    const initialAutoScroll = !storeForWsInit.loopPlaybackEnabled;

    void (async () => {
      const host = initialHost;
      if (!host) return;
      const wsDiagId =
        process.env.NODE_ENV === "development"
          ? registerWaveSurferDiagInstance()
          : null;
      if (process.env.NODE_ENV === "development") {
        logWaveformLifecycle("init:host-before-await", {
          ws: null,
          host,
          regions: null,
          wsDiagId,
        });
      }
      const Factory = await regionFactoryPromise;
      if (destroyed || !Factory) return;

      const ws = WaveSurfer.create({
        container: host,
        /** `auto` lets the waveform fill the (much taller) flex container — see layout below. */
        height: "auto",
        cursorColor: "transparent",
        cursorWidth: 0,
        /** Slightly brighter wave so peaks remain legible underneath the loop overlay (the waveform is the hero). */
        waveColor: "#403a35",
        progressColor: "#e0d2ff",
        barWidth: 1,
        barGap: 0,
        normalize: true,
        /** Hide the browser-native scrollbar; pan via wheel/trackpad and minimap stays primary. */
        hideScrollbar: true,
        /** Critical: default `fillParent:true` hides zoom until duration×px/sec exceeds viewport */
        fillParent: false,
        minPxPerSec: starterZoom,
        /**
         * Drag is reserved for click-drag panning of the waveform viewport (see pan handler below).
         * Click still seeks via WaveSurfer's internal interaction; this only disables drag-to-seek
         * so panning and editing gestures don't fight the playhead.
         */
        dragToSeek: false,
        autoScroll: initialAutoScroll,
        autoCenter: initialAutoScroll,
      });

      const regionsCtor = Factory as {
        create?: () => RegionsHandle;
        new (): RegionsHandle;
      };
      const regions =
        typeof regionsCtor.create === "function"
          ? regionsCtor.create()
          : new (Factory as new () => RegionsHandle)();
      if (process.env.NODE_ENV === "development") {
        logWaveformLifecycle("init:after-ws-create", {
          ws,
          host,
          regions: null,
          wsDiagId,
        });
      }
      if (process.env.NODE_ENV === "development") {
        logRegionsPinProbe(regions, "after regions ctor");
      }

      try {
        ws.registerPlugin(regions as never);
        if (process.env.NODE_ENV === "development") {
          logRegionsPinProbe(regions, "after registerPlugin");
          logWaveformLifecycle("init:after-register-plugin", {
            ws,
            host,
            regions,
            wsDiagId,
          });
          globalThis.setTimeout(() => {
            logWaveformLifecycle("init:post-timeout", {
              ws,
              host,
              regions,
              wsDiagId,
            });
          }, 0);
          requestAnimationFrame(() => {
            logWaveformLifecycle("init:post-raf", {
              ws,
              host,
              regions,
              wsDiagId,
            });
          });
        }
      } catch {
        devError("Regions plugin unavailable");
      }
      regionsRef.current = regions;
      wavesurferRef.current = ws;
      setWaveSurferEpoch((n) => n + 1);

      const applyWaveformGutterMargins = () => {
        const dom = peekWaveSurferDom(ws);
        if (!dom?.wrapper) return;
        dom.wrapper.style.marginLeft = `${WAVEFORM_HORIZONTAL_GUTTER_PX}px`;
        dom.wrapper.style.marginRight = `${WAVEFORM_HORIZONTAL_GUTTER_PX}px`;
      };
      applyWaveformGutterMargins();

      /**
       * One adapter instance per WaveSurfer mount — reused by loop RAF + transport listeners
       * so hot paths don't allocate fresh `{ seek, play, … }` closures every tick.
       */
      const wsPlaybackSurface = createWaveSurferPlaybackSurface(ws);

      /**
       * Click-drag pan on the main waveform.
       *
       * Why this exists:
       *   The mini-map was carrying too much weight for everyday navigation.
       *   Direct click-drag inside the waveform is the most tactile way to move
       *   around while practicing.
       *
       * Gesture priority:
       *   1. Phrase resize handles (inside `.woodshed-region-editing`) — regions
       *      plugin owns resize; we bail out when the event target is inside that
       *      wrapper (handles keep `pointer-events: auto`; the phrase fill is `none`).
       *   2. Focus region overlay (`.woodshed-region-segment`) — click-to-select /
       *      resize when unlocked; we never arm pan from inside the overlay.
       *   3. Elsewhere on the waveform — pan after slop; click without drag seeks.
       *
       * Click-vs-pan disambiguation:
       *   We require ~4px of movement before activating pan so single clicks
       *   still seek via WaveSurfer's internal interaction. Once a pan starts
       *   we set pointer capture and intercept the trailing `click` event in
       *   the capture phase so WaveSurfer's seek doesn't fire on release.
       */
      const panDom = peekWaveSurferDom(ws);
      if (panDom) {
        releasePanRef.current = installWaveformPanGesture(
          panDom.scrollContainer,
          () => mobilePracticeModeRef.current,
        );
        releaseShiftAuthoringRef.current?.();
        /** Shift+drag authoring seeks via WaveSurfer inside the gesture helper (`getWave`); Phase 1 playback boundary is workspace-owned elsewhere. */
        releaseShiftAuthoringRef.current = installShiftWaveformAuthoringGesture({
          scrollContainer: panDom.scrollContainer,
          getWave: () => wavesurferRef.current,
          isMobilePractice: () => mobilePracticeModeRef.current,
          getMinPxPerSec: () => useWoodshedStore.getState().minPxPerSec,
          commit: ({ startSec, endSec }) => {
            const st = useWoodshedStore.getState();
            const phraseId = st.activeLoopId;
            const loop = phraseId
              ? st.loops.find((l) => l.id === phraseId)
              : undefined;
            if (
              phraseId &&
              shiftDragShouldCreateFocusInsideActivePhrase(
                loop,
                startSec,
                endSec,
              )
            ) {
              const r = st.createFocusSegmentFromShiftDrag({
                phraseId,
                startSec,
                endSec,
              });
              if (!r) return null;
              markDesktopFocusLoopCreatedByUser();
              st.setCurrentTime(r.seekTo);
              return r;
            }
            const phrase = st.createPhraseFromShiftDrag(startSec, endSec);
            if (!phrase) return null;
            st.setCurrentTime(phrase.start);
            return { seekTo: phrase.start };
          },
        });
        pinchZoomReleaseRef.current = installWaveformPinchZoom(ws, {
          isMobilePractice: () => mobilePracticeModeRef.current,
          getStore: () => useWoodshedStore.getState(),
        });
      }

      let tightLoopRaf = 0;
      const cancelTightLoop = () => {
        cancelAnimationFrame(tightLoopRaf);
        tightLoopRaf = 0;
      };
      cancelPlaybackLoopRef.current = cancelTightLoop;

      function loopBoundaryStep() {
        if (destroyed || !wsPlaybackSurface.isPlaying()) {
          tightLoopRaf = 0;
          return;
        }
        const snapshot = useWoodshedStore.getState();
        const rail = buildPlaybackLoopRail(snapshot);
        const t = wsPlaybackSurface.getCurrentTime();
        if (rail.enabled && rail.end > rail.start) {
          if (t >= rail.end) {
            wsPlaybackSurface.seek(rail.start);
          } else if (t + 1e-4 < rail.start) {
            wsPlaybackSurface.seek(rail.start);
          }
        }
        tightLoopRaf = requestAnimationFrame(loopBoundaryStep);
      }

      const updateViewport = () => {
        const dom = peekWaveSurferDom(ws);
        const parent = dom?.scrollContainer;
        if (!dom || !parent) return;
        const scrollLeft = parent.scrollLeft;
        const scrollWidth = parent.scrollWidth;
        const clientWidth = parent.clientWidth || 1;
        const usable = scrollWidth - clientWidth;
        const startRatio = usable <= 0 ? 0 : scrollLeft / usable;
        const durationRatio =
          scrollWidth <= 0 ? 1 : Math.min(1, clientWidth / scrollWidth);
        setViewport({ startRatio, durationRatio });
      };

      ws.on("scroll", updateViewport);
      ws.on("zoom", updateViewport);

      const peekPan = peekWaveSurferDom(ws);
      if (peekPan) {
        peekPan.scrollContainer.addEventListener(
          "scroll",
          () => {
            if (performance.now() < suppressViewportScrollUntilRef.current) {
              return;
            }
            const st = useWoodshedStore.getState();
            st.exitPhraseFitAfterUserNavigation();
          },
          { passive: true },
        );
      }

      ws.on("dblclick", (relativeX) => {
        if (mobilePracticeModeRef.current) return;
        const dur = wsPlaybackSurface.getDuration();
        if (!dur) return;
        const midpoint = clamp(relativeX, 0, 1) * dur;
        useWoodshedStore
          .getState()
          .addLoopAround(
            midpoint,
            Math.min(2, Math.max(dur * 0.015, 0.25)),
            "Quick phrase",
          );
      });

      let lastTransportUiMs = 0;

      ws.on("timeupdate", (t) => {
        if (destroyed) return;
        const tSec =
          typeof t === "number" && Number.isFinite(t)
            ? t
            : wsPlaybackSurface.getCurrentTime();
        const now = performance.now();
        if (
          !wsPlaybackSurface.isPlaying() ||
          now - lastTransportUiMs >= PLAYHEAD_UI_TIME_MS
        ) {
          lastTransportUiMs = now;
          useWoodshedStore.getState().setCurrentTime(tSec);
        }
      });

      ws.on("play", () => {
        useWoodshedStore.getState().setPlaying(true);
        lastTransportUiMs = 0;
        cancelTightLoop();
        tightLoopRaf = requestAnimationFrame(loopBoundaryStep);
      });
      ws.on("pause", () => {
        cancelTightLoop();
        useWoodshedStore.getState().setPlaying(false);
      });
      ws.on("finish", () => {
        cancelTightLoop();
        useWoodshedStore.getState().setPlaying(false);
      });

      ws.on("decode", (dur) => {
        const state = useWoodshedStore.getState();
        state.setDuration(dur);
        const pending = pendingHydration.current;
        const demo = pendingDemoHydrationRef.current;
        if (pending) {
          state.setProjectMeta(
            pending.id,
            pending.name,
            normalizeMediaSourceFromStoredProject(pending),
          );
          state.upsertLoops(pending.loops);
          if (
            pending.activeLoopId &&
            pending.loops.some((l) => l.id === pending.activeLoopId)
          ) {
            state.selectLoop(pending.activeLoopId);
          }
          const stAfter = useWoodshedStore.getState();
          const rawPractice = pending.practiceStateV1;
          if (rawPractice != null) {
            const normalized = normalizePracticeStatePersistV1(
              rawPractice,
              stAfter.loops,
              stAfter.activeLoopId,
            );
            if (normalized) {
              useWoodshedStore
                .getState()
                .applyHydratedPracticePreferences(normalized);
            }
          }
          pendingHydration.current = null;
        } else if (demo) {
          const loops = demoRowsToPracticeLoops(demo.loopRows, dur);
          state.setProjectMeta(demo.projectId, demo.title, {
            ...DEFAULT_UPLOAD_MEDIA_SOURCE,
          });
          state.upsertLoops(loops);
          const active =
            demo.activeLoopId &&
            loops.some((l) => l.id === demo.activeLoopId)
              ? demo.activeLoopId
              : (loops[0]?.id ?? null);
          if (active) state.selectLoop(active);
          pendingDemoHydrationRef.current = null;
        } else if (state.loops.length === 0) {
          state.bootstrapFromDuration(dur);
        }

        try {
          const decoded = (
            ws as unknown as { getDecodedData?: () => AudioBuffer }
          ).getDecodedData?.();
          if (decoded && decoded.numberOfChannels) {
            setDecodedPeaks(Float32Array.from(decoded.getChannelData(0)));
          }
        } catch {
          /* optional */
        }

        applyWaveformGutterMargins();
        updateViewport();
        if (!destroyed) {
          ws.zoom(useWoodshedStore.getState().minPxPerSec);
        }
      });

      /**
       * Built-in demo is **never** loaded on WaveSurfer init.
       * Users open it explicitly (session picker → demo id, etc.).
       * @see docs/APPLICATION_STATE_MODEL.md • docs/ONBOARDING_STRATEGY.md
       */

      updateViewport();
    })();

    return () => {
      destroyed = true;
      if (process.env.NODE_ENV === "development") {
        logWaveformLifecycle("init:cleanup-before-destroy", {
          ws: wavesurferRef.current,
          host: initialHost,
          regions: regionsRef.current,
          wsDiagId: null,
        });
      }
      cancelPlaybackLoopRef.current?.();
      cancelPlaybackLoopRef.current = null;
      loopsSignature.current = "";
      wheelBound.current = false;
      regionsRef.current = null;
      /** Release the pan handler before destroying WaveSurfer (DOM listeners attach to the scrollContainer). */
      releasePanRef.current?.();
      releasePanRef.current = null;
      releaseShiftAuthoringRef.current?.();
      releaseShiftAuthoringRef.current = null;
      pinchZoomReleaseRef.current?.();
      pinchZoomReleaseRef.current = null;
      wavesurferRef.current?.destroy();
      if (process.env.NODE_ENV === "development") {
        unregisterWaveSurferDiagInstance();
      }
      wavesurferRef.current = null;
      if (pendingWaveSurferObjectUrlRef.current) {
        URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
        pendingWaveSurferObjectUrlRef.current = null;
      }
    };
  }, [youtubeShellActive]);

  useEffect(() => {
    if (youtubeShellActive) return;
    if (!wavesurferRef.current) return;
    const pending = deferredUploadHydrationRef.current;
    if (!pending) return;
    deferredUploadHydrationRef.current = undefined;
    void hydrateProjectFnRef.current(pending.meta, pending.options);
  }, [youtubeShellActive, waveSurferEpoch]);

  useEffect(() => {
    if (youtubeShellActive) return;
    if (!wavesurferRef.current || !deferredDemoLoadRef.current) return;
    void loadBuiltInDemoProject().then((ok) => {
      if (ok) void listProjects().then(setProjectsList);
    });
  }, [youtubeShellActive, waveSurferEpoch, loadBuiltInDemoProject]);

  useEffect(() => {
    if (youtubeShellActive) return;
    const ws = wavesurferRef.current;
    const url = pendingWaveSurferObjectUrlRef.current;
    if (!ws || !url) return;
    pendingWaveSurferObjectUrlRef.current = null;
    void (async () => {
      try {
        await ws.load(url);
        await listProjects().then(setProjectsList);
      } catch {
        devError("Failed to load waveform");
        setAudioTimelineLoading(false);
        URL.revokeObjectURL(url);
      }
    })();
  }, [youtubeShellActive, waveSurferEpoch]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws || !isWaveSurferAudioDecoded(ws)) return;
    ws.zoom(minPxPerSec);
  }, [minPxPerSec]);

  /** Mobile: drag-to-seek off while repeating; off while Edit Mode (M2 phrase refinement); softer drag in play-through. */
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (!isMobilePractice) {
      ws.setOptions({ dragToSeek: false });
      return;
    }
    if (mobileEditModeActive) {
      ws.setOptions({ dragToSeek: false });
      return;
    }
    if (loopPlaybackEnabled) {
      ws.setOptions({ dragToSeek: false });
      return;
    }
    ws.setOptions({ dragToSeek: { debounceTime: 280 } });
  }, [isMobilePractice, loopPlaybackEnabled, mobileEditModeActive]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const st = useWoodshedStore.getState();
    if (!st.loopPlaybackEnabled) {
      st.setViewportMode("follow");
      return;
    }
    const loop = st.loops.find((l) => l.id === st.activeLoopId);
    if (!loop || loop.end <= loop.start) {
      st.setViewportMode("follow");
      return;
    }
    suppressViewportScrollUntilRef.current = performance.now() + 220;
    if (!fitActivePhraseInViewport(loop)) {
      useWoodshedStore.getState().setViewportMode("follow");
      return;
    }
    useWoodshedStore.getState().setViewportMode("phrase-focus");
  }, [loopPlaybackEnabled, activeLoopId, loopFocusTick, fitActivePhraseInViewport]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    /** While repeat phrase is on, never auto-scroll the waveform — even after the user leaves phrase-focus. */
    const followPlayback = !loopPlaybackEnabled;
    ws.setOptions({
      autoScroll: followPlayback,
      autoCenter: followPlayback,
    });
  }, [loopPlaybackEnabled]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const playback = createWaveSurferPlaybackSurface(ws);
    applyPlaybackTempo(playback, activeLoop?.tempo ?? 1);
  }, [activeLoop?.tempo, activeLoop?.id]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    const regions = regionsRef.current;
    if (!ws || !regions) return;
    if (process.env.NODE_ENV === "development") {
      logRegionsPinProbe(regions, "regions effect start");
      logWaveformLifecycle("regions-effect:start", {
        ws,
        host: containerRef.current,
        regions,
        wsDiagId: null,
      });
    }

    /**
     * Main waveform shows only the currently active practice phrase (one region).
     *
     * Other phrases stay in the store, desktop mini-map, and mobile phrase list.
     * Selecting a different phrase swaps which one is drawn here.
     */
    const renderedLoop = activeLoopId
      ? loops.find((l) => l.id === activeLoopId) ?? null
      : null;

    /**
     * Signature only tracks what the main waveform actually draws.
     * If an inactive loop's bounds change (e.g. background tempo change),
     * we don't waste a region rebuild. Phrase edit mode and per-segment waveform
     * unlock flags are included so toggling handles rebuilds regions.
     */
    const segSig = renderedLoop?.segments?.length
      ? renderedLoop.segments
          .map((s) => `${s.id}:${s.startTime.toFixed(3)}:${s.endTime.toFixed(3)}`)
          .join(",")
      : "";
    const segUnlockSig = renderedLoop?.segments?.length
      ? renderedLoop.segments
          .map((s) =>
            focusRegionWaveformEditUnlockedById[s.id] ? `${s.id}:1` : `${s.id}:0`,
          )
          .join(",")
      : "";
    const phraseWaveUnlocked = Boolean(
      renderedLoop && phraseWaveformEditUnlockedById[renderedLoop.id],
    );
    /** M2: Edit Mode — refine selected Practice Section bounds on the waveform (mobile only). */
    const mobilePhraseRefine = Boolean(
      isMobilePractice && mobileEditModeActive && renderedLoop,
    );
    /**
     * Desktop phrase waveform resize handles whenever the inspector unlocks phrase
     * boundaries — independent of `regionContextActive`. Previously we tied handles to
     * `!regionContextActive`, which made resize impossible whenever a focus segment
     * was selected (the common case while editing focus regions). Stacking + CSS
     * (`pointer-events` on `.woodshed-region-editing`) keep segment clicks usable.
     *
     * Mobile: resize when Edit Mode is on for the active (rendered) Practice Section.
     */
    const phraseWaveResizeEnabled =
      Boolean(phraseWaveUnlocked && !isMobilePractice) || mobilePhraseRefine;
    const phraseHandleDiagActive =
      phraseWaveResizeEnabled &&
      phraseHandleDiagnosticsEnabled() &&
      !isMobilePractice;
    if (containerRef.current) {
      if (phraseHandleDiagActive) {
        containerRef.current.dataset.phraseHandleDebug = "true";
      } else {
        delete containerRef.current.dataset.phraseHandleDebug;
      }
    }
    /**
     * Keep the active phrase region mounted while desktop phrase waveform editing is
     * unlocked — WaveSurfer's virtualAppend would otherwise detach it when zoomed/panned.
     * See `lib/wavesurfer-regions-virtual-append-phrase-pin.ts`.
     */
    setActivePhraseRegionVirtualAppendPin({
      pinActive: Boolean(
        renderedLoop &&
          ((phraseWaveUnlocked && !isMobilePractice) ||
            (isMobilePractice && mobileEditModeActive)),
      ),
      pinnedLoopId: renderedLoop?.id ?? null,
    });
    if (process.env.NODE_ENV === "development" && renderedLoop) {
      console.log("[Woodshed phrase pin] render-state", {
        renderedLoopId: renderedLoop.id,
        phraseWaveUnlocked,
        phraseWaveResizeEnabled,
        isMobilePractice,
      });
    }
    const phraseHasSegForRegions = Boolean(renderedLoop?.segments?.length);
    const signature = renderedLoop
      ? `${renderedLoop.id}|${renderedLoop.start.toFixed(4)}|${renderedLoop.end.toFixed(4)}|ph:${
          phraseWaveResizeEnabled ? "edit" : "lock"
        }|m:${isMobilePractice ? "1" : "0"}|e:${mobileEditModeActive ? "1" : "0"}|lp:${loopPracticeScope}|seg:${segSig}|segU:${segUnlockSig}|sel:${mobileFocusChipSelectedId ?? ""}`
      : `empty|m:${isMobilePractice ? "1" : "0"}|e:${mobileEditModeActive ? "1" : "0"}|lp:${loopPracticeScope}`;
    if (signature === loopsSignature.current) {
      return;
    }
    loopsSignature.current = signature;

    const trackDur = createWaveSurferPlaybackSurface(ws).getDuration();

    phraseHandleDiagCleanupRef.current?.();
    phraseHandleDiagCleanupRef.current = null;

    regions.clearRegions();
    if (process.env.NODE_ENV === "development") {
      logWaveformLifecycle("regions-effect:after-clear", {
        ws,
        host: containerRef.current,
        regions,
        wsDiagId: null,
      });
    }

    const applyPhraseHandleInteractivity = (el: HTMLElement) => {
      /**
       * WaveSurfer internals render in shadow DOM, so app-level descendant selectors
       * from globals.css cannot reliably style phrase handles. Set explicit inline
       * styles on the live handle nodes while phrase resize is unlocked.
       */
      const handles = Array.from(
        el.querySelectorAll('[part*="region-handle"]'),
      ).filter((n): n is HTMLElement => n instanceof HTMLElement);
      for (const handle of handles) {
        handle.style.pointerEvents = "auto";
        handle.style.cursor = "ew-resize";
        handle.style.zIndex = "3";
      }
    };
    const applyMobilePhraseHandleTouchSizing = (el: HTMLElement) => {
      const handles = Array.from(
        el.querySelectorAll('[part*="region-handle"]'),
      ).filter((n): n is HTMLElement => n instanceof HTMLElement);
      for (const handle of handles) {
        handle.style.minWidth = "44px";
        handle.style.minHeight = "44px";
        handle.style.touchAction = "none";
      }
    };
    let focusProbeLogged = false;

    const addFocusRegionOverlays = () => {
      const segmentMobileReadonly = isMobilePractice;
      if (!renderedLoop?.segments?.length) return;
      const segmentsOrdered = [...renderedLoop.segments].sort(
        (a, b) => a.startTime - b.startTime,
      );
      for (let segIndex = 0; segIndex < segmentsOrdered.length; segIndex++) {
        const seg = segmentsOrdered[segIndex];
        const selected = seg.id === mobileFocusChipSelectedId;
        const waveformUnlocked = Boolean(
          focusRegionWaveformEditUnlockedById[seg.id],
        );
        const allowSegResize =
          !segmentMobileReadonly &&
          selected &&
          waveformUnlocked;
        const paletteIndex = focusRegionWavePaletteIndex(segIndex);
        const paletteSlot = FOCUS_REGION_WAVE_PALETTE[paletteIndex];
        const { start: segStart, end: segEnd } = normalizeWaveSurferRegionBounds({
          startRaw: seg.startTime,
          endRaw: seg.endTime,
          trackDuration: trackDur,
        });
        if (process.env.NODE_ENV === "development") {
          console.log("[Woodshed ws region] focus addRegion", {
            phraseId: renderedLoop.id,
            phraseName: renderedLoop.name,
            segmentId: seg.id,
            segmentName: seg.name,
            start: segStart,
            end: segEnd,
            duration: trackDur,
            raw: { startTime: seg.startTime, endTime: seg.endTime },
          });
        }
        const focusFront = loopPracticeScope === "practice_region" && phraseHasSegForRegions;
        const sreg = regions.addRegion({
          id: `seg:${seg.id}`,
          start: segStart,
          end: segEnd,
          color:
            segmentMobileReadonly && selected
              ? focusRegionFillForWave(paletteSlot, true, focusFront)
              : segmentMobileReadonly
                ? focusRegionFillForWave(paletteSlot, false, focusFront)
                : focusRegionFillForWave(paletteSlot, selected, focusFront),
          /** Move whole region off — only phrase-level editing uses full drag. */
          drag: false,
          resize: allowSegResize,
        }) as RegionHandle & { element?: HTMLElement | null };

        requestAnimationFrame(() => {
          const el = sreg.element;
          if (!el) return;
          el.classList.add("woodshed-region-segment");
          if (process.env.NODE_ENV === "development" && !focusProbeLogged) {
            focusProbeLogged = true;
            logRegionElementMountProbe({
              label: "focus-region-path",
              regionId: `seg:${seg.id}`,
              element: el,
              ws,
            });
          }
          if (segmentMobileReadonly) {
            el.classList.add("woodshed-region-segment-readonly");
            if (selected) {
              el.classList.add("woodshed-region-segment-selected");
            }
            el.style.pointerEvents = "none";
            applyMobileReadonlyFocusRegionVisuals(
              el,
              selected,
              loopPracticeScope,
              phraseHasSegForRegions,
            );
          } else {
            el.setAttribute("data-focus-palette", String(paletteIndex));
            el.style.pointerEvents = "auto";
            if (selected) {
              el.classList.add("woodshed-region-segment-selected");
            }
            if (allowSegResize) {
              el.classList.add("woodshed-region-segment-editable");
            }
            applyDesktopFocusRegionVisuals(
              el,
              paletteIndex,
              selected,
              allowSegResize,
              loopPracticeScope,
              phraseHasSegForRegions,
            );
            const onDesktopFocusDblClick = (ev: MouseEvent) => {
              if (!isStructuralPracticeMode()) return;
              ev.preventDefault();
              ev.stopPropagation();
              enterFocusLoopStructuralEdit(renderedLoop.id, seg.id);
            };
            el.addEventListener("dblclick", onDesktopFocusDblClick);
          }
        });

        if (!segmentMobileReadonly) {
          sreg.on("click", () => {
            useWoodshedStore
              .getState()
              .selectSegment(renderedLoop.id, seg.id);
          });
        }

        if (allowSegResize) {
          sreg.on("update-end", (payload: unknown) => {
            const updated =
              typeof payload === "object" && payload && "region" in (payload as object)
                ? ((payload as { region?: RegionHandle }).region ?? sreg)
                : sreg;
            const regionStart =
              typeof (updated as { start?: number }).start === "number"
                ? (updated as { start: number }).start
                : sreg.start;
            const regionEnd =
              typeof (updated as { end?: number }).end === "number"
                ? (updated as { end: number }).end
                : sreg.end;
            useWoodshedStore.getState().updateSegment(renderedLoop.id, seg.id, {
              startTime: regionStart,
              endTime: regionEnd,
            });
          });
        }
      }
    };

    const addActivePhraseRegion = () => {
      if (!renderedLoop) return;
      const loop = renderedLoop;
      const isEditing = phraseWaveResizeEnabled;
      const isActive = loop.id === activeLoopId && !isEditing;
      const allowResize = phraseWaveResizeEnabled;
      const { start: phraseStart, end: phraseEnd } = normalizeWaveSurferRegionBounds({
        startRaw: loop.start,
        endRaw: loop.end,
        trackDuration: trackDur,
      });
      if (process.env.NODE_ENV === "development") {
        console.log("[Woodshed ws region] phrase addRegion", {
          phraseId: loop.id,
          phraseName: loop.name,
          start: phraseStart,
          end: phraseEnd,
          duration: trackDur,
          raw: { start: loop.start, end: loop.end },
        });
      }
      const region = regions.addRegion({
        id: loop.id,
        start: phraseStart,
        end: phraseEnd,
        /**
         * Three visual tiers, in order of emphasis:
         *   editing  — calm violet wash, bright edges + handles (CSS owns the edge frame)
         *   active   — selected practice phrase: clear borders, no fill emphasis
         *   locked   — barely-there slate: still selectable, never editable
         * Fill opacities stay low so the waveform is always the hero.
         */
        color: phraseRegionWaveColor(
          isEditing ? "editing" : isActive ? "active" : "locked",
          isMobilePractice,
          loopPracticeScope === "phrase" || !phraseHasSegForRegions,
        ),
        /** Match focus regions: resize handles only (no whole-phrase drag). */
        drag: false,
        resize: allowResize,
      }) as RegionHandle & { element?: HTMLElement | null };
      if (process.env.NODE_ENV === "development") {
        console.log("[Woodshed phrase pin] phrase region added", {
          regionId: loop.id,
          allowResize,
          hasElementObject: Boolean(region.element),
        });
      }

      requestAnimationFrame(() => {
        const el = region.element;
        if (!el) return;
        if (process.env.NODE_ENV === "development") {
          logRegionElementMountProbe({
            label: "phrase-region-path",
            regionId: loop.id,
            element: el,
            ws,
          });
        }
        const className = isEditing
          ? "woodshed-region-editing"
          : isActive
            ? "woodshed-region-active"
            : "woodshed-region-locked";
        el.classList.add(className);
        applyPhraseRegionVisuals(
          el,
          isEditing ? "editing" : isActive ? "active" : "locked",
          isMobilePractice,
          loopPracticeScope,
          phraseHasSegForRegions,
        );
        if (!isMobilePractice) {
          const onDesktopPhraseDblClick = (ev: MouseEvent) => {
            if (!isStructuralPracticeMode()) return;
            ev.preventDefault();
            ev.stopPropagation();
            enterPracticeSectionStructuralEdit(loop.id);
          };
          el.addEventListener("dblclick", onDesktopPhraseDblClick);
        }
        if (isMobilePractice && !mobilePhraseRefine) {
          el.style.pointerEvents = "none";
        } else if (allowResize) {
          /** Keep phrase body pass-through while leaving handles interactive. */
          el.style.pointerEvents = "none";
          applyPhraseHandleInteractivity(el);
          if (mobilePhraseRefine) {
            applyMobilePhraseHandleTouchSizing(el);
          }
        } else {
          el.style.pointerEvents = "";
        }
      });

      if (!isMobilePractice) {
        region.on("click", () => {
          useWoodshedStore.getState().selectLoop(loop.id);
        });
      }

      if (mobilePhraseRefine) {
        region.on("update", () => {
          const st = useWoodshedStore.getState();
          if (!st.isPlaying) return;
          const w = wavesurferRef.current;
          const playback = w ? createWaveSurferPlaybackSurface(w) : null;
          playback?.pause();
          st.setPlaying(false);
        });
      }

      region.on("update-end", (payload: unknown) => {
        const updated = typeof payload === "object" && payload && "region" in (payload as object)
          ? ((payload as { region?: RegionHandle }).region ?? region)
          : region;
        const regionStart =
          typeof (updated as { start?: number }).start === "number"
            ? ((updated as { start: number }).start)
            : region.start;
        const regionEnd =
          typeof (updated as { end?: number }).end === "number"
            ? ((updated as { end: number }).end)
            : region.end;

        useWoodshedStore
          .getState()
          .updateLoopBounds(loop.id, regionStart, regionEnd);
      });

      if (phraseHandleDiagActive) {
        phraseHandleDiagCleanupRef.current = schedulePhraseHandleDiagnostics({
          regionId: loop.id,
          region,
          ws,
          regionsPlugin: regions as unknown as { regionsContainer?: HTMLElement | null },
          host: containerRef.current,
        });
      }
    };

    /**
     * When phrase resize is enabled, register the phrase region *after* focus overlays
     * so it sits on top (handles stay reachable). The editing phrase root uses
     * `pointer-events: none` in CSS so clicks pass through to segments except on handles.
     * When locked, phrase stays under segments so phrase clicks select the phrase first.
     */
    if (renderedLoop) {
      if (phraseWaveResizeEnabled) {
        addFocusRegionOverlays();
        addActivePhraseRegion();
      } else {
        addActivePhraseRegion();
        addFocusRegionOverlays();
      }
    }

    const domPeek = peekWaveSurferDom(ws);
    if (domPeek && !wheelBound.current) {
      const { scrollContainer, wrapper } = domPeek;
      wheelBound.current = true;
      scrollContainer.addEventListener(
        "wheel",
        (event) => {
          if (mobilePracticeModeRef.current) return;
          const ws = wavesurferRef.current;
          if (!ws) return;
          event.preventDefault();
          const target = useWoodshedStore.getState();
          target.exitPhraseFitAfterUserNavigation();
          applyWheelZoomAnchoredToCursor(
            ws,
            event,
            target.minPxPerSec,
            target.setMinPxPerSec,
          );
        },
        { passive: false },
      );
      scrollContainer.addEventListener("pointermove", (event) => {
        const inner = wavesurferRef.current;
        if (!inner) return;
        const dur = createWaveSurferPlaybackSurface(inner).getDuration();
        if (!dur) return;
        const scRect = scrollContainer.getBoundingClientRect();
        const xInWaveform =
          event.clientX - scRect.left + scrollContainer.scrollLeft;
        const totalW = Math.max(1, wrapper.scrollWidth);
        const ratio = clamp(xInWaveform / totalW, 0, 1);
        useWoodshedStore.getState().setHoverTime(ratio * dur);
      });
      scrollContainer.addEventListener("pointerleave", () =>
        useWoodshedStore.getState().setHoverTime(null),
      );
    }
  }, [
    loops,
    activeLoopId,
    isMobilePractice,
    mobileEditModeActive,
    activeSegmentId,
    regionContextActive,
    mobileFocusChipSelectedId,
    focusRegionWaveformEditUnlockedById,
    phraseWaveformEditUnlockedById,
    loopPracticeScope,
  ]);

  useEffect(() => {
    const host = containerRef.current;
    return () => {
      phraseHandleDiagCleanupRef.current?.();
      phraseHandleDiagCleanupRef.current = null;
      if (host) {
        delete host.dataset.phraseHandleDebug;
      }
    };
  }, []);

  const ingestFile = useCallback(async (blob: Blob) => {
    setMobileEditModeActive(false);
    setAudioTimelineLoading(true);
    pendingDemoHydrationRef.current = null;
    deferredUploadHydrationRef.current = undefined;
    deferredDemoLoadRef.current = false;

    useWoodshedStore.getState().resetWorkspace();
    audioBlobRef.current =
      blob instanceof File ? blob : new Blob([await blob.arrayBuffer()]);
    loopsSignature.current = "";

    await primeWaveformCaches(audioBlobRef.current);

    const displayName =
      blob instanceof File
        ? formatFilenameAsProjectName(blob.name)
        : "Woodshed session";
    const uploadMediaSource =
      blob instanceof File
        ? {
            kind: "upload" as const,
            blobId: null,
            fileName: blob.name,
            mimeType: blob.type || null,
          }
        : { ...DEFAULT_UPLOAD_MEDIA_SOURCE };
    useWoodshedStore
      .getState()
      .setProjectMeta(nanoid(), displayName, uploadMediaSource);

    const ws = wavesurferRef.current;
    try {
      const url = URL.createObjectURL(blob);
      if (!ws) {
        if (pendingWaveSurferObjectUrlRef.current) {
          URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
        }
        pendingWaveSurferObjectUrlRef.current = url;
        return;
      }
      await ws.load(url);
      await listProjects().then(setProjectsList);
    } catch {
      devError("Failed to load waveform");
      setAudioTimelineLoading(false);
    }
  }, [primeWaveformCaches]);

  const handleMobileFileInputChange = useCallback(
    async (evt: ChangeEvent<HTMLInputElement>) => {
      const input = evt.target;
      const file = input.files?.item(0);
      if (!file) {
        input.value = "";
        return;
      }
      if (!isAllowedUploadedAudioFile(file)) {
        devWarn(
          "Please choose an audio file (MP3, M4A, AAC, WAV, FLAC, AIFF, …).",
        );
        input.value = "";
        return;
      }
      await ingestFile(file);
      input.value = "";
    },
    [ingestFile],
  );

  const hydrateProject = useCallback(
    async (meta: StoredProjectMeta, options?: { audioBlob?: Blob }) => {
      const normalized = normalizeMediaSourceFromStoredProject(meta);
      if (normalized.kind === "youtube") {
        devWarn(
          "hydrateProject called with YouTube media — use main-app YouTube loader.",
        );
        return;
      }
      const ws = wavesurferRef.current;
      if (!ws) {
        deferredUploadHydrationRef.current = { meta, options };
        deferredDemoLoadRef.current = false;
        if (pendingWaveSurferObjectUrlRef.current) {
          URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
          pendingWaveSurferObjectUrlRef.current = null;
        }
        setMobileEditModeActive(false);
        pendingDemoHydrationRef.current = null;
        pendingHydration.current = null;
        useWoodshedStore.getState().resetWorkspace();
        useWoodshedStore
          .getState()
          .setProjectMeta(meta.id, meta.name, normalized);
        setAudioTimelineLoading(true);
        loopsSignature.current = "";
        audioBlobRef.current = null;
        return;
      }
      deferredDemoLoadRef.current = false;
      deferredUploadHydrationRef.current = undefined;
      if (pendingWaveSurferObjectUrlRef.current) {
        URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
        pendingWaveSurferObjectUrlRef.current = null;
      }
      setMobileEditModeActive(false);
      pendingDemoHydrationRef.current = null;
      const blob =
        options?.audioBlob ??
        (meta.blobId ? await loadBlobRecord(meta.blobId) : undefined);
      if (!blob) {
        pendingHydration.current = null;
        devWarn("Missing archived audio blob");
        return;
      }
      setAudioTimelineLoading(true);
      pendingHydration.current = meta;
      useWoodshedStore.getState().resetWorkspace();
      loopsSignature.current = "";
      audioBlobRef.current = blob;
      try {
        await primeWaveformCaches(blob);
        await ws.load(URL.createObjectURL(blob));
        await listProjects().then(setProjectsList);
      } catch {
        setAudioTimelineLoading(false);
        pendingHydration.current = null;
        devError("Failed to load project audio");
      }
    },
    [primeWaveformCaches],
  );

  hydrateProjectFnRef.current = hydrateProject;

  const scheduleSaveStatusClear = useCallback(
    (ms: number) => {
      if (saveStatusClearTimerRef.current) {
        clearTimeout(saveStatusClearTimerRef.current);
      }
      saveStatusClearTimerRef.current = setTimeout(() => {
        saveStatusClearTimerRef.current = null;
        setSaveStatusMessage(null);
        setSaveStatusTone("neutral");
      }, ms);
    },
    [],
  );

  useEffect(
    () => () => {
      if (saveStatusClearTimerRef.current) {
        clearTimeout(saveStatusClearTimerRef.current);
      }
    },
    [],
  );

  const persistSession = useCallback(async () => {
    const snapshot = useWoodshedStore.getState();
    const isDemo = snapshot.projectId === DEMO_PROJECT_ID;

    const clearPendingLabel = () => setSavePendingLabel(undefined);

    if (isDemo) {
      devWarn(
        "The built-in example project is read-only. Open a saved session or upload audio, then use Save to store your own copy.",
      );
      return;
    }

    const isYoutubeProject = snapshot.mediaSource.kind === "youtube";
    const archivedAudioBlob = audioBlobRef.current;

    if (!isYoutubeProject && !archivedAudioBlob) {
      devWarn("Load audio before saving");
      return;
    }

    const configured = isSupabaseConfigured();
    let sessionUserId: string | null = null;
    let sessionReadError: string | null = null;

    if (supabase) {
      const first = await supabase.auth.getSession();
      if (first.error) {
        sessionReadError = first.error.message;
      }
      sessionUserId = first.data.session?.user?.id ?? null;
      if (!sessionUserId && user?.id) {
        await refreshUser();
        const second = await supabase.auth.getSession();
        if (second.error) {
          sessionReadError = second.error.message;
        }
        sessionUserId = second.data.session?.user?.id ?? null;
      }
    }

    const existingCloudId = isCloudProjectId(snapshot.projectId)
      ? snapshot.projectId
      : null;

    const useCloud =
      Boolean(
        configured &&
          supabase &&
          sessionUserId &&
          !isDemo &&
          !isYoutubeProject,
      );

    devLog("[Woodshed save]", {
      supabaseConfigured: configured,
      hasSupabaseClient: Boolean(supabase),
      sessionPresent: Boolean(sessionUserId),
      sessionReadError,
      sessionUserId,
      reactContextUserId: user?.id ?? null,
      isDemoProject: isDemo,
      projectId: snapshot.projectId,
      existingCloudProjectId: existingCloudId,
      savePath: useCloud ? "cloud" : "local",
    });

    if (configured && supabase && user?.id && !sessionUserId) {
      const msg =
        sessionReadError != null
          ? `Signed in, but no Supabase session could be read (${sessionReadError}). Try refreshing the page.`
          : "Signed in, but no Supabase session was found. Try refreshing the page before saving to the cloud.";
      setSaveStatusMessage(msg);
      setSaveStatusTone("error");
      scheduleSaveStatusClear(12_000);
      console.error("[Woodshed save] blocked: UI user without session", {
        reactContextUserId: user.id,
      });
      return;
    }

    if (useCloud && supabase && sessionUserId) {
      setSaveBusy(true);
      setSavePendingLabel("Saving to cloud…");
      setSaveStatusMessage("Saving to cloud…");
      setSaveStatusTone("progress");
      try {
        const cloudId = await upsertCloudProject(
          supabase,
          sessionUserId,
          existingCloudId,
          {
            name: snapshot.projectName,
            loops: snapshot.loops,
            activeLoopId: snapshot.activeLoopId,
            audioBlob: archivedAudioBlob!,
            practiceStateV1: capturePracticeStatePersistV1({
              loopPlaybackEnabled: snapshot.loopPlaybackEnabled,
              loopPracticeScope: snapshot.loopPracticeScope,
              activeSegmentId: snapshot.activeSegmentId,
              lastPracticeSegmentIdByPhrase:
                snapshot.lastPracticeSegmentIdByPhrase,
            }),
          },
        );
        devLog("[Woodshed save] cloud upsert ok", { cloudProjectId: cloudId });
        useWoodshedStore
          .getState()
          .setProjectMeta(cloudId, snapshot.projectName);
        await refreshCloudProjects();
        setSaveStatusMessage("Saved to cloud");
        setSaveStatusTone("success");
        scheduleSaveStatusClear(5000);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error("[Woodshed save] cloud upsert failed:", e);
        setSaveStatusMessage(`Cloud save failed: ${detail}`);
        setSaveStatusTone("error");
        scheduleSaveStatusClear(14_000);
      } finally {
        setSaveBusy(false);
        clearPendingLabel();
      }
      return;
    }

    setSaveBusy(true);
    setSavePendingLabel("Saving locally…");
    setSaveStatusMessage("Saving locally…");
    setSaveStatusTone("progress");
    try {
      if (isYoutubeProject) {
        if (snapshot.mediaSource.kind !== "youtube") {
          throw new Error("Expected youtube mediaSource");
        }
        const payload = captureYoutubeDexieProjectPayload({
          projectId: snapshot.projectId,
          projectName: snapshot.projectName,
          mediaSource: snapshot.mediaSource,
          loops: snapshot.loops,
          activeLoopId: snapshot.activeLoopId,
          durationSeconds: snapshot.duration,
          minPxPerSec: snapshot.minPxPerSec,
          loopPlaybackEnabled: snapshot.loopPlaybackEnabled,
          loopPracticeScope: snapshot.loopPracticeScope,
          activeSegmentId: snapshot.activeSegmentId,
          lastPracticeSegmentIdByPhrase:
            snapshot.lastPracticeSegmentIdByPhrase,
        });
        await saveDexieProject(payload);
        const ms = payload.mediaSource;
        if (!ms || ms.kind !== "youtube") {
          throw new Error("YouTube save missing mediaSource");
        }
        useWoodshedStore
          .getState()
          .setProjectMeta(payload.id, payload.name, ms);
        await listProjects().then(setProjectsList);
        setSaveStatusMessage("Saved locally");
        setSaveStatusTone("success");
        scheduleSaveStatusClear(5000);
        return;
      }

      const pid = snapshot.projectId ?? nanoid();
      const persistedMedia = persistMediaSourceForDexieRow({
        source: snapshot.mediaSource,
        resolvedBlobId: pid,
      });
      await saveBlobRecord(pid, archivedAudioBlob!, "audio");
      await saveDexieProject({
        id: pid,
        name: snapshot.projectName,
        loops: snapshot.loops,
        activeLoopId: snapshot.activeLoopId,
        blobId: pid,
        mediaSource: persistedMedia,
        practiceStateV1: capturePracticeStatePersistV1({
          loopPlaybackEnabled: snapshot.loopPlaybackEnabled,
          loopPracticeScope: snapshot.loopPracticeScope,
          activeSegmentId: snapshot.activeSegmentId,
          lastPracticeSegmentIdByPhrase:
            snapshot.lastPracticeSegmentIdByPhrase,
        }),
      });
      useWoodshedStore
        .getState()
        .setProjectMeta(pid, snapshot.projectName, persistedMedia);
      await listProjects().then(setProjectsList);
      setSaveStatusMessage("Saved locally");
      setSaveStatusTone("success");
      scheduleSaveStatusClear(5000);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[Woodshed save] local save failed:", e);
      setSaveStatusMessage(`Local save failed: ${detail}`);
      setSaveStatusTone("error");
      scheduleSaveStatusClear(14_000);
    } finally {
      setSaveBusy(false);
      clearPendingLabel();
    }
  }, [
    user?.id,
    supabase,
    refreshCloudProjects,
    refreshUser,
    scheduleSaveStatusClear,
  ]);

  const handleKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (mobilePracticeModeRef.current) {
        if (event.key === " ") {
          event.preventDefault();
          const playback = getPlaybackSurface();
          if (!playback) return;
          if (playback.isPlaying()) playback.pause();
          else void playback.play();
        }
        return;
      }

      if (isKeyboardFocusInTextField(event.target)) {
        return;
      }

      const playback = getPlaybackSurface();
      const modifier = event.shiftKey;
      const stepping = modifier ? 0.05 : 0.75;
      if (event.repeat) return;

      switch (event.key) {
        case " ": {
          event.preventDefault();
          if (!playback) return;
          if (playback.isPlaying()) playback.pause();
          else void playback.play();
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (!playback || !duration) break;
          playback.seek(
            clamp(playback.getCurrentTime() - stepping, 0, duration),
          );
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (!playback || !duration) break;
          playback.seek(
            clamp(playback.getCurrentTime() + stepping, 0, duration),
          );
          break;
        }
        case "=":
        case "+": {
          event.preventDefault();
          useWoodshedStore.getState().bumpTempo(0.05);
          break;
        }
        case "-":
        case "_": {
          event.preventDefault();
          useWoodshedStore.getState().bumpTempo(-0.05);
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
            .nudgeLoopEdge("start", -loopBracketStep(modifier, event.altKey));
          break;
        }
        case "]": {
          event.preventDefault();
          useWoodshedStore
            .getState()
            .nudgeLoopEdge("end", loopBracketStep(modifier, event.altKey));
          break;
        }
        default:
          break;
      }
    },
    [duration, getPlaybackSurface],
  );

  useEffect(() => {
    if (duration > 0) {
      setAudioTimelineLoading(false);
    }
  }, [duration]);

  const userProjectsSelectable = useMemo(() => {
    const base = projects.filter((p) => p.id !== DEMO_PROJECT_ID);
    if (YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) return base;
    return base.filter(
      (p) => normalizeMediaSourceFromStoredProject(p).kind !== "youtube",
    );
  }, [projects]);

  const sessionSelectValue = useMemo(() => {
    if (!projectId) return "";
    if (projectId === DEMO_PROJECT_ID) return DEMO_PROJECT_ID;
    if (isCloudProjectId(projectId)) {
      return cloudSessionPickerValue(projectId);
    }
    if (userProjectsSelectable.some((p) => p.id === projectId)) return projectId;
    return "";
  }, [projectId, userProjectsSelectable]);

  /** Decoded timeline not ready — transport/header use quieter idle chrome. */
  const playbackChromeIdle = duration <= 0 && !youtubeShellActive;

  const activePhraseName = useMemo(() => {
    if (playbackChromeIdle) return "—";
    return activeLoop?.name ?? "No section";
  }, [playbackChromeIdle, activeLoop?.name]);

  const enterMobileEditMode = useCallback(() => {
    if (!isMobilePractice || playbackChromeIdle || isDemoProject) return;
    setMobileEditModeActive(true);
    const playback = getPlaybackSurface();
    if (playback?.isPlaying()) playback.pause();
    useWoodshedStore.getState().setPlaying(false);
  }, [
    getPlaybackSurface,
    isDemoProject,
    isMobilePractice,
    playbackChromeIdle,
  ]);

  const exitMobileEditMode = useCallback(() => {
    setMobileEditModeActive(false);
  }, []);

  const handleTransportTogglePlay = useCallback(() => {
    const playback = getPlaybackSurface();
    if (!playback) return;
    if (playback.isPlaying()) playback.pause();
    else void playback.play();
  }, [getPlaybackSurface]);

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

  const handleTransportTempo = useCallback((pct: number) => {
    useWoodshedStore.getState().setActiveLoopTempoFromPercent(pct);
    const playback = getPlaybackSurface();
    if (!playback) return;
    applyPlaybackTempo(
      playback,
      useWoodshedStore.getState().activeLoopTemps(),
    );
  }, [getPlaybackSurface]);

  const handleNeutralTimelineSeek = useCallback(
    (sec: number) => {
      useWoodshedStore.getState().exitPhraseFitAfterUserNavigation();
      getPlaybackSurface()?.seek(sec);
      useWoodshedStore.getState().setCurrentTime(sec);
    },
    [getPlaybackSurface],
  );

  const handleNeutralTimelinePxPerSec = useCallback((next: number) => {
    useWoodshedStore.getState().exitPhraseFitAfterUserNavigation();
    useWoodshedStore.getState().setMinPxPerSec(next);
  }, []);

  const handleResetTempo100 = useCallback(() => {
    handleTransportTempo(100);
  }, [handleTransportTempo]);

  const handleRestoreProject = useCallback(
    async (id: string) => {
      if (id === DEMO_PROJECT_ID) {
        const ok = await loadBuiltInDemoProject();
        if (ok) await listProjects().then(setProjectsList);
        return;
      }
      const cloudId = parseCloudSessionPickerValue(id);
      if (cloudId && supabase) {
        try {
          const loaded = await loadCloudProject(supabase, cloudId);
          await hydrateProject(
            {
              id: loaded.id,
              name: loaded.name,
              loops: loaded.loops,
              activeLoopId: loaded.activeLoopId,
              updatedAt: loaded.updatedAt,
              practiceStateV1: loaded.practiceStateV1 ?? undefined,
            },
            { audioBlob: loaded.audioBlob },
          );
          await refreshCloudProjects();
        } catch (e) {
          const msg =
            e instanceof Error
              ? e.message
              : "Could not open this cloud project.";
          console.error("[Woodshed cloud] loadCloudProject failed:", e);
          setSaveStatusMessage(`Cloud open failed: ${msg}`);
          setSaveStatusTone("error");
          scheduleSaveStatusClear(12_000);
        }
        return;
      }
      const project = await loadDexieProject(id);
      if (!project) return;
      if (normalizeMediaSourceFromStoredProject(project).kind === "youtube") {
        if (!YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) {
          setSaveStatusMessage(
            "This session uses YouTube. Enable NEXT_PUBLIC_WOODSHED_YOUTUBE_WORKSPACE in your environment to open it.",
          );
          setSaveStatusTone("error");
          scheduleSaveStatusClear(12_000);
          return;
        }
        const v = validateYoutubeDexieProjectMeta(project);
        if (!v.ok) {
          setSaveStatusMessage(`Could not open YouTube project: ${v.reason}`);
          setSaveStatusTone("error");
          scheduleSaveStatusClear(12_000);
          return;
        }
        setMobileEditModeActive(false);
        deferredUploadHydrationRef.current = undefined;
        deferredDemoLoadRef.current = false;
        if (pendingWaveSurferObjectUrlRef.current) {
          URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
          pendingWaveSurferObjectUrlRef.current = null;
        }
        pendingDemoHydrationRef.current = null;
        pendingHydration.current = null;
        hydrateYoutubeDexieIntoStore(v.meta);
        await listProjects().then(setProjectsList);
        return;
      }
      await hydrateProject(project);
    },
    [
      hydrateProject,
      loadBuiltInDemoProject,
      refreshCloudProjects,
      scheduleSaveStatusClear,
      supabase,
    ],
  );

  const showCloudSessions = Boolean(
    isSupabaseConfigured() && supabase && cloudSessionUserId,
  );
  const savedProjectsBrowseBusy =
    !dexieProjectsListed || (showCloudSessions && !cloudPickerListed);
  const showEmptyWorkspace =
    duration <= 0 && !audioTimelineLoading && !youtubeShellActive;

  const showDemoOrientationRibbon =
    isDemoProject && duration > 0 && !demoOrientationSeen;

  const desktopShiftFocusGuidanceVisible = useMemo(
    () =>
      !isMobilePractice &&
      !showEmptyWorkspace &&
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: desktopFocusAuthoringComplete,
        durationSec: duration,
        loops,
      }),
    [
      isMobilePractice,
      showEmptyWorkspace,
      desktopFocusAuthoringComplete,
      duration,
      loops,
    ],
  );

  const requestOpenSavedProjectPicker = useCallback(() => {
    setProjectPickerOpenSignal((n) => n + 1);
  }, []);

  const openDemoFromEmptyWorkspace = useCallback(() => {
    void handleRestoreProject(DEMO_PROJECT_ID);
  }, [handleRestoreProject]);

  const openImportChoiceModal = useCallback(() => {
    setYoutubeLinkDraft("");
    setImportChoiceOpen(true);
  }, []);

  const triggerAudioUploadImport = useCallback(() => {
    setImportChoiceOpen(false);
    setYoutubeLinkDraft("");
    window.requestAnimationFrame(() => fileInputRef.current?.click());
  }, []);

  const confirmNewYoutubeFromPaste = useCallback(() => {
    const ms = parseYoutubePasteForMediaSource(youtubeLinkDraft);
    if (!ms) {
      setSaveStatusMessage(
        "Paste a valid YouTube link (watch URL, Shorts, or youtu.be).",
      );
      setSaveStatusTone("error");
      scheduleSaveStatusClear(9000);
      return;
    }
    setImportChoiceOpen(false);
    setYoutubeLinkDraft("");
    setMobileEditModeActive(false);
    deferredUploadHydrationRef.current = undefined;
    deferredDemoLoadRef.current = false;
    if (pendingWaveSurferObjectUrlRef.current) {
      URL.revokeObjectURL(pendingWaveSurferObjectUrlRef.current);
      pendingWaveSurferObjectUrlRef.current = null;
    }
    pendingDemoHydrationRef.current = null;
    pendingHydration.current = null;
    audioBlobRef.current = null;
    loopsSignature.current = "";
    useWoodshedStore.getState().resetWorkspace();
    const pid = nanoid();
    useWoodshedStore
      .getState()
      .setProjectMeta(pid, `YouTube (${ms.videoId})`, ms);
    void listProjects().then(setProjectsList);
  }, [youtubeLinkDraft, scheduleSaveStatusClear]);

  const handleEmptyWorkspaceCreateProject = useCallback(() => {
    if (YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED) openImportChoiceModal();
    else fileInputRef.current?.click();
  }, [openImportChoiceModal]);

  return (
    <section
      ref={sectionRef}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-950 text-stone-50 outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyboard}
      aria-label="Woodshed workspace"
    >
      {showDemoOrientationRibbon ? (
        <DemoProjectOrientationRibbon onDismiss={dismissDemoOrientation} />
      ) : null}
      {!isMobilePractice ? (
        <DesktopHeaderBar
          projectName={projectName}
          isDemoProject={isDemoProject}
          sessionSelectValue={sessionSelectValue}
          demoProjectId={DEMO_PROJECT_ID}
          demoProjectLabel={demoPickerTitle}
          userProjects={userProjectsSelectable}
          cloudProjects={cloudProjects}
          showCloudSessions={showCloudSessions}
          onRestoreProject={handleRestoreProject}
          projectPickerOpenSignal={projectPickerOpenSignal}
          timelineIdle={playbackChromeIdle}
          onOpenAudioFile={
            YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
              ? openImportChoiceModal
              : () => fileInputRef.current?.click()
          }
          showYoutubeImport={YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED}
          onPasteYoutubeLink={
            YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
              ? openImportChoiceModal
              : undefined
          }
          activePhraseName={activePhraseName}
          loops={loops}
          activeLoopId={activeLoopId}
          onSelectPhrase={handleMobilePhraseSelect}
          onCreateNewPhrase={() => {
            useWoodshedStore.getState().addLoopCandidate();
          }}
          saveDisabled={isDemoProject}
          saveLabel={
            isSupabaseConfigured() && supabase && cloudSessionUserId
              ? "Save to cloud"
              : "Save"
          }
          saveBusy={saveBusy}
          savePendingLabel={savePendingLabel}
          saveStatusMessage={saveStatusMessage}
          saveStatusTone={saveStatusTone}
          cloudListError={cloudListError}
          devExportLoopsJson={
            process.env.NODE_ENV === "development"
              ? handleDevExportLoopsJson
              : undefined
          }
          hiddenFileProps={{
            ref: fileInputRef,
            type: "file",
            accept: MOBILE_AUDIO_INPUT_ACCEPT,
            hidden: true,
            onChange: handleMobileFileInputChange,
            "aria-hidden": true,
          }}
          onSaveProject={() => void persistSession()}
        />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            isMobilePractice &&
              !youtubeShellActive &&
              "grid h-full w-full min-h-0 grid-rows-[1fr_auto]",
            isMobilePractice &&
              youtubeShellActive &&
              "flex min-h-0 min-w-0 flex-col overflow-hidden",
            !isMobilePractice && "flex flex-col",
          )}
        >
          {isMobilePractice ? (
            youtubeShellActive ? (
              <YoutubeWorkspace
                ref={youtubeWorkspaceRef}
                key={projectId ?? "youtube-session"}
                variant="embedded"
                mobileStackedLayout
                className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              >
                <MobilePracticeControls
                  fileInputRef={fileInputRef}
                  fileAccept={MOBILE_AUDIO_INPUT_ACCEPT}
                  onFileInputChange={handleMobileFileInputChange}
                  projectName={projectName}
                  isDemoProject={isDemoProject}
                  sessionSelectValue={sessionSelectValue}
                  demoProjectId={DEMO_PROJECT_ID}
                  demoProjectLabel={demoPickerTitle}
                  userProjects={userProjectsSelectable}
                  cloudProjects={cloudProjects}
                  showCloudSessions={showCloudSessions}
                  onRestoreProject={handleRestoreProject}
                  saveStatusMessage={saveStatusMessage}
                  saveStatusTone={saveStatusTone}
                  cloudListError={cloudListError}
                  activePhraseName={activePhraseName}
                  isPlaying={isPlaying}
                  duration={duration}
                  currentTime={currentTime}
                  tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
                  loopPlaybackEnabled={loopPlaybackEnabled}
                  canEnableLoopPlayback={Boolean(
                    activeLoop && activeLoop.end > activeLoop.start,
                  )}
                  loopPracticeScope={loopPracticeScope}
                  phraseHasFocusRegions={phraseHasFocusRegions}
                  onCycleLoopPlaybackMode={() =>
                    useWoodshedStore.getState().cycleLoopPlaybackMode()
                  }
                  onTogglePlay={handleTransportTogglePlay}
                  onTempoSlider={handleTransportTempo}
                  onResetTempoTo100={handleResetTempo100}
                  loops={loops}
                  activeLoopId={activeLoopId}
                  onSelectPhrase={handleMobilePhraseSelect}
                  focusSegments={activeLoop?.segments ?? []}
                  onRestartPractice={handleMobileRestartPractice}
                  onSelectFocusSegment={handleMobileFocusSegmentSelect}
                  canRestartPractice={Boolean(
                    activeLoop && activeLoop.end > activeLoop.start,
                  )}
                  focusChipSelectedSegmentId={mobileFocusChipSelectedId}
                  projectPickerOpenSignal={projectPickerOpenSignal}
                  timelineIdle={playbackChromeIdle}
                  mobileEditModeActive={mobileEditModeActive}
                  onEnterMobileEditMode={enterMobileEditMode}
                  onExitMobileEditMode={exitMobileEditMode}
                  showYoutubeImport={YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED}
                  onPasteYoutubeLink={
                    YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
                      ? openImportChoiceModal
                      : undefined
                  }
                  onOpenAudioFromProjectPicker={
                    YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
                      ? openImportChoiceModal
                      : undefined
                  }
                />
              </YoutubeWorkspace>
            ) : (
              <>
                <div
                  className={cn(
                    "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a]",
                    "touch-manipulation border-b px-3 py-2 transition-[box-shadow,background-color] duration-150",
                    mobileEditModeActive
                      ? "border-violet-500/25 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)] bg-gradient-to-br from-[#0c0820] via-[#0b0806] to-[#10080a]"
                      : "border-stone-800/80",
                  )}
                  data-mobile-practice="true"
                  data-mobile-edit-mode={mobileEditModeActive ? "true" : "false"}
                >
                  <div
                    ref={containerRef}
                    data-testid="primary-waveform"
                    className="relative z-0 h-full w-full min-h-0"
                  />
                  {showEmptyWorkspace ? (
                    <WorkspaceEmptyState
                      onCreateNewProject={handleEmptyWorkspaceCreateProject}
                      onOpenDemoProject={openDemoFromEmptyWorkspace}
                      onOpenSavedProject={requestOpenSavedProjectPicker}
                      savedProjectsBrowseBusy={savedProjectsBrowseBusy}
                    />
                  ) : null}
                </div>
                <MobilePracticeControls
                  fileInputRef={fileInputRef}
                  fileAccept={MOBILE_AUDIO_INPUT_ACCEPT}
                  onFileInputChange={handleMobileFileInputChange}
                  projectName={projectName}
                  isDemoProject={isDemoProject}
                  sessionSelectValue={sessionSelectValue}
                  demoProjectId={DEMO_PROJECT_ID}
                  demoProjectLabel={demoPickerTitle}
                  userProjects={userProjectsSelectable}
                  cloudProjects={cloudProjects}
                  showCloudSessions={showCloudSessions}
                  onRestoreProject={handleRestoreProject}
                  saveStatusMessage={saveStatusMessage}
                  saveStatusTone={saveStatusTone}
                  cloudListError={cloudListError}
                  activePhraseName={activePhraseName}
                  isPlaying={isPlaying}
                  duration={duration}
                  currentTime={currentTime}
                  tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
                  loopPlaybackEnabled={loopPlaybackEnabled}
                  canEnableLoopPlayback={Boolean(
                    activeLoop && activeLoop.end > activeLoop.start,
                  )}
                  loopPracticeScope={loopPracticeScope}
                  phraseHasFocusRegions={phraseHasFocusRegions}
                  onCycleLoopPlaybackMode={() =>
                    useWoodshedStore.getState().cycleLoopPlaybackMode()
                  }
                  onTogglePlay={handleTransportTogglePlay}
                  onTempoSlider={handleTransportTempo}
                  onResetTempoTo100={handleResetTempo100}
                  loops={loops}
                  activeLoopId={activeLoopId}
                  onSelectPhrase={handleMobilePhraseSelect}
                  focusSegments={activeLoop?.segments ?? []}
                  onRestartPractice={handleMobileRestartPractice}
                  onSelectFocusSegment={handleMobileFocusSegmentSelect}
                  canRestartPractice={Boolean(
                    activeLoop && activeLoop.end > activeLoop.start,
                  )}
                  focusChipSelectedSegmentId={mobileFocusChipSelectedId}
                  projectPickerOpenSignal={projectPickerOpenSignal}
                  timelineIdle={playbackChromeIdle}
                  mobileEditModeActive={mobileEditModeActive}
                  onEnterMobileEditMode={enterMobileEditMode}
                  onExitMobileEditMode={exitMobileEditMode}
                  showYoutubeImport={YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED}
                  onPasteYoutubeLink={
                    YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
                      ? openImportChoiceModal
                      : undefined
                  }
                  onOpenAudioFromProjectPicker={
                    YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED
                      ? openImportChoiceModal
                      : undefined
                  }
                />
              </>
            )
          ) : null}
          {!isMobilePractice && youtubeShellActive ? (
            <YoutubeWorkspace
              ref={youtubeWorkspaceRef}
              key={projectId ?? "youtube-session"}
              variant="embedded"
              className="min-h-0 min-w-0 flex-1"
            />
          ) : !isMobilePractice ? (
            <>
              {!showEmptyWorkspace ? (
                <MiniMap
                  placement="top"
                  peaks={decodedPeaks}
                  duration={duration}
                  loops={loops}
                  activeLoopId={activeLoopId}
                  viewport={viewport}
                  currentTime={currentTime}
                  onNavigate={(seconds) => {
                    const st = useWoodshedStore.getState();
                    st.exitPhraseFitAfterUserNavigation();
                    getPlaybackSurface()?.seek(seconds);
                  }}
                  onViewportPanToRatio={(ratio) => {
                    const st = useWoodshedStore.getState();
                    st.exitPhraseFitAfterUserNavigation();
                    setWaveNormalizedScroll(wavesurferRef.current, ratio);
                  }}
                  onFitAll={handleResetZoomFullSong}
                />
              ) : null}
              {NEUTRAL_TIMELINE_PROTOTYPE_ENABLED && !showEmptyWorkspace ? (
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
              ) : null}
              <div
                ref={desktopSplitRef}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
              >
                <div
                  ref={desktopWaveformColumnRef}
                  className={cn(
                    "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a]",
                    "border-0 px-3 py-2 sm:px-4 sm:py-2.5",
                  )}
                >
                  <div
                    ref={containerRef}
                    data-testid="primary-waveform"
                    className="relative z-0 min-h-0 flex-1 w-full"
                  />
                  {showEmptyWorkspace ? (
                    <WorkspaceEmptyState
                      onCreateNewProject={handleEmptyWorkspaceCreateProject}
                      onOpenDemoProject={openDemoFromEmptyWorkspace}
                      onOpenSavedProject={requestOpenSavedProjectPicker}
                      savedProjectsBrowseBusy={savedProjectsBrowseBusy}
                    />
                  ) : null}
                  {desktopShiftFocusGuidanceVisible ? (
                    <DesktopShiftFocusGuidanceStripe />
                  ) : null}
                  {!showEmptyWorkspace && desktopPostFocusCreationHint ? (
                    <DesktopPostFocusLoopHintStripe />
                  ) : null}
                </div>
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-label="Resize waveform and bottom panel"
                  tabIndex={0}
                  className="group relative z-20 flex h-2 shrink-0 cursor-ns-resize items-center justify-center border-y border-stone-800/40 bg-[#0a0806] outline-none hover:bg-stone-900/90 focus-visible:ring-2 focus-visible:ring-violet-500/40"
                  onPointerDown={onDesktopBottomResizePointerDown}
                  onPointerMove={onDesktopBottomResizePointerMove}
                  onPointerUp={onDesktopBottomResizePointerUp}
                  onPointerCancel={onDesktopBottomResizePointerUp}
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const root = desktopSplitRef.current;
                    if (!root) return;
                    const h = root.clientHeight;
                    const maxBottom = Math.min(
                      Math.floor(h * DESKTOP_BOTTOM_STACK_MAX_FRAC),
                      h - DESKTOP_WAVEFORM_MIN,
                    );
                    /** Arrow up → taller bottom stack (matches drag-up). */
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
                  className="flex w-full shrink-0 flex-col overflow-hidden border-t border-stone-800/50 bg-[#050403]"
                  style={{ maxHeight: desktopBottomStackPx }}
                >
                  <DesktopTransportBar
                    duration={duration}
                    currentTime={currentTime}
                    isPlaying={isPlaying}
                    timelineIdle={playbackChromeIdle}
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
                    onRestartLoop={() => {
                      const playback = getPlaybackSurface();
                      if (!playback || !activeLoopId) return;
                      const st = useWoodshedStore.getState();
                      const loop = loops.find((l) => l.id === activeLoopId);
                      if (!loop) return;
                      playback.seek(
                        getRestartSeekSeconds({
                          loop,
                          loopPracticeScope: st.loopPracticeScope,
                          activeSegmentId: st.activeSegmentId,
                          lastPracticeSegmentIdByPhrase:
                            st.lastPracticeSegmentIdByPhrase,
                        }),
                      );
                      void playback.play();
                    }}
                    onCycleLoopPlaybackMode={() =>
                      useWoodshedStore.getState().cycleLoopPlaybackMode()
                    }
                    onTempoSlider={handleTransportTempo}
                    formatTime={(t) => formatTime(t)}
                  />
                  <DesktopInspectorPanel />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {importChoiceOpen && YOUTUBE_WORKSPACE_PROTOTYPE_ENABLED ? (
        <div
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/55 px-4 py-8 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="woodshed-import-choice-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-700/55 bg-stone-950 p-5 shadow-2xl">
            <h2
              id="woodshed-import-choice-title"
              className="text-base font-semibold tracking-tight text-stone-50"
            >
              New session
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Upload audio from your device or paste a YouTube link. No audio is
              downloaded for YouTube projects.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                className="w-full bg-violet-600 hover:bg-violet-500"
                onClick={triggerAudioUploadImport}
              >
                Upload audio file
              </Button>
              <label
                htmlFor="woodshed-youtube-paste"
                className="mt-2 block text-[11px] font-medium uppercase tracking-[0.14em] text-stone-500"
              >
                YouTube link
              </label>
              <textarea
                id="woodshed-youtube-paste"
                value={youtubeLinkDraft}
                onChange={(e) => setYoutubeLinkDraft(e.target.value)}
                rows={3}
                spellCheck={false}
                placeholder="https://www.youtube.com/watch?v=…"
                className="w-full resize-none rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-stone-100 outline-none ring-violet-500/35 focus-visible:ring-2"
              />
              <Button
                type="button"
                variant="outline"
                className="w-full border-stone-600 bg-stone-900/40 text-stone-100 hover:bg-stone-800/70"
                onClick={() => void confirmNewYoutubeFromPaste()}
              >
                Create YouTube project
              </Button>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                className="text-stone-400 hover:bg-stone-900/60 hover:text-stone-200"
                onClick={() => {
                  setImportChoiceOpen(false);
                  setYoutubeLinkDraft("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
});

export { WoodshedWorkspace };
export default WoodshedWorkspace;

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

/** Shift = ultra-fine · Alt = medium · default = coarse (PRD nudge ladders). */
function loopBracketStep(shift: boolean, alt: boolean) {
  if (shift) return 0.012;
  if (alt) return 0.035;
  return 0.08;
}

/**
 * Px the pointer must travel before a hold-and-drag converts to a pan.
 * Small enough to feel instant, large enough that single-click seeks survive.
 */
const PAN_THRESHOLD_PX = 4;

/**
 * Install the click-drag pan gesture on the waveform scroll container.
 *
 * Returns a cleanup function that detaches all listeners.
 *
 * Implementation notes:
 *   - We don't `preventDefault` on pointerdown so WaveSurfer's click-to-seek
 *     still works for real (non-dragging) clicks.
 *   - Once we cross the slop threshold, we capture the pointer and intercept
 *     the subsequent `click` event in the capture phase. Without that,
 *     WaveSurfer's interaction layer would seek to wherever the pointer
 *     released, which would feel terrible after a pan.
 *   - Editable regions are skipped — the regions plugin owns those gestures.
 *     Locked / selected regions fall through, so dragging across them pans.
 */
function installWaveformPanGesture(
  container: HTMLElement,
  isMobilePractice?: () => boolean,
): () => void {
  container.style.cursor = "grab";

  let startX = 0;
  let startScrollLeft = 0;
  let activePointerId: number | null = null;
  let armed = false;
  let panning = false;
  let suppressNextClick = false;

  const reset = () => {
    armed = false;
    panning = false;
    activePointerId = null;
    container.style.cursor = "grab";
    container.classList.remove("is-panning");
  };

  const onPointerDown = (event: PointerEvent) => {
    if (isMobilePractice?.()) return;
    if (event.button !== 0) return;
    /** Shift+drag authoring owns the gesture — do not arm waveform pan. */
    if (event.shiftKey) return;
    const target = event.target as Element | null;
    /** Editable region drag/resize is owned by the WaveSurfer regions plugin. */
    if (target?.closest(".woodshed-region-editing")) return;
    /** Focus region markers use region clicks — do not arm waveform pan from them. */
    if (target?.closest(".woodshed-region-segment")) return;

    startX = event.clientX;
    startScrollLeft = container.scrollLeft;
    activePointerId = event.pointerId;
    armed = true;
    panning = false;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (isMobilePractice?.()) return;
    if (!armed || event.pointerId !== activePointerId) return;
    const dx = event.clientX - startX;
    if (!panning) {
      if (Math.abs(dx) < PAN_THRESHOLD_PX) return;
      panning = true;
      try {
        container.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      container.style.cursor = "grabbing";
      container.classList.add("is-panning");
    }
    container.scrollLeft = startScrollLeft - dx;
    event.preventDefault();
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    if (panning) {
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
        /* release is best-effort */
      }
      /** Stop WaveSurfer's click-to-seek that would otherwise fire on release. */
      suppressNextClick = true;
    }
    reset();
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("pointermove", onPointerMove, { passive: false });
  container.addEventListener("pointerup", onPointerEnd);
  container.addEventListener("pointercancel", onPointerEnd);
  container.addEventListener("click", onClickCapture, true);

  return () => {
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerup", onPointerEnd);
    container.removeEventListener("pointercancel", onPointerEnd);
    container.removeEventListener("click", onClickCapture, true);
    container.style.cursor = "";
    container.classList.remove("is-panning");
  };
}

const WS_DIAG_KEY = "__woodshedWsDiagIds";
const WS_DIAG_NEXT_KEY = "__woodshedWsDiagNextId";

function registerWaveSurferDiagInstance(): number {
  const bag = globalThis as unknown as Record<string, unknown>;
  const nextRaw = bag[WS_DIAG_NEXT_KEY];
  const next = typeof nextRaw === "number" ? nextRaw + 1 : 1;
  bag[WS_DIAG_NEXT_KEY] = next;
  const setRaw = bag[WS_DIAG_KEY];
  const set =
    setRaw instanceof Set ? (setRaw as Set<number>) : new Set<number>();
  set.add(next);
  bag[WS_DIAG_KEY] = set;
  return next;
}

function unregisterWaveSurferDiagInstance(): void {
  const bag = globalThis as unknown as Record<string, unknown>;
  const setRaw = bag[WS_DIAG_KEY];
  if (!(setRaw instanceof Set)) return;
  const set = setRaw as Set<number>;
  const arr = Array.from(set);
  if (arr.length === 0) return;
  set.delete(arr[arr.length - 1]);
}

function listWaveSurferDiagInstances(): number[] {
  const bag = globalThis as unknown as Record<string, unknown>;
  const setRaw = bag[WS_DIAG_KEY];
  return setRaw instanceof Set ? Array.from(setRaw as Set<number>) : [];
}

function nodeChain(node: Node | null): string[] {
  const out: string[] = [];
  let cur: Node | null = node;
  for (let i = 0; i < 10 && cur; i++) {
    if (cur instanceof HTMLElement) {
      out.push(
        `${cur.tagName.toLowerCase()}#${cur.id || "-"}.${
          cur.className || "-"
        }[part=${cur.getAttribute("part") || "-"}][connected=${cur.isConnected}]`,
      );
      cur = cur.parentNode;
      continue;
    }
    out.push(cur.nodeName);
    break;
  }
  return out;
}

function collectWaveformPartCounts(doc: Document): {
  waveformHosts: number;
  wrapperPartsInShadows: number;
  regionsPartsInShadows: number;
} {
  const hosts = Array.from(
    doc.querySelectorAll('[data-testid="primary-waveform"]'),
  );
  let wrappers = 0;
  let regions = 0;
  for (const host of hosts) {
    const root = host.shadowRoot;
    if (!root) continue;
    wrappers += root.querySelectorAll('[part="wrapper"]').length;
    regions += root.querySelectorAll('[part="regions-container"]').length;
  }
  return {
    waveformHosts: hosts.length,
    wrapperPartsInShadows: wrappers,
    regionsPartsInShadows: regions,
  };
}

function logWaveformLifecycle(
  label: string,
  args: {
    ws: WaveSurfer | null;
    host: HTMLElement | null;
    regions: RegionsHandle | null;
    wsDiagId: number | null;
  },
): void {
  if (process.env.NODE_ENV !== "development") return;
  const host = args.host;
  const ws = args.ws;
  const regionsUnknown = args.regions as unknown as {
    regionsContainer?: HTMLElement | null;
  } | null;
  const renderer = ws
    ? (ws.getRenderer() as unknown as {
        getWrapper?: () => HTMLElement;
        scrollContainer?: HTMLElement | null;
      })
    : null;
  const wrapper = renderer?.getWrapper?.() ?? null;
  const scrollContainer = renderer?.scrollContainer ?? null;
  const regionsContainer = regionsUnknown?.regionsContainer ?? null;
  const doc =
    host?.ownerDocument ??
    wrapper?.ownerDocument ??
    regionsContainer?.ownerDocument ??
    document;
  const counts = collectWaveformPartCounts(doc);

  console.log("[Woodshed ws lifecycle]", {
    label,
    wsDiagId: args.wsDiagId,
    activeWsDiagIds: listWaveSurferDiagInstances(),
    hostConnected: host?.isConnected ?? false,
    hostInBody: Boolean(host && doc.body.contains(host)),
    hostChain: nodeChain(host),
    hostHasShadowRoot: Boolean(host?.shadowRoot),
    wrapperConnected: wrapper?.isConnected ?? false,
    wrapperInBody: Boolean(wrapper && doc.body.contains(wrapper)),
    wrapperChain: nodeChain(wrapper),
    scrollContainerConnected: scrollContainer?.isConnected ?? false,
    scrollContainerInBody: Boolean(scrollContainer && doc.body.contains(scrollContainer)),
    scrollContainerChain: nodeChain(scrollContainer),
    regionsContainerConnected: regionsContainer?.isConnected ?? false,
    regionsContainerInBody: Boolean(regionsContainer && doc.body.contains(regionsContainer)),
    regionsContainerChain: nodeChain(regionsContainer),
    wrapperContainsRegions: Boolean(
      wrapper && regionsContainer && wrapper.contains(regionsContainer),
    ),
    counts,
  });
}
