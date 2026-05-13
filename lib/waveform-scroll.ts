import WaveSurfer from "wavesurfer.js";

import { scrollPixelsFromNormalizedRatio } from "@/lib/waveform-manager";

/** Scroll parent + waveform wrapper (WaveSurfer renderer internals). */
export function peekWaveSurferDom(ws: WaveSurfer): {
  scrollContainer: HTMLElement;
  wrapper: HTMLElement;
} | null {
  const r = ws.getRenderer() as unknown as {
    scrollContainer?: HTMLElement | null;
    getWrapper: () => HTMLElement;
  };
  if (!r?.scrollContainer) return null;
  return { scrollContainer: r.scrollContainer, wrapper: r.getWrapper() };
}

function scrollContainer(ws: WaveSurfer | null): HTMLElement | null {
  if (!ws) return null;
  return peekWaveSurferDom(ws)?.scrollContainer ?? null;
}

/** Sets WaveSurfer scroll using the renderer’s `.scroll` element (correct scroll parent). */
export function setWaveNormalizedScroll(ws: WaveSurfer | null, ratio: number) {
  if (!ws) return;
  const sc = scrollContainer(ws);
  if (!sc) return;
  const usable = Math.max(0, sc.scrollWidth - sc.clientWidth);
  ws.setScroll(scrollPixelsFromNormalizedRatio(ratio, usable));
}
