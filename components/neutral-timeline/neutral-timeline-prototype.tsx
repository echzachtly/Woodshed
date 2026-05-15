"use client";

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type { PracticeLoop } from "@/lib/loop-engine";
import { cn } from "@/lib/utils";

import {
  pickMajorTickIntervalSec,
  pointerClientToSeconds,
  secondsToContentPx,
  timelineLogicalWidthPx,
  timelineScrollWidthPx,
  timelineViewportRatios,
} from "@/components/neutral-timeline/timeline-coordinates";

export type NeutralTimelinePrototypeProps = {
  duration: number;
  currentTime: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  /** Matches WaveSurfer `minPxPerSec` — shared zoom semantic with main waveform. */
  pxPerSec: number;
  onPxPerSecChange: (nextPxPerSec: number) => void;
  onSeek: (seconds: number) => void;
};

const RULER_H = 26;
const PAN_SLOP_PX = 4;

/** Phase 3 prototype — DAW-style ruler strip (no waveform peaks). */
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
  } = props;

  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [scrollMetrics, setScrollMetrics] = useState({
    scrollLeft: 0,
    scrollWidth: 1,
    clientWidth: 1,
  });

  const logicalWidth = useMemo(
    () => timelineLogicalWidthPx(duration, pxPerSec),
    [duration, pxPerSec],
  );

  const scrollWidthPx = useMemo(
    () => timelineScrollWidthPx(logicalWidth, viewportWidth),
    [logicalWidth, viewportWidth],
  );

  const tickMajorSec = useMemo(
    () => pickMajorTickIntervalSec(pxPerSec),
    [pxPerSec],
  );

  const tickMarks = useMemo(() => {
    if (!(duration > 0)) return [];
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += tickMajorSec) {
      out.push(Math.min(t, duration));
    }
    return out;
  }, [duration, tickMajorSec]);

  const viewportRatios = useMemo(
    () =>
      timelineViewportRatios({
        scrollLeft: scrollMetrics.scrollLeft,
        scrollWidth: scrollMetrics.scrollWidth,
        viewportWidth: scrollMetrics.clientWidth,
      }),
    [scrollMetrics],
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
    const ro = new ResizeObserver(() => {
      setViewportWidth(host.clientWidth);
    });
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

  /** Vertical wheel scroll → horizontal scrub (prototype ergonomics). */
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

  /** Follow playhead loosely during playback — thin UX smoke test only. */
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

  const panSession = useRef<{
    pointerId: number;
    startClientX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);

  const onPointerDownTrack = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-neutral-timeline-zoom]")) return;

    const el = scrollRef.current;
    if (!el) return;

    panSession.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
    };
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onPointerMoveTrack = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const sess = panSession.current;
      const el = scrollRef.current;
      if (!sess || !el || event.pointerId !== sess.pointerId) return;

      const dx = event.clientX - sess.startClientX;
      if (Math.abs(dx) >= PAN_SLOP_PX) sess.moved = true;
      if (sess.moved) {
        el.scrollLeft = sess.startScrollLeft - dx;
        refreshScrollMetrics();
      }
    },
    [refreshScrollMetrics],
  );

  const finishPanSession = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const sess = panSession.current;
      const el = scrollRef.current;
      if (!sess || !el || event.pointerId !== sess.pointerId) return;

      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }

      if (!sess.moved && scrollRef.current && duration > 0) {
        const rect = scrollRef.current.getBoundingClientRect();
        const sec = pointerClientToSeconds({
          clientX: event.clientX,
          scrollHostLeft: rect.left,
          scrollLeft: scrollRef.current.scrollLeft,
          pxPerSec,
          durationSec: duration,
        });
        onSeek(sec);
      }

      panSession.current = null;
    },
    [duration, onSeek, pxPerSec],
  );

  const formatTickLabel = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const zoomOut = useCallback(() => {
    onPxPerSecChange(pxPerSec / 1.22);
  }, [onPxPerSecChange, pxPerSec]);

  const zoomIn = useCallback(() => {
    onPxPerSecChange(pxPerSec * 1.22);
  }, [onPxPerSecChange, pxPerSec]);

  if (!(duration > 0)) return null;

  const playheadPx = secondsToContentPx(currentTime, pxPerSec);

  return (
    <div
      className="border-b border-stone-800/80 bg-[#070605] px-3 py-2 sm:px-4"
      aria-label="Neutral timeline prototype (development)"
    >
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="select-none text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
          Neutral timeline prototype
        </span>
        <button
          type="button"
          data-neutral-timeline-zoom="true"
          className="rounded border border-stone-700 bg-stone-900 px-2 py-0.5 text-[11px] text-stone-300 hover:bg-stone-800"
          onClick={zoomOut}
        >
          Zoom −
        </button>
        <button
          type="button"
          data-neutral-timeline-zoom="true"
          className="rounded border border-stone-700 bg-stone-900 px-2 py-0.5 text-[11px] text-stone-300 hover:bg-stone-800"
          onClick={zoomIn}
        >
          Zoom +
        </button>
        <span className="text-[10px] text-stone-600">
          {pxPerSec.toFixed(1)} px/s · {duration.toFixed(1)}s
        </span>
      </div>

      <div
        ref={hostRef}
        className="rounded-md border border-stone-800/90 bg-[#0b0908]"
      >
        <div
          ref={scrollRef}
          className="relative max-w-full overflow-x-auto overflow-y-hidden"
          style={{ scrollbarWidth: "thin" }}
          onPointerDown={onPointerDownTrack}
          onPointerMove={onPointerMoveTrack}
          onPointerUp={finishPanSession}
          onPointerCancel={finishPanSession}
        >
          <div
            className="relative cursor-crosshair select-none"
            style={{
              width: scrollWidthPx,
              height: RULER_H + 52,
            }}
          >
            {/* Ruler */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 border-b border-stone-700/80 bg-[#100e0c]"
              style={{ height: RULER_H }}
            >
              {tickMarks.map((t) => {
                const leftPx = secondsToContentPx(t, pxPerSec);
                return (
                  <div
                    key={`tick-${t}`}
                    className="pointer-events-none absolute top-0 flex flex-col items-center"
                    style={{
                      left: leftPx,
                      transform: "translateX(-50%)",
                      height: RULER_H,
                    }}
                  >
                    <span className="mt-1 block h-2 w-px bg-stone-500/90" />
                    <span className="mt-0.5 whitespace-nowrap text-[9px] tabular-nums text-stone-500">
                      {formatTickLabel(t)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Practice Sections + Focus strips */}
            <div className="absolute inset-x-0 bottom-0 top-[26px]">
              <div className="relative h-full w-full">
                {loops.map((loop) => {
                  const active = loop.id === activeLoopId;
                  const left = secondsToContentPx(loop.start, pxPerSec);
                  const width = Math.max(
                    2,
                    secondsToContentPx(loop.end - loop.start, pxPerSec),
                  );
                  return (
                    <div key={`phrase-${loop.id}`}>
                      <div
                        className={cn(
                          "pointer-events-none absolute top-2 bottom-[42%] rounded-sm border",
                          active
                            ? "border-violet-400/55 bg-violet-950/55"
                            : "border-violet-800/35 bg-violet-950/25",
                        )}
                        style={{ left, width }}
                        title={loop.name}
                      />
                      {(loop.segments ?? []).map((seg) => {
                        const segActive =
                          active && seg.id === activeSegmentId;
                        const sl = secondsToContentPx(seg.startTime, pxPerSec);
                        const sw = Math.max(
                          2,
                          secondsToContentPx(
                            seg.endTime - seg.startTime,
                            pxPerSec,
                          ),
                        );
                        return (
                          <div
                            key={`seg-${seg.id}`}
                            className={cn(
                              "pointer-events-none absolute bottom-2 top-[58%] rounded-sm border",
                              segActive
                                ? "border-amber-300/55 bg-amber-950/45"
                                : "border-amber-700/35 bg-amber-950/25",
                            )}
                            style={{ left: sl, width: sw }}
                            title={seg.name}
                          />
                        );
                      })}
                    </div>
                  );
                })}

                {/* Playhead */}
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-gradient-to-b from-violet-200/95 via-violet-100 to-violet-200/95 shadow-[0_0_10px_rgba(216,180,254,0.35)]"
                  style={{
                    left: playheadPx,
                    transform: "translateX(-0.5px)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Viewport minim strip — ratios reuse waveform-manager semantics */}
      <div
        className="relative mx-auto mt-2 h-1 max-w-full overflow-hidden rounded-full bg-stone-800/90"
        aria-hidden
      >
        <div
          className="absolute inset-y-0 rounded-full bg-violet-500/35"
          style={{
            left: `${viewportRatios.startRatio * 100}%`,
            width: `${viewportRatios.durationRatio * 100}%`,
          }}
        />
      </div>
    </div>
  );
});
