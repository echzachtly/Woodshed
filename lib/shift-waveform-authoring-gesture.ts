import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";
import { peekWaveSurferDom } from "@/lib/waveform-scroll";
import { pointerClientXToSongSeconds } from "@/lib/shift-waveform-authoring";
import type WaveSurfer from "wavesurfer.js";

const SHIFT_DRAG_THRESHOLD_PX = 4;
/** Ignore micro-ranges; store enforces its own minimum span as well. */
const SHIFT_DRAG_MIN_SEC = 0.04;

export type ShiftWaveformAuthoringCommit = (args: {
  startSec: number;
  endSec: number;
}) => { seekTo: number } | null;

/**
 * Desktop-only Shift+drag on the waveform scroll container.
 * Uses capture on pointerdown so WaveSurfer seek/pan do not steal the gesture.
 */
export function installShiftWaveformAuthoringGesture(args: {
  scrollContainer: HTMLElement;
  getWave: () => WaveSurfer | null;
  isMobilePractice: () => boolean;
  getMinPxPerSec: () => number;
  commit: ShiftWaveformAuthoringCommit;
}): () => void {
  const { scrollContainer, getWave, isMobilePractice, getMinPxPerSec, commit } =
    args;

  let phase: "idle" | "armed" | "dragging" = "idle";
  let pointerId: number | null = null;
  let startClientX = 0;
  let startSec = 0;
  let lastSec = 0;
  let previewEl: HTMLDivElement | null = null;
  let suppressNextClick = false;

  const removePreview = () => {
    previewEl?.remove();
    previewEl = null;
  };

  const syncPreview = (t0: number, t1: number) => {
    const ws = getWave();
    const dom = ws ? peekWaveSurferDom(ws) : null;
    if (!ws || !dom) return;
    const duration = ws.getDuration();
    if (!(duration > 0)) return;
    const minPx = Math.max(4, Math.min(1500, getMinPxPerSec()));
    const lo = Math.max(0, Math.min(t0, t1, duration));
    const hi = Math.min(duration, Math.max(t0, t1, 0));
    const { wrapper } = dom;
    if (!previewEl) {
      previewEl = document.createElement("div");
      previewEl.className = "woodshed-shift-authoring-preview";
      previewEl.style.position = "absolute";
      previewEl.style.top = "0";
      previewEl.style.bottom = "0";
      previewEl.style.pointerEvents = "none";
      previewEl.style.zIndex = "30";
      previewEl.style.borderRadius = "2px";
      if (getComputedStyle(wrapper).position === "static") {
        wrapper.style.position = "relative";
      }
      wrapper.appendChild(previewEl);
    }
    const leftPx = lo * minPx + WAVEFORM_HORIZONTAL_GUTTER_PX;
    const widthPx = Math.max(1, (hi - lo) * minPx);
    previewEl.style.left = `${leftPx}px`;
    previewEl.style.width = `${widthPx}px`;
  };

  const timeAtClientX = (clientX: number): number => {
    const ws = getWave();
    const dom = ws ? peekWaveSurferDom(ws) : null;
    if (!ws || !dom) return 0;
    const d = ws.getDuration();
    return pointerClientXToSongSeconds({
      clientX,
      scrollContainer: dom.scrollContainer,
      wrapper: dom.wrapper,
      durationSec: d,
    });
  };

  const onPointerDownCapture = (event: PointerEvent) => {
    if (isMobilePractice()) return;
    if (!event.shiftKey || event.button !== 0) return;
    const target = event.target as Element | null;
    if (target?.closest('.woodshed-region-editing [part*="region-handle"]')) {
      return;
    }
    if (target?.closest(".woodshed-region-segment")) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    phase = "armed";
    pointerId = event.pointerId;
    startClientX = event.clientX;
    startSec = timeAtClientX(event.clientX);
    lastSec = startSec;
  };

  const cleanupInteraction = () => {
    if (pointerId != null) {
      try {
        scrollContainer.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
    pointerId = null;
    phase = "idle";
    removePreview();
  };

  const onPointerMove = (event: PointerEvent) => {
    if (phase === "idle" || event.pointerId !== pointerId) return;
    if (isMobilePractice()) {
      cleanupInteraction();
      return;
    }
    const curSec = timeAtClientX(event.clientX);
    lastSec = curSec;
    if (phase === "armed") {
      if (Math.abs(event.clientX - startClientX) < SHIFT_DRAG_THRESHOLD_PX) {
        return;
      }
      phase = "dragging";
      try {
        scrollContainer.setPointerCapture(event.pointerId);
      } catch {
        /* best-effort */
      }
    }
    if (phase === "dragging") {
      event.preventDefault();
      syncPreview(startSec, curSec);
    }
  };

  const finalize = () => {
    if (phase !== "dragging" || pointerId == null) {
      cleanupInteraction();
      return;
    }
    const a = startSec;
    const b = lastSec;
    cleanupInteraction();
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    if (hi - lo < SHIFT_DRAG_MIN_SEC) return;
    const result = commit({ startSec: lo, endSec: hi });
    if (result != null) {
      suppressNextClick = true;
      const ws = getWave();
      if (ws) {
        ws.setTime(result.seekTo);
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    if (phase === "armed") {
      cleanupInteraction();
      return;
    }
    finalize();
  };

  const onPointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    cleanupInteraction();
  };

  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  };

  scrollContainer.addEventListener("pointerdown", onPointerDownCapture, true);
  scrollContainer.addEventListener("pointermove", onPointerMove, {
    passive: false,
  });
  scrollContainer.addEventListener("pointerup", onPointerUp);
  scrollContainer.addEventListener("pointercancel", onPointerCancel);
  scrollContainer.addEventListener("click", onClickCapture, true);

  return () => {
    scrollContainer.removeEventListener(
      "pointerdown",
      onPointerDownCapture,
      true,
    );
    scrollContainer.removeEventListener("pointermove", onPointerMove);
    scrollContainer.removeEventListener("pointerup", onPointerUp);
    scrollContainer.removeEventListener("pointercancel", onPointerCancel);
    scrollContainer.removeEventListener("click", onClickCapture, true);
    cleanupInteraction();
  };
}
