"use client";

import { memo, useEffect, useMemo } from "react";

import {
  pickMajorTickIntervalSec,
  secondsToContentPx,
} from "@/components/neutral-timeline/timeline-coordinates";
import { cn } from "@/lib/utils";

type TimeRulerProps = {
  duration: number;
  pxPerSec: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
  contentWidthPx: number;
  leftOffsetPx?: number;
  className?: string;
  diagnostics?: {
    enabled: boolean;
    onRender?: () => void;
  };
};

function fmtRuler(seconds: number): string {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) return "0:00";
  const fl = Math.floor(seconds);
  const m = Math.floor(fl / 60);
  const s = fl % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const TimeRuler = memo(function TimeRuler(props: TimeRulerProps) {
  const {
    duration,
    pxPerSec,
    scrollLeftPx,
    viewportWidthPx,
    contentWidthPx,
    leftOffsetPx = 0,
    className,
    diagnostics,
  } = props;

  useEffect(() => {
    if (!diagnostics?.enabled) return;
    diagnostics.onRender?.();
  });

  const majorTickSec = useMemo(() => pickMajorTickIntervalSec(pxPerSec), [pxPerSec]);
  const ticks = useMemo(() => {
    if (!(duration > 0) || !(majorTickSec > 0)) return [];
    const out: number[] = [];
    for (let t = 0; t <= duration + 1e-6; t += majorTickSec) {
      out.push(Math.min(duration, t));
    }
    return out;
  }, [duration, majorTickSec]);

  return (
    <div className={cn("relative h-9 select-none", className)} aria-hidden="true">
      <div className="absolute inset-x-0 top-[30px] h-px bg-stone-800/70" />
      <div
        className="pointer-events-none absolute inset-y-0 left-0"
        style={{ width: Math.max(1, contentWidthPx) }}
      >
        {ticks.map((t, i) => {
          const leftPx = leftOffsetPx + secondsToContentPx(t, pxPerSec) - scrollLeftPx;
          const vw = Math.max(1, viewportWidthPx);
          const xView = leftPx / vw;
          if (xView < -0.15 || xView > 1.35) return null;
          const showMajor = t === 0 || i === 0 || i % 5 === 0;
          return (
            <div
              key={`ruler-tick-${String(t)}:${i}`}
              className="absolute top-[18px]"
              style={{ transform: `translate3d(${leftPx}px, 0, 0)` }}
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
  );
});

