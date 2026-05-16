import type WaveSurfer from "wavesurfer.js";
import { WAVEFORM_HORIZONTAL_GUTTER_PX } from "@/lib/waveform-gutter";

/**
 * Shared helpers for reading audio time into React (transport / mini-map).
 * Waveform fill position is owned by WaveSurfer’s renderer, not these utilities.
 */

/**
 * Throttle interval for React / transport time display while playing (ms).
 * WaveSurfer advances the waveform fill on its own timer (~16ms); this only
 * limits store updates so the transport and mini-map do not re-render every frame.
 */
export const PLAYHEAD_UI_TIME_MS = 120;

/** Prefer media element clock — slightly ahead of WaveSurfer’s throttled `timeupdate`. */
export function readPlaybackSeconds(ws: WaveSurfer): number {
  const media = ws.getMediaElement();
  if (media && Number.isFinite(media.currentTime)) {
    return media.currentTime;
  }
  return ws.getCurrentTime();
}

/** Viewport-relative X (px) for uploaded-audio playhead overlays. */
export function waveformViewportPlayheadX(args: {
  seconds: number;
  duration: number;
  pxPerSec: number;
  scrollLeft: number;
}): number {
  const duration = Number.isFinite(args.duration) ? Math.max(0, args.duration) : 0;
  const pxPerSec = Number.isFinite(args.pxPerSec) ? Math.max(0, args.pxPerSec) : 0;
  const sec = Number.isFinite(args.seconds)
    ? Math.min(duration, Math.max(0, args.seconds))
    : 0;
  return WAVEFORM_HORIZONTAL_GUTTER_PX + sec * pxPerSec - args.scrollLeft;
}

/**
 * While playing uploaded audio, keep the current time visually under a fixed
 * viewport playhead (center when possible, edge-clamped near song bounds).
 */
export function resolveFixedPlayheadViewportLock(args: {
  seconds: number;
  duration: number;
  pxPerSec: number;
  viewportWidthPx: number;
  scrollWidthPx: number;
}): {
  scrollLeftPx: number;
  playheadViewportXPx: number;
  centered: boolean;
} {
  const duration = Number.isFinite(args.duration) ? Math.max(0, args.duration) : 0;
  const pxPerSec = Number.isFinite(args.pxPerSec) ? Math.max(0, args.pxPerSec) : 0;
  const sec = Number.isFinite(args.seconds)
    ? Math.min(duration, Math.max(0, args.seconds))
    : 0;
  const viewportWidth = Number.isFinite(args.viewportWidthPx)
    ? Math.max(1, args.viewportWidthPx)
    : 1;
  const scrollWidth = Number.isFinite(args.scrollWidthPx)
    ? Math.max(viewportWidth, args.scrollWidthPx)
    : viewportWidth;
  const contentXPx = WAVEFORM_HORIZONTAL_GUTTER_PX + sec * pxPerSec;
  const centerXPx = viewportWidth / 2;
  const maxScroll = Math.max(0, scrollWidth - viewportWidth);
  const desiredScroll = contentXPx - centerXPx;
  const scrollLeftPx = Math.min(maxScroll, Math.max(0, desiredScroll));
  const playheadViewportXPx = contentXPx - scrollLeftPx;
  const centered = Math.abs(scrollLeftPx - desiredScroll) < 0.25;
  return { scrollLeftPx, playheadViewportXPx, centered };
}
