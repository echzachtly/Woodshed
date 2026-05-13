import { create } from "zustand";

import {
  clampTempo,
  createInitialLoop,
  loopFromBounds,
  type PracticeLoop,
} from "@/lib/loop-engine";
import { nanoid } from "@/lib/id";

/** Waveform viewport: follow playhead vs loop-focused zoom once (until user pans/zooms). */
export type ViewportMode = "follow" | "loop-focused";

export type WoodshedState = {
  projectId: string | null;
  projectName: string;
  duration: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  isPlaying: boolean;
  currentTime: number;
  /** When true, playback repeats the selected loop; waveform auto-follow is off. */
  loopPlaybackEnabled: boolean;
  /** Main waveform zoom (WaveSurfer minPxPerSec) */
  minPxPerSec: number;
  hoverTime: number | null;
  /**
   * `follow` — WaveSurfer keeps the play position in view during playback.
   * `loop-focused` — viewport was fitted to the active loop once; user pan/zoom returns to follow layout.
   */
  viewportMode: ViewportMode;
  /**
   * Incremented whenever the user explicitly selects a practice loop (including re-selecting the same one)
   * so the workspace can refit the waveform once.
   */
  loopFocusTick: number;
  /** True when creating loop from double-click / drag */
  pendingLoopDrag: { start: number; end: number } | null;
};

type WoodshedActions = {
  resetWorkspace: () => void;
  bootstrapFromDuration: (duration: number) => void;
  setProjectMeta: (id: string | null, name: string) => void;
  setDuration: (duration: number) => void;
  setPlaying: (flag: boolean) => void;
  setCurrentTime: (t: number) => void;
  setLoopPlaybackEnabled: (flag: boolean) => void;
  setMinPxPerSec: (v: number) => void;
  setHoverTime: (t: number | null) => void;
  setViewportMode: (mode: ViewportMode) => void;
  upsertLoops: (loops: PracticeLoop[]) => void;
  addLoopCandidate: () => void;
  addLoopAround: (
    mid: number,
    halfWidthSec?: number,
    baseName?: string,
  ) => PracticeLoop | null;
  selectLoop: (id: string | null) => void;
  renameLoop: (id: string, name: string) => void;
  updateLoopBounds: (id: string, start: number, end: number) => void;
  removeLoop: (id: string) => void;
  nudgeLoopEdge: (edge: "start" | "end", deltaSec: number) => void;
  bumpTempo: (delta: number) => void;
  /** Sets active loop tempo from UI percent slider (25–150). No-op without active loop. */
  setActiveLoopTempoFromPercent: (percent: number) => void;
  setPendingLoopDrag: (
    bounds: WoodshedState["pendingLoopDrag"],
  ) => void;
  activeLoopTemps: () => number;
};

export type WoodshedStore = WoodshedState & WoodshedActions;

const initialState: WoodshedState = {
  projectId: null,
  projectName: "Untitled session",
  duration: 0,
  loops: [],
  activeLoopId: null,
  isPlaying: false,
  currentTime: 0,
  loopPlaybackEnabled: false,
  minPxPerSec: 50,
  hoverTime: null,
  viewportMode: "follow",
  loopFocusTick: 0,
  pendingLoopDrag: null,
};

function clampUi(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export const useWoodshedStore = create<WoodshedStore>((set, get) => ({
  ...initialState,
  resetWorkspace: () => set({ ...initialState }),
  bootstrapFromDuration: (duration) => {
    const loop = createInitialLoop(duration);
    set((state) => ({
      duration,
      loops: [loop],
      activeLoopId: loop.id,
      loopPlaybackEnabled: true,
      loopFocusTick: state.loopFocusTick + 1,
    }));
  },
  setProjectMeta: (projectId, projectName) => set({ projectId, projectName }),
  setDuration: (duration) => set({ duration }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setLoopPlaybackEnabled: (loopPlaybackEnabled) =>
    set({
      loopPlaybackEnabled,
      ...(!loopPlaybackEnabled ? { viewportMode: "follow" as const } : {}),
    }),
  setMinPxPerSec: (minPxPerSec) =>
    set({ minPxPerSec: Math.max(4, Math.min(1500, minPxPerSec)) }),
  setHoverTime: (hoverTime) => set({ hoverTime }),
  setViewportMode: (viewportMode) => set({ viewportMode }),
  upsertLoops: (loops) => set({ loops }),
  addLoopCandidate: () => {
    const { duration, loops, activeLoopId } = get();
    if (!duration) return;
    const active = loops.find((l) => l.id === activeLoopId);
    const span = active
      ? Math.min(8, Math.max(1, active.end - active.start))
      : Math.min(12, duration * 0.05);
    const start = active
      ? clampTime(active.end, duration)
      : Math.min(Math.max(0, duration - span), duration * 0.5);
    const end = Math.min(duration, start + span);
    const created = loopFromBounds(start, end, duration, `Section ${loops.length + 1}`);
    set((state) => ({
      loops: [...loops, created],
      activeLoopId: created.id,
      loopPlaybackEnabled: true,
      loopFocusTick: state.loopFocusTick + 1,
    }));
  },
  addLoopAround: (mid, halfWidthSec = 2, baseName) => {
    const { duration } = get();
    if (!duration) return null;
    const half =
      typeof halfWidthSec === "number"
        ? halfWidthSec
        : Math.min(4, duration * 0.02);
    const start = clampTime(mid - half, duration);
    const end = clampTime(mid + half, duration);
    const phrase = loopFromBounds(
      start,
      end,
      duration,
      baseName ?? `Phrase ${nanoid(4)}`,
    );
    set((s) => ({
      loops: [...s.loops, phrase],
      activeLoopId: phrase.id,
      loopPlaybackEnabled: true,
      loopFocusTick: s.loopFocusTick + 1,
    }));
    return phrase;
  },
  selectLoop: (activeLoopId) =>
    set((s) => {
      if (activeLoopId === null) {
        return {
          activeLoopId: null,
          loopPlaybackEnabled: false,
          viewportMode: "follow",
          loopFocusTick: s.loopFocusTick + 1,
        };
      }
      const loop = s.loops.find((l) => l.id === activeLoopId);
      const playback = Boolean(loop && loop.end > loop.start);
      return {
        activeLoopId,
        loopPlaybackEnabled: playback,
        loopFocusTick: playback ? s.loopFocusTick + 1 : s.loopFocusTick,
        ...(!playback ? { viewportMode: "follow" as const } : {}),
      };
    }),
  renameLoop: (id, name) =>
    set((s) => ({
      loops: s.loops.map((l) => (l.id === id ? { ...l, name } : l)),
    })),
  updateLoopBounds: (id, start, end) => {
    const { duration } = get();
    if (!duration) return;
    let s = Math.max(0, Math.min(start, end));
    let e = Math.min(duration, Math.max(start, end));
    const minSpan = Math.min(0.05, duration * 0.001);
    if (e - s < minSpan) e = Math.min(duration, s + minSpan);

    set((state) => ({
      loops: state.loops.map((l) =>
        l.id === id ? { ...l, start: s, end: e } : l,
      ),
    }));
  },
  removeLoop: (id) =>
    set((s) => {
      const next = s.loops.filter((l) => l.id !== id);
      const activeRemoved = s.activeLoopId === id;
      const nextActive = activeRemoved ? next[0]?.id ?? null : s.activeLoopId;
      if (next.length === 0) {
        return {
          loops: next,
          activeLoopId: null,
          loopPlaybackEnabled: false,
          viewportMode: "follow",
        };
      }
      if (!activeRemoved) {
        return { loops: next, activeLoopId: nextActive };
      }
      const naLoop = nextActive
        ? next.find((l) => l.id === nextActive)
        : undefined;
      const playback = Boolean(naLoop && naLoop.end > naLoop.start);
      return {
        loops: next,
        activeLoopId: nextActive,
        loopPlaybackEnabled: playback,
        loopFocusTick: playback ? s.loopFocusTick + 1 : s.loopFocusTick,
        ...(!playback ? { viewportMode: "follow" as const } : {}),
      };
    }),
  nudgeLoopEdge: (edge, deltaSec) => {
    const { activeLoopId, loops, duration } = get();
    if (!activeLoopId || !duration) return;
    const loop = loops.find((l) => l.id === activeLoopId);
    if (!loop) return;
    if (edge === "start") {
      get().updateLoopBounds(loop.id, loop.start + deltaSec, loop.end);
    } else {
      get().updateLoopBounds(loop.id, loop.start, loop.end + deltaSec);
    }
  },
  bumpTempo: (delta) => {
    const { activeLoopId, loops } = get();
    if (!activeLoopId) return;
    set({
      loops: loops.map((l) =>
        l.id === activeLoopId
          ? { ...l, tempo: clampTempo(l.tempo + delta) }
          : l,
      ),
    });
  },
  setActiveLoopTempoFromPercent: (percent) => {
    const { activeLoopId, loops } = get();
    if (!activeLoopId) return;
    const pct = clampUi(percent, 25, 150) / 100;
    set({
      loops: loops.map((l) =>
        l.id === activeLoopId ? { ...l, tempo: clampTempo(pct) } : l,
      ),
    });
  },
  setPendingLoopDrag: (pendingLoopDrag) => set({ pendingLoopDrag }),
  activeLoopTemps: () => {
    const { loops, activeLoopId } = get();
    const hit = loops.find((l) => l.id === activeLoopId);
    return hit?.tempo ?? 1;
  },
}));

function clampTime(value: number, duration: number) {
  return Math.min(duration, Math.max(0, value));
}
