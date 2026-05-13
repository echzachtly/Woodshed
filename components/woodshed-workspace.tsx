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
import { detectTransientSeconds } from "@/lib/transient-engine";
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
import { nanoid } from "@/lib/id";
import { setWaveNormalizedScroll } from "@/lib/waveform-scroll";
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

/** Resolves via package.json `exports` → `dist/plugins/regions.esm.js` (do not use `plugins/regions.js` — not exported; breaks Vercel/webpack). */
async function loadRegionsFactory(): Promise<unknown> {
  const mod = await import("wavesurfer.js/plugins/regions");
  return mod.default;
}

/** Prefer element clock — slightly ahead of WaveSurfer’s throttled `timeupdate`. */
function readPlaybackSeconds(ws: WaveSurfer): number {
  const media = ws.getMediaElement();
  if (media && Number.isFinite(media.currentTime)) {
    return media.currentTime;
  }
  return ws.getCurrentTime();
}

function makeSurface(ws: WaveSurfer): MediaPlaybackSurface {
  return {
    getDuration: () => ws.getDuration(),
    getCurrentTime: () => ws.getCurrentTime(),
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

function peekWaveSurferDom(ws: WaveSurfer): {
  scrollContainer: HTMLElement;
  wrapper: HTMLElement;
} | null {
  const r = ws.getRenderer() as unknown as {
    scrollContainer?: HTMLElement | null;
    getWrapper: () => HTMLElement;
  };
  if (!r?.scrollContainer) return null;
  return { scrollContainer: r.scrollContainer, wrapper: r.getWrapper() };
}

const WoodshedWorkspace = memo(function WoodshedWorkspace() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioBlobRef = useRef<Blob | null>(null);
  const pendingHydration = useRef<StoredProjectMeta | null>(null);
  const loopsSignature = useRef<string>("");
  const wheelBound = useRef(false);
  /** Stops tight loop RAF from the effect cleanup (see mount IIFE). */
  const cancelPlaybackLoopRef = useRef<(() => void) | null>(null);

  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsHandle | null>(null);

  const [projects, setProjectsList] = useState<StoredProjectMeta[]>([]);
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
  const transientTimes = useWoodshedStore((s) => s.transientTimes);
  const snapAssist = useWoodshedStore((s) => s.snapAssist);
  const autoScrollDuringPlayback = useWoodshedStore(
    (s) => s.autoScrollDuringPlayback,
  );
  const loopPlaybackEnabled = useWoodshedStore((s) => s.loopPlaybackEnabled);
  const isPlaying = useWoodshedStore((s) => s.isPlaying);
  const currentTime = useWoodshedStore((s) => s.currentTime);
  const activeLoop = useMemo(
    () => loops.find((l) => l.id === activeLoopId),
    [activeLoopId, loops],
  );

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00.00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }, []);

  const handleFitToLoop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws || !activeLoop) return;
    const loopDuration = activeLoop.end - activeLoop.start;
    if (loopDuration <= 0) return;
    const dom = peekWaveSurferDom(ws);
    const container = dom?.scrollContainer;
    if (!container) return;
    const clientWidth = container.clientWidth;
    if (clientWidth <= 0) return;
    /** Leave a touch of room on either side so handles stay reachable. */
    const targetWidth = clientWidth * 0.94;
    const nextPxPerSec = Math.max(
      4,
      Math.min(1500, targetWidth / loopDuration),
    );
    useWoodshedStore.getState().setMinPxPerSec(nextPxPerSec);
    ws.zoom(nextPxPerSec);
    const padPx = (clientWidth - loopDuration * nextPxPerSec) / 2;
    const startPx = activeLoop.start * nextPxPerSec - Math.max(0, padPx);
    ws.setScroll(Math.max(0, startPx));
  }, [activeLoop]);

  useEffect(() => {
    listProjects().then(setProjectsList).catch(() => undefined);
  }, []);

  useEffect(() => {
    sectionRef.current?.focus({ preventScroll: true });
  }, []);

  const primeWaveformCaches = useCallback(async (blob: Blob) => {
    try {
      const decoded = await analyzeAudioEnvelope(blob);
      if (!decoded) return;
      useWoodshedStore.getState().setTransients(
        detectTransientSeconds(
          Float32Array.from(decoded.getChannelData(0)),
          decoded.sampleRate,
          { sensitivity: 0.4 },
        ),
      );
      setDecodedPeaks(Float32Array.from(decoded.getChannelData(0)));
    } catch {
      /* optional */
    }
  }, []);

  useEffect(() => {
    let destroyed = false;
    const regionFactoryPromise = loadRegionsFactory();
    const starterZoom =
      typeof window === "undefined"
        ? 50
        : useWoodshedStore.getState().minPxPerSec;

    void (async () => {
      const host = containerRef.current;
      if (!host) return;
      const Factory = await regionFactoryPromise;
      if (destroyed || !Factory) return;

      const ws = WaveSurfer.create({
        container: host,
        /** `auto` lets the waveform fill the (much taller) flex container — see layout below. */
        height: "auto",
        cursorColor: "#fbbf24",
        cursorWidth: 2,
        waveColor: "#3f3b37",
        progressColor: "#d4c4fc",
        barWidth: 1,
        barGap: 0,
        normalize: true,
        /** Hide the browser-native scrollbar; pan via wheel/trackpad and minimap stays primary. */
        hideScrollbar: true,
        /** Critical: default `fillParent:true` hides zoom until duration×px/sec exceeds viewport */
        fillParent: false,
        minPxPerSec: starterZoom,
        dragToSeek: true,
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

      ws.on("timeupdate", (t) => {
        useWoodshedStore.getState().setCurrentTime(t);
      });

      ws.on("play", () => {
        useWoodshedStore.getState().setPlaying(true);
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

        useWoodshedStore.getState().updateLoopBounds(
          loop.id,
          regionStart,
          regionEnd,
          { transientSnap: transientTimes },
        );
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
  }, [loops, activeLoopId, transientTimes]);

  const ingestFile = useCallback(async (blob: Blob) => {
    const ws = wavesurferRef.current;
    if (!ws) return;

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
          zs.setMinPxPerSec(zs.minPxPerSec / 1.22);
          break;
        }
        case "PageUp": {
          event.preventDefault();
          const zp = useWoodshedStore.getState();
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
        projects={projects}
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
        onRestoreProject={(id) =>
          loadDexieProject(id).then(async (project) => {
            if (!project) return;
            await hydrateProject(project);
          })
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <WorkspaceTransportBar
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            loopPlaybackEnabled={loopPlaybackEnabled}
            tempoPercent={Math.round((activeLoop?.tempo ?? 1) * 100)}
            canFitLoop={Boolean(activeLoop && activeLoop.end > activeLoop.start)}
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
            }}
            onRestartLoop={() => {
              const ws = wavesurferRef.current;
              if (!ws || !activeLoopId) return;
              const rail = loops.find((l) => l.id === activeLoopId);
              if (!rail) return;
              ws.setTime(rail.start);
              void ws.play();
            }}
            onFitToLoop={handleFitToLoop}
            onToggleLoopRail={() =>
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
              wavesurferRef.current?.setTime(seconds);
            }}
            onViewportPanToRatio={(ratio) =>
              setWaveNormalizedScroll(wavesurferRef.current, ratio)
            }
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
          snapAssist={snapAssist}
          onSnapAssistChange={(value) =>
            useWoodshedStore.getState().setSnapAssist(value)
          }
          autoScroll={autoScrollDuringPlayback}
          onAutoScrollToggle={() =>
            useWoodshedStore
              .getState()
              .setAutoScroll(!autoScrollDuringPlayback)
          }
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
