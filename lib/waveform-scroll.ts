import WaveSurfer from "wavesurfer.js";

import { scrollPixelsFromNormalizedRatio } from "@/lib/waveform-manager";

function scrollContainer(ws: WaveSurfer | null): HTMLElement | null {
  const r = ws?.getRenderer?.() as unknown as {
    scrollContainer?: HTMLElement | null;
  } | undefined;
  return r?.scrollContainer ?? null;
}

/** Sets WaveSurfer scroll using the renderer’s `.scroll` element (correct scroll parent). */
export function setWaveNormalizedScroll(ws: WaveSurfer | null, ratio: number) {
  if (!ws) return;
  const sc = scrollContainer(ws);
  if (!sc) return;
  const usable = Math.max(0, sc.scrollWidth - sc.clientWidth);
  ws.setScroll(scrollPixelsFromNormalizedRatio(ratio, usable));
}
