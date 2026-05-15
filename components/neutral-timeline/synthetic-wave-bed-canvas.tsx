"use client";

import { memo, useEffect, useRef } from "react";

import { syntheticWaveNormalized } from "@/components/neutral-timeline/synthetic-wave-bed";

export type SyntheticWaveBedCanvasProps = {
  /** Content width in CSS pixels (matches timeline scroll width). */
  widthPx: number;
  /** Track band height in CSS pixels. */
  heightPx: number;
};

/**
 * Muted filled band + faint stroke — sits under phrase/focus/playhead layers.
 * `pointer-events: none` — all hit testing stays on the parent scroll surface.
 */
export const SyntheticWaveBedCanvas = memo(function SyntheticWaveBedCanvas(
  props: SyntheticWaveBedCanvasProps,
) {
  const { widthPx, heightPx } = props;
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
    /** Low amplitude — clearly secondary to overlays. */
    const amp = heightPx * 0.13;
    const step = Math.max(2, Math.ceil(widthPx / 700));

    const topY = (t: number) => mid + syntheticWaveNormalized(t) * amp;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let x = 0; x <= widthPx; x += step) {
      ctx.lineTo(x, topY(x));
    }
    ctx.lineTo(widthPx, mid);
    ctx.closePath();

    const fillGrd = ctx.createLinearGradient(0, 0, 0, heightPx);
    fillGrd.addColorStop(0, "rgba(224,210,255,0.045)");
    fillGrd.addColorStop(0.45, "rgba(91,82,74,0.09)");
    fillGrd.addColorStop(1, "rgba(38,34,31,0.08)");
    ctx.fillStyle = fillGrd;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, topY(0));
    for (let x = step; x <= widthPx; x += step) {
      ctx.lineTo(x, topY(x));
    }
    ctx.strokeStyle = "rgba(224,210,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [widthPx, heightPx]);

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
