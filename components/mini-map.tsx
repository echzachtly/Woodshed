"use client";

import { memo, useEffect, useRef } from "react";

import type { PracticeLoop } from "@/lib/loop-engine";
import {
  downsamplePeaks,
  type VisibleWindow,
} from "@/lib/waveform-manager";
import { cn } from "@/lib/utils";

type Props = {
  peaks?: Float32Array | null;
  duration: number;
  currentTime: number;
  viewport: VisibleWindow;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onNavigate: (seconds: number) => void;
  /** Normalized scrollbar ratio (WaveSurfer `scrollLeft/maxScroll`). */
  onViewportPanToRatio: (startRatioNormalized: number) => void;
  /** Double-click overview to reset zoom to full song (desktop practice). */
  onFitAll?: () => void;
  /** Mobile practice: visual overview only — no seek or viewport drag. */
  readOnly?: boolean;
  /** Extra classes on the outer wrapper (e.g. compact height on mobile). */
  className?: string;
  /** Desktop: sit above the main waveform; default sits below. */
  placement?: "top" | "bottom";
  /** Tighter strip for mobile overview under transport. */
  density?: "default" | "compact";
};

function clampFrac(x: number) {
  return Math.min(1, Math.max(0, x));
}

export const MiniMap = memo(function MiniMap(props: Props) {
  const {
    peaks,
    duration,
    currentTime,
    viewport,
    loops,
    activeLoopId,
    onNavigate,
    onViewportPanToRatio,
    onFitAll,
    readOnly = false,
    className,
    placement = "bottom",
    density = "default",
  } = props;
  const compact = density === "compact";
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dragSession = useRef<
    | {
        mode: "scrub" | "pan";
        pointerId: number;
        startClientX: number;
        anchorScrollRatio: number;
        canvasWidth: number;
      }
    | null
  >(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#141210";
    ctx.fillRect(0, 0, width, height);

    if (peaks && peaks.length && duration > 0) {
      const bucketCount = Math.max(64, Math.floor(width));
      const arr = Array.from(peaks);
      const down = downsamplePeaks(arr.map((v) => Math.abs(v)), bucketCount);
      ctx.strokeStyle = "#6b6357";
      ctx.beginPath();
      for (let x = 0; x < down.length; x++) {
        const amp = Math.min(1, down[x] ?? 0);
        const yCenter = height / 2;
        const ampPx = amp * height * 0.92;
        const xPx = (x / down.length) * width;
        ctx.moveTo(xPx, yCenter - ampPx / 2);
        ctx.lineTo(xPx, yCenter + ampPx / 2);
      }
      ctx.stroke();
    } else if (duration <= 0) {
      ctx.fillStyle = "#78716c";
      ctx.font = "12px system-ui";
      ctx.fillText("Load audio to populate overview", 10, height / 2 + 4);
    }

    const drawLoop = (loop: PracticeLoop, active: boolean) => {
      if (!duration) return;
      const x1 = (loop.start / duration) * width;
      const x2 = (loop.end / duration) * width;
      ctx.fillStyle = active
        ? "rgba(196,181,253,0.55)"
        : "rgba(100,116,139,0.30)";
      ctx.fillRect(Math.min(x1, x2), 0, Math.max(Math.abs(x2 - x1), 2), height);
      ctx.strokeStyle = active
        ? "rgba(221,214,254,0.95)"
        : "rgba(148,163,184,0.40)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.min(x1, x2),
        0,
        Math.max(Math.abs(x2 - x1), 2),
        height - 1,
      );
    };

    for (const loop of loops) {
      drawLoop(loop, loop.id === activeLoopId);
    }

    if (duration > 0) {
      const playX = Math.min(width, Math.max(0, (currentTime / duration) * width));
      ctx.strokeStyle = "rgba(252,211,77,0.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();

      /** Viewport window — soft fill + gentle rim + depth shadow. */
      const viewX = viewport.startRatio * width;
      const viewW = Math.max(4, viewport.durationRatio * width);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = "rgba(250,250,249,0.085)";
      ctx.fillRect(viewX, 1, viewW, height - 2);
      ctx.restore();
      ctx.strokeStyle = "rgba(250,250,249,0.42)";
      ctx.lineWidth = 1.25;
      ctx.strokeRect(viewX + 0.5, 1.5, viewW - 1, height - 3);
    }
  }, [peaks, duration, currentTime, viewport, loops, activeLoopId, placement, density]);

  return (
    <div
      className={cn(
        placement === "top"
          ? "border-b border-stone-800/50 bg-[#0c0a09]/90 px-3 py-1 sm:px-4"
          : "border-t border-stone-800/50 bg-[#0c0a09]/90 px-5 py-2",
        compact && "border-b border-stone-800/45 bg-[#0c0a09]/85 px-2 py-1",
        readOnly && "pointer-events-none select-none",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-1.5 text-[10px] uppercase tracking-[0.16em] text-stone-500 sm:gap-2 sm:text-[11px] sm:tracking-[0.18em]",
          compact && "gap-1 text-[9px] tracking-[0.12em]",
        )}
      >
        <span>Overview</span>
        <span
          className={cn(
            "text-xs text-stone-400 normal-case tracking-normal",
            compact && "max-w-[70%] truncate text-[9px]",
          )}
        >
          {readOnly
            ? "Read-only preview"
            : onFitAll
              ? "Click to seek · drag to pan · double-click to fit all"
              : "Click to seek · drag the window to pan"}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        className={cn(
          "w-full touch-none select-none rounded-md border border-stone-800/55 bg-stone-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_6px_18px_rgba(0,0,0,0.4)]",
          compact ? "mt-0.5 h-10" : placement === "top"
            ? "mt-1 h-[4.5rem]"
            : "mt-1.5 h-[5.5rem]",
          readOnly ? "cursor-default" : "cursor-crosshair",
        )}
        onPointerDown={(event) => {
          if (readOnly) return;
          if (!duration) return;
          const canvas = canvasRef.current;
          if (!canvas) return;

          canvas.setPointerCapture(event.pointerId);
          const rect = canvas.getBoundingClientRect();
          const w = rect.width;
          const viewXRatio = viewport.startRatio;
          const viewWRatioPx = viewport.durationRatio * w;
          const hitPadPx = Math.max(10, Math.min(viewWRatioPx * 0.2, w * 0.04));
          const viewLeftPx = viewXRatio * w;
          const insideViewport =
            viewport.durationRatio < 0.98 &&
            event.clientX - rect.left >= viewLeftPx - hitPadPx &&
            event.clientX - rect.left <= viewLeftPx + viewWRatioPx + hitPadPx;

          if (insideViewport) {
            dragSession.current = {
              mode: "pan",
              pointerId: event.pointerId,
              startClientX: event.clientX,
              anchorScrollRatio: viewport.startRatio,
              canvasWidth: w,
            };
          } else {
            dragSession.current = {
              mode: "scrub",
              pointerId: event.pointerId,
              startClientX: event.clientX,
              anchorScrollRatio: 0,
              canvasWidth: w,
            };
            const ratioPx = clampFrac((event.clientX - rect.left) / w);
            onNavigate(ratioPx * duration);
          }
        }}
        onPointerMove={(event) => {
          if (readOnly) return;
          const sess = dragSession.current;
          if (!sess || event.pointerId !== sess.pointerId) return;
          const canvas = canvasRef.current;
          if (!canvas || !duration) return;
          const rect = canvas.getBoundingClientRect();

          if (sess.mode === "scrub") {
            const ratioPx = clampFrac((event.clientX - rect.left) / sess.canvasWidth);
            onNavigate(ratioPx * duration);
            return;
          }

          if (sess.mode === "pan" && sess.canvasWidth > 0) {
            const deltaPx = event.clientX - sess.startClientX;
            const deltaRatio = deltaPx / sess.canvasWidth;
            onViewportPanToRatio(clampFrac(sess.anchorScrollRatio + deltaRatio));
          }
        }}
        onPointerUp={(event) => {
          if (readOnly) return;
          const canvas = canvasRef.current;
          const sess = dragSession.current;
          if (sess && event.pointerId === sess.pointerId) {
            canvas?.releasePointerCapture(event.pointerId);
            dragSession.current = null;
          }
        }}
        onPointerCancel={(event) => {
          if (readOnly) return;
          canvasRef.current?.releasePointerCapture(event.pointerId);
          dragSession.current = null;
        }}
        onDoubleClick={(event) => {
          if (readOnly || !duration || !onFitAll) return;
          event.preventDefault();
          onFitAll();
        }}
      />
    </div>
  );
});
