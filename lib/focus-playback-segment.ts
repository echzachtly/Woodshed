import type { PhraseSegment, PracticeLoop } from "@/lib/loop-engine";

function compareFocusSegments(a: PhraseSegment, b: PhraseSegment): number {
  return (
    a.startTime - b.startTime ||
    a.endTime - b.endTime ||
    a.id.localeCompare(b.id)
  );
}

export function listOrderedValidFocusSegments(
  segments: PhraseSegment[] | undefined,
): PhraseSegment[] {
  return (segments ?? [])
    .filter((s) => s.endTime > s.startTime && Number.isFinite(s.startTime))
    .slice()
    .sort(compareFocusSegments);
}

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
  const segs = listOrderedValidFocusSegments(loop.segments);
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

export function resolveFocusDeletionFallbackId(args: {
  segments: PhraseSegment[] | undefined;
  removedSegmentId: string;
  lastUsedSegmentId: string | null;
}): string | null {
  const ordered = listOrderedValidFocusSegments(args.segments);
  if (!ordered.length) return null;
  const removedIndex = ordered.findIndex((seg) => seg.id === args.removedSegmentId);
  const remaining = ordered.filter((seg) => seg.id !== args.removedSegmentId);
  if (!remaining.length) return null;

  // Canonical fallback: next sibling, then previous sibling.
  if (removedIndex >= 0) {
    const nextSibling = ordered
      .slice(removedIndex + 1)
      .find((seg) => seg.id !== args.removedSegmentId);
    if (nextSibling) return nextSibling.id;
    const prevSibling = ordered
      .slice(0, removedIndex)
      .reverse()
      .find((seg) => seg.id !== args.removedSegmentId);
    if (prevSibling) return prevSibling.id;
  }

  // Then last-used in this Practice Section if still valid.
  if (args.lastUsedSegmentId) {
    const lastUsed = remaining.find((seg) => seg.id === args.lastUsedSegmentId);
    if (lastUsed) return lastUsed.id;
  }

  return remaining[0]?.id ?? null;
}
