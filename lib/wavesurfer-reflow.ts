import type WaveSurfer from "wavesurfer.js";

import { isWaveSurferAudioDecoded } from "@/lib/wavesurfer-audio-ready";

/** Re-apply zoom so WaveSurfer picks up container width/height (v7 resize observer is width-focused). */
export function reflowWaveSurferForContainer(ws: WaveSurfer | null, minPxPerSec: number) {
  if (!ws || !isWaveSurferAudioDecoded(ws)) return;
  ws.zoom(minPxPerSec);
}
