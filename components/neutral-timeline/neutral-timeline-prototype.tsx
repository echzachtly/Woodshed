"use client";

/**
 * Synthetic (neutral) timeline — ruler + faux waveform + overlays.
 *
 * **WaveSurfer vs synthetic authoring:** Upload workspace regions are RegionsPlugin handles on decoded
 * waveform pixels; this strip maps **pixels → seconds** only (`pointerClientToSeconds`). All bounds
 * clamping mirrors store expectations (`updateLoopBounds` → `clampSegmentsToPhraseBounds` for phrases).
 *
 * **Gesture separation:** Explicit **Pan timeline** vs **Edit timeline**.
 * - Pan — horizontal drag scrolls; release without movement seeks (except over zoom chrome).
 * - Edit — ruler stays non-authoring/non-seek by design (use Pan mode to scrub ticks); empty phrase-band
 *   tap seeks; phrase-band drag creates Practice Sections when the Section tool is active; active
 *   phrase + Focus tool + drag in the lower band authors Focus Loops. Regions use `pointerdown`
 *   `stopPropagation` so scrub/tap-drag never competes with body/handle dragging.
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
  frontmostPhraseAtTime,
  minPhraseOrSegmentSpanSec,
  secondsDeltaFromPixelDelta,
} from "@/components/neutral-timeline/synthetic-timeline-regions";

export type SyntheticTimelineAuthoringConfig = {
  enabled: boolean;
  interactionMode: "pan" | "edit";
  onInteractionModeChange: (mode: "pan" | "edit") => void;
  editTool: "section" | "focus";
  onEditToolChange: (tool: "section" | "focus") => void;
  activePhraseId: string | null;
  onPhraseBandDragCreate: (startSec: number, endSec: number) => void;
  onFocusBandDragCreate: (
    phraseId: string,
    startSec: number,
    endSec: number,
  ) => void;
  onSelectPhrase: (id: string | null) => void;
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

const RULER_H = 26;
const TRACK_BAND_PX = 52;
const PAN_SLOP_PX = 4;
const PHRASE_BAND_END_FRAC_OF_TRACK = 0.58;

const noop = () => {};
const NOOP_AUTHORING_CTX: SyntheticTimelineAuthoringConfig = {
  enabled: false,
  interactionMode: "pan",
  onInteractionModeChange: noop,
  editTool: "section",
  onEditToolChange: noop,
  activePhraseId: null,
  onPhraseBandDragCreate: noop,
  onFocusBandDragCreate: noop,
  onSelectPhrase: noop,
  onSelectFocus: noop,
  onPhraseBoundsCommit: noop,
  onSegmentBoundsCommit: noop,
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
      mode: "draftPhrase";
      pid: number;
      aSec: number;
      ax: number;
      moved: boolean;
    }
  | {
      mode: "draftFocus";
      pid: number;
      phraseId: string;
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
  });

  liveRef.current.duration = duration;
  liveRef.current.pxPerSec = pxPerSec;
  liveRef.current.loops = loops;

  const gestureUnhookRef = useRef<(() => void) | null>(null);

  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });
  const [ghostNonce, setGhostTick] = useState(0);
  const bumpGhost = useCallback(() => setGhostTick((n) => n + 1), []);

  const auth = authoring;
  const authOn = Boolean(auth?.enabled);

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
      return y <= TRACK_BAND_PX * PHRASE_BAND_END_FRAC_OF_TRACK
        ? ("phrase" as const)
        : ("focus" as const);
    },
    [],
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

        if (g.mode === "draftPhrase") {
          if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
          if (!(g.moved && ctx.editTool === "section")) return;
          const lo = Math.min(g.aSec, secNow);
          const hi = Math.max(g.aSec, secNow);
          if (
            frontmostPhraseAtTime(live.loops, lo) ||
            frontmostPhraseAtTime(live.loops, hi)
          ) {
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

        if (g.mode === "draftFocus") {
          if (Math.abs(e.clientX - g.ax) >= PAN_SLOP_PX) g.moved = true;
          const phrase = live.loops.find((l) => l.id === g.phraseId);
          if (!phrase || !(g.moved && ctx.editTool === "focus")) return;
          let lo = Math.min(g.aSec, secNow);
          let hi = Math.max(g.aSec, secNow);
          lo = Math.max(lo, phrase.start);
          hi = Math.min(hi, phrase.end);
          if (!(hi > lo)) {
            ghostFocusRef.current = null;
            bumpGhost();
            return;
          }
          const cl = clampSegmentStartEndInPhrase(lo, hi, phrase.start, phrase.end);
          ghostFocusRef.current = [cl.start, cl.end];
          ghostPhraseRef.current = null;
          bumpGhost();
          return;
        }

        if (!ctx.enabled || ctx.interactionMode !== "edit") return;

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

        if (g.mode === "draftPhrase") {
          if (!(live.duration > 0)) return;
          if (!g.moved) {
            onSeek(secTap);
            return;
          }
          const ghost = ghostPhraseDraft;
          if (
            ghost &&
            ctx.enabled &&
            ghost[1] - ghost[0] >= minPhraseOrSegmentSpanSec(live.duration) - 1e-9
          ) {
            ctx.onPhraseBandDragCreate(ghost[0], ghost[1]);
          }
          return;
        }

        if (g.mode === "draftFocus") {
          if (!(live.duration > 0)) return;
          if (!g.moved) {
            onSeek(secTap);
            return;
          }
          const ghost = ghostFocusDraft;
          const ph = live.loops.find((l) => l.id === g.phraseId);
          if (
            ghost &&
            ph &&
            ctx.enabled &&
            ghost[1] - ghost[0] >= minPhraseOrSegmentSpanSec(ph.end - ph.start) - 1e-9
          ) {
            ctx.onFocusBandDragCreate(g.phraseId, ghost[0], ghost[1]);
          }
          return;
        }

        if (ctx.enabled && ctx.interactionMode === "edit") {
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

      const band = bandAt(event);

      const panChosen =
        !authOn || (auth?.interactionMode ?? "pan") === "pan";

      /** Pan timeline (classic) — also when authoring off */
      if (panChosen) {
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
        return;
      }

      const a = auth;
      if (!a) return;

      /** Edit — backdrop draft only (regions stopPropagation). */
      if (!(event.target as HTMLElement)?.closest?.("[data-neutral-timeline-region]")) {
        if (band === "ruler" || band === "outside") return;
        const sec0 = secsFromClient(event.clientX);
        if (band === "phrase" && a.editTool === "section") {
          if (frontmostPhraseAtTime(loops, sec0)) return;
          gestureRef.current = {
            mode: "draftPhrase",
            pid: event.pointerId,
            aSec: sec0,
            ax: event.clientX,
            moved: false,
          };
          ghostPhraseRef.current = null;
          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
          bindGestureHooks(gestureRef.current, a);
          return;
        }
        if (band === "focus" && a.editTool === "focus") {
          const phraseId = a.activePhraseId;
          if (!phraseId) return;
          const phrase = loops.find((l) => l.id === phraseId);
          if (!(phrase && sec0 >= phrase.start && sec0 <= phrase.end)) return;
          gestureRef.current = {
            mode: "draftFocus",
            pid: event.pointerId,
            phraseId,
            aSec: sec0,
            ax: event.clientX,
            moved: false,
          };
          try {
            el.setPointerCapture(event.pointerId);
          } catch {
            /* ignore */
          }
          bindGestureHooks(gestureRef.current, a);
          return;
        }
      }
    },
    [auth, authOn, bandAt, bindGestureHooks, duration, loops, rulerIgnored, secsFromClient],
  );

  void ghostNonce;

  const phraseStripPx = TRACK_BAND_PX * PHRASE_BAND_END_FRAC_OF_TRACK;
  const focusStripPx = TRACK_BAND_PX - phraseStripPx;

  const phraseEditActive = Boolean(
    auth &&
      authOn &&
      auth.interactionMode === "edit" &&
      auth.editTool === "section",
  );
  const focusEditActive = Boolean(
    auth &&
      authOn &&
      auth.interactionMode === "edit" &&
      auth.editTool === "focus",
  );

  /** Focus tool: tapping the phrase ribbon activates the phrase for bottom-band authoring. */
  const onPhraseBackdropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, loop: PracticeLoop) => {
      if (!auth || !authOn || auth.interactionMode !== "edit" || event.button !== 0)
        return;
      if (loop.end <= loop.start) return;
      event.stopPropagation();
      if (auth.editTool === "focus") {
        auth.onSelectPhrase(loop.id);
      }
    },
    [auth, authOn],
  );

  const phraseBodyMoveDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, loop: PracticeLoop) => {
      if (!auth || !phraseEditActive || event.button !== 0) return;
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
    [auth, phraseEditActive, bindGestureHooks],
  );

  const phraseEdgeResizeDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      edge: "start" | "end",
    ) => {
      if (!auth || !phraseEditActive || event.button !== 0) return;
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
    [auth, phraseEditActive, bindGestureHooks],
  );

  const segmentBodyMoveDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
    ) => {
      if (!auth || !focusEditActive || event.button !== 0) return;
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
    [auth, focusEditActive, bindGestureHooks],
  );

  const segmentEdgeResizeDown = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      loop: PracticeLoop,
      segment: PhraseSegment,
      edge: "start" | "end",
    ) => {
      if (!auth || !focusEditActive || event.button !== 0) return;
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
    [auth, focusEditActive, bindGestureHooks],
  );

  const phraseGhostDraft = ghostPhraseRef.current;
  const focusGhostDraft = ghostFocusRef.current;

  const regionPointerShell =
    authOn && auth?.interactionMode === "edit"
      ? "pointer-events-auto"
      : "pointer-events-none";

  return (
    <div
      ref={hostRef}
      className="flex flex-col overflow-hidden border-b border-stone-900/85 bg-[#070605]"
    >
      {auth?.enabled ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-800/65 bg-[#080605]/90 px-3 py-1.5 text-[11px] text-stone-300">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Synthetic timeline
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex rounded-md border border-stone-800/85 bg-black/55 p-0.5 shadow-inner shadow-black/30"
              role="group"
              aria-label="Scroll vs edit timeline"
            >
              <button
                type="button"
                className={cn(
                  "rounded-[5px] px-2 py-1 font-medium outline-none ring-violet-500/35 transition focus-visible:ring-2",
                  auth.interactionMode === "pan"
                    ? "bg-stone-800/95 text-white"
                    : "text-stone-500 hover:text-stone-300",
                )}
                aria-pressed={auth.interactionMode === "pan"}
                onClick={() => auth.onInteractionModeChange("pan")}
              >
                Pan
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-[5px] px-2 py-1 font-medium outline-none ring-violet-500/35 transition focus-visible:ring-2",
                  auth.interactionMode === "edit"
                    ? "bg-stone-800/95 text-white"
                    : "text-stone-500 hover:text-stone-300",
                )}
                aria-pressed={auth.interactionMode === "edit"}
                onClick={() => auth.onInteractionModeChange("edit")}
              >
                Edit
              </button>
            </div>
            {auth.interactionMode === "edit" ? (
              <div
                className="flex rounded-md border border-stone-800/85 bg-black/55 p-0.5 shadow-inner shadow-black/30"
                role="group"
                aria-label="Practice Section vs Focus Loop authoring tool"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-[5px] px-2 py-1 font-medium outline-none ring-violet-500/35 transition focus-visible:ring-2",
                    auth.editTool === "section"
                      ? "bg-violet-900/90 text-white"
                      : "text-stone-500 hover:text-stone-300",
                  )}
                  aria-pressed={auth.editTool === "section"}
                  onClick={() => auth.onEditToolChange("section")}
                >
                  Section
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-[5px] px-2 py-1 font-medium outline-none ring-violet-500/35 transition focus-visible:ring-2",
                    auth.editTool === "focus"
                      ? "bg-emerald-950/95 text-emerald-100"
                      : "text-stone-500 hover:text-stone-300",
                  )}
                  aria-pressed={auth.editTool === "focus"}
                  onClick={() => auth.onEditToolChange("focus")}
                >
                  Focus
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        ref={scrollRef}
        className="neutral-timeline-scrollbar relative overflow-x-auto overflow-y-hidden px-3 py-3"
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
                      <span className="-translate-x-1/2 whitespace-nowrap pl-px font-mono text-[9px] text-stone-600">
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
            style={{ height: TRACK_BAND_PX }}
          >
            <SyntheticWaveBedCanvas widthPx={scrollWidthPx} heightPx={TRACK_BAND_PX} />

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
                  height: TRACK_BAND_PX,
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
                      onPointerDown={(e) => onPhraseBackdropPointerDown(e, loop)}
                    >
                      {phraseEditActive ? (
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
                      ) : focusEditActive ? (
                        <div className="absolute inset-2 rounded-[3px]" />
                      ) : null}
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

                    const segHitClass = cn(
                      "absolute rounded-sm border backdrop-blur-[1px] transition-colors",
                      focusEditActive ? regionPointerShell : "pointer-events-none opacity-70",
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
                        {focusEditActive ? (
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