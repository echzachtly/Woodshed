import type { PhraseSegment, PracticeLoop } from "@/lib/loop-engine";

/**
 * Pick which practice region bounds Focus Loop should use: explicit selection,
 * then last-used on this phrase, then first valid region.
 */
export function resolveFocusPlaybackSegment(args: {
  loop: PracticeLoop;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
}): PhraseSegment | null {
  const { loop, activeSegmentId, lastPracticeSegmentIdByPhrase } = args;
  const segs = (loop.segments ?? []).filter(
    (s) => s.endTime > s.startTime && Number.isFinite(s.startTime),
  );
  if (!segs.length) return null;
  if (activeSegmentId) {
    const hit = segs.find((s) => s.id === activeSegmentId);
    if (hit) return hit;
  }
  const lastId = lastPracticeSegmentIdByPhrase[loop.id];
  if (lastId) {
    const hit = segs.find((s) => s.id === lastId);
    if (hit) return hit;
  }
  return segs[0] ?? null;
}
