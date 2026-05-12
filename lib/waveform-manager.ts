/**
 * Coordination helpers for main + minimap waveforms (PRD waveform-manager).
 */

export type VisibleWindow = {
  /** Portion [0–1] of total duration rendered in the main waveform */
  startRatio: number;
  durationRatio: number;
};

/** Down-sample peaks arrays for canvases constrained by css width buckets */
export function downsamplePeaks(peaks: number[], targets: number): number[] {
  if (!targets || targets <= 0) return peaks;
  const out = new Array<number>(targets);
  const span = peaks.length / targets;
  for (let i = 0; i < targets; i++) {
    const start = Math.floor(i * span);
    const end = Math.floor((i + 1) * span);
    let max = 0;
    for (let j = start; j < end; j++) max = Math.max(max, Math.abs(peaks[j] ?? 0));
    out[i] = max;
  }
  return out;
}

export function ratioFromScroll(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): VisibleWindow {
  if (scrollWidth <= clientWidth) {
    return { startRatio: 0, durationRatio: 1 };
  }
  const maxScroll = scrollWidth - clientWidth;
  const startRatio = maxScroll <= 0 ? 0 : scrollLeft / maxScroll;
  const durationRatio =
    scrollWidth <= 0 ? 1 : Math.min(1, Math.max(clientWidth / scrollWidth, 0));
  const adjustedDuration = scrollWidth <= 0 ? 1 : clientWidth / scrollWidth;
  return {
    startRatio,
    durationRatio: adjustedDuration,
  };
}

export type MinimapClick = {
  clientX: number;
  minimapLeft: number;
  minimapWidth: number;
  duration: number;
};

export function minimapSeekSeconds(evt: MinimapClick): number {
  const frac = clampFraction((evt.clientX - evt.minimapLeft) / evt.minimapWidth);
  return frac * evt.duration;
}

function clampFraction(f: number) {
  if (!Number.isFinite(f)) return 0;
  return Math.min(1, Math.max(0, f));
}

/** Map scrollbar ratio (WaveSurfer `scrollLeft/maxScroll`) to pixel offset. */
export function scrollPixelsFromNormalizedRatio(ratio: number, maxScrollPx: number) {
  const usable = Math.max(0, maxScrollPx);
  return clampFraction(ratio) * usable;
}
