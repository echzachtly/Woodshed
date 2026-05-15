import type WaveSurfer from "wavesurfer.js";

import { isWaveSurferAudioDecoded } from "@/lib/wavesurfer-audio-ready";
import { peekWaveSurferDom } from "@/lib/waveform-scroll";
import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";
import type { WoodshedStore } from "@/store/woodshed-store";

type PinchOpts = {
  /** Current mobile practice mode (ref-backed from workspace). */
  isMobilePractice: () => boolean;
  getStore: () => WoodshedStore;
};

const MIN_PX = 6;
const MAX_PX = 720;

/**
 * Two-finger pinch zoom on the WaveSurfer scroll container.
 * Keeps the time under the pinch midpoint stable (approx., using gutter margin).
 * Call `preventDefault` on move so the page does not zoom while pinching the wave.
 */
export function installWaveformPinchZoom(
  ws: WaveSurfer,
  options: PinchOpts,
): () => void {
  const dom = peekWaveSurferDom(ws);
  const sc = dom?.scrollContainer;
  if (!sc) return () => undefined;

  let pinchActive = false;
  let startDist = 0;
  let startZoom = 0;
  /** Midpoint in scroll coordinates (content px) at gesture start. */
  let anchorContentX = 0;

  const onTouchStart = (e: TouchEvent) => {
    if (!options.isMobilePractice()) {
      sc.style.removeProperty("touch-action");
      return;
    }
    /**
     * WaveSurfer’s scroll `.scroll` node lives in shadow DOM with `touch-action: auto`.
     * A narrow `touch-action: pan-x` on an ancestor overrides `touch-manipulation` in Tailwind
     * (whichever utility wins in the stylesheet) and can block cancelable pinch `touchmove`
     * delivery. We set `manipulation` inline on the scroll surface during mobile practice so
     * two-finger pinch stays reliable.
     */
    sc.style.touchAction = "manipulation";

    if (e.touches.length !== 2) return;
    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return;

    pinchActive = true;
    startDist = dist;
    startZoom = options.getStore().minPxPerSec;

    const rect = sc.getBoundingClientRect();
    const midClientX = (t0.clientX + t1.clientX) / 2;
    anchorContentX = sc.scrollLeft + (midClientX - rect.left);
    /** Claim the gesture before the browser treats it as native pinch / scroll. */
    e.preventDefault();
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!pinchActive || e.touches.length < 2) return;
    if (!options.isMobilePractice()) {
      pinchActive = false;
      return;
    }
    e.preventDefault();

    const t0 = e.touches[0];
    const t1 = e.touches[1];
    const dx = t0.clientX - t1.clientX;
    const dy = t0.clientY - t1.clientY;
    const dist = Math.hypot(dx, dy);
    if (startDist < 8) return;

    const ratio = dist / startDist;
    const nextZoom = Math.min(MAX_PX, Math.max(MIN_PX, startZoom * ratio));
    const dur = ws.getDuration();
    if (!(dur > 0) || !isWaveSurferAudioDecoded(ws)) return;

    const gutter = WAVEFORM_HORIZONTAL_GUTTER_PX;
    const timeAtAnchor = Math.max(
      0,
      Math.min(dur, (anchorContentX - gutter) / Math.max(1e-6, startZoom)),
    );

    options.getStore().setMinPxPerSec(nextZoom);
    ws.zoom(nextZoom);

    const rect = sc.getBoundingClientRect();
    const midClientX = (t0.clientX + t1.clientX) / 2;
    const newAnchorContentX = timeAtAnchor * nextZoom + gutter;
    const nextScroll = newAnchorContentX - (midClientX - rect.left);

    requestAnimationFrame(() => {
      const maxScroll = Math.max(0, sc.scrollWidth - sc.clientWidth);
      ws.setScroll(Math.max(0, Math.min(maxScroll, nextScroll)));
    });
  };

  const endPinch = () => {
    pinchActive = false;
  };

  sc.addEventListener("touchstart", onTouchStart, { passive: false });
  sc.addEventListener("touchmove", onTouchMove, { passive: false });
  sc.addEventListener("touchend", endPinch);
  sc.addEventListener("touchcancel", endPinch);

  return () => {
    sc.style.removeProperty("touch-action");
    sc.removeEventListener("touchstart", onTouchStart);
    sc.removeEventListener("touchmove", onTouchMove);
    sc.removeEventListener("touchend", endPinch);
    sc.removeEventListener("touchcancel", endPinch);
  };
}
