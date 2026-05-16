"use client";

import { memo, useEffect, useRef } from "react";

import { syntheticWaveNormalized } from "@/components/neutral-timeline/synthetic-wave-bed";

export type SyntheticWaveBedCanvasProps = {
  /** Content width in CSS pixels (matches timeline scroll width). */
  widthPx: number;
  /** Track band height in CSS pixels. */
  heightPx: number;
  /** Elapsed corridor in px (same coords as waveform X). */
  playedWidthPx: number;
  /** Brighter waveform energy while transport is advancing. */
  playbackActive?: boolean;
};

/** Sample waveform top Y across [xLo, xHi]; includes both ends. */
function sampleWaveTopYs(
  xLo: number,
  xHi: number,
  widthPx: number,
  step: number,
  mid: number,
  amp: number,
): [number, number][] {
  const lo = Math.max(0, Math.min(xLo, widthPx));
  const hi = Math.max(0, Math.min(xHi, widthPx));
  if (!(hi > lo - 1e-6)) return [[lo, mid + syntheticWaveNormalized(lo) * amp]];
  const out: [number, number][] = [];
  let x = lo;
  for (;;) {
    const xx = Math.min(hi, x);
    out.push([xx, mid + syntheticWaveNormalized(xx) * amp]);
    if (xx >= hi - 1e-9) break;
    x += step;
    if (out.length > 16000) break;
  }
  const last = out[out.length - 1];
  if (last && last[0] < hi - 1e-6) {
    out.push([hi, mid + syntheticWaveNormalized(hi) * amp]);
  }
  return out;
}

function fillUnderHelix(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  mid: number,
  fillStyle: string,
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  const [x0, y0] = pts[0]!;
  ctx.moveTo(x0, mid);
  ctx.lineTo(x0, y0);
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i]!;
    ctx.lineTo(x, y);
  }
  const [xl, yl] = pts[pts.length - 1]!;
  ctx.lineTo(xl, mid);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
}

function strokeHelix(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  strokeStyle: string,
  lineWidth: number,
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]![0], pts[i]![1]);
  }
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Synthetic helix + subtle under-curve fills — progress is **stroke-based** (played vs unplayed),
 * not a full-height wash. Sits under phrase/focus/playhead layers.
 */
export const SyntheticWaveBedCanvas = memo(function SyntheticWaveBedCanvas(
  props: SyntheticWaveBedCanvasProps,
) {
  const { widthPx, heightPx, playedWidthPx, playbackActive = false } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !(widthPx > 0) || !(heightPx > 0)) return;

    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(widthPx * dpr));
    canvas.height = Math.max(1, Math.floor(heightPx * dpr));
    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, widthPx, heightPx);

    const mid = heightPx * 0.5;
    const amp = heightPx * 0.098;
    const step = Math.max(2, Math.ceil(widthPx / 700));

    let split = Math.min(widthPx, Math.max(0, playedWidthPx));

    const ptsPlayed =
      split > 1e-6 ? sampleWaveTopYs(0, split, widthPx, step, mid, amp) : [];
    const ptsUnplayed =
      split < widthPx - 1e-6
        ? sampleWaveTopYs(split, widthPx, widthPx, step, mid, amp)
        : [];

    /** Subtle wedges under helix — shape-following, not full-band rectangles. */
    const fillPlayed = playbackActive
      ? "rgba(214,208,247,0.055)"
      : "rgba(200,188,246,0.042)";
    const fillUnplayed = "rgba(45,43,62,0.045)";

    if (ptsPlayed.length >= 2) {
      fillUnderHelix(ctx, ptsPlayed, mid, fillPlayed);
    }
    if (ptsUnplayed.length >= 2) {
      fillUnderHelix(ctx, ptsUnplayed, mid, fillUnplayed);
    }

    /** Unplayed stroke muted; played brighter — nearer audio waveform progress. */
    const strokePlayed = playbackActive
      ? "rgba(237,229,253,0.52)"
      : "rgba(220,210,255,0.36)";
    const strokeUnplayed = "rgba(120,118,146,0.14)";
    const lwPlayed = playbackActive ? 1.65 : 1.35;
    const lwUnplayed = 1.05;

    if (ptsUnplayed.length >= 2) {
      strokeHelix(ctx, ptsUnplayed, strokeUnplayed, lwUnplayed);
    }
    if (ptsPlayed.length >= 2) {
      strokeHelix(ctx, ptsPlayed, strokePlayed, lwPlayed);
    }
  }, [widthPx, heightPx, playedWidthPx, playbackActive]);

  if (!(widthPx > 0) || !(heightPx > 0)) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-0 top-0 z-0"
      style={{
        width: widthPx,
        height: heightPx,
      }}
      aria-hidden
    />
  );
});
