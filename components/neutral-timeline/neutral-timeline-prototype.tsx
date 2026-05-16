"use client";

/**
 * Synthetic (neutral) timeline — ruler + faux waveform + overlays (non-upload sources).
 *
 * **WaveSurfer vs synthetic:** RegionsPlugin uses decoded waveform pixels; this strip maps
 * **pointer X → seconds** via `pointerClientToSeconds` only. Timeline **content width** ends at `duration`
 * (`timelineSongContentWidthPx`) — no decorative extension past the song. Playback progress is conveyed
 * on the **synthetic helix stroke** (`SyntheticWaveBedCanvas`: played brighter / unplayed subdued), not via
 * full-height overlays.
 * Bounds clamping matches store expectations (`updateLoopBounds`, `updateSegment`, `clampSegmentsToPhraseBounds`).
 *
 * **Uploaded-audio parity (when `authoring.enabled`):**
 * - Plain click+drag on the strip = **pan/scroll** (like the main waveform).
 * - **Shift+drag** uses the same rule as `shiftDragShouldCreateFocusInsideActivePhrase`; when
 *   `phraseWaveformEditUnlockedById` is supplied (YouTube/desktop parity), commits only while the
 *   active Practice Section waveform is unlocked in the store (`editableLoopId` / transport lock).
 * - Practice Mode (`structural`): **double‑click** a Practice Section shell (outside the focus drill lane)
 *   or a Focus Loop rect unlocks waveform handles (`enterPracticeSectionStructuralEdit` /
 *   `enterFocusLoopStructuralEdit`) — single click stays selection-only (when unlock maps wired).
 * - Region `pointerdown` handlers `stopPropagation` so pan/shift-draft never steals phrase/focus edits.
 * - Phrase / focus boundaries follow optional unlock maps mirroring WaveSurfer (see authoring type).
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { PracticeLoop, PhraseSegment } from "@/lib/loop-engine";
import { cn } from "@/lib/utils";

import {
  pickMajorTickIntervalSec,
  pointerClientToSeconds,
  scrollHostContentLeftClientX,
  secondsToContentPx,
  timelineSongContentWidthPx,
} from "@/components/neutral-timeline/timeline-coordinates";
import { SyntheticWaveBedCanvas } from "@/components/neutral-timeline/synthetic-wave-bed-canvas";
import {
  clampPhraseMoveDelta,
  clampPhraseStartEnd,
  clampSegmentMoveDeltaInPhrase,
  clampSegmentStartEndInPhrase,
  minPhraseOrSegmentSpanSec,
  secondsDeltaFromPixelDelta,
} from "@/components/neutral-timeline/synthetic-timeline-regions";
import {
  shiftDragPhraseAuthoringAllowed,
  shiftDragShouldCreateFocusInsideActivePhrase,
} from "@/lib/shift-waveform-authoring";
import { applyNeutralTimelineWheelZoomAnchoredToCursor } from "@/lib/neutral-timeline-wheel-zoom";
import { resolvePracticeEditCompatibility } from "@/lib/interaction/practice-edit-mode";
import { deriveRegionVisualState, type RegionZIndexTier } from "@/lib/regions/region-visual-state";
import {
  enterFocusLoopStructuralEdit,
  enterPracticeSectionStructuralEdit,
  isStructuralPracticeMode,
} from "@/lib/woodshed-enter-region-edit";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type SyntheticTimelineAuthoringConfig = {
  enabled: boolean;
  /** Store’s active Practice Section (`activeLoopId`) — drives Shift+drag focus vs phrase decision. */
  activeLoopId: string | null;
  /**
   * When provided, mirrors desktop WaveSurfer gating (`phraseWaveformEditUnlockedById`).
   * Omitted ⇒ legacy parity strip (anything `enabled` implies is interactable).
   */
  phraseWaveformEditUnlockedById?: Record<string, true>;
  /**
   * When provided, mirrors desktop focus overlays (`focusRegionWaveformEditUnlockedById` + selection).
   * Omitted ⇒ legacy parity strip behavior.
   */
  focusRegionWaveformEditUnlockedById?: Record<string, true>;
  onShiftPhraseDragCreate: (startSec: number, endSec: number) => void;
  onShiftFocusDragCreate: (
    phraseId: string,
    startSec: number,
    endSec: number,
  ) => void;
  onSelectPhrase: (id: string) => void;
  onSelectFocus: (phraseId: string, segmentId: string) => void;
  /** YouTube parity: tap-to-seek anywhere on the timeline, including phrase/focus regions. */
  onPlaybackIntentTap?: (sec: number) => void;
  onPhraseBoundsCommit: (phraseId: string, startSec: number, endSec: number) => void;
  onSegmentBoundsCommit: (
    phraseId: string,
    segmentId: string,
    startSec: number,
    endSec: number,
  ) => void;
  /**
   * YouTube/global Practice Mode: when `enabled` is false, Shift+drag on **empty waveform
   * backdrop only** still starts a new Practice Section draft; commit enters Edit Mode via store.
   * Region hits never use this — must not steal in-phrase Shift+ authoring.
   */
  allowBackdropShiftPhraseDraftWhenPractice?: boolean;
  /**
   * Practice Mode: Shift+drag starting on a Practice Section body/strip still drafts a Focus Loop
   * inside that phrase (commits move the session into Edit Mode via the workspace).
   */
  allowInPhraseShiftFocusDraftWhenPractice?: boolean;
};

export type NeutralTimelinePrototypeProps = {
  duration: number;
  currentTime: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  loopPracticeScope?: LoopPracticeScope;
  pxPerSec: number;
  onPxPerSecChange: (nextPxPerSec: number) => void;
  onSeek: (seconds: number) => void;
  authoring?: SyntheticTimelineAuthoringConfig;
  /** Tighter padding + faux-wave cap for phone-width YouTube shell */
  compactLayout?: boolean;
  /**
   * Raise the faux-waveform band cap so flex growth reclaims vertical space (desktop shells).
   */
  waveformBandMaxPx?: number;
  /** Chip / list hover — subtly links inspector focus pills to nested regions. */
  timelineHoverSegmentId?: string | null;
  /** Transport is actively playing — restrained playhead / chrome energy. */
  playbackActive?: boolean;
  /** Pointer over a Focus Loop region — links chips ↔ timeline bidirectionally. */
  onTimelineFocusSegmentHover?: (segmentId: string | null) => void;
};

const RULER_H = 36;
/** Initial faux-wave height before `ResizeObserver` measures the waveform column (WaveSurfer-like fill). */
const TRACK_BAND_PX_DEFAULT = 148;
const TRACK_BAND_MIN_PX = 92;
const TRACK_BAND_MAX_PX = 560;
const PAN_SLOP_PX = 4;
/** Draft phrase ghost height hint (fraction of track). Focus ghost is vertically centered inside the lane. */
const PHRASE_GHOST_VERTICAL_FRAC = 0.2;
const TRACK_VERTICAL_GUTTER_PX = 6;

const TRACK_BAND_MAX_COMPACT_PX = 118;

const noop = () => {};
const noopNum2 = (_a: number, _b: number) => {};
const noopPhraseFocus = (_p: string, _a: number, _b: number) => {};
const noopSelectFocus = (_p: string, _s: string) => {};
const noopSeg = (_pi: string, _si: string, _a: number, _b: number) => {};
const noopPhraseCommit = (_id: string, _a: number, _b: number) => {};
const noopSelectPhrase = (_id: string) => {};
const NOOP_AUTHORING_CTX: SyntheticTimelineAuthoringConfig = {
  enabled: false,
  activeLoopId: null,
  phraseWaveformEditUnlockedById: undefined,
  focusRegionWaveformEditUnlockedById: undefined,
  onShiftPhraseDragCreate: noopNum2,
  onShiftFocusDragCreate: noopPhraseFocus,
  onSelectPhrase: noopSelectPhrase,
  onSelectFocus: noopSelectFocus,
  onPhraseBoundsCommit: noopPhraseCommit,
  onSegmentBoundsCommit: noopSeg,
};

function neutralPhraseZ(tier: RegionZIndexTier, paintIx: number): number {
  switch (tier) {
    case "section_editing_foreground":
      return 28 + paintIx;
    case "section_active_foreground":
      return 26 + paintIx;
    case "section_editing_context":
      return 14 + paintIx;
    case "section_active_context":
      return 12 + paintIx;
    default:
      return 10 + paintIx;
  }
}

function neutralFocusZ(tier: RegionZIndexTier): number {
  switch (tier) {
    case "focus_editing_foreground":
      return 36;
    case "focus_active_foreground":
      return 34;
    case "focus_inactive_foreground":
      return 33;
    case "focus_editing_context":
      return 33;
    case "focus_active_context":
      return 32;
    default:
      return 31;
  }
}

type Gesture =
  | {
      mode: "pan";
      pid: number;
      ax: number;
      sl: number;
      moved: boolean;
    }
  | {
      mode: "draftShift";
      pid: number;
      aSec: number;
      ax: number;
      moved: boolean;
      /**
       * When set — Shift+drag began on this Practice Section overlay (body/strip).
       * Targets that phrase regardless of stale `SyntheticTimelineAuthoringConfig.activeLoopId`
       * in the gesture closure.
       */
      phraseId?: string;
      /**
       * Started from backdrop in Practice Mode — phrase draft only (no Focus Loop preview/commit).
       */
      backdropPhraseDraftOnly?: boolean;
      /**
       * Practice Mode: Shift+drag on phrase chrome — bypass unlock-map gating (commit still creates region).
       */
      practicePhraseShiftBypass?: boolean;
    }
  | {
      mode: "phraseMove";
      pid: number;
      id: string;
      s0: number;
      e0: number;
      ax: number;
      moved: boolean;
    }
  | {
      mode: "phraseRs";
      pid: number;
      id: string;
      s0: number;
      e0: number;
      edge: "start" | "end";
      ax: number;
      moved: boolean;
    }
  | {
      mode: "segMove" | "segRsStart" | "segRsEnd";
      pid: number;
      phraseId: string;
      segId: string;
      phraseS: number;
      phraseE: number;
      segS: number;
      segE: number;
      ax: number;
      moved: boolean;
    };

/** Phrase for Shift-draft geometry + commits (`phraseId` pins overlay-originated drafts). */
function resolveDraftShiftPhraseLoop(
  g: Extract<Gesture, { mode: "draftShift" }>,
  ctx: SyntheticTimelineAuthoringConfig,
  loops: PracticeLoop[],
): PracticeLoop | undefined {
  const phraseId = g.phraseId ?? ctx.activeLoopId;
  if (phraseId == null) return undefined;
  return loops.find((p) => p.id === phraseId);
}

/** Phrase overlays wide → narrow so nested sections stack like WaveSurfer z-order intuition. */
function loopsForPhrasePaint(loopsInput: PracticeLoop[]): PracticeLoop[] {
  return [...loopsInput].sort(
    (a, b) => b.end - b.start - (a.end - a.start),
  );
}

function fmtRuler(seconds: number): string {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) return "0:00";
  const fl = Math.floor(seconds);
  const m = Math.floor(fl / 60);
  const s = fl % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const NeutralTimelinePrototype = memo(function NeutralTimelinePrototype(
  props: NeutralTimelinePrototypeProps,
) {
  const {
    duration,
    currentTime,
    loops,
    activeLoopId,
    activeSegmentId,
    loopPracticeScope = "phrase",
    pxPerSec,
    onPxPerSecChange,
    onSeek,
    authoring,
    compactLayout = false,
    waveformBandMaxPx,
    timelineHoverSegmentId = null,
    playbackActive = false,
    onTimelineFocusSegmentHover,
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const ghostPhraseRef = useRef<[number, number] | null>(null);
  const ghostFocusRef = useRef<[number, number] | null>(null);
  /** Fresh duration / zoom / phrases for in-flight gestures (handlers must not snapshot stale loops). */
  const liveRef = useRef({
    duration: 0 as number,
    pxPerSec: 1 as number,
    loops: [] as PracticeLoop[],
    activeLoopId: null as string | null,
  });

  liveRef.current.duration = duration;
  liveRef.current.pxPerSec = pxPerSec;
  liveRef.current.loops = loops;
  liveRef.current.activeLoopId = activeLoopId;

  const gestureUnhookRef = useRef<(() => void) | null>(null);

  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [ghostNonce, setGhostTick] = useState(0);
  const bumpGhost = useCallback(() => setGhostTick((n) => n + 1), []);

  /** Faux waveform band height fills the waveform column minus the ruler row (desktop WaveSurfer parity). */
  const [trackBandPx, setTrackBandPx] = useState(TRACK_BAND_PX_DEFAULT);

  const auth = authoring;
  /** True when authoring config is wired (YouTube/upload neutral path — selection overlay). */
  const phraseOverlayActive = Boolean(auth);
  const phraseUnlockMapProvided = auth?.phraseWaveformEditUnlockedById !== undefined;
  const focusUnlockMapProvided = auth?.focusRegionWaveformEditUnlockedById !== undefined;
  const practiceEditCompatibility = useMemo(() => {
    if (!auth) {
      return resolvePracticeEditCompatibility({
        editableLoopId: null,
        phraseWaveformEditUnlockedById: {},
        focusRegionWaveformEditUnlockedById: {},
      });
    }
    const phraseUnlockMap = auth.phraseWaveformEditUnlockedById ?? {};
    const focusUnlockMap = auth.focusRegionWaveformEditUnlockedById ?? {};
    const editableLoopId =
      auth.enabled && auth.activeLoopId ? auth.activeLoopId : null;
    return resolvePracticeEditCompatibility({
      editableLoopId,
      phraseWaveformEditUnlockedById: phraseUnlockMap,
      focusRegionWaveformEditUnlockedById: focusUnlockMap,
    });
  }, [auth]);

  const phraseBoundaryEditable = useCallback(
    (loopId: string) => {
      if (!phraseUnlockMapProvided) return true;
      return Boolean(auth?.phraseWaveformEditUnlockedById?.[loopId]);
    },
    [auth?.phraseWaveformEditUnlockedById, phraseUnlockMapProvided],
  );

  const focusSegmentBoundaryEditable = useCallback(
    (segmentId: string) => {
      if (!focusUnlockMapProvided) return true;
      if (segmentId !== activeSegmentId) return false;
      return Boolean(auth?.focusRegionWaveformEditUnlockedById?.[segmentId]);
    },
    [
      activeSegmentId,
      auth?.focusRegionWaveformEditUnlockedById,
      focusUnlockMapProvided,
    ],
  );

  /** Song-space width only — waveform/ruler/phrases end where the media ends (no faux viewport padding). */
  const timelineSongWidthPx = useMemo(
    () =>
      !(duration > 0)
        ? 1
        : timelineSongContentWidthPx(duration, pxPerSec),
    [duration, pxPerSec],
  );

  /** Elapsed corridor in layout px — clamps to `[0, timelineSongWidthPx]` (feeds waveform progress stroke). */
  const syntheticPlayedTimelinePx = useMemo(() => {
    if (!(duration > 0)) return 0;
    const t = Math.min(Math.max(currentTime, 0), duration);
    const raw = secondsToContentPx(t, pxPerSec);
    return Math.min(timelineSongWidthPx, Math.max(0, raw));
  }, [currentTime, duration, pxPerSec, timelineSongWidthPx]);

  const tickMajorSec = useMemo(() => pickMajorTickIntervalSec(pxPerSec), [pxPerSec]);
  const tickMarks = useMemo(() => {
    if (!(duration > 0)) return [];
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += tickMajorSec) {
      out.push(Math.min(t, duration));
    }
    return out;
  }, [duration, tickMajorSec]);



  const orderedLoopsPhrasePaint = useMemo(
    () => loopsForPhrasePaint(loops),
    [loops],
  );

  const refreshScrollMetrics = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollMetrics({
      scrollLeft: el.scrollLeft,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    refreshScrollMetrics();
    const onScroll = () => refreshScrollMetrics();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [refreshScrollMetrics, timelineSongWidthPx, duration]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !(duration > 0)) return;
    const wheel = (event: WheelEvent) => {
      applyNeutralTimelineWheelZoomAnchoredToCursor({
        scrollEl: el,
        durationSec: duration,
        pxPerSec,
        event,
        onPxPerSecChange,
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [duration, pxPerSec, onPxPerSecChange]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const defaultMax = compactLayout ? TRACK_BAND_MAX_COMPACT_PX : TRACK_BAND_MAX_PX;
      const bandMax =
        typeof waveformBandMaxPx === "number" && waveformBandMaxPx > 0
          ? waveformBandMaxPx
          : defaultMax;
      const usable = Math.floor(el.clientHeight - RULER_H - 12);
      const next = Math.min(
        bandMax,
        Math.max(TRACK_BAND_MIN_PX, usable),
      );
      setTrackBandPx((prev) => (prev === next ? prev : next));
      refreshScrollMetrics();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compactLayout, refreshScrollMetrics, waveformBandMaxPx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !(duration > 0)) return;
    const px = secondsToContentPx(currentTime, pxPerSec);
    const visibleStart = el.scrollLeft;
    const visibleEnd = visibleStart + el.clientWidth;
    const pad = el.clientWidth * 0.18;
    if (px < visibleStart + pad) {
      el.scrollLeft = Math.max(0, px - pad * 2);
    } else if (px > visibleEnd - pad) {
      el.scrollLeft = Math.max(
        0,
        Math.min(el.scrollWidth - el.clientWidth, px - el.clientWidth + pad * 2),
      );
    }
    refreshScrollMetrics();
  }, [currentTime, duration, pxPerSec, refreshScrollMetrics]);

  /** Teardown stray window listeners if the scrub surface unmounts mid-gesture. */
  useEffect(
    () => () => {
      gestureUnhookRef.current?.();
      gestureUnhookRef.current = null;
    },
    [],
  );

  const secsFromClient = useCallback((clientX: number) => {
    const live = liveRef.current;
    const el = scrollRef.current;
    if (!el || !(live.duration > 0)) return 0;
    return pointerClientToSeconds({
      clientX,
      scrollHostLeft: scrollHostContentLeftClientX(el),
      scrollLeft: el.scrollLeft,
      pxPerSec: live.pxPerSec,
      durationSec: live.duration,
    });
  }, []);

  const rulerIgnored = useCallback((node: EventTarget | null) => {
    return !!(node instanceof Element && node.closest('[data-neutral-timeline-zoom="true"]'));
  }, []);

  const bandAt = useCallback(
    (evt: Pick<ReactPointerEvent<Element>, "clientX" | "clientY">) => {
      const root = scrubRef.current;
      if (!root) return "outside" as const;
      const r = root.getBoundingClientRect();
      if (
        evt.clientY < r.top ||
        evt.clientY > r.bottom ||
        evt.clientX < r.left ||
        evt.clientX > r.right
      )
        return "outside" as const;
      const ry = evt.clientY - r.top - RULER_H;
      if (ry < 0) return "ruler" as const;
      if (ry > trackBandPx) return "outside" as const;
      /** Single waveform lane — scrub/pan authoring uses time only (focus vs phrase is decided elsewhere). */
      return "phrase" as const;
    },
    [trackBandPx],
  );

  const installGestureHooks = useCallback(
    (_gesture: Gesture, ctx: SyntheticTimelineAuthoringConfig) => {
      gestureUnhookRef.current?.();
      gestureUnhookRef.current = null;

      const move = (e: PointerEvent) => {
        const g = gestureRef.current;
        if (!g || e.pointerId !== g.pid) return;
        const live = liveRef.current;
        const secNow = secsFromClient(e.clientX);

        if (g.mode === "pan") {
          const el = scrollRef.current;
          if (!el) return;
          const dx = e.clientX - g.ax;
          if (Math.abs(dx) >= PAN_SLOP_PX) g.moved = true;
          if (g.moved) {
            el.scrollLeft = g.sl - dx;
            refreshScrollMetrics();
          }
          return;
        }

        if (g.mode === "draftShift") {
          const bdOnly = g.backdropPhraseDraftOnly === true;
          const practiceBypass = g.practicePhraseShiftBypass === true;
          if (!bdOnly && !practiceBypass) {
            const unlockPhraseId =
              g.phraseId !== undefined ? g.phraseId : ctx.activeLoopId;
            const shiftAllowed = shiftDragPhraseAuthoringAllowed({
              authoringEnabled: ctx.enabled,
              phraseWaveformEditUnlockedById: ctx.phraseWaveformEditUnlockedById,
              phraseId: unlockPhraseId,
            });
            if (!shiftAllowed) return;
          }
          if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
          if (!g.moved) return;
          const lo = Math.min(g.aSec, secNow);
          const hi = Math.max(g.aSec, secNow);

          if (bdOnly) {
            const c = clampPhraseStartEnd(lo, hi, live.duration);
            ghostPhraseRef.current = [c.start, c.end];
            ghostFocusRef.current = null;
            bumpGhost();
            return;
          }

          const activePhrase = resolveDraftShiftPhraseLoop(
            g,
            ctx,
            live.loops,
          );
          if (
            shiftDragShouldCreateFocusInsideActivePhrase(activePhrase, lo, hi) &&
            activePhrase
          ) {
            let loCl = Math.max(lo, activePhrase.start);
            let hiCl = Math.min(hi, activePhrase.end);
            if (!(hiCl > loCl)) {
              ghostFocusRef.current = null;
              ghostPhraseRef.current = null;
              bumpGhost();
              return;
            }
            const cl = clampSegmentStartEndInPhrase(
              loCl,
              hiCl,
              activePhrase.start,
              activePhrase.end,
            );
            ghostFocusRef.current = [cl.start, cl.end];
            ghostPhraseRef.current = null;
            bumpGhost();
            return;
          }
          const c = clampPhraseStartEnd(lo, hi, live.duration);
          ghostPhraseRef.current = [c.start, c.end];
          ghostFocusRef.current = null;
          bumpGhost();
          return;
        }

        if (!ctx.enabled) return;

        if (g.mode === "phraseMove") {
          const dx = e.clientX - g.ax;
          if (Math.abs(dx) >= PAN_SLOP_PX) g.moved = true;
          if (!g.moved) return;
          const dSec = secondsDeltaFromPixelDelta(dx, live.pxPerSec);
          const n = clampPhraseMoveDelta(g.s0, g.e0, dSec, live.duration);
          ctx.onPhraseBoundsCommit(g.id, n.start, n.end);
        } else if (g.mode === "phraseRs") {
          if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
          if (!g.moved) return;
          const c =
            g.edge === "start"
              ? clampPhraseStartEnd(secNow, g.e0, live.duration)
              : clampPhraseStartEnd(g.s0, secNow, live.duration);
          ctx.onPhraseBoundsCommit(g.id, c.start, c.end);
        } else if (
          g.mode === "segMove" ||
          g.mode === "segRsStart" ||
          g.mode === "segRsEnd"
        ) {
          let ss = g.segS;
          let ee = g.segE;
          if (g.mode === "segMove") {
            const dx = e.clientX - g.ax;
            if (Math.abs(dx) >= PAN_SLOP_PX) g.moved = true;
            if (!g.moved) return;
            const dSec = secondsDeltaFromPixelDelta(dx, live.pxPerSec);
            const m = clampSegmentMoveDeltaInPhrase(
              g.segS,
              g.segE,
              dSec,
              g.phraseS,
              g.phraseE,
            );
            ss = m.start;
            ee = m.end;
          } else if (g.mode === "segRsStart") {
            if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
            if (!g.moved) return;
            const c = clampSegmentStartEndInPhrase(
              secNow,
              g.segE,
              g.phraseS,
              g.phraseE,
            );
            ss = c.start;
            ee = c.end;
          } else {
            if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
            if (!g.moved) return;
            const c = clampSegmentStartEndInPhrase(
              g.segS,
              secNow,
              g.phraseS,
              g.phraseE,
            );
            ss = c.start;
            ee = c.end;
          }
          ctx.onSegmentBoundsCommit(g.phraseId, g.segId, ss, ee);
        }
      };

      const up = (e: PointerEvent) => {
        const g = gestureRef.current;
        if (!g || g.pid !== e.pointerId) return;

        const ghostPhraseDraft = ghostPhraseRef.current;
        const ghostFocusDraft = ghostFocusRef.current;

        gestureUnhookRef.current?.();
        gestureUnhookRef.current = null;

        gestureRef.current = null;

        ghostPhraseRef.current = null;
        ghostFocusRef.current = null;
        bumpGhost();

        try {
          scrollRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }

        const live = liveRef.current;

        if (g.mode === "pan") {
          if (!(live.duration > 0)) return;
          if (!g.moved) {
            if (!rulerIgnored(e.target)) {
              const sec = secsFromClient(e.clientX);
              if (ctx.onPlaybackIntentTap) ctx.onPlaybackIntentTap(sec);
              else onSeek(sec);
            }
          }
          return;
        }

        const secTap = secsFromClient(e.clientX);

        if (g.mode === "draftShift") {
          if (!(live.duration > 0)) return;
          if (!g.moved) {
            if (ctx.onPlaybackIntentTap) ctx.onPlaybackIntentTap(secTap);
            else onSeek(secTap);
            return;
          }
          const bdOnly = g.backdropPhraseDraftOnly === true;

          const fg = ghostFocusDraft;
          const pg = ghostPhraseDraft;
          const activePhrase = resolveDraftShiftPhraseLoop(g, ctx, live.loops);
          const phraseDur =
            activePhrase && activePhrase.end > activePhrase.start
              ? activePhrase.end - activePhrase.start
              : live.duration;
          const minDur = minPhraseOrSegmentSpanSec(live.duration);
          const practiceBypass = g.practicePhraseShiftBypass === true;

          if (bdOnly) {
            if (pg && pg[1] - pg[0] >= minDur - 1e-9) {
              ctx.onShiftPhraseDragCreate(pg[0], pg[1]);
            }
            return;
          }

          const unlockPhraseId =
            g.phraseId !== undefined ? g.phraseId : ctx.activeLoopId;
          const shiftAllowed =
            practiceBypass ||
            shiftDragPhraseAuthoringAllowed({
              authoringEnabled: ctx.enabled,
              phraseWaveformEditUnlockedById: ctx.phraseWaveformEditUnlockedById,
              phraseId: unlockPhraseId,
            });
          if (!shiftAllowed) return;

          if (
            fg &&
            activePhrase &&
            shiftDragShouldCreateFocusInsideActivePhrase(
              activePhrase,
              fg[0],
              fg[1],
            ) &&
            fg[1] - fg[0] >= minPhraseOrSegmentSpanSec(phraseDur) - 1e-9
          ) {
            ctx.onShiftFocusDragCreate(activePhrase.id, fg[0], fg[1]);
            return;
          }
          if (pg && pg[1] - pg[0] >= minDur - 1e-9) {
            ctx.onShiftPhraseDragCreate(pg[0], pg[1]);
          }
          return;
        }

        if (ctx.enabled) {
          if (g.mode === "phraseMove") {
            if (!g.moved) {
              if (ctx.onPlaybackIntentTap) ctx.onPlaybackIntentTap(secTap);
              else ctx.onSelectPhrase(g.id);
            }
            return;
          }
          if (g.mode === "phraseRs") {
            if (!g.moved) {
              if (ctx.onPlaybackIntentTap) ctx.onPlaybackIntentTap(secTap);
              else ctx.onSelectPhrase(g.id);
            }
            return;
          }
          if (
            g.mode === "segMove" ||
            g.mode === "segRsStart" ||
            g.mode === "segRsEnd"
          ) {
            if (!g.moved) {
              if (ctx.onPlaybackIntentTap) ctx.onPlaybackIntentTap(secTap);
              else ctx.onSelectFocus(g.phraseId, g.segId);
            }
            return;
          }
        }
      };

      gestureUnhookRef.current = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
      };

      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return gestureUnhookRef.current;
    },
    [bumpGhost, onSeek, refreshScrollMetrics, rulerIgnored, secsFromClient],
  );

  /** Begin global listeners for the active pointer (one session at a time). */
  const bindGestureHooks = useCallback(
    (_session: Gesture, ctx: SyntheticTimelineAuthoringConfig) => {
      installGestureHooks(_session, ctx);
    },
    [installGestureHooks],
  );

  const beginDraftShiftGesture = useCallback(
    (
      event: Pick<
        ReactPointerEvent<Element>,
        "pointerId" | "clientX" | "button"
      >,
      opts: { scopedPhraseId?: string } = {},
    ): boolean => {
      const el = scrollRef.current;
      if (!el || !(duration > 0) || !auth || event.button !== 0) return false;

      const scoped = opts.scopedPhraseId;

      /** Practice Mode: backdrop-only phrase draft bypasses unlock-map gating (commit unlocks via store). */
      const backdropPhrasePracticeDraft =
        !auth.enabled &&
        Boolean(auth.allowBackdropShiftPhraseDraftWhenPractice) &&
        scoped === undefined;

      const inPhraseFocusPracticeDraft =
        !auth.enabled &&
        Boolean(auth.allowInPhraseShiftFocusDraftWhenPractice) &&
        scoped !== undefined;

      const unlockTarget = scoped ?? auth.activeLoopId ?? undefined;
      if (!backdropPhrasePracticeDraft && !inPhraseFocusPracticeDraft) {
        if (
          !shiftDragPhraseAuthoringAllowed({
            authoringEnabled: Boolean(auth.enabled),
            phraseWaveformEditUnlockedById: auth.phraseWaveformEditUnlockedById,
            phraseId: unlockTarget,
          })
        )
          return false;
      }

      gestureRef.current = {
        mode: "draftShift",
        pid: event.pointerId,
        aSec: secsFromClient(event.clientX),
        ax: event.clientX,
        moved: false,
        ...(scoped != null ? { phraseId: scoped } : {}),
        ...(backdropPhrasePracticeDraft
          ? { backdropPhraseDraftOnly: true }
          : {}),
        ...(inPhraseFocusPracticeDraft
          ? { practicePhraseShiftBypass: true }
          : {}),
      };
      ghostPhraseRef.current = null;
      ghostFocusRef.current = null;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth);
      return true;
    },
    [auth, bindGestureHooks, duration, secsFromClient],
  );

  const onScrubPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      if (rulerIgnored(event.target)) return;

      const el = scrollRef.current;
      if (!el || !(duration > 0)) return;

      const inRegion = (event.target as HTMLElement)?.closest?.(
        "[data-neutral-timeline-region]",
      );

      /** Region hits never start scrub-level pan/shift gestures (desktop matches region priority). */
      if (inRegion) return;

      const band = bandAt(event);
      if (band === "outside") return;

      /** Shift+drag backdrop — gated per active phrase waveform unlock map. */
      if (auth && event.shiftKey && beginDraftShiftGesture(event)) return;

      gestureRef.current = {
        mode: "pan",
        pid: event.pointerId,
        ax: event.clientX,
        sl: el.scrollLeft,
        moved: false,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth ?? NOOP_AUTHORING_CTX);
    },
    [
      auth,
      bandAt,
      beginDraftShiftGesture,
      bindGestureHooks,
      duration,
      rulerIgnored,
      secsFromClient,
    ],
  );

  const onPhraseStripPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, loop: PracticeLoop) => {
      if (!phraseOverlayActive || !auth || event.button !== 0) return;
      if (loop.end <= loop.start) return;

      /** Shift on phrase strip — begins focus draft in Practice Mode when allowed, else Edit Mode. */
      if (event.shiftKey) {
        event.stopPropagation();
        auth.onSelectPhrase(loop.id);
        beginDraftShiftGesture(event, { scopedPhraseId: loop.id });
        return;
      }

      event.stopPropagation();
      if (auth.onPlaybackIntentTap) {
        auth.onPlaybackIntentTap(secsFromClient(event.clientX));
      } else {
        auth.onSelectPhrase(loop.id);
      }
    },
    [auth, phraseOverlayActive, beginDraftShiftGesture, secsFromClient],
  );

  const phraseBodyMoveDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, loop: PracticeLoop) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
      if (loop.end <= loop.start) return;

      /** Shift+drag for focus creation must work in Practice Mode — handle before boundary-edit gate. */
      if (event.shiftKey) {
        event.stopPropagation();
        auth.onSelectPhrase(loop.id);
        beginDraftShiftGesture(event, { scopedPhraseId: loop.id });
        return;
      }

      if (!phraseBoundaryEditable(loop.id)) return;

      event.stopPropagation();
      auth.onSelectPhrase(loop.id);
      const el = scrollRef.current;
      if (!el) return;
      gestureRef.current = {
        mode: "phraseMove",
        pid: event.pointerId,
        id: loop.id,
        s0: loop.start,
        e0: loop.end,
        ax: event.clientX,
        moved: false,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth);
    },
    [auth, beginDraftShiftGesture, phraseBoundaryEditable, phraseOverlayActive, bindGestureHooks],
  );

  const phraseEdgeResizeDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      edge: "start" | "end",
    ) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
      if (!phraseBoundaryEditable(loop.id)) return;
      if (loop.end <= loop.start) return;
      event.stopPropagation();
      auth.onSelectPhrase(loop.id);
      const el = scrollRef.current;
      if (!el) return;
      gestureRef.current = {
        mode: "phraseRs",
        pid: event.pointerId,
        id: loop.id,
        s0: loop.start,
        e0: loop.end,
        edge,
        ax: event.clientX,
        moved: false,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth);
    },
    [auth, phraseBoundaryEditable, phraseOverlayActive, bindGestureHooks],
  );

  const segmentSelectPointerDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
    ) => {
      if (!phraseOverlayActive || !auth || event.button !== 0) return;
      if (event.shiftKey) {
        event.stopPropagation();
        auth.onSelectPhrase(loop.id);
        beginDraftShiftGesture(event, { scopedPhraseId: loop.id });
        return;
      }
      event.stopPropagation();
      if (auth.onPlaybackIntentTap) {
        auth.onPlaybackIntentTap(secsFromClient(event.clientX));
      } else {
        auth.onSelectFocus(loop.id, segment.id);
      }
    },
    [auth, beginDraftShiftGesture, phraseOverlayActive, secsFromClient],
  );

  const segmentBodyMoveDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
    ) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
      if (event.shiftKey) {
        event.stopPropagation();
        auth.onSelectPhrase(loop.id);
        beginDraftShiftGesture(event, { scopedPhraseId: loop.id });
        return;
      }
      if (!focusSegmentBoundaryEditable(segment.id)) return;
      event.stopPropagation();
      auth.onSelectFocus(loop.id, segment.id);
      const el = scrollRef.current;
      if (!el) return;
      gestureRef.current = {
        mode: "segMove",
        pid: event.pointerId,
        phraseId: loop.id,
        segId: segment.id,
        phraseS: loop.start,
        phraseE: loop.end,
        segS: segment.startTime,
        segE: segment.endTime,
        ax: event.clientX,
        moved: false,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth);
    },
    [
      auth,
      beginDraftShiftGesture,
      focusSegmentBoundaryEditable,
      phraseOverlayActive,
      bindGestureHooks,
    ],
  );

  const segmentEdgeResizeDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
      edge: "start" | "end",
    ) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
      if (!focusSegmentBoundaryEditable(segment.id)) return;
      event.stopPropagation();
      auth.onSelectFocus(loop.id, segment.id);
      const el = scrollRef.current;
      if (!el) return;
      gestureRef.current = {
        mode: edge === "start" ? "segRsStart" : "segRsEnd",
        pid: event.pointerId,
        phraseId: loop.id,
        segId: segment.id,
        phraseS: loop.start,
        phraseE: loop.end,
        segS: segment.startTime,
        segE: segment.endTime,
        ax: event.clientX,
        moved: false,
      };
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      bindGestureHooks(gestureRef.current, auth);
    },
    [
      auth,
      focusSegmentBoundaryEditable,
      phraseOverlayActive,
      bindGestureHooks,
    ],
  );

  void ghostNonce;

  const phraseGhostDraft = ghostPhraseRef.current;
  const focusGhostDraft = ghostFocusRef.current;

  const phraseGhostH = Math.max(
    18,
    Math.min(52, Math.round(trackBandPx * PHRASE_GHOST_VERTICAL_FRAC)),
  );
  const focusGhostH = Math.max(26, Math.round(trackBandPx * 0.36));
  const focusGhostTop = Math.max(
    TRACK_VERTICAL_GUTTER_PX,
    Math.round((trackBandPx - focusGhostH) / 2),
  );

  /** Region overlays receive pointers whenever authoring is wired; Practice Mode uses auth.enabled=false for structural gestures only. */
  const regionPointerShell = phraseOverlayActive
    ? "pointer-events-auto"
    : "pointer-events-none";

  const timelinePracticeCalmChrome = Boolean(auth && phraseOverlayActive && !auth.enabled);

  return (
    <div
      ref={hostRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-stone-800/55 bg-[radial-gradient(ellipse_120%_80%_at_50%_0%,rgba(78,61,118,0.07),transparent_52%),linear-gradient(to_bottom,#0a0908,#070605)] text-stone-100 transition-[opacity,filter,box-shadow] duration-300",
        timelinePracticeCalmChrome && "opacity-[0.98] saturate-[0.9]",
        playbackActive &&
          "shadow-[inset_0_-1px_0_rgba(167,139,250,0.07)] saturate-[1.02]",
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          "neutral-timeline-scrollbar relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden",
          compactLayout
            ? "px-2 pb-2 pt-1.5"
            : "px-3 pb-3 pt-2 sm:px-5 sm:pb-3.5 sm:pt-2.5",
        )}
      >
        <div
          ref={scrubRef}
          className="relative select-none touch-pan-x"
          style={{ width: timelineSongWidthPx }}
          onPointerDown={onScrubPointerDown}
        >
          <div className="relative mb-px" style={{ height: RULER_H }}>
            <div className="absolute inset-x-0 top-[30px] h-px bg-stone-800/70" />

            <div
              data-neutral-timeline-zoom="true"
              className="absolute right-1 top-0.5 z-[4] flex items-center gap-0.5 rounded-lg border border-stone-700/65 bg-black/55 px-0.5 py-px shadow-inner shadow-black/50 backdrop-blur-sm"
            >
              <button
                type="button"
                className="rounded px-1.5 py-px text-[11px] font-semibold leading-none text-stone-400 hover:bg-stone-900/95 hover:text-stone-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onPxPerSecChange(pxPerSec / 1.2);
                }}
                aria-label="Zoom timeline out"
              >
                −
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-px text-[11px] font-semibold leading-none text-stone-400 hover:bg-stone-900/95 hover:text-stone-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onPxPerSecChange(pxPerSec * 1.2);
                }}
                aria-label="Zoom timeline in"
              >
                +
              </button>
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 pt-px">
              {tickMarks.map((t, i) => {
                const leftPx = secondsToContentPx(t, pxPerSec);
                const cw = scrollMetrics.clientWidth || 1;
                const xView = (leftPx - scrollMetrics.scrollLeft) / cw;
                if (xView < -0.15 || xView > 1.35) return null;

                const showMajor = t === 0 || i === 0 || i % 5 === 0;

                return (
                  <div
                    key={`tm-${String(t)}:${i}`}
                    className="absolute top-[18px]"
                    style={{ transform: `translateX(${leftPx}px)` }}
                  >
                    <span className="block h-[7px] w-px rounded-full bg-stone-700/95" />
                    {showMajor ? (
                      <span className="-translate-x-1/2 whitespace-nowrap pl-px font-mono text-[10px] text-stone-500">
                        {fmtRuler(t)}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={cn(
              "relative isolate overflow-visible rounded-xl ring-1 ring-inset shadow-[inset_0_-12px_24px_-20px_rgba(0,0,0,0.45)] transition-[box-shadow] duration-300",
              timelinePracticeCalmChrome ? "ring-stone-900/42" : "ring-stone-800/28",
            )}
            style={{ height: trackBandPx }}
          >
            <SyntheticWaveBedCanvas
              widthPx={timelineSongWidthPx}
              heightPx={trackBandPx}
              playedWidthPx={duration > 0 ? syntheticPlayedTimelinePx : 0}
              playbackActive={playbackActive}
            />

            {duration > 0 ? (
              <div
                aria-hidden
                className="pointer-events-none absolute bottom-[10%] top-[10%] z-[1] w-px rounded-full bg-gradient-to-b from-transparent via-stone-200/48 to-transparent shadow-[2px_0_10px_rgba(251,252,253,0.03)] opacity-95"
                style={{
                  left: Math.max(0, timelineSongWidthPx - 1),
                }}
              />
            ) : null}

            {phraseGhostDraft && phraseGhostDraft[1] > phraseGhostDraft[0] ? (
              <div
                className="pointer-events-none absolute z-[14] rounded-md border border-dashed border-violet-400/65 bg-gradient-to-b from-violet-500/[0.22] to-transparent shadow-[inset_0_0_0_1px_rgba(167,139,250,0.12)]"
                style={{
                  left: secondsToContentPx(phraseGhostDraft[0], pxPerSec),
                  width: Math.max(
                    2,
                    secondsToContentPx(phraseGhostDraft[1], pxPerSec) -
                      secondsToContentPx(phraseGhostDraft[0], pxPerSec),
                  ),
                  top: TRACK_VERTICAL_GUTTER_PX + 4,
                  height: phraseGhostH,
                }}
              />
            ) : null}

            {focusGhostDraft && focusGhostDraft[1] > focusGhostDraft[0] ? (
              <div
                className="pointer-events-none absolute z-[15] rounded-lg border border-dashed border-emerald-400/50 bg-emerald-500/[0.1] shadow-[inset_0_0_0_1px_rgba(167,243,208,0.07)]"
                style={{
                  left: secondsToContentPx(focusGhostDraft[0], pxPerSec),
                  width: Math.max(
                    2,
                    secondsToContentPx(focusGhostDraft[1], pxPerSec) -
                      secondsToContentPx(focusGhostDraft[0], pxPerSec),
                  ),
                  top: focusGhostTop,
                  height: focusGhostH,
                }}
              />
            ) : null}

            {secondsToContentPx(duration, pxPerSec) > 1 ? (
              <div
                className={cn(
                  "pointer-events-none absolute bottom-2 top-2 z-[45] w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 transition-[filter,opacity,box-shadow] duration-200",
                  playbackActive
                    ? "opacity-100 shadow-[0_0_26px_rgba(251,191,36,0.42)]"
                    : "shadow-[0_0_22px_rgba(251,191,36,0.35)]",
                )}
                style={{
                  left: secondsToContentPx(Math.min(duration, Math.max(currentTime, 0)), pxPerSec),
                }}
              />
            ) : null}

            <div
              className={cn(
                "absolute inset-x-0 top-0 overflow-visible",
                regionPointerShell,
              )}
              style={{ height: trackBandPx }}
            >
              {orderedLoopsPhrasePaint.map((loop, paintIx) => {
                if (!(loop.end > loop.start)) return null;
                const pxL = secondsToContentPx(loop.start, pxPerSec);
                const pxR = secondsToContentPx(loop.end, pxPerSec);
                const w = Math.max(3, pxR - pxL);
                const phraseState = deriveRegionVisualState({
                  context: {
                    surface: "desktop",
                    activeLoopId,
                    activeSegmentId,
                    editableLoopId: auth?.enabled ? auth.activeLoopId : null,
                    loopPlaybackEnabled: playbackActive,
                    loopPracticeScope,
                    phraseWaveformEditUnlockedById:
                      auth?.phraseWaveformEditUnlockedById ?? {},
                    focusRegionWaveformEditUnlockedById:
                      auth?.focusRegionWaveformEditUnlockedById ?? {},
                    practiceEditCompatibility,
                  },
                  target: {
                    kind: "phrase",
                    phraseId: loop.id,
                    phraseHasFocusRegions: Boolean(loop.segments?.length),
                  },
                });
                const phraseActive = phraseState.isSectionActive;
                /** Horizontal padding aligning nested focus rects with lane insets (~pl-3 + ring). */
                const innerPadX = 11;
                /** Space reserved for Practice Section heading above the drill lane. */
                const laneTopPx = 32;
                const phraseStackZ = neutralPhraseZ(phraseState.zIndexTier, paintIx);

                return (
                  <div
                    key={`phrase-slot-${loop.id}`}
                    data-neutral-timeline-region={`phrase:${loop.id}`}
                    className={cn(
                      "absolute overflow-visible rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] backdrop-blur-[2px] transition-[border-color,box-shadow,opacity] duration-200",
                      timelinePracticeCalmChrome && "opacity-[0.9]",
                      phraseActive
                        ? timelinePracticeCalmChrome
                          ? "border border-violet-400/26 bg-[linear-gradient(to_bottom,rgba(109,93,217,0.09),rgba(26,23,43,0.28))]"
                          : "border border-violet-400/44 bg-[linear-gradient(to_bottom,rgba(109,93,217,0.2),rgba(26,23,43,0.42))]"
                        : "border border-white/[0.06] bg-[linear-gradient(to_bottom,rgba(44,43,71,0.16),rgba(14,13,21,0.34))]",
                    )}
                    style={{
                      left: pxL,
                      width: w,
                      top: TRACK_VERTICAL_GUTTER_PX,
                      height: Math.max(
                        trackBandPx - TRACK_VERTICAL_GUTTER_PX * 2,
                        52,
                      ),
                      zIndex: phraseStackZ,
                    }}
                    onDoubleClick={(e: ReactMouseEvent<HTMLDivElement>) => {
                      if (
                        !(
                          phraseOverlayActive &&
                          phraseUnlockMapProvided &&
                          focusUnlockMapProvided
                        )
                      )
                        return;
                      if (!isStructuralPracticeMode()) return;
                      const node = e.target as HTMLElement | null;
                      if (node?.closest("[data-neutral-focus-lane]")) return;
                      e.preventDefault();
                      e.stopPropagation();
                      enterPracticeSectionStructuralEdit(loop.id);
                    }}
                    onPointerDown={(e: ReactPointerEvent<HTMLDivElement>) => {
                      const node = e.target as HTMLElement | null;
                      if (
                        node?.closest(
                          '[data-neutral-timeline-region^="focus:"]',
                        )
                      )
                        return;
                      onPhraseStripPointerDown(e, loop);
                    }}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute top-2 z-[1] flex min-w-0 items-center gap-2",
                        compactLayout ? "left-2 right-2" : "left-3 right-3",
                      )}
                    >
                      <span
                        className={cn(
                          "truncate text-[10px] font-semibold uppercase tracking-[0.1em]",
                          phraseActive
                            ? "text-violet-100/93"
                            : "text-white/74",
                        )}
                      >
                        {loop.name.trim() || "Practice Section"}
                      </span>
                      <span className="h-px min-w-[14px] flex-1 bg-gradient-to-r from-white/18 to-transparent" />
                    </div>

                    {/* Invisible phrase-move plate — Focus regions sit above and capture pointers first. */}
                    {phraseOverlayActive && phraseBoundaryEditable(loop.id) ? (
                      <>
                        <button
                          type="button"
                          aria-label={`Drag Practice Section: ${loop.name}`}
                          className={cn(
                            "absolute bottom-2 z-[22] rounded-md bg-transparent outline-none ring-0",
                            compactLayout ? "left-2 right-2" : "left-3 right-3",
                          )}
                          style={{ top: laneTopPx }}
                          tabIndex={-1}
                          onPointerDown={(e) => phraseBodyMoveDown(e, loop)}
                        />
                        <div
                          aria-label="Practice Section start boundary"
                          className="absolute bottom-2 left-0 top-[26px] z-[44] w-2 cursor-ew-resize rounded-l-xl bg-gradient-to-r from-white/26 to-transparent opacity-95 hover:w-2.5 hover:from-white/43"
                          onPointerDown={(e) =>
                            phraseEdgeResizeDown(e, loop, "start")
                          }
                        />
                        <div
                          aria-label="Practice Section end boundary"
                          className="absolute bottom-2 right-0 top-[26px] z-[44] w-2 cursor-ew-resize rounded-r-xl bg-gradient-to-l from-white/26 to-transparent opacity-95 hover:w-2.5 hover:from-white/43"
                          onPointerDown={(e) =>
                            phraseEdgeResizeDown(e, loop, "end")
                          }
                        />
                      </>
                    ) : null}

                    <div
                      className="pointer-events-none absolute inset-x-2 bottom-2 z-[24] rounded-lg shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)] backdrop-blur-[2px]"
                      style={{ top: laneTopPx }}
                      data-neutral-focus-lane=""
                    >
                      <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/[0.16]" />

                      {[...(loop.segments ?? [])]
                        .sort((a, b) => a.startTime - b.startTime)
                        .map((segment) => {
                          const absL = secondsToContentPx(segment.startTime, pxPerSec);
                          const absR = secondsToContentPx(segment.endTime, pxPerSec);
                          const segPxLRel = Math.max(0, absL - pxL - innerPadX);
                          const segW = Math.max(4, absR - absL);
                          const focusState = deriveRegionVisualState({
                            context: {
                              surface: "desktop",
                              activeLoopId,
                              activeSegmentId,
                              editableLoopId: auth?.enabled ? auth.activeLoopId : null,
                              loopPlaybackEnabled: playbackActive,
                              loopPracticeScope,
                              phraseWaveformEditUnlockedById:
                                auth?.phraseWaveformEditUnlockedById ?? {},
                              focusRegionWaveformEditUnlockedById:
                                auth?.focusRegionWaveformEditUnlockedById ?? {},
                              practiceEditCompatibility,
                            },
                            target: {
                              kind: "focus",
                              phraseId: loop.id,
                              segmentId: segment.id,
                              phraseHasFocusRegions: Boolean(loop.segments?.length),
                            },
                          });
                          const activeSeg = focusState.isFocusActive;
                          const chipHoverLink =
                            timelineHoverSegmentId === segment.id &&
                            !activeSeg;
                          const focusEditable = phraseOverlayActive && focusState.isEditable;

                          const segClass = cn(
                            "absolute top-2 bottom-2 rounded-lg transition-[background-color,border-color,box-shadow] duration-150",
                            phraseOverlayActive
                              ? timelinePracticeCalmChrome
                                ? "pointer-events-auto cursor-default opacity-[0.88]"
                                : "pointer-events-auto cursor-default"
                              : "pointer-events-none opacity-[0.78]",
                            activeSeg
                              ? timelinePracticeCalmChrome
                                ? "border border-emerald-300/22 bg-emerald-400/[0.07] ring-1 ring-emerald-200/15"
                                : "border border-emerald-300/30 bg-emerald-400/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),inset_0_0_16px_rgba(167,243,208,0.065)] ring-1 ring-emerald-200/26"
                              : chipHoverLink
                                ? "border border-emerald-300/35 bg-emerald-400/[0.09] ring-1 ring-emerald-200/35 shadow-[inset_0_0_12px_rgba(167,243,208,0.08)]"
                                : focusState.isDimmed
                                  ? "border border-white/[0.05] bg-emerald-500/[0.052] hover:border-emerald-400/22 hover:bg-emerald-400/[0.085]"
                                  : "border border-white/[0.06] bg-emerald-500/[0.06] hover:border-emerald-400/24 hover:bg-emerald-400/[0.095]",
                          );

                          const zRaise = neutralFocusZ(focusState.zIndexTier);

                          return (
                            <div
                              key={`${loop.id}:${segment.id}`}
                              data-neutral-timeline-region={`focus:${loop.id}:${segment.id}`}
                              className={segClass}
                              style={{
                                left: segPxLRel,
                                width: segW,
                                zIndex: zRaise,
                              }}
                              onPointerEnter={() => {
                                onTimelineFocusSegmentHover?.(segment.id);
                              }}
                              onPointerLeave={() => {
                                onTimelineFocusSegmentHover?.(null);
                              }}
                              onDoubleClick={(e: ReactMouseEvent<HTMLDivElement>) => {
                                if (
                                  !(
                                    phraseOverlayActive &&
                                    phraseUnlockMapProvided &&
                                    focusUnlockMapProvided
                                  )
                                )
                                  return;
                                if (!isStructuralPracticeMode()) return;
                                e.preventDefault();
                                e.stopPropagation();
                                enterFocusLoopStructuralEdit(loop.id, segment.id);
                              }}
                            >
                              {focusEditable ? (
                                <>
                                  <div
                                    aria-label={`Focus Loop ${segment.name} start`}
                                    className="absolute inset-y-1.5 left-0 z-[3] w-2 max-w-[30%] cursor-ew-resize rounded-l-lg bg-emerald-200/26 opacity-90 hover:bg-emerald-100/42"
                                    onPointerDown={(e) =>
                                      segmentEdgeResizeDown(e, loop, segment, "start")
                                    }
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Drag Focus Loop ${segment.name}`}
                                    className="absolute inset-y-1 left-2 right-2 z-[2] cursor-grab rounded-sm bg-transparent px-2 pt-px text-left text-[9px] font-medium tracking-tight text-emerald-50/95 hover:bg-black/[0.22] active:cursor-grabbing"
                                    onPointerDown={(e) =>
                                      segmentBodyMoveDown(e, loop, segment)
                                    }
                                  >
                                    {segment.name.trim() || "Focus Loop"}
                                  </button>
                                  <div
                                    aria-label={`Focus Loop ${segment.name} end`}
                                    className="absolute inset-y-1.5 right-0 z-[3] w-2 max-w-[30%] cursor-ew-resize rounded-r-lg bg-emerald-200/26 opacity-90 hover:bg-emerald-100/42"
                                    onPointerDown={(e) =>
                                      segmentEdgeResizeDown(e, loop, segment, "end")
                                    }
                                  />
                                </>
                              ) : phraseOverlayActive ? (
                                <button
                                  type="button"
                                  aria-label={`Select Focus Loop ${segment.name}`}
                                  className="absolute inset-2 z-[2] cursor-default rounded-md bg-transparent px-2 text-left text-[9px] font-medium tracking-tight text-emerald-50/[0.95] hover:bg-black/[0.18]"
                                  onPointerDown={(e) =>
                                    segmentSelectPointerDown(e, loop, segment)
                                  }
                                >
                                  {segment.name.trim() || "Focus Loop"}
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});