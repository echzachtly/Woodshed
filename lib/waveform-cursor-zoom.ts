import type WaveSurfer from "wavesurfer.js";

import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";
import { isWaveSurferAudioDecoded } from "@/lib/wavesurfer-audio-ready";
import { peekWaveSurferDom } from "@/lib/waveform-scroll";

/** Audio time (seconds) at a viewport clientX over the main waveform scroll container. */
export function timeAtWaveformClientX(
  ws: WaveSurfer,
  scrollContainer: HTMLElement,
  clientX: number,
  pxPerSec: number,
): number {
  const dur = ws.getDuration();
  if (!dur || !Number.isFinite(pxPerSec) || pxPerSec <= 0) return 0;
  const rect = scrollContainer.getBoundingClientRect();
  const xInScroll = scrollContainer.scrollLeft + (clientX - rect.left);
  const t = (xInScroll - WAVEFORM_HORIZONTAL_GUTTER_PX) / pxPerSec;
  return Math.max(0, Math.min(dur, t));
}

/** After zoom, keep `timeSec` under the same viewport clientX. */
export function scrollToKeepTimeUnderClientX(
  ws: WaveSurfer,
  scrollContainer: HTMLElement,
  clientX: number,
  timeSec: number,
  pxPerSec: number,
): void {
  const rect = scrollContainer.getBoundingClientRect();
  const targetXInScroll =
    WAVEFORM_HORIZONTAL_GUTTER_PX + timeSec * pxPerSec;
  const nextScroll = targetXInScroll - (clientX - rect.left);
  const maxScroll = Math.max(
    0,
    scrollContainer.scrollWidth - scrollContainer.clientWidth,
  );
  ws.setScroll(Math.max(0, Math.min(maxScroll, nextScroll)));
}

/**
 * Wheel zoom on the main waveform, anchored to the pointer time (not t=0).
 * Updates store px/sec and WaveSurfer zoom; adjusts scroll on the next frame.
 */
export function applyWheelZoomAnchoredToCursor(
  ws: WaveSurfer,
  event: WheelEvent,
  currentMinPxPerSec: number,
  setMinPxPerSec: (next: number) => void,
): void {
  if (!isWaveSurferAudioDecoded(ws)) return;
  const dom = peekWaveSurferDom(ws);
  if (!dom) return;

  const { scrollContainer } = dom;
  const anchorTime = timeAtWaveformClientX(
    ws,
    scrollContainer,
    event.clientX,
    currentMinPxPerSec,
  );
  const factor = Math.exp(event.deltaY * -0.0015);
  const next = Math.min(
    1500,
    Math.max(4, currentMinPxPerSec * factor),
  );
  if (next === currentMinPxPerSec) return;

  ws.zoom(next);
  setMinPxPerSec(next);

  const clientX = event.clientX;
  requestAnimationFrame(() => {
    scrollToKeepTimeUnderClientX(
      ws,
      scrollContainer,
      clientX,
      anchorTime,
      next,
    );
  });
}
