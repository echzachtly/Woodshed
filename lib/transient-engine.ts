/**
 * Lightweight transient-style peaks from PCM for assistive snapping.
 * Cached per-analysis key in the waveform layer — not MIR-grade.
 */

const DEFAULT_MAX_MARKERS = 120;

/** Peak-pick spectral flux–style heuristic on RMS envelope (fast, assistive-only). */
export function detectTransientSeconds(
  channel: Float32Array,
  sampleRate: number,
  options?: {
    sensitivity?: number; // higher = fewer markers (0–1)
    maxMarkers?: number;
  },
): number[] {
  if (!channel.length || sampleRate <= 0) return [];
  const hop = Math.max(256, Math.floor(sampleRate / 200)); // ~5 ms-ish floor
  const frameCount = Math.floor(channel.length / hop);
  if (frameCount < 8) return [];

  const rms = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    const start = i * hop;
    let sum = 0;
    let n = 0;
    const end = Math.min(start + hop, channel.length);
    for (let s = start; s < end; s++) {
      const v = channel[s]!;
      sum += v * v;
      n++;
    }
    rms[i] = n ? Math.sqrt(sum / n) : 0;
  }

  let sum = 0;
  let sumSq = 0;
  for (let i = 1; i < rms.length; i++) {
    const diff = Math.max(0, rms[i]! - rms[i - 1]!);
    sum += diff;
    sumSq += diff * diff;
  }
  const mean = sum / Math.max(1, rms.length - 1);
  const variance = Math.max(
    sumSq / Math.max(1, rms.length - 1) - mean * mean,
    1e-8,
  );
  const sigma = Math.sqrt(variance);

  const sens = Math.min(
    Math.max(typeof options?.sensitivity === "number" ? options.sensitivity : 0.35, 0),
    1,
  );
  /** Higher sensitivity -> higher threshold -> fewer spikes */
  const threshold = mean + sigma * (1.4 + sens * 1.8);

  const candidates: number[] = [];
  for (let i = 2; i < rms.length - 2; i++) {
    const center = Math.max(rms[i]!, rms[i - 1]!, rms[i + 1]!);
    if (rms[i]! < threshold || center !== rms[i]!) continue;
    const novelty = Math.max(
      rms[i]! - rms[i - 1]!,
      rms[i]! - rms[i + 1]!,
    );
    if (novelty <= 0) continue;
    candidates.push((i * hop) / sampleRate);
  }

  /** Non-maximum suppression-ish merge of close neighbors */
  const merged: number[] = [];
  const minGap = hop / sampleRate;
  candidates.sort((a, b) => a - b);
  for (const t of candidates) {
    const last = merged[merged.length - 1];
    if (last !== undefined && t - last < minGap) continue;
    merged.push(t);
  }

  const maxMarkers = Math.max(
    8,
    typeof options?.maxMarkers === "number"
      ? options.maxMarkers
      : DEFAULT_MAX_MARKERS,
  );
  if (merged.length <= maxMarkers) return merged;

  const stride = Math.ceil(merged.length / maxMarkers);
  const trimmed: number[] = [];
  for (let i = 0; i < merged.length; i += stride) trimmed.push(merged[i]!);
  return trimmed;
}

export function cacheKeyForBuffer(buffer: AudioBuffer): string {
  return `${buffer.sampleRate}:${buffer.length}:${buffer.duration.toFixed(3)}`;
}
