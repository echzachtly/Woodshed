"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import WaveSurfer from "wavesurfer.js";

import { AppHeader, WorkspaceTransportBar } from "@/components/transport-bar";
import { LoopSidebar } from "@/components/loop-sidebar";
import { MiniMap } from "@/components/mini-map";
import type { VisibleWindow } from "@/lib/waveform-manager";
import {
  applyPlaybackTempo,
  type LoopRail,
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
import { devError, devWarn } from "@/lib/dev-log";
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
import { nanoid } from "@/lib/id";
import { peekWaveSurferDom, setWaveNormalizedScroll } from "@/lib/waveform-scroll";
import {
  PLAYHEAD_UI_TIME_MS,
  readPlaybackSeconds,
} from "@/lib/playhead-sync";
import { useWoodshedStore } from "@/store/woodshed-store";

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

function buildLoopRail(
  loops: PracticeLoop[],
  activeId: string | null,
  enabled: boolean,
): LoopRail {
  const target = loops.find((l) => l.id === activeId);
  if (!target || !enabled) {
    return { enabled: false, start: 0, end: Number.POSITIVE_INFINITY };
  }
  return { enabled: true, start: target.start, end: target.end };
}

const WoodshedWorkspace = memo(function WoodshedWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const pendingHydration = useRef<StoredProjectMeta | null>(null);
  const pendingDemoHydrationRef = useRef<PendingDemoHydration | null>(null);
  const demoInitialLoadDoneRef = useRef(false);
  const loopsSignature = useRef<string>("");
  const wheelBound = useRef(false);
  /** Ignore scroll events briefly after programmatic phrase fit (loop-focused viewport). */
  const suppressViewportScrollUntilRef = useRef(0);
  /** Stops tight loop RAF from the effect cleanup (see mount IIFE). */
  const cancelPlaybackLoopRef = useRef<(() => void) | null>(null);

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

  const projectName = useWoodshedStore((s) => s.projectName);
  const projectId = useWoodshedStore((s) => s.projectId);
  const loops = useWoodshedStore((s) => s.loops);
  const activeLoopId = useWoodshedStore((s) => s.activeLoopId);
  const duration = useWoodshedStore((s) => s.duration);
  const minPxPerSec = useWoodshedStore((s) => s.minPxPerSec);
  const loopPlaybackEnabled = useWoodshedStore((s) => s.loopPlaybackEnabled);
  const loopFocusTick = useWoodshedStore((s) => s.loopFocusTick);
  const isPlaying = useWoodshedStore((s) => s.isPlaying);
  const currentTime = useWoodshedStore((s) => s.currentTime);
  const activeLoop = useMemo(
    () => loops.find((l) => l.id === activeLoopId),
    [activeLoopId, loops],
  );

  const isDemoProject = projectId === DEMO_PROJECT_ID;

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }, []);

  /** Fit waveform to `loop` and update store zoom; returns false if layout not ready. */
  const applyPhraseFitToLoop = useCallback((loop: PracticeLoop) => {
    const ws = wavesurferRef.current;
    if (!ws) return false;
    const span = loop.end - loop.start;
    if (span <= 0) return false;
    const dom = peekWaveSurferDom(ws);
    const container = dom?.scrollContainer;
    if (!container) return false;
    const clientWidth = container.clientWidth;
    if (clientWidth <= 0) return false;
    const targetWidth = clientWidth * 0.94;
    const nextPxPerSec = Math.max(4, Math.min(1500, targetWidth / span));
    useWoodshedStore.getState().setMinPxPerSec(nextPxPerSec);
    ws.zoom(nextPxPerSec);
    const padPx = (clientWidth - span * nextPxPerSec) / 2;
    const startPx = loop.start * nextPxPerSec - Math.max(0, padPx);
    ws.setScroll(Math.max(0, startPx));
    return true;
  }, []);

  const handleResetZoomFullSong = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    const st = useWoodshedStore.getState();
    if (st.viewportMode === "loop-focused") {
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
    const snapInit = useWoodshedStore.getState();
    const initialAutoScroll = !snapInit.loopPlaybackEnabled;

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
        waveColor: "#342f2c",
        progressColor: "#d8c8fc",
        barWidth: 1,
        barGap: 0,
        normalize: true,
        /** Hide the browser-native scrollbar; pan via wheel/trackpad and minimap stays primary. */
        hideScrollbar: true,
        /** Critical: default `fillParent:true` hides zoom until duration×px/sec exceeds viewport */
        fillParent: false,
        minPxPerSec: starterZoom,
        dragToSeek: true,
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
        const rail = buildLoopRail(
          snapshot.loops,
          snapshot.activeLoopId,
          snapshot.loopPlaybackEnabled,
        );
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
            if (st.viewportMode === "loop-focused") {
              st.setViewportMode("follow");
            }
          },
          { passive: true },
        );
      }

      ws.on("dblclick", (relativeX) => {
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
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.zoom(minPxPerSec);
  }, [minPxPerSec]);

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
    if (!applyPhraseFitToLoop(loop)) {
      useWoodshedStore.getState().setViewportMode("follow");
      return;
    }
    useWoodshedStore.getState().setViewportMode("loop-focused");
  }, [loopPlaybackEnabled, activeLoopId, loopFocusTick, applyPhraseFitToLoop]);

  useEffect(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    /** While loop playback is on, never auto-scroll the waveform — even after manual pan unlocks loop-focused view. */
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

    const signature = `${activeLoopId ?? "none"}|${loops
      .map((l) => `${l.id}:${l.start.toFixed(4)}:${l.end.toFixed(4)}`)
      .join("|")}`;
    if (signature === loopsSignature.current) {
      return;
    }
    loopsSignature.current = signature;

    regions.clearRegions();
    loops.forEach((loop) => {
      const editable = loop.id === activeLoopId;
      const region = regions.addRegion({
        id: loop.id,
        start: loop.start,
        end: loop.end,
        /** Keep these in sync with --loop-active / --loop-inactive in globals.css. */
        color: editable
          ? "rgba(210, 198, 255, 0.46)"
          : "rgba(100,116,139,0.16)",
        drag: editable,
        resize: editable,
      }) as RegionHandle & { element?: HTMLElement | null };

      requestAnimationFrame(() => {
        const el = region.element;
        if (!el || !editable) return;
        el.style.transition =
          "box-shadow 120ms ease, filter 120ms ease, outline-color 120ms ease";
        const onEnter = () => {
          el.style.boxShadow =
            "inset 0 0 0 1.5px rgba(233, 213, 255, 0.65), 0 0 14px rgba(167, 139, 250, 0.12)";
          el.style.filter = "brightness(1.03)";
        };
        const onLeave = () => {
          el.style.boxShadow = "";
          el.style.filter = "";
        };
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
      });

      region.on("click", () => {
        useWoodshedStore.getState().selectLoop(loop.id);
      });

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

    const domPeek = peekWaveSurferDom(ws);
    if (domPeek && !wheelBound.current) {
      const { scrollContainer, wrapper } = domPeek;
      wheelBound.current = true;
      scrollContainer.addEventListener(
        "wheel",
        (event) => {
          const target = useWoodshedStore.getState();
          if (!wavesurferRef.current) return;
          event.preventDefault();
          if (target.viewportMode === "loop-focused") {
            target.setViewportMode("follow");
          }
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
  }, [loops, activeLoopId]);

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
      const prettyName =
        blob instanceof File
          ? blob.name.replace(/\.[^/.]+$/, "")
          : "Woodshed session";
      useWoodshedStore
        .getState()
        .setProjectMeta(nanoid(), prettyName ?? "Untitled session");
      await listProjects().then(setProjectsList);
    } catch {
      devError("Failed to load waveform");
    }
  }, [primeWaveformCaches]);

  const hydrateProject = useCallback(async (meta: StoredProjectMeta) => {
    const ws = wavesurferRef.current;
    if (!ws || !meta.blobId) return;
    pendingDemoHydrationRef.current = null;
    demoInitialLoadDoneRef.current = true;
    pendingHydration.current = meta;
    useWoodshedStore.getState().resetWorkspace();
    const blob = await loadBlobRecord(meta.blobId);
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
  }, [primeWaveformCaches]);

  const persistSession = useCallback(async () => {
    const snapshot = useWoodshedStore.getState();
    if (snapshot.projectId === DEMO_PROJECT_ID) {
      devWarn(
        "The built-in example project is read-only. Open a saved session or upload audio, then use Save to store your own copy.",
      );
      return;
    }
    if (!audioBlobRef.current) {
      devWarn("Load audio before saving");
      return;
    }
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
  }, []);

  const handleKeyboard = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const ws = wavesurferRef.current;
      const modifier = event.shiftKey;
      const stepping = modifier ? 0.05 : 0.75;
      if (event.repeat) return;

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

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
        case "r":
        case "R": {
          event.preventDefault();
          if (!ws || !activeLoopId) break;
          const rail = loops.find((l) => l.id === activeLoopId);
          if (!rail) break;
          ws.setTime(rail.start);
          void ws.play();
          break;
        }
        case "PageDown": {
          event.preventDefault();
          const zs = useWoodshedStore.getState();
          if (zs.viewportMode === "loop-focused") zs.setViewportMode("follow");
          zs.setMinPxPerSec(zs.minPxPerSec / 1.22);
          break;
        }
        case "PageUp": {
          event.preventDefault();
          const zp = useWoodshedStore.getState();
          if (zp.viewportMode === "loop-focused") zp.setViewportMode("follow");
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
    [activeLoopId, duration, loops],
  );

  const userProjectsSelectable = useMemo(
    () => projects.filter((p) => p.id !== DEMO_PROJECT_ID),
    [projects],
  );

  const sessionSelectValue = useMemo(() => {
    if (!projectId) return "";
    if (projectId === DEMO_PROJECT_ID) return DEMO_PROJECT_ID;
    if (userProjectsSelectable.some((p) => p.id === projectId)) return projectId;
    return "";
  }, [projectId, userProjectsSelectable]);

  return (
    <section
      ref={sectionRef}
      className="flex h-dvh flex-col overflow-hidden bg-stone-950 text-stone-50 outline-none"
      tabIndex={-1}
      onKeyDown={handleKeyboard}
      aria-label="Woodshed workspace"
    >
      <AppHeader
        projectName={projectName}
        sessionSelectValue={sessionSelectValue}
        demoProjectId={DEMO_PROJECT_ID}
        demoProjectLabel={demoPickerTitle}
        userProjects={userProjectsSelectable}
        isDemoProject={isDemoProject}
        sessionNameReadOnly={isDemoProject}
        saveDisabled={isDemoProject}
        devExportLoopsJson={
          process.env.NODE_ENV === "development"
            ? handleDevExportLoopsJson
            : undefined
        }
        hiddenFileProps={{
          ref: fileInputRef,
          type: "file",
          accept: "audio/*",
          hidden: true,
          onChange: async (evt) => {
            const file = evt.target.files?.item(0);
            if (!file) return;
            await ingestFile(file);
          },
          "aria-hidden": true,
        }}
        onRenameProject={(name) =>
          useWoodshedStore.getState().setProjectMeta(projectId ?? null, name)
        }
        onOpenFileClick={() => fileInputRef.current?.click()}
        onSaveProject={() => void persistSession()}
        onRestoreProject={async (id) => {
          if (id === DEMO_PROJECT_ID) {
            const ok = await loadBuiltInDemoProject();
            if (ok) await listProjects().then(setProjectsList);
            return;
          }
          const project = await loadDexieProject(id);
          if (!project) return;
          await hydrateProject(project);
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceTransportBar
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            loopPlaybackEnabled={loopPlaybackEnabled}
            canEnableLoopPlayback={Boolean(
              activeLoop && activeLoop.end > activeLoop.start,
            )}
            tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
            onTogglePlay={() => {
              const ws = wavesurferRef.current;
              if (!ws) return;
              if (ws.isPlaying()) ws.pause();
              else void ws.play();
            }}
            onStop={() => {
              wavesurferRef.current?.pause();
              wavesurferRef.current?.setTime(0);
              useWoodshedStore.getState().setPlaying(false);
              useWoodshedStore.getState().setCurrentTime(0);
            }}
            onRestartLoop={() => {
              const ws = wavesurferRef.current;
              if (!ws || !activeLoopId) return;
              const rail = loops.find((l) => l.id === activeLoopId);
              if (!rail) return;
              ws.setTime(rail.start);
              void ws.play();
            }}
            onResetZoomFullSong={handleResetZoomFullSong}
            onToggleLoopPlayback={() =>
              useWoodshedStore
                .getState()
                .setLoopPlaybackEnabled(!loopPlaybackEnabled)
            }
            onTempoSlider={(pct) => {
              useWoodshedStore.getState().setActiveLoopTempoFromPercent(pct);
              const ws = wavesurferRef.current;
              if (!ws) return;
              const surface = makeSurface(ws);
              applyPlaybackTempo(
                surface,
                useWoodshedStore.getState().activeLoopTemps(),
              );
            }}
            formatTime={(t) => formatTime(t)}
          />
          <div className="relative flex min-h-0 min-w-0 flex-[1_1_62%] flex-col overflow-hidden border-b border-stone-900 bg-gradient-to-br from-[#080605] via-[#0b0806] to-[#10080a] px-5 py-4">
            <div
              ref={containerRef}
              data-testid="primary-waveform"
              className="relative z-0 h-full w-full"
            />
          </div>
          <MiniMap
            peaks={decodedPeaks}
            duration={duration}
            loops={loops}
            activeLoopId={activeLoopId}
            viewport={viewport}
            currentTime={currentTime}
            onNavigate={(seconds) => {
              const st = useWoodshedStore.getState();
              if (st.viewportMode === "loop-focused") {
                st.setViewportMode("follow");
              }
              wavesurferRef.current?.setTime(seconds);
            }}
            onViewportPanToRatio={(ratio) => {
              const st = useWoodshedStore.getState();
              if (st.viewportMode === "loop-focused") {
                st.setViewportMode("follow");
              }
              setWaveNormalizedScroll(wavesurferRef.current, ratio);
            }}
          />
        </div>

        <LoopSidebar
          loops={loops}
          activeLoopId={activeLoopId}
          onSelectLoop={(id) => useWoodshedStore.getState().selectLoop(id)}
          onRenameLoop={(id, next) =>
            useWoodshedStore.getState().renameLoop(id, next)
          }
          onAddLoop={() => useWoodshedStore.getState().addLoopCandidate()}
          onRemoveLoop={(id) => useWoodshedStore.getState().removeLoop(id)}
        />
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
