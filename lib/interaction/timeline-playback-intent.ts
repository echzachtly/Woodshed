import type { PracticeLoop } from "@/lib/loop-engine";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type NeutralTimelineHit =
  | { kind: "gap" }
  | { kind: "phrase"; phraseId: string }
  | { kind: "focus"; phraseId: string; segmentId: string };

export type TimelinePlaybackIntentSnapshot = {
  duration: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
};

export type TimelinePlaybackIntentDecision = {
  clampedTime: number;
  selectLoopId?: string;
  selectSegment?: { phraseId: string; segmentId: string };
  setLoopPlaybackEnabled?: boolean;
  setLoopPracticeScope?: LoopPracticeScope;
};

/**
 * Map a song time to the narrowest containing phrase (smallest span wins on overlap)
 * and the narrowest containing Focus Loop if any.
 */
export function resolveNeutralTimelineHit(
  t: number,
  loops: PracticeLoop[],
): NeutralTimelineHit {
  const hits = loops.filter(
    (l) => l.end > l.start && t >= l.start && t <= l.end,
  );
  if (!hits.length) return { kind: "gap" };
  const loop = [...hits].sort(
    (a, b) => a.end - a.start - (b.end - b.start),
  )[0]!;
  const segs = loop.segments ?? [];
  const segHits = segs.filter(
    (s) => t >= s.startTime && t <= s.endTime,
  );
  if (!segHits.length) return { kind: "phrase", phraseId: loop.id };
  const seg = [...segHits].sort(
    (a, b) => a.endTime - a.startTime - (b.endTime - b.startTime),
  )[0]!;
  return { kind: "focus", phraseId: loop.id, segmentId: seg.id };
}

function timeInPhraseBounds(loop: PracticeLoop | undefined, t: number): boolean {
  return Boolean(loop && t >= loop.start && t <= loop.end);
}

function timeInSegmentBounds(
  seg: { startTime: number; endTime: number } | undefined,
  t: number,
): boolean {
  return Boolean(seg && t >= seg.startTime && t <= seg.endTime);
}

/**
 * Shared playback-intent contract for timeline taps/clicks.
 * Callers still own actual seek/playback side-effects.
 */
export function resolveTimelinePlaybackIntent(
  snapshot: TimelinePlaybackIntentSnapshot,
  seconds: number,
): TimelinePlaybackIntentDecision | null {
  const { duration } = snapshot;
  if (!(duration > 0)) return null;
  const t = Math.min(Math.max(seconds, 0), duration);
  const hit = resolveNeutralTimelineHit(t, snapshot.loops);

  const activeLoop =
    snapshot.activeLoopId != null
      ? snapshot.loops.find((l) => l.id === snapshot.activeLoopId)
      : undefined;
  const activeSeg = activeLoop?.segments?.find(
    (s) => s.id === snapshot.activeSegmentId,
  );

  const inActivePhrase = timeInPhraseBounds(activeLoop, t);
  const inActiveFocus = timeInSegmentBounds(activeSeg, t);

  const loopSectionMode =
    snapshot.loopPlaybackEnabled && snapshot.loopPracticeScope === "phrase";
  const focusLoopMode =
    snapshot.loopPlaybackEnabled &&
    snapshot.loopPracticeScope === "practice_region";

  if (!snapshot.loopPlaybackEnabled) {
    if (hit.kind === "gap") return { clampedTime: t };
    // Outside the active Practice Section stays Play Through.
    if (!inActivePhrase) {
      if (hit.kind === "phrase") {
        return {
          clampedTime: t,
          selectLoopId: hit.phraseId,
          setLoopPlaybackEnabled: false,
        };
      }
      return {
        clampedTime: t,
        selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
        setLoopPlaybackEnabled: false,
      };
    }

    // Inside the active Practice Section body/focus resolves to section/focus loop.
    if (hit.kind === "phrase") {
      return {
        clampedTime: t,
        selectLoopId: snapshot.activeLoopId ?? hit.phraseId,
        setLoopPlaybackEnabled: true,
        setLoopPracticeScope: "phrase",
      };
    }
    return {
      clampedTime: t,
      selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
      setLoopPlaybackEnabled: true,
      setLoopPracticeScope: "practice_region",
    };
  }

  if (loopSectionMode) {
    // Canonical rule: clicking outside active practice section resolves to Play Through.
    if (!inActivePhrase) {
      if (hit.kind === "phrase") {
        return {
          clampedTime: t,
          selectLoopId: hit.phraseId,
          setLoopPlaybackEnabled: false,
        };
      }
      if (hit.kind === "focus") {
        return {
          clampedTime: t,
          selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
          setLoopPlaybackEnabled: false,
        };
      }
      return { clampedTime: t, setLoopPlaybackEnabled: false };
    }
    if (
      hit.kind === "focus" &&
      hit.phraseId === snapshot.activeLoopId &&
      snapshot.activeLoopId != null
    ) {
      return {
        clampedTime: t,
        selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
        setLoopPracticeScope: "practice_region",
      };
    }
    return { clampedTime: t };
  }

  if (focusLoopMode) {
    // Canonical rule: clicking outside active practice section resolves to Play Through.
    if (!inActivePhrase) {
      if (hit.kind === "phrase") {
        return {
          clampedTime: t,
          selectLoopId: hit.phraseId,
          setLoopPlaybackEnabled: false,
        };
      }
      if (hit.kind === "focus") {
        return {
          clampedTime: t,
          selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
          setLoopPlaybackEnabled: false,
        };
      }
      return { clampedTime: t, setLoopPlaybackEnabled: false };
    }
    if (
      inActiveFocus &&
      hit.kind === "focus" &&
      hit.segmentId === snapshot.activeSegmentId
    ) {
      return { clampedTime: t };
    }
    if (
      hit.kind === "focus" &&
      hit.phraseId === snapshot.activeLoopId &&
      snapshot.activeLoopId != null
    ) {
      return {
        clampedTime: t,
        selectSegment: { phraseId: hit.phraseId, segmentId: hit.segmentId },
        setLoopPracticeScope: "practice_region",
      };
    }
    return { clampedTime: t, setLoopPracticeScope: "phrase" };
  }

  return { clampedTime: t };
}
