import { create } from "zustand";

import {
  clampSegmentsToPhraseBounds,
  clampTempo,
  createInitialLoop,
  createSegmentInPhrase,
  loopFromBounds,
  phraseSegmentFromBounds,
  type PhraseSegment,
  type PracticeLoop,
} from "@/lib/loop-engine";
import { nanoid } from "@/lib/id";

/**
 * Waveform viewport intent (WaveSurfer `autoScroll` / `autoCenter` still follow
 * `loopPlaybackEnabled` separately — see workspace effect).
 *
 * - `follow` — default; playhead can stay centered when not repeating a phrase.
 * - `phrase-focus` — viewport was just fitted to the active phrase (zoom + scroll).
 * - `manual` — user panned/zoomed after a phrase-focus fit while repeat is on;
 *   playhead follow stays off until the next explicit phrase refit.
 */
export type ViewportMode = "follow" | "phrase-focus" | "manual";

/** When repeat is on, loop either the full phrase or a focus region’s range. */
export type LoopPracticeScope = "phrase" | "practice_region";

export type WoodshedState = {
  projectId: string | null;
  projectName: string;
  duration: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  /**
   * The single loop currently in editable/draft mode.
   * - Newly created loops auto-enter this state ("draft" — until the user clicks Done).
   * - Saved loops are locked by default. The user must explicitly enter Edit mode.
   * - Only one loop is ever editable at a time.
   * - Selecting a different loop auto-finalizes the previous editable one.
   * Separation of concerns: `activeLoopId` = practice focus; `editableLoopId` = edit focus.
   * Kept in sync with `phraseWaveformEditUnlockedById` for phrase waveform handles
   * (inspector Lock / Edit, transport, sidebar).
   */
  editableLoopId: string | null;
  isPlaying: boolean;
  currentTime: number;
  /** When true, playback repeats the active phrase; waveform playhead auto-follow is off. */
  loopPlaybackEnabled: boolean;
  /**
   * With repeat on: loop the full phrase, or a focus region’s time range when
   * scope is `practice_region`.
   */
  loopPracticeScope: LoopPracticeScope;
  /** Main waveform zoom (WaveSurfer minPxPerSec) */
  minPxPerSec: number;
  hoverTime: number | null;
  viewportMode: ViewportMode;
  /**
   * Incremented whenever the user explicitly selects a practice loop (including re-selecting the same one)
   * so the workspace can refit the waveform once.
   */
  loopFocusTick: number;
  /** True when creating loop from double-click / drag */
  pendingLoopDrag: { start: number; end: number } | null;
  /** Desktop inspector: selected focus region on the active phrase (if any). */
  activeSegmentId: string | null;
  /**
   * Incremented when transport asks the inspector to expand and focus
   * focus-region fields.
   */
  inspectorFocusRequestId: number;
  /**
   * Per phrase, last focus region used for Focus Loop (persists when none is
   * selected in the inspector).
   */
  lastPracticeSegmentIdByPhrase: Record<string, string>;
  /**
   * Desktop-only session UI: focus region ids allowed to drag-resize start/end
   * on the main waveform. Key present with `true` = unlocked; absent = locked.
   * Not persisted in project files.
   */
  focusRegionWaveformEditUnlockedById: Record<string, true>;
  /**
   * Desktop-only session UI: phrase (loop) ids allowed to drag-resize phrase
   * start/end on the main waveform. Sparse `true` = unlocked. Kept in sync with
   * `editableLoopId` for sidebar/transport; cleared when changing phrase selection
   * without preserving edit. Not persisted in project files.
   */
  phraseWaveformEditUnlockedById: Record<string, true>;
};

type WoodshedActions = {
  resetWorkspace: () => void;
  bootstrapFromDuration: (duration: number) => void;
  setProjectMeta: (id: string | null, name: string) => void;
  setDuration: (duration: number) => void;
  setPlaying: (flag: boolean) => void;
  setCurrentTime: (t: number) => void;
  setLoopPlaybackEnabled: (flag: boolean) => void;
  setLoopPracticeScope: (scope: LoopPracticeScope) => void;
  /**
   * Advance the transport loop control: Phrase↔Play Through when the active
   * phrase has no focus regions; Loop Phrase→Focus Loop→Play Through when it does.
   */
  cycleLoopPlaybackMode: () => void;
  setMinPxPerSec: (v: number) => void;
  setHoverTime: (t: number | null) => void;
  setViewportMode: (mode: ViewportMode) => void;
  /**
   * Call when the user pans, zooms, or navigates the viewport after an automatic
   * phrase fit — leaves `phrase-focus` for `manual` (repeat on) or `follow`.
   */
  exitPhraseFitAfterUserNavigation: () => void;
  upsertLoops: (loops: PracticeLoop[]) => void;
  /** Optional name for mobile / future callers; default `Section N`. */
  addLoopCandidate: (nameOverride?: string) => void;
  addLoopAround: (
    mid: number,
    halfWidthSec?: number,
    baseName?: string,
  ) => PracticeLoop | null;
  /**
   * Desktop Shift+drag: add a phrase from [startSec,endSec] song times (clamped
   * in loopFromBounds). Enables loop phrase, unlocks waveform handles.
   */
  createPhraseFromShiftDrag: (
    startSec: number,
    endSec: number,
  ) => PracticeLoop | null;
  /**
   * Desktop Shift+drag: add a focus segment inside an existing phrase.
   * Enables Focus Loop, unlocks segment handles, clears phrase waveform unlock.
   */
  createFocusSegmentFromShiftDrag: (args: {
    phraseId: string;
    startSec: number;
    endSec: number;
  }) => { seekTo: number } | null;
  selectLoop: (id: string | null) => void;
  renameLoop: (id: string, name: string) => void;
  updateLoopBounds: (id: string, start: number, end: number) => void;
  removeLoop: (id: string) => void;
  /**
   * Set / clear the single loop currently in edit mode.
   * Pass null to finalize (lock) the currently editable loop.
   * Used by the sidebar "Edit" / "Done" buttons and internally on new-loop creation.
   */
  setEditableLoopId: (id: string | null) => void;
  nudgeLoopEdge: (edge: "start" | "end", deltaSec: number) => void;
  bumpTempo: (delta: number) => void;
  /** Sets active loop tempo from UI percent slider (25–150). No-op without active loop. */
  setActiveLoopTempoFromPercent: (percent: number) => void;
  setPendingLoopDrag: (
    bounds: WoodshedState["pendingLoopDrag"],
  ) => void;
  activeLoopTemps: () => number;
  setActiveSegmentId: (id: string | null) => void;
  selectSegment: (phraseId: string, segmentId: string) => void;
  setLoopNotes: (phraseId: string, notes: string) => void;
  addSegment: (phraseId: string) => void;
  updateSegment: (
    phraseId: string,
    segmentId: string,
    patch: Partial<
      Pick<PhraseSegment, "name" | "startTime" | "endTime" | "notes">
    >,
  ) => void;
  removeSegment: (phraseId: string, segmentId: string) => void;
  /**
   * Desktop: allow or forbid waveform handle editing for this focus region.
   * `false` removes the id from the sparse unlock map (locked).
   */
  setFocusRegionWaveformEditUnlocked: (
    segmentId: string,
    unlocked: boolean,
  ) => void;
  /**
   * Desktop: phrase waveform boundary lock (mirrors focus-region waveform control).
   * Unlock sets this as the only unlocked phrase and aligns `editableLoopId`.
   */
  setPhraseWaveformEditUnlocked: (loopId: string, unlocked: boolean) => void;
  requestInspectorSegmentFieldFocus: () => void;
  /**
   * After project hydration — restore validated practice prefs (loop mode, focus map).
   * Does not replace loops; call after `upsertLoops` + `selectLoop`.
   */
  applyHydratedPracticePreferences: (prefs: {
    loopPlaybackEnabled: boolean;
    loopPracticeScope: LoopPracticeScope;
    activeSegmentId: string | null;
    lastPracticeSegmentIdByPhrase: Record<string, string>;
  }) => void;
};

export type WoodshedStore = WoodshedState & WoodshedActions;

const initialState: WoodshedState = {
  projectId: null,
  projectName: "Untitled session",
  duration: 0,
  loops: [],
  activeLoopId: null,
  editableLoopId: null,
  isPlaying: false,
  currentTime: 0,
  loopPlaybackEnabled: false,
  loopPracticeScope: "phrase",
  minPxPerSec: 50,
  hoverTime: null,
  viewportMode: "follow",
  loopFocusTick: 0,
  pendingLoopDrag: null,
  activeSegmentId: null,
  inspectorFocusRequestId: 0,
  lastPracticeSegmentIdByPhrase: {},
  focusRegionWaveformEditUnlockedById: {},
  phraseWaveformEditUnlockedById: {},
};

function clampUi(value: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, value));
}

export const useWoodshedStore = create<WoodshedStore>((set, get) => ({
  ...initialState,
  resetWorkspace: () =>
    set({
      ...initialState,
      activeSegmentId: null,
      loopPracticeScope: "phrase",
      inspectorFocusRequestId: 0,
      lastPracticeSegmentIdByPhrase: {},
      focusRegionWaveformEditUnlockedById: {},
      phraseWaveformEditUnlockedById: {},
    }),
  bootstrapFromDuration: (duration) => {
    const loop = createInitialLoop(duration);
    set((state) => ({
      duration,
      loops: [loop],
      activeLoopId: loop.id,
      /** Bootstrap loops are brand-new — start in draft so the user can refine immediately. */
      editableLoopId: loop.id,
      phraseWaveformEditUnlockedById: { [loop.id]: true },
      loopPlaybackEnabled: true,
      loopPracticeScope: "phrase",
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
      ...(!loopPlaybackEnabled
        ? { viewportMode: "follow" as const, loopPracticeScope: "phrase" as const }
        : {}),
    }),
  setLoopPracticeScope: (loopPracticeScope) => set({ loopPracticeScope }),
  cycleLoopPlaybackMode: () =>
    set((s) => {
      const loop = s.activeLoopId
        ? s.loops.find((l) => l.id === s.activeLoopId)
        : undefined;
      const canEnable = Boolean(loop && loop.end > loop.start);
      if (!canEnable || !loop) return {};

      const phraseHasFocusRegions = Boolean(loop.segments?.length);

      if (!phraseHasFocusRegions) {
        if (s.loopPlaybackEnabled) {
          return {
            loopPlaybackEnabled: false,
            viewportMode: "follow" as const,
            loopPracticeScope: "phrase" as const,
          };
        }
        return {
          loopPlaybackEnabled: true,
          loopPracticeScope: "phrase" as const,
        };
      }

      if (!s.loopPlaybackEnabled) {
        return {
          loopPlaybackEnabled: true,
          loopPracticeScope: "phrase" as const,
        };
      }
      if (s.loopPracticeScope === "phrase") {
        return { loopPracticeScope: "practice_region" as const };
      }
      return {
        loopPlaybackEnabled: false,
        viewportMode: "follow" as const,
        loopPracticeScope: "phrase" as const,
      };
    }),
  setMinPxPerSec: (minPxPerSec) =>
    set({ minPxPerSec: Math.max(4, Math.min(1500, minPxPerSec)) }),
  setHoverTime: (hoverTime) => set({ hoverTime }),
  setViewportMode: (viewportMode) => set({ viewportMode }),
  exitPhraseFitAfterUserNavigation: () =>
    set((s) =>
      s.viewportMode === "phrase-focus"
        ? {
            viewportMode: s.loopPlaybackEnabled
              ? ("manual" as const)
              : ("follow" as const),
          }
        : {},
    ),
  /**
   * Bulk-load (project hydration). Loaded loops are always treated as "saved" —
   * any in-flight edit/draft state is cleared so the user enters practice mode.
   */
  upsertLoops: (loops) =>
    set({
      loops: loops.map((l) => ({
        ...l,
        segments: l.segments?.length
          ? clampSegmentsToPhraseBounds(l.segments, l.start, l.end)
          : l.segments,
      })),
      editableLoopId: null,
      activeSegmentId: null,
      loopPracticeScope: "phrase",
      inspectorFocusRequestId: 0,
      lastPracticeSegmentIdByPhrase: {},
      focusRegionWaveformEditUnlockedById: {},
      phraseWaveformEditUnlockedById: {},
    }),
  addLoopCandidate: (nameOverride) => {
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
    const defaultName = `Section ${loops.length + 1}`;
    const label =
      typeof nameOverride === "string" && nameOverride.trim()
        ? nameOverride.trim()
        : defaultName;
    const created = loopFromBounds(start, end, duration, label);
    set((state) => ({
      loops: [...loops, created],
      activeLoopId: created.id,
      /** Brand-new loop → enter draft so the user can shape it immediately. */
      editableLoopId: created.id,
      phraseWaveformEditUnlockedById: { [created.id]: true },
      loopPlaybackEnabled: true,
      loopPracticeScope: "phrase",
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
      /** Brand-new loop → enter draft so the user can shape it immediately. */
      editableLoopId: phrase.id,
      phraseWaveformEditUnlockedById: { [phrase.id]: true },
      loopPlaybackEnabled: true,
      loopPracticeScope: "phrase",
      loopFocusTick: s.loopFocusTick + 1,
    }));
    return phrase;
  },
  createPhraseFromShiftDrag: (startSec, endSec) => {
    const { duration } = get();
    if (!duration) return null;
    const phrase = loopFromBounds(
      startSec,
      endSec,
      duration,
      "New Phrase",
    );
    set((s) => ({
      loops: [...s.loops, phrase],
      activeLoopId: phrase.id,
      editableLoopId: phrase.id,
      phraseWaveformEditUnlockedById: { [phrase.id]: true },
      loopPlaybackEnabled: true,
      loopPracticeScope: "phrase" as const,
      activeSegmentId: null,
      loopFocusTick: s.loopFocusTick + 1,
    }));
    return phrase;
  },
  createFocusSegmentFromShiftDrag: ({ phraseId, startSec, endSec }) => {
    const { duration, loops } = get();
    if (!duration) return null;
    const loop = loops.find((l) => l.id === phraseId);
    if (!loop || loop.end <= loop.start) return null;
    let lo = Math.min(startSec, endSec);
    let hi = Math.max(startSec, endSec);
    lo = Math.max(loop.start, Math.min(lo, loop.end));
    hi = Math.min(loop.end, Math.max(hi, loop.start));
    const phraseSpan = loop.end - loop.start;
    const minSpan = Math.min(
      0.05,
      Math.max(duration * 0.001, phraseSpan * 0.001),
    );
    if (hi - lo < minSpan) {
      hi = Math.min(loop.end, lo + minSpan);
    }
    const raw = phraseSegmentFromBounds(
      phraseId,
      lo,
      hi,
      "New Focus Loop",
    );
    const existing = loop.segments ?? [];
    const merged = clampSegmentsToPhraseBounds(
      [...existing, raw],
      loop.start,
      loop.end,
    );
    const created = merged.find((seg) => seg.id === raw.id);
    if (!created) return null;
    set((s) => {
      const nextPhraseUnlock = { ...s.phraseWaveformEditUnlockedById };
      delete nextPhraseUnlock[phraseId];
      return {
        loops: s.loops.map((l) =>
          l.id === phraseId ? { ...l, segments: merged } : l,
        ),
        activeLoopId: phraseId,
        activeSegmentId: created.id,
        editableLoopId: null,
        phraseWaveformEditUnlockedById: nextPhraseUnlock,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region" as const,
        loopFocusTick: s.loopFocusTick + 1,
        lastPracticeSegmentIdByPhrase: {
          ...s.lastPracticeSegmentIdByPhrase,
          [phraseId]: created.id,
        },
        focusRegionWaveformEditUnlockedById: {
          ...s.focusRegionWaveformEditUnlockedById,
          [created.id]: true,
        },
      };
    });
    return { seekTo: created.startTime };
  },
  selectLoop: (activeLoopId) =>
    set((s) => {
      /**
       * Selection auto-finalizes any other loop in edit mode — practice is separate from editing.
       * Re-selecting the currently editable loop preserves edit mode (lets the user click between
       * the draft and the sidebar without losing their work).
       */
      const nextEditable =
        activeLoopId !== null && activeLoopId === s.editableLoopId
          ? s.editableLoopId
          : null;
      if (activeLoopId === null) {
        return {
          activeLoopId: null,
          editableLoopId: nextEditable,
          loopPlaybackEnabled: false,
          viewportMode: "follow",
          loopFocusTick: s.loopFocusTick + 1,
          activeSegmentId: null,
          loopPracticeScope: "phrase",
          phraseWaveformEditUnlockedById: {},
        };
      }
      const loop = s.loops.find((l) => l.id === activeLoopId);
      const playback = Boolean(loop && loop.end > loop.start);
      const hasRegions = Boolean(loop?.segments?.length);
      const keepSegment =
        s.activeSegmentId &&
        loop?.segments?.some((seg) => seg.id === s.activeSegmentId);
      const loopPracticeScope =
        keepSegment && hasRegions
          ? s.loopPracticeScope
          : "phrase";
      const nextPhraseUnlock: Record<string, true> = {};
      if (
        nextEditable != null &&
        activeLoopId === nextEditable &&
        s.phraseWaveformEditUnlockedById[activeLoopId]
      ) {
        nextPhraseUnlock[activeLoopId] = true;
      }
      return {
        activeLoopId,
        editableLoopId: nextEditable,
        loopPlaybackEnabled: playback,
        loopFocusTick: playback ? s.loopFocusTick + 1 : s.loopFocusTick,
        activeSegmentId: keepSegment ? s.activeSegmentId : null,
        loopPracticeScope,
        phraseWaveformEditUnlockedById: nextPhraseUnlock,
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
    const startSec = Math.max(0, Math.min(start, end));
    let e = Math.min(duration, Math.max(start, end));
    const minSpan = Math.min(0.05, duration * 0.001);
    if (e - startSec < minSpan) e = Math.min(duration, startSec + minSpan);

    set((state) => ({
      loops: state.loops.map((l) => {
        if (l.id !== id) return l;
        const nextSeg =
          l.segments !== undefined
            ? clampSegmentsToPhraseBounds(l.segments, startSec, e)
            : undefined;
        return {
          ...l,
          start: startSec,
          end: e,
          ...(nextSeg !== undefined ? { segments: nextSeg } : {}),
        };
      }),
    }));
  },
  removeLoop: (id) =>
    set((s) => {
      const pruneLast = (m: Record<string, string>) => {
        const next = { ...m };
        delete next[id];
        return next;
      };
      const removedLoop = s.loops.find((l) => l.id === id);
      const pruneUnlockForLoop = (m: Record<string, true>) => {
        const segIds = removedLoop?.segments?.map((x) => x.id) ?? [];
        if (!segIds.length) return m;
        const next = { ...m };
        for (const sid of segIds) delete next[sid];
        return next;
      };
      const next = s.loops.filter((l) => l.id !== id);
      const activeRemoved = s.activeLoopId === id;
      /** If the editable loop got removed, exit edit mode. */
      const editableRemoved = s.editableLoopId === id;
      const nextActive = activeRemoved ? next[0]?.id ?? null : s.activeLoopId;
      const nextEditable = editableRemoved ? null : s.editableLoopId;
      if (next.length === 0) {
        return {
          loops: next,
          activeLoopId: null,
          editableLoopId: null,
          loopPlaybackEnabled: false,
          viewportMode: "follow",
          activeSegmentId: null,
          loopPracticeScope: "phrase",
          lastPracticeSegmentIdByPhrase: {},
          focusRegionWaveformEditUnlockedById: {},
          phraseWaveformEditUnlockedById: {},
        };
      }
      if (!activeRemoved) {
        const removedHadActiveSegment = s.loops
          .find((l) => l.id === id)
          ?.segments?.some((seg) => seg.id === s.activeSegmentId);
        const nextPhrase = { ...s.phraseWaveformEditUnlockedById };
        delete nextPhrase[id];
        return {
          loops: next,
          activeLoopId: nextActive,
          editableLoopId: nextEditable,
          activeSegmentId: removedHadActiveSegment ? null : s.activeSegmentId,
          loopPracticeScope: removedHadActiveSegment
            ? ("phrase" as const)
            : s.loopPracticeScope,
          lastPracticeSegmentIdByPhrase: pruneLast(
            s.lastPracticeSegmentIdByPhrase,
          ),
          focusRegionWaveformEditUnlockedById: pruneUnlockForLoop(
            s.focusRegionWaveformEditUnlockedById,
          ),
          phraseWaveformEditUnlockedById: nextPhrase,
        };
      }
      const naLoop = nextActive
        ? next.find((l) => l.id === nextActive)
        : undefined;
      const playback = Boolean(naLoop && naLoop.end > naLoop.start);
      const nextPhrase = { ...s.phraseWaveformEditUnlockedById };
      delete nextPhrase[id];
      return {
        loops: next,
        activeLoopId: nextActive,
        editableLoopId: nextEditable,
        loopPlaybackEnabled: playback,
        loopFocusTick: playback ? s.loopFocusTick + 1 : s.loopFocusTick,
        activeSegmentId: null,
        loopPracticeScope: "phrase",
        lastPracticeSegmentIdByPhrase: pruneLast(
          s.lastPracticeSegmentIdByPhrase,
        ),
        focusRegionWaveformEditUnlockedById: pruneUnlockForLoop(
          s.focusRegionWaveformEditUnlockedById,
        ),
        phraseWaveformEditUnlockedById: nextPhrase,
        ...(!playback ? { viewportMode: "follow" as const } : {}),
      };
    }),
  setEditableLoopId: (id) =>
    set((s) => {
      if (id === null) {
        const prev = s.editableLoopId;
        const nextPhrase = { ...s.phraseWaveformEditUnlockedById };
        if (prev) delete nextPhrase[prev];
        return { editableLoopId: null, phraseWaveformEditUnlockedById: nextPhrase };
      }
      const exists = s.loops.some((l) => l.id === id);
      if (!exists) return {};
      return {
        editableLoopId: id,
        phraseWaveformEditUnlockedById: { [id]: true },
      };
    }),
  nudgeLoopEdge: (edge, deltaSec) => {
    const { activeLoopId, loops, duration, phraseWaveformEditUnlockedById, activeSegmentId } =
      get();
    if (!activeLoopId || !duration) return;
    if (!phraseWaveformEditUnlockedById[activeLoopId]) return;
    const loop = loops.find((l) => l.id === activeLoopId);
    if (!loop) return;
    const focusRegionDetailActive = Boolean(
      activeSegmentId &&
        loop.segments?.some((s) => s.id === activeSegmentId),
    );
    if (focusRegionDetailActive) return;
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
  setActiveSegmentId: (activeSegmentId) =>
    set((s) => {
      if (!activeSegmentId) {
        return { activeSegmentId: null };
      }
      const next: Partial<WoodshedState> = { activeSegmentId };
      if (s.activeLoopId) {
        next.lastPracticeSegmentIdByPhrase = {
          ...s.lastPracticeSegmentIdByPhrase,
          [s.activeLoopId]: activeSegmentId,
        };
      }
      return next;
    }),
  selectSegment: (phraseId, segmentId) =>
    set((s) => {
      const loop = s.loops.find((l) => l.id === phraseId);
      if (!loop?.segments?.some((seg) => seg.id === segmentId)) {
        return {};
      }
      const playback = Boolean(loop.end > loop.start);
      const nextEditable =
        phraseId === s.editableLoopId ? s.editableLoopId : null;
      return {
        activeLoopId: phraseId,
        activeSegmentId: segmentId,
        editableLoopId: nextEditable,
        loopPlaybackEnabled: playback,
        loopFocusTick: playback ? s.loopFocusTick + 1 : s.loopFocusTick,
        loopPracticeScope: s.loopPracticeScope,
        lastPracticeSegmentIdByPhrase: {
          ...s.lastPracticeSegmentIdByPhrase,
          [phraseId]: segmentId,
        },
        ...(!playback ? { viewportMode: "follow" as const } : {}),
      };
    }),
  setLoopNotes: (phraseId, notes) =>
    set((s) => ({
      loops: s.loops.map((l) =>
        l.id === phraseId ? { ...l, notes } : l,
      ),
    })),
  addSegment: (phraseId) =>
    set((s) => {
      const loop = s.loops.find((l) => l.id === phraseId);
      if (!loop || loop.end <= loop.start) return {};
      const existing = loop.segments ?? [];
      const created = createSegmentInPhrase(
        phraseId,
        loop.start,
        loop.end,
        existing.length + 1,
      );
      return {
        loops: s.loops.map((l) =>
          l.id === phraseId
            ? { ...l, segments: [...existing, created] }
            : l,
        ),
        activeSegmentId: created.id,
        activeLoopId: phraseId,
        loopPracticeScope: s.loopPracticeScope,
        lastPracticeSegmentIdByPhrase: {
          ...s.lastPracticeSegmentIdByPhrase,
          [phraseId]: created.id,
        },
        focusRegionWaveformEditUnlockedById: {
          ...s.focusRegionWaveformEditUnlockedById,
          [created.id]: true,
        },
      };
    }),
  updateSegment: (phraseId, segmentId, patch) =>
    set((s) => {
      const loop = s.loops.find((l) => l.id === phraseId);
      if (!loop) return {};
      const segs = loop.segments ?? [];
      const t = Date.now();
      const nextSegs = segs.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const merged = { ...seg, ...patch, updatedAt: t };
        const s0 = Math.min(merged.startTime, merged.endTime);
        const s1 = Math.max(merged.startTime, merged.endTime);
        return {
          ...merged,
          startTime: s0,
          endTime: s1,
        };
      });
      const clamped = clampSegmentsToPhraseBounds(
        nextSegs,
        loop.start,
        loop.end,
      );
      return {
        loops: s.loops.map((l) =>
          l.id === phraseId ? { ...l, segments: clamped } : l,
        ),
      };
    }),
  removeSegment: (phraseId, segmentId) =>
    set((s) => {
      const loop = s.loops.find((l) => l.id === phraseId);
      const prevSegs = loop?.segments ?? [];
      const nextSegs = prevSegs.filter((x) => x.id !== segmentId);
      const cleared = s.activeSegmentId === segmentId;
      const nextLast = { ...s.lastPracticeSegmentIdByPhrase };
      if (nextLast[phraseId] === segmentId) {
        const fallback = nextSegs[0]?.id;
        if (fallback) nextLast[phraseId] = fallback;
        else delete nextLast[phraseId];
      }
      let loopPracticeScope = s.loopPracticeScope;
      if (nextSegs.length === 0) {
        loopPracticeScope = "phrase";
      }
      const nextUnlock = { ...s.focusRegionWaveformEditUnlockedById };
      delete nextUnlock[segmentId];
      return {
        loops: s.loops.map((l) =>
          l.id === phraseId ? { ...l, segments: nextSegs } : l,
        ),
        activeSegmentId: cleared ? null : s.activeSegmentId,
        loopPracticeScope,
        lastPracticeSegmentIdByPhrase: nextLast,
        focusRegionWaveformEditUnlockedById: nextUnlock,
      };
    }),
  setFocusRegionWaveformEditUnlocked: (segmentId, unlocked) =>
    set((s) => {
      const next = { ...s.focusRegionWaveformEditUnlockedById };
      if (unlocked) next[segmentId] = true;
      else delete next[segmentId];
      return { focusRegionWaveformEditUnlockedById: next };
    }),
  setPhraseWaveformEditUnlocked: (loopId, unlocked) =>
    set((s) => {
      if (!s.loops.some((l) => l.id === loopId)) return {};
      if (unlocked) {
        return {
          phraseWaveformEditUnlockedById: { [loopId]: true },
          editableLoopId: loopId,
        };
      }
      const next = { ...s.phraseWaveformEditUnlockedById };
      delete next[loopId];
      const nextEditable = s.editableLoopId === loopId ? null : s.editableLoopId;
      return {
        phraseWaveformEditUnlockedById: next,
        editableLoopId: nextEditable,
      };
    }),
  requestInspectorSegmentFieldFocus: () =>
    set((s) => ({
      inspectorFocusRequestId: s.inspectorFocusRequestId + 1,
    })),
  applyHydratedPracticePreferences: (prefs) =>
    set((s) => {
      const activeId = s.activeLoopId;
      const loop = activeId ? s.loops.find((l) => l.id === activeId) : undefined;
      const playbackOk = Boolean(loop && loop.end > loop.start);
      const loopPlaybackEnabled = prefs.loopPlaybackEnabled && playbackOk;
      let loopPracticeScope = prefs.loopPracticeScope;
      let activeSegmentId = prefs.activeSegmentId;
      const lastPracticeSegmentIdByPhrase = {
        ...prefs.lastPracticeSegmentIdByPhrase,
      };

      if (loopPracticeScope === "practice_region" && !loop?.segments?.length) {
        loopPracticeScope = "phrase";
      }
      if (
        activeSegmentId &&
        !loop?.segments?.some((seg) => seg.id === activeSegmentId)
      ) {
        activeSegmentId = null;
      }

      if (!loopPlaybackEnabled) {
        return {
          loopPlaybackEnabled: false,
          loopPracticeScope: "phrase" as const,
          activeSegmentId,
          lastPracticeSegmentIdByPhrase,
          viewportMode: "follow" as const,
        };
      }

      return {
        loopPlaybackEnabled: true,
        loopPracticeScope,
        activeSegmentId,
        lastPracticeSegmentIdByPhrase,
        loopFocusTick: playbackOk ? s.loopFocusTick + 1 : s.loopFocusTick,
      };
    }),
}));

function clampTime(value: number, duration: number) {
  return Math.min(duration, Math.max(0, value));
}
