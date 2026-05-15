const MIN_SPAN_SEC = 0.05;
const DEFAULT_SPAN_SEC = 5;

/**
 * WaveSurfer region geometry must use finite `start` / `end` in seconds.
 * Never substitutes track duration when `end` is missing — uses `start +` {@link DEFAULT_SPAN_SEC} (clamped).
 */
export function normalizeWaveSurferRegionBounds(opts: {
  startRaw: unknown;
  endRaw: unknown;
  trackDuration: number;
}): { start: number; end: number } {
  const d =
    typeof opts.trackDuration === "number" &&
    Number.isFinite(opts.trackDuration) &&
    opts.trackDuration > 0
      ? opts.trackDuration
      : Number.POSITIVE_INFINITY;

  let start =
    typeof opts.startRaw === "number" && Number.isFinite(opts.startRaw)
      ? opts.startRaw
      : 0;
  start = Math.max(0, start);

  let end: number;
  if (typeof opts.endRaw === "number" && Number.isFinite(opts.endRaw)) {
    end = opts.endRaw;
  } else {
    end = start + DEFAULT_SPAN_SEC;
  }

  if (end <= start) {
    end = start + DEFAULT_SPAN_SEC;
  }

  end = Math.min(end, d);
  start = Math.min(start, end - MIN_SPAN_SEC);
  start = Math.max(0, start);
  end = Math.max(start + MIN_SPAN_SEC, end);
  end = Math.min(end, d);

  return { start, end };
}
