/**
 * Phase 3B — decorative synthetic “wave” for the neutral timeline prototype only.
 * Deterministic smooth blend of sinusoids (not audio analysis).
 */

/**
 * Returns a smooth value in roughly (−1, 1). Intentionally non-musical: no beats,
 * no transient spikes, no song-shaped macro envelope.
 */
export function syntheticWaveNormalized(contentXPx: number): number {
  const x = contentXPx * 0.00837;
  const blend =
    Math.sin(x * 1.047) * 0.31 +
    Math.sin(x * 0.583 + 1.71) * 0.27 +
    Math.sin(x * 0.331 + 0.42) * 0.22 +
    Math.sin(x * 0.179 + 2.93) * 0.14;
  return Math.tanh(blend * 1.35);
}
