/**
 * Pure math for Phase 6B synthetic-timeline authoring.
 *
 * **Interaction model vs WaveSurfer:** WaveSurfer regions sit on decoded audio + decoded peaks; gestures
 * are coupled to waveform pixels and region plugins. The neutral strip has no PCM — authoring maps
 * pointer motion to **seconds via pxPerSec**, then clamps into media duration / parent phrase bounds the
 * same way store helpers (`clampSegmentsToPhraseBounds`, etc.) ultimately do after dispatch.
 */

import type { PracticeLoop } from "@/lib/loop-engine";

/** Mirrors `woodshed-store` phrase min span heuristic (keep in sync loosely). */
export function minPhraseOrSegmentSpanSec(durationSec: number): number {
  if (!(durationSec > 0)) return 0.05;
  return Math.min(0.05, Math.max(1e-4, durationSec * 0.001));
}

export function clampPhraseStartEnd(
  start: number,
  end: number,
  durationSec: number,
): { start: number; end: number } {
  const minSpan = minPhraseOrSegmentSpanSec(durationSec);
  let lo = Number.isFinite(start) ? start : 0;
  let hi = Number.isFinite(end) ? end : 0;
  if (hi < lo) [lo, hi] = [hi, lo];
  lo = Math.max(0, Math.min(lo, durationSec));
  hi = Math.max(0, Math.min(hi, durationSec));
  if (hi - lo < minSpan) {
    hi = Math.min(durationSec, lo + minSpan);
    if (hi - lo < minSpan) {
      lo = Math.max(0, hi - minSpan);
    }
  }
  return { start: lo, end: hi };
}

export function clampPhraseMoveDelta(
  start: number,
  end: number,
  deltaSec: number,
  durationSec: number,
): { start: number; end: number } {
  const span = end - start;
  let s = start + deltaSec;
  let e = end + deltaSec;
  if (s < 0) {
    const fix = -s;
    s += fix;
    e += fix;
  }
  if (e > durationSec) {
    const fix = e - durationSec;
    s -= fix;
    e -= fix;
  }
  const minSpan = minPhraseOrSegmentSpanSec(durationSec);
  if (e - s < minSpan) {
    return { start, end }; // Degenerate — abandon move
  }
  return { start: Math.max(0, s), end: Math.min(durationSec, e) };
}

export function clampSegmentStartEndInPhrase(
  start: number,
  end: number,
  phraseStart: number,
  phraseEnd: number,
): { start: number; end: number } {
  const dur = phraseEnd - phraseStart;
  const minSpan = minPhraseOrSegmentSpanSec(
    dur > 0 ? dur + phraseStart : phraseStart + 1,
  );
  let lo = Number.isFinite(start) ? start : phraseStart;
  let hi = Number.isFinite(end) ? end : phraseEnd;
  if (hi < lo) [lo, hi] = [hi, lo];
  lo = Math.max(phraseStart, Math.min(lo, phraseEnd));
  hi = Math.min(phraseEnd, Math.max(hi, phraseStart));
  if (hi - lo < minSpan) {
    hi = Math.min(phraseEnd, lo + minSpan);
    if (hi > phraseEnd) {
      hi = phraseEnd;
      lo = Math.max(phraseStart, hi - minSpan);
    }
  }
  return { start: lo, end: hi };
}

export function clampSegmentMoveDeltaInPhrase(
  start: number,
  end: number,
  deltaSec: number,
  phraseStart: number,
  phraseEnd: number,
): { start: number; end: number } {
  const span = end - start;
  let s = start + deltaSec;
  let e = end + deltaSec;
  const minSpan = minPhraseOrSegmentSpanSec(Math.max(phraseEnd, phraseStart + 1));
  if (e - s < minSpan) return { start, end };
  if (s < phraseStart) {
    const fix = phraseStart - s;
    s += fix;
    e += fix;
  }
  if (e > phraseEnd) {
    const fix = e - phraseEnd;
    s -= fix;
    e -= fix;
  }
  if (e - s < minSpan || s < phraseStart || e > phraseEnd) return { start, end };
  return clampSegmentStartEndInPhrase(s, e, phraseStart, phraseEnd);
}

/** Drag-end seconds from pointer Δx (scroll-stable). */
export function secondsDeltaFromPixelDelta(pxDelta: number, pxPerSec: number): number {
  if (!(pxPerSec > 0)) return 0;
  return pxDelta / pxPerSec;
}

export function frontmostPhraseAtTime(
  loops: readonly PracticeLoop[],
  songTime: number,
): PracticeLoop | undefined {
  let best: PracticeLoop | undefined;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const l of loops) {
    if (!(l.end > l.start && songTime >= l.start && songTime <= l.end)) continue;
    const span = l.end - l.start;
    if (span < bestSpan) {
      bestSpan = span;
      best = l;
    }
  }
  return best;
}