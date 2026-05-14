import { nanoid } from "@/lib/id";

/** Tempo multiplier 25%–150% (PRD) */
export const TEMPO_MIN = 0.25;
export const TEMPO_MAX = 1.5;

/**
 * Lightweight labeled region inside a parent phrase (absolute song times).
 * One level only — no nested segments.
 */
export type PhraseSegment = {
  id: string;
  phraseId: string;
  name: string;
  startTime: number;
  endTime: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
};

export type PracticeLoop = {
  id: string;
  name: string;
  start: number;
  end: number;
  /** Playback rate multiplier; pitch preservation handled at playback surface */
  tempo: number;
  /** Optional practice notes for this phrase (desktop inspector). */
  notes?: string;
  segments?: PhraseSegment[];
};

export function clampTempo(value: number): number {
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, value));
}

export function clampTimeToDuration(t: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(duration, Math.max(0, t));
}

/** Initial loop spans ~first 10% of the file, capped (PRD frictionless start). */
export function createInitialLoop(duration: number): PracticeLoop {
  const id = nanoid();
  let span =
    duration > 0 ? Math.min(Math.max(duration * 0.1, 4), Math.min(duration, 30)) : 30;
  if (duration > 0) span = Math.min(span, duration);
  const end =
    duration > 0
      ? Math.min(duration, Math.max(span, Math.min(duration, 12)))
      : Math.max(span, 8);
  return {
    id,
    name: "Intro",
    start: 0,
    end,
    tempo: 1,
    notes: "",
    segments: [],
  };
}

/** Returns a duplicated loop spanning [start,end] clipped to duration. */
export function loopFromBounds(
  start: number,
  end: number,
  duration: number,
  name = "Phrase",
): PracticeLoop {
  const s = clampTimeToDuration(Math.min(start, end), duration);
  let e = clampTimeToDuration(Math.max(start, end), duration);
  const minSpan = duration > 0 ? Math.min(0.05, duration * 0.001) : 0.05;
  if (e - s < minSpan) e = clampTimeToDuration(s + minSpan, duration);
  return {
    id: nanoid(),
    name,
    start: s,
    end: e,
    tempo: 1,
    notes: "",
    segments: [],
  };
}

const nowMs = () => Date.now();

/** Clamp segment times to lie within [phraseStart, phraseEnd] with a small minimum span. */
export function clampSegmentsToPhraseBounds(
  segments: PhraseSegment[] | undefined,
  phraseStart: number,
  phraseEnd: number,
): PhraseSegment[] {
  if (!segments?.length) return [];
  const span = phraseEnd - phraseStart;
  const minSpan = span > 0 ? Math.min(0.05, span * 0.02) : 0.05;
  const t = nowMs();
  return segments.map((seg) => {
    let s = Math.max(phraseStart, Math.min(seg.startTime, phraseEnd - minSpan));
    let e = Math.min(phraseEnd, Math.max(seg.endTime, phraseStart + minSpan));
    if (e - s < minSpan) {
      e = Math.min(phraseEnd, s + minSpan);
      if (e > phraseEnd) {
        e = phraseEnd;
        s = Math.max(phraseStart, e - minSpan);
      }
    }
    if (s >= e) {
      s = phraseStart;
      e = Math.min(phraseEnd, phraseStart + minSpan);
    }
    const changed = s !== seg.startTime || e !== seg.endTime;
    return {
      ...seg,
      startTime: s,
      endTime: e,
      updatedAt: changed ? t : seg.updatedAt,
    };
  });
}

export function createSegmentInPhrase(
  phraseId: string,
  phraseStart: number,
  phraseEnd: number,
  index1Based: number,
): PhraseSegment {
  const span = phraseEnd - phraseStart;
  const t = nowMs();
  if (!(span > 1e-4)) {
    return {
      id: nanoid(),
      phraseId,
      name: `Focus ${index1Based}`,
      startTime: phraseStart,
      endTime: phraseEnd,
      notes: "",
      createdAt: t,
      updatedAt: t,
    };
  }
  const minSpan = Math.min(0.35, Math.max(0.08, span * 0.15));
  const mid = phraseStart + span / 2;
  let s = mid - minSpan / 2;
  let e = mid + minSpan / 2;
  s = Math.max(phraseStart, Math.min(s, phraseEnd - minSpan));
  e = Math.min(phraseEnd, Math.max(e, s + minSpan));
  return {
    id: nanoid(),
    phraseId,
    name: `Focus ${index1Based}`,
    startTime: s,
    endTime: e,
    notes: "",
    createdAt: t,
    updatedAt: t,
  };
}

/** Soft snap: return nearest transient if within threshold, otherwise raw time */
export function softSnapSeconds(
  t: number,
  transients: readonly number[],
  thresholdSec: number,
): number {
  if (!transients.length || thresholdSec <= 0) return t;
  let best = t;
  let bestDelta = thresholdSec + 1;
  for (const p of transients) {
    const d = Math.abs(p - t);
    if (d < bestDelta) {
      bestDelta = d;
      best = p;
    }
  }
  return bestDelta <= thresholdSec ? best : t;
}

export function mutateLoopTempos(
  loops: PracticeLoop[],
  id: string,
  tempo: number,
): PracticeLoop[] {
  return loops.map((l) => (l.id === id ? { ...l, tempo: clampTempo(tempo) } : l));
}
