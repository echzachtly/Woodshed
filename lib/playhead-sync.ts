import type WaveSurfer from "wavesurfer.js";

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
