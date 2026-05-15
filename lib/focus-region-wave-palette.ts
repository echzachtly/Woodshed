/**
 * Desktop waveform focus-region fills (WaveSurfer `color`).
 * Cycles by segment order within the phrase — no persisted color on segments.
 */
export type FocusRegionWaveSlot = {
  inactiveFill: string;
  selectedFill: string;
};

export const FOCUS_REGION_WAVE_PALETTE: readonly FocusRegionWaveSlot[] = [
  {
    inactiveFill: "rgba(168, 158, 210, 0.17)",
    selectedFill: "rgba(226, 218, 252, 0.46)",
  },
  {
    inactiveFill: "rgba(148, 170, 218, 0.165)",
    selectedFill: "rgba(210, 224, 255, 0.47)",
  },
  {
    inactiveFill: "rgba(182, 168, 220, 0.17)",
    selectedFill: "rgba(236, 222, 255, 0.48)",
  },
  {
    inactiveFill: "rgba(150, 176, 206, 0.165)",
    selectedFill: "rgba(218, 232, 248, 0.46)",
  },
  {
    inactiveFill: "rgba(190, 172, 198, 0.17)",
    selectedFill: "rgba(240, 220, 244, 0.47)",
  },
  {
    inactiveFill: "rgba(158, 186, 180, 0.165)",
    selectedFill: "rgba(220, 240, 234, 0.44)",
  },
];

export function focusRegionWavePaletteIndex(segmentIndex: number): number {
  if (!Number.isFinite(segmentIndex) || segmentIndex < 0) return 0;
  return segmentIndex % FOCUS_REGION_WAVE_PALETTE.length;
}
