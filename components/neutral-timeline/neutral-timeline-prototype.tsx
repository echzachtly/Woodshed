"use client";

/**
 * Synthetic (neutral) timeline — ruler + faux waveform + overlays (non-upload sources).
 *
 * **WaveSurfer vs synthetic:** RegionsPlugin uses decoded waveform pixels; this strip maps
 * **pointer X → seconds** via `pointerClientToSeconds` only. Bounds clamping matches store expectations
 * (`updateLoopBounds`, `updateSegment`, `clampSegmentsToPhraseBounds`).
 *
 * **Uploaded-audio parity (when `authoring.enabled`):**
 * - Plain click+drag on the strip = **pan/scroll** (like the main waveform).
 * - **Shift+drag** uses the same rule as `shiftDragShouldCreateFocusInsideActivePhrase`; when
 *   `phraseWaveformEditUnlockedById` is supplied (YouTube/desktop parity), commits only while the
 *   active Practice Section waveform is unlocked in the store (`editableLoopId` / transport lock).
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
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { PracticeLoop, PhraseSegment } from "@/lib/loop-engine";
import { cn } from "@/lib/utils";

import {
  pickMajorTickIntervalSec,
  pointerClientToSeconds,
  secondsToContentPx,
  timelineLogicalWidthPx,
  timelineScrollWidthPx,
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
import { shiftDragShouldCreateFocusInsideActivePhrase } from "@/lib/shift-waveform-authoring";

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
  onPhraseBoundsCommit: (phraseId: string, startSec: number, endSec: number) => void;
  onSegmentBoundsCommit: (
    phraseId: string,
    segmentId: string,
    startSec: number,
    endSec: number,
  ) => void;
};

export type NeutralTimelinePrototypeProps = {
  duration: number;
  currentTime: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  pxPerSec: number;
  onPxPerSecChange: (nextPxPerSec: number) => void;
  onSeek: (seconds: number) => void;
  authoring?: SyntheticTimelineAuthoringConfig;
};

const RULER_H = 36;
/** Initial faux-wave height before `ResizeObserver` measures the waveform column (WaveSurfer-like fill). */
const TRACK_BAND_PX_DEFAULT = 148;
const TRACK_BAND_MIN_PX = 92;
const TRACK_BAND_MAX_PX = 560;
const PAN_SLOP_PX = 4;
const PHRASE_BAND_END_FRAC_OF_TRACK = 0.58;

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
    pxPerSec,
    onPxPerSecChange,
    onSeek,
    authoring,
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

  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [ghostNonce, setGhostTick] = useState(0);
  const bumpGhost = useCallback(() => setGhostTick((n) => n + 1), []);

  /** Faux waveform band height fills the waveform column minus the ruler row (desktop WaveSurfer parity). */
  const [trackBandPx, setTrackBandPx] = useState(TRACK_BAND_PX_DEFAULT);
  const phraseStripPx = useMemo(
    () => trackBandPx * PHRASE_BAND_END_FRAC_OF_TRACK,
    [trackBandPx],
  );
  const focusStripPx = trackBandPx - phraseStripPx;

  const auth = authoring;
  const authOn = Boolean(auth?.enabled);
  /** Desktop-style maps from `woodshed-store` — omitted on legacy overlay strips (`woodshed-workspace` dev rail). */
  const phraseUnlockMapProvided = auth?.phraseWaveformEditUnlockedById !== undefined;
  const focusUnlockMapProvided = auth?.focusRegionWaveformEditUnlockedById !== undefined;

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

  const shiftAuthoringAllowed =
    Boolean(auth?.enabled) &&
    (!phraseUnlockMapProvided ||
      Boolean(
        auth?.activeLoopId &&
          auth.phraseWaveformEditUnlockedById?.[auth.activeLoopId],
      ));

  const logicalWidth = useMemo(
    () => timelineLogicalWidthPx(duration, pxPerSec),
    [duration, pxPerSec],
  );
  const scrollWidthPx = useMemo(
    () => timelineScrollWidthPx(logicalWidth, viewportWidth),
    [logicalWidth, viewportWidth],
  );
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
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") {
      setViewportWidth(hostRef.current?.clientWidth ?? 0);
      return;
    }
    const ro = new ResizeObserver(() => setViewportWidth(host.clientWidth));
    ro.observe(host);
    setViewportWidth(host.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    refreshScrollMetrics();
    const onScroll = () => refreshScrollMetrics();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [refreshScrollMetrics, scrollWidthPx, duration]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
      refreshScrollMetrics();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [refreshScrollMetrics, scrollWidthPx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      const usable = Math.floor(el.clientHeight - RULER_H - 12);
      const next = Math.min(
        TRACK_BAND_MAX_PX,
        Math.max(TRACK_BAND_MIN_PX, usable),
      );
      setTrackBandPx((prev) => (prev === next ? prev : next));
      refreshScrollMetrics();
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [refreshScrollMetrics]);

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
    const rect = el.getBoundingClientRect();
    return pointerClientToSeconds({
      clientX,
      scrollHostLeft: rect.left,
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
      const y = ry;
      return y <= phraseStripPx ? ("phrase" as const) : ("focus" as const);
    },
    [phraseStripPx],
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
          const shiftAllowed =
            ctx.enabled &&
            (!ctx.phraseWaveformEditUnlockedById ||
              Boolean(
                ctx.activeLoopId &&
                  ctx.phraseWaveformEditUnlockedById[ctx.activeLoopId],
              ));
          if (!shiftAllowed) return;
          if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
          if (!g.moved) return;
          const lo = Math.min(g.aSec, secNow);
          const hi = Math.max(g.aSec, secNow);
          const activePhrase =
            ctx.activeLoopId != null
              ? live.loops.find((l) => l.id === ctx.activeLoopId)
              : undefined;
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
              onSeek(secsFromClient(e.clientX));
            }
          }
          return;
        }

        const secTap = secsFromClient(e.clientX);

        if (g.mode === "draftShift") {
          if (!(live.duration > 0)) return;
          if (!g.moved) {
            onSeek(secTap);
            return;
          }
          const shiftAllowed =
            ctx.enabled &&
            (!ctx.phraseWaveformEditUnlockedById ||
              Boolean(
                ctx.activeLoopId &&
                  ctx.phraseWaveformEditUnlockedById[ctx.activeLoopId],
              ));
          if (!shiftAllowed) return;
          const fg = ghostFocusDraft;
          const pg = ghostPhraseDraft;
          const activePhrase =
            ctx.activeLoopId != null
              ? live.loops.find((l) => l.id === ctx.activeLoopId)
              : undefined;
          const phraseDur =
            activePhrase && activePhrase.end > activePhrase.start
              ? activePhrase.end - activePhrase.start
              : live.duration;
          const minDur = minPhraseOrSegmentSpanSec(live.duration);
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
              ctx.onSelectPhrase(g.id);
            }
            return;
          }
          if (g.mode === "phraseRs") {
            if (!g.moved) ctx.onSelectPhrase(g.id);
            return;
          }
          if (
            g.mode === "segMove" ||
            g.mode === "segRsStart" ||
            g.mode === "segRsEnd"
          ) {
            if (!g.moved) {
              ctx.onSelectFocus(g.phraseId, g.segId);
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

      /** Shift+drag matches desktop store gating when unlock maps are present. */
      if (shiftAuthoringAllowed && auth && event.shiftKey) {
        gestureRef.current = {
          mode: "draftShift",
          pid: event.pointerId,
          aSec: secsFromClient(event.clientX),
          ax: event.clientX,
          moved: false,
        };
        ghostPhraseRef.current = null;
        ghostFocusRef.current = null;
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
        bindGestureHooks(gestureRef.current, auth);
        return;
      }

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
      shiftAuthoringAllowed,
      bandAt,
      bindGestureHooks,
      duration,
      rulerIgnored,
      secsFromClient,
    ],
  );

  /** Overlay shell: selects phrases / consumes hits above the faux waveform. Structural edits use per-loop gates. */
  const phraseOverlayActive = Boolean(auth && authOn);

  /** Practice Section backdrop — absorbs stray hits; body/handles own dragging. */
  const onPhraseStripPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, loop: PracticeLoop) => {
      if (!phraseOverlayActive || !auth || event.button !== 0) return;
      if (loop.end <= loop.start) return;
      event.stopPropagation();
      auth.onSelectPhrase(loop.id);
    },
    [auth, phraseOverlayActive],
  );

  const phraseBodyMoveDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, loop: PracticeLoop) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
      if (!phraseBoundaryEditable(loop.id)) return;
      if (loop.end <= loop.start) return;
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
    [auth, phraseBoundaryEditable, phraseOverlayActive, bindGestureHooks],
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
      event.stopPropagation();
      auth.onSelectFocus(loop.id, segment.id);
    },
    [auth, phraseOverlayActive],
  );

  const segmentBodyMoveDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
    ) => {
      if (!auth || !phraseOverlayActive || event.button !== 0) return;
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

  const regionPointerShell =
    authOn && auth?.enabled ? "pointer-events-auto" : "pointer-events-none";

  return (
    <div
      ref={hostRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-stone-900/85 bg-[#070605]"
    >
      <div
        ref={scrollRef}
        className="neutral-timeline-scrollbar relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2 py-2 sm:px-3 sm:py-3"
      >
        <div
          ref={scrubRef}
          className="relative select-none touch-pan-x"
          style={{ width: Math.max(scrollWidthPx, viewportWidth || 1) }}
          onPointerDown={onScrubPointerDown}
        >
          <div className="relative" style={{ height: RULER_H }}>
            <div className="absolute inset-x-0 top-8 h-px bg-stone-800/90" />

            <div
              data-neutral-timeline-zoom="true"
              className="absolute right-0 top-1 z-[4] flex items-center gap-1 rounded-md border border-stone-800/85 bg-black/70 px-1 py-0.5 backdrop-blur-sm"
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
            className="relative isolate overflow-visible"
            style={{ height: trackBandPx }}
          >
            <SyntheticWaveBedCanvas widthPx={scrollWidthPx} heightPx={trackBandPx} />

            <div className="pointer-events-none absolute inset-x-0 top-2 h-px bg-stone-800/65" />

            {phraseGhostDraft && phraseGhostDraft[1] > phraseGhostDraft[0] ? (
              <div
                className="pointer-events-none absolute z-[14] rounded-sm border border-dashed border-violet-400/85 bg-violet-500/20"
                style={{
                  left: secondsToContentPx(phraseGhostDraft[0], pxPerSec),
                  width: Math.max(
                    2,
                    secondsToContentPx(phraseGhostDraft[1], pxPerSec) -
                      secondsToContentPx(phraseGhostDraft[0], pxPerSec),
                  ),
                  top: 6,
                  height: Math.max(0, phraseStripPx - 8),
                }}
              />
            ) : null}

            {focusGhostDraft && focusGhostDraft[1] > focusGhostDraft[0] ? (
              <div
                className="pointer-events-none absolute z-[14] rounded-sm border border-dashed border-emerald-400/85 bg-emerald-500/20"
                style={{
                  left: secondsToContentPx(focusGhostDraft[0], pxPerSec),
                  width: Math.max(
                    2,
                    secondsToContentPx(focusGhostDraft[1], pxPerSec) -
                      secondsToContentPx(focusGhostDraft[0], pxPerSec),
                  ),
                  top: phraseStripPx + 2,
                  height: Math.max(0, focusStripPx - 4),
                }}
              />
            ) : null}

            {secondsToContentPx(duration, pxPerSec) > 1 ? (
              <div
                className="pointer-events-none absolute z-[22] top-0 w-[1.5px] -translate-x-1/2 rounded-full bg-amber-400/98 shadow-[0_0_14px_rgba(251,191,36,0.45)]"
                style={{
                  height: trackBandPx,
                  left: secondsToContentPx(Math.min(duration, Math.max(currentTime, 0)), pxPerSec),
                }}
              />
            ) : null}

            <div className={cn("absolute inset-x-0 top-0 space-y-0", regionPointerShell)}>
              <div className="relative overflow-visible" style={{ height: phraseStripPx }}>
                {orderedLoopsPhrasePaint.map((loop) => {
                  if (!(loop.end > loop.start)) return null;
                  const pxL = secondsToContentPx(loop.start, pxPerSec);
                  const pxR = secondsToContentPx(loop.end, pxPerSec);
                  const w = Math.max(3, pxR - pxL);
                  const phraseActive = activeLoopId === loop.id;

                  return (
                    <div
                      key={`phrase-slot-${loop.id}`}
                      data-neutral-timeline-region={`phrase:${loop.id}`}
                      className={cn(
                        "absolute top-2 overflow-visible rounded-sm border backdrop-blur-[1px]",
                        phraseActive
                          ? "border-violet-400/72 bg-violet-500/[0.12]"
                          : "border-violet-500/[0.32] bg-violet-950/[0.08]",
                      )}
                      style={{ left: pxL, width: w, height: phraseStripPx - 8 }}
                      onPointerDown={(e) => onPhraseStripPointerDown(e, loop)}
                    >
                      {phraseOverlayActive &&
                      phraseBoundaryEditable(loop.id) ? (
                        <>
                          <div
                            aria-label="Practice Section start boundary"
                            className="absolute bottom-2 left-0 top-2 z-[2] w-[9px] max-w-[30%] cursor-ew-resize rounded-l-sm bg-white/13 hover:bg-white/24"
                            onPointerDown={(e) => phraseEdgeResizeDown(e, loop, "start")}
                          />
                          <button
                            type="button"
                            aria-label={`Drag Practice Section: ${loop.name}`}
                            className="absolute bottom-2 left-[9px] right-[9px] top-2 z-[1] cursor-grab rounded-sm bg-transparent px-2 text-left hover:bg-black/12 active:cursor-grabbing"
                            onPointerDown={(e) => phraseBodyMoveDown(e, loop)}
                          >
                            <span className="line-clamp-1 text-[10px] font-medium text-white/92">
                              {loop.name.trim() || "Practice Section"}
                            </span>
                          </button>
                          <div
                            aria-label="Practice Section end boundary"
                            className="absolute bottom-2 right-0 top-2 z-[2] w-[9px] max-w-[30%] cursor-ew-resize rounded-r-sm bg-white/13 hover:bg-white/24"
                            onPointerDown={(e) => phraseEdgeResizeDown(e, loop, "end")}
                          />
                        </>
                      ) : (
                        <div className="pointer-events-none absolute inset-2 flex items-center">
                          <span className="line-clamp-1 text-[10px] font-medium text-white/80">
                            {loop.name.trim() || "Practice Section"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className="relative overflow-visible"
                style={{ height: Math.max(focusStripPx, 12) }}
              >
                <div className="pointer-events-none absolute bottom-5 left-0 right-0 h-px bg-stone-800/65" />

                {orderedLoopsPhrasePaint.flatMap((loop) => {
                  if (!(loop.end > loop.start)) return [];
                  const segs = loop.segments ?? [];
                  return segs.map((segment) => {
                    const pxL = secondsToContentPx(segment.startTime, pxPerSec);
                    const pxR = secondsToContentPx(segment.endTime, pxPerSec);
                    const sw = Math.max(3, pxR - pxL);
                    const activeSeg = segment.id === activeSegmentId;

                    const focusEditable =
                      phraseOverlayActive &&
                      focusSegmentBoundaryEditable(segment.id);
                    const segHitClass = cn(
                      "absolute rounded-sm border backdrop-blur-[1px] transition-colors",
                      phraseOverlayActive
                        ? "pointer-events-auto"
                        : "pointer-events-none opacity-70",
                      activeSeg
                        ? "border-emerald-400/80 bg-emerald-500/[0.16]"
                        : "border-emerald-600/42 bg-emerald-950/[0.10]",
                    );

                    return (
                      <div
                        key={`${loop.id}:${segment.id}`}
                        data-neutral-timeline-region={`focus:${loop.id}:${segment.id}`}
                        className={segHitClass}
                        style={{
                          left: pxL,
                          width: sw,
                          top: 3,
                          height: Math.max(10, focusStripPx - 10),
                        }}
                      >
                        {focusEditable ? (
                          <>
                            <div
                              aria-label={`Focus Loop ${segment.name} start`}
                              className="absolute inset-y-3 left-0 z-[3] w-[9px] max-w-[34%] cursor-ew-resize rounded-l-md bg-emerald-300/35 hover:bg-emerald-200/50"
                              onPointerDown={(e) =>
                                segmentEdgeResizeDown(e, loop, segment, "start")
                              }
                            />
                            <button
                              type="button"
                              aria-label={`Drag Focus Loop ${segment.name}`}
                              className="absolute inset-y-3 left-[9px] right-[9px] z-[2] cursor-grab rounded-sm bg-transparent px-2 pt-px text-left text-[9px] font-medium text-emerald-50 hover:bg-black/22 active:cursor-grabbing"
                              onPointerDown={(e) => segmentBodyMoveDown(e, loop, segment)}
                            >
                              {segment.name.trim() || "Focus Loop"}
                            </button>
                            <div
                              aria-label={`Focus Loop ${segment.name} end`}
                              className="absolute inset-y-3 right-0 z-[3] w-[9px] max-w-[34%] cursor-ew-resize rounded-r-md bg-emerald-300/35 hover:bg-emerald-200/50"
                              onPointerDown={(e) =>
                                segmentEdgeResizeDown(e, loop, segment, "end")
                              }
                            />
                          </>
                        ) : phraseOverlayActive ? (
                          <button
                            type="button"
                            aria-label={`Select Focus Loop ${segment.name}`}
                            className="absolute inset-1 z-[2] cursor-default rounded-sm bg-transparent px-2 pt-px text-left text-[9px] font-medium text-emerald-50/95 hover:bg-black/14"
                            onPointerDown={(e) =>
                              segmentSelectPointerDown(e, loop, segment)
                            }
                          >
                            {segment.name.trim() || "Focus Loop"}
                          </button>
                        ) : null}
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});