import type WaveSurfer from "wavesurfer.js";

/**
 * WaveSurfer 7's `zoom()` throws `new Error("No audio loaded")` until internal
 * decoded audio exists (after the `decode` event). Any effect or handler that
 * runs while a URL is loading — e.g. after `resetWorkspace()` bumps store state
 * before `ws.load()` finishes — must skip `zoom()` until this returns true.
 */
export function isWaveSurferAudioDecoded(
  ws: WaveSurfer | null | undefined,
): boolean {
  if (!ws) return false;
  const decoded = (
    ws as unknown as { getDecodedData?: () => unknown }
  ).getDecodedData?.();
  return decoded != null;
}
