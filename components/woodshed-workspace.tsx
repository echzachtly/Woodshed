"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import WaveSurfer from "wavesurfer.js";

import { DesktopHeaderBar } from "@/components/desktop-header-bar";
import { DesktopInspectorPanel } from "@/components/desktop-inspector-panel";
import { DesktopTransportBar } from "@/components/desktop-transport-bar";
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
import { formatFilenameAsProjectName } from "@/lib/format-upload-project-name";
import {
  buildPlaybackLoopRail,
  getRestartSeekSeconds,
} from "@/lib/playback-loop-rail";
import { isKeyboardFocusInTextField } from "@/lib/woodshed-keyboard";
import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";
import { nanoid } from "@/lib/id";
import { cn } from "@/lib/utils";
import { peekWaveSurferDom, setWaveNormalizedScroll } from "@/lib/waveform-scroll";
import {
  PLAYHEAD_UI_TIME_MS,
  readPlaybackSeconds,
} from "@/lib/playhead-sync";
import { useShallow } from "zustand/react/shallow";

import { useWoodshedStore } from "@/store/woodshed-store";

/** iOS Safari: combine MIME tokens with extensions so common files stay selectable. */
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
  return mod.default;
}

function makeSurface(ws: WaveSurfer): MediaPlaybackSurface {
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const pendingHydration = useRef<StoredProjectMeta | null>(null);
  const pendingDemoHydrationRef = useRef<PendingDemoHydration | null>(null);
  const demoInitialLoadDoneRef = useRef(false);
  const loopsSignature = useRef<string>("");
  const wheelBound = useRef(false);
  /** Ignore scroll events briefly after programmatic phrase-fit (avoids fighting `phrase-focus`). */
  const suppressViewportScrollUntilRef = useRef(0);
  /** Stops tight loop RAF from the effect cleanup (see mount IIFE). */
  const cancelPlaybackLoopRef = useRef<(() => void) | null>(null);
  /** Releases the click-drag pan gesture listeners from the effect cleanup. */
  const releasePanRef = useRef<(() => void) | null>(null);
  /** WaveSurfer mount effect reads this ref — keep in sync with `isMobilePractice`. */
  const mobilePracticeModeRef = useRef(false);

  /** Releases two-finger pinch zoom on mobile waveform. */
  const pinchZoomReleaseRef = useRef<(() => void) | null>(null);

  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsHandle | null>(null);

  const [projects, setProjectsList] = useState<StoredProjectMeta[]>([]);
  const [demoPickerTitle, setDemoPickerTitle] = useState(
    DEMO_PROJECT_DISPLAY_FALLBACK,
  );
  const [decodedPeaks, setDecodedPeaks] = useState<Float32Array | null>(null);
  const [viewport, setViewport] = useState<VisibleWindow>({
    startRatio: 0,
    durationRatio: 1,
  });

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
    })),
  );
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
    if (!ws) return false;
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
    const duration = ws.getDuration();
    const totalScrollWidth =
      duration * nextPxPerSec + 2 * WAVEFORM_HORIZONTAL_GUTTER_PX;
    const maxScroll = Math.max(0, totalScrollWidth - clientWidth);
    const clampedScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
    ws.setScroll(clampedScroll);
    return true;
  }, []);

  const handleResetZoomFullSong = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const st = useWoodshedStore.getState();
    /** Full song is an explicit zoom reset — always leave phrase-focus for follow (matches prior behavior). */
    if (st.viewportMode === "phrase-focus") {
      st.setViewportMode("follow");
    }
    const d = ws.getDuration();
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
    listProjects().then(setProjectsList).catch(() => undefined);
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
    void refreshCloudProjects();
  }, [refreshCloudProjects, cloudSessionUserId]);

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
    const ws = wavesurferRef.current;
    useWoodshedStore.getState().setActiveSegmentId(null);
    useWoodshedStore.getState().setLoopPlaybackEnabled(true);
    useWoodshedStore.getState().selectLoop(id);
    const loop = useWoodshedStore.getState().loops.find((l) => l.id === id);
    if (ws && loop && loop.end > loop.start) {
      ws.setTime(loop.start);
    }
  }, []);

  const loadBuiltInDemoProjectRef = useRef<() => Promise<boolean>>(
    async () => false,
  );

  const loadBuiltInDemoProject = useCallback(async (): Promise<boolean> => {
    const ws = wavesurferRef.current;
    if (!ws) return false;
    pendingHydration.current = null;
    pendingDemoHydrationRef.current = null;
    try {
      const res = await fetch(DEMO_PROJECT_JSON_PATH, { cache: "no-store" });
      if (!res.ok) return false;
      const raw: unknown = await res.json();
      const parsed = parseDemoProjectFile(raw);
      if (!parsed) return false;
      const audioBlob = await resolveDemoAudioBlob(parsed.audioUrl);
      useWoodshedStore.getState().resetWorkspace();
      pendingDemoHydrationRef.current = parsed;
      audioBlobRef.current = audioBlob;
      loopsSignature.current = "";
      await primeWaveformCaches(audioBlob);
      if (pendingHydration.current) {
        pendingDemoHydrationRef.current = null;
        return false;
      }
      await ws.load(URL.createObjectURL(audioBlob));
      return true;
    } catch {
      devWarn("Built-in demo could not be loaded");
      return false;
    }
  }, [primeWaveformCaches]);

  loadBuiltInDemoProjectRef.current = loadBuiltInDemoProject;

  useEffect(() => {
    let destroyed = false;
    const regionFactoryPromise = loadRegionsFactory();
    const starterZoom =
      typeof window === "undefined"
        ? 50
        : useWoodshedStore.getState().minPxPerSec;
    const storeForWsInit = useWoodshedStore.getState();
    const initialAutoScroll = !storeForWsInit.loopPlaybackEnabled;

    void (async () => {
      const host = containerRef.current;
      if (!host) return;
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

      try {
        ws.registerPlugin(regions as never);
      } catch {
        devError("Regions plugin unavailable");
      }
      regionsRef.current = regions;
      wavesurferRef.current = ws;

      const applyWaveformGutterMargins = () => {
        const dom = peekWaveSurferDom(ws);
        if (!dom?.wrapper) return;
        dom.wrapper.style.marginLeft = `${WAVEFORM_HORIZONTAL_GUTTER_PX}px`;
        dom.wrapper.style.marginRight = `${WAVEFORM_HORIZONTAL_GUTTER_PX}px`;
      };
      applyWaveformGutterMargins();

      /**
       * Click-drag pan on the main waveform.
       *
       * Why this exists:
       *   The mini-map was carrying too much weight for everyday navigation.
       *   Direct click-drag inside the waveform is the most tactile way to move
       *   around while practicing.
       *
       * Gesture priority:
       *   1. Editable region → regions plugin handles drag/resize (we bail out).
       *   2. Locked/selected region or empty waveform → pan when the pointer
       *      moves past the slop threshold; click without drag still seeks.
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
        if (destroyed || !ws.isPlaying()) {
          tightLoopRaf = 0;
          return;
        }
        const snapshot = useWoodshedStore.getState();
        const rail = buildPlaybackLoopRail(snapshot);
        const t = readPlaybackSeconds(ws);
        if (rail.enabled && rail.end > rail.start) {
          if (t >= rail.end) {
            ws.setTime(rail.start);
          } else if (t + 1e-4 < rail.start) {
            ws.setTime(rail.start);
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
        const dur = ws.getDuration();
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
            : readPlaybackSeconds(ws);
        const now = performance.now();
        if (
          !ws.isPlaying() ||
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
          state.setProjectMeta(pending.id, pending.name);
          state.upsertLoops(pending.loops);
          if (
            pending.activeLoopId &&
            pending.loops.some((l) => l.id === pending.activeLoopId)
          ) {
            state.selectLoop(pending.activeLoopId);
          }
          pendingHydration.current = null;
        } else if (demo) {
          const loops = demoRowsToPracticeLoops(demo.loopRows, dur);
          state.setProjectMeta(demo.projectId, demo.title);
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
      });

      const tryLoadBuiltInDemo = async () => {
        if (demoInitialLoadDoneRef.current) return;
        if (destroyed) return;
        const wsLocal = wavesurferRef.current;
        if (!wsLocal) return;
        if (audioBlobRef.current) return;
        if (pendingHydration.current) return;

        demoInitialLoadDoneRef.current = true;

        const ok = await loadBuiltInDemoProjectRef.current();
        if (!ok) {
          demoInitialLoadDoneRef.current = false;
        }
      };

      void tryLoadBuiltInDemo();

      updateViewport();
    })();

    return () => {
      destroyed = true;
      cancelPlaybackLoopRef.current?.();
      cancelPlaybackLoopRef.current = null;
      loopsSignature.current = "";
      wheelBound.current = false;
      regionsRef.current = null;
      /** Release the pan handler before destroying WaveSurfer (DOM listeners attach to the scrollContainer). */
      releasePanRef.current?.();
      releasePanRef.current = null;
      pinchZoomReleaseRef.current?.();
      pinchZoomReleaseRef.current = null;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.zoom(minPxPerSec);
  }, [minPxPerSec]);

  /** Mobile: allow drag along the wave to seek; desktop keeps click-only seek without drag-to-seek. */
  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.setOptions({ dragToSeek: isMobilePractice });
  }, [isMobilePractice]);

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
    const surface = makeSurface(ws);
    applyPlaybackTempo(surface, activeLoop?.tempo ?? 1);
  }, [activeLoop?.tempo, activeLoop?.id]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    const regions = regionsRef.current;
    if (!ws || !regions) return;

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
     * we don't waste a region rebuild. Editable-state is included so flipping
     * in/out of Edit mode rebuilds with the right drag/resize flags.
     */
    const segSig =
      !isMobilePractice && renderedLoop?.segments?.length
        ? renderedLoop.segments
            .map((s) => `${s.id}:${s.startTime.toFixed(3)}:${s.endTime.toFixed(3)}`)
            .join(",")
        : "";
    const signature = renderedLoop
      ? `${renderedLoop.id}|${renderedLoop.start.toFixed(4)}|${renderedLoop.end.toFixed(4)}|${
          renderedLoop.id === editableLoopId ? "edit" : "lock"
        }|m:${isMobilePractice ? "1" : "0"}|seg:${segSig}|sel:${activeSegmentId ?? ""}`
      : `empty|m:${isMobilePractice ? "1" : "0"}`;
    if (signature === loopsSignature.current) {
      return;
    }
    loopsSignature.current = signature;

    regions.clearRegions();
    const renderable = renderedLoop ? [renderedLoop] : [];
    renderable.forEach((loop) => {
      const isEditing = loop.id === editableLoopId;
      const isActive = loop.id === activeLoopId;
      const allowResize = isEditing && !isMobilePractice;
      const region = regions.addRegion({
        id: loop.id,
        start: loop.start,
        end: loop.end,
        /**
         * Three visual tiers, in order of emphasis:
         *   editing  — calm violet wash, bright edges + handles (CSS owns the edge frame)
         *   active   — selected practice phrase: clear borders, no fill emphasis
         *   locked   — barely-there slate: still selectable, never editable
         * Fill opacities stay low so the waveform is always the hero.
         */
        color: isEditing
          ? "rgba(210, 198, 255, 0.30)"
          : isActive
            ? "rgba(196, 181, 253, 0.10)"
            : "rgba(100,116,139,0.10)",
        drag: allowResize,
        resize: allowResize,
      }) as RegionHandle & { element?: HTMLElement | null };

      requestAnimationFrame(() => {
        const el = region.element;
        if (!el) return;
        const className = isEditing
          ? "woodshed-region-editing"
          : isActive
            ? "woodshed-region-active"
            : "woodshed-region-locked";
        el.classList.add(className);
        if (isMobilePractice) {
          el.style.pointerEvents = "none";
        } else {
          el.style.pointerEvents = "";
        }
      });

      if (!isMobilePractice) {
        region.on("click", () => {
          useWoodshedStore.getState().selectLoop(loop.id);
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
    });

    if (!isMobilePractice && renderedLoop?.segments?.length) {
      for (const seg of renderedLoop.segments) {
        const selected = seg.id === activeSegmentId;
        const sreg = regions.addRegion({
          id: `seg:${seg.id}`,
          start: seg.startTime,
          end: seg.endTime,
          color: selected
            ? "rgba(148, 163, 184, 0.11)"
            : "rgba(100, 116, 139, 0.045)",
          drag: false,
          resize: false,
        }) as RegionHandle & { element?: HTMLElement | null };

        requestAnimationFrame(() => {
          const el = sreg.element;
          if (!el) return;
          el.classList.add("woodshed-region-segment");
          el.style.pointerEvents = "auto";
        });

        sreg.on("click", () => {
          useWoodshedStore
            .getState()
            .selectSegment(renderedLoop.id, seg.id);
        });
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
          const target = useWoodshedStore.getState();
          if (!wavesurferRef.current) return;
          event.preventDefault();
          target.exitPhraseFitAfterUserNavigation();
          const factor = Math.exp(event.deltaY * -0.0015);
          const next = Math.min(
            1500,
            Math.max(4, target.minPxPerSec * factor),
          );
          target.setMinPxPerSec(next);
        },
        { passive: false },
      );
      scrollContainer.addEventListener("pointermove", (event) => {
        const inner = wavesurferRef.current;
        if (!inner) return;
        const dur = inner.getDuration();
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
  }, [loops, activeLoopId, editableLoopId, isMobilePractice, activeSegmentId]);

  const ingestFile = useCallback(async (blob: Blob) => {
    const ws = wavesurferRef.current;
    if (!ws) return;

    pendingDemoHydrationRef.current = null;
    demoInitialLoadDoneRef.current = true;

    useWoodshedStore.getState().resetWorkspace();
    audioBlobRef.current =
      blob instanceof File ? blob : new Blob([await blob.arrayBuffer()]);
    loopsSignature.current = "";

    await primeWaveformCaches(audioBlobRef.current);

    try {
      const url = URL.createObjectURL(blob);
      await ws.load(url);
      const displayName =
        blob instanceof File
          ? formatFilenameAsProjectName(blob.name)
          : "Woodshed session";
      useWoodshedStore.getState().setProjectMeta(nanoid(), displayName);
      await listProjects().then(setProjectsList);
    } catch {
      devError("Failed to load waveform");
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
      const ws = wavesurferRef.current;
      if (!ws) return;
      pendingDemoHydrationRef.current = null;
      demoInitialLoadDoneRef.current = true;
      pendingHydration.current = meta;
      useWoodshedStore.getState().resetWorkspace();
      const blob =
        options?.audioBlob ??
        (meta.blobId ? await loadBlobRecord(meta.blobId) : undefined);
      if (!blob) {
        pendingHydration.current = null;
        devWarn("Missing archived audio blob");
        return;
      }
      loopsSignature.current = "";
      audioBlobRef.current = blob;
      await primeWaveformCaches(blob);
      await ws.load(URL.createObjectURL(blob));
      await listProjects().then(setProjectsList);
    },
    [primeWaveformCaches],
  );

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
    if (!audioBlobRef.current) {
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
          !isDemo,
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
            audioBlob: audioBlobRef.current,
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
      const pid = snapshot.projectId ?? nanoid();
      await saveBlobRecord(pid, audioBlobRef.current, "audio");
      await saveDexieProject({
        id: pid,
        name: snapshot.projectName,
        loops: snapshot.loops,
        activeLoopId: snapshot.activeLoopId,
        blobId: pid,
      });
      useWoodshedStore.getState().setProjectMeta(pid, snapshot.projectName);
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
          const ws = wavesurferRef.current;
          if (!ws) return;
          if (ws.isPlaying()) ws.pause();
          else void ws.play();
        }
        return;
      }

      if (isKeyboardFocusInTextField(event.target)) {
        return;
      }

      const ws = wavesurferRef.current;
      const modifier = event.shiftKey;
      const stepping = modifier ? 0.05 : 0.75;
      if (event.repeat) return;

      switch (event.key) {
        case " ": {
          event.preventDefault();
          if (!ws) return;
          if (ws.isPlaying()) ws.pause();
          else void ws.play();
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (!ws || !duration) break;
          ws.setTime(clamp(ws.getCurrentTime() - stepping, 0, duration));
          break;
        }
        case "ArrowRight": {
          event.preventDefault();
          if (!ws || !duration) break;
          ws.setTime(clamp(ws.getCurrentTime() + stepping, 0, duration));
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
    [duration],
  );

  const userProjectsSelectable = useMemo(
    () => projects.filter((p) => p.id !== DEMO_PROJECT_ID),
    [projects],
  );

  const sessionSelectValue = useMemo(() => {
    if (!projectId) return "";
    if (projectId === DEMO_PROJECT_ID) return DEMO_PROJECT_ID;
    if (isCloudProjectId(projectId)) {
      return cloudSessionPickerValue(projectId);
    }
    if (userProjectsSelectable.some((p) => p.id === projectId)) return projectId;
    return "";
  }, [projectId, userProjectsSelectable]);

  const activePhraseName = useMemo(
    () => activeLoop?.name ?? "No phrase",
    [activeLoop?.name],
  );

  const handleTransportTogglePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (ws.isPlaying()) ws.pause();
    else void ws.play();
  }, []);

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

  const handleTransportAddContext = useCallback(() => {
    const st = useWoodshedStore.getState();
    const pid = st.activeLoopId;
    const loop = pid ? st.loops.find((l) => l.id === pid) : undefined;
    if (!pid || !loop || loop.end <= loop.start || !st.duration) {
      st.addLoopCandidate();
      return;
    }
    st.addSegment(pid);
  }, []);

  const handleTransportTempo = useCallback((pct: number) => {
    useWoodshedStore.getState().setActiveLoopTempoFromPercent(pct);
    const ws = wavesurferRef.current;
    if (!ws) return;
    const surface = makeSurface(ws);
    applyPlaybackTempo(
      surface,
      useWoodshedStore.getState().activeLoopTemps(),
    );
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

  return (
    <section
      ref={sectionRef}
      className="flex h-dvh flex-col overflow-hidden bg-stone-950 text-stone-50 outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyboard}
      aria-label="Woodshed workspace"
    >
      {!isMobilePractice ? (
        <DesktopHeaderBar
          projectName={projectName}
          isDemoProject={isDemoProject}
          sessionSelectValue={sessionSelectValue}
          demoProjectId={DEMO_PROJECT_ID}
          demoProjectLabel={demoPickerTitle}
          userProjects={userProjectsSelectable}
          cloudProjects={cloudProjects}
          showCloudSessions={Boolean(
            isSupabaseConfigured() && supabase && cloudSessionUserId,
          )}
          onRestoreProject={handleRestoreProject}
          onOpenAudioFile={() => fileInputRef.current?.click()}
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            isMobilePractice
              ? "grid h-full w-full grid-rows-[auto_1fr]"
              : "flex flex-col",
          )}
        >
          {isMobilePractice ? (
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
              showCloudSessions={Boolean(
                isSupabaseConfigured() && supabase && cloudSessionUserId,
              )}
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
            />
          ) : null}
          {!isMobilePractice ? (
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
                wavesurferRef.current?.setTime(seconds);
              }}
              onViewportPanToRatio={(ratio) => {
                const st = useWoodshedStore.getState();
                st.exitPhraseFitAfterUserNavigation();
                setWaveNormalizedScroll(wavesurferRef.current, ratio);
              }}
              onFitAll={handleResetZoomFullSong}
            />
          ) : null}
          <div
            className={cn(
              "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a]",
              !isMobilePractice &&
                "min-h-0 flex-1 border-0 px-3 py-2 sm:px-4 sm:py-2.5",
              isMobilePractice &&
                "min-h-0 flex-1 touch-manipulation border-b border-stone-800/80 px-3 py-2 [touch-action:pan-x]",
            )}
          >
            <div
              ref={containerRef}
              data-testid="primary-waveform"
              className="relative z-0 h-full w-full min-h-0"
            />
          </div>
          {!isMobilePractice ? (
            <>
              <DesktopTransportBar
                duration={duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
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
                onAddContext={handleTransportAddContext}
                tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
                onTogglePlay={handleTransportTogglePlay}
                onRestartLoop={() => {
                  const ws = wavesurferRef.current;
                  if (!ws || !activeLoopId) return;
                  const st = useWoodshedStore.getState();
                  const loop = loops.find((l) => l.id === activeLoopId);
                  if (!loop) return;
                  ws.setTime(
                    getRestartSeekSeconds({
                      loop,
                      loopPracticeScope: st.loopPracticeScope,
                      activeSegmentId: st.activeSegmentId,
                      lastPracticeSegmentIdByPhrase:
                        st.lastPracticeSegmentIdByPhrase,
                    }),
                  );
                  void ws.play();
                }}
                onCycleLoopPlaybackMode={() =>
                  useWoodshedStore.getState().cycleLoopPlaybackMode()
                }
                onTempoSlider={handleTransportTempo}
                formatTime={(t) => formatTime(t)}
              />
              <DesktopInspectorPanel />
            </>
          ) : null}
        </div>
      </div>
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
