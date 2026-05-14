import type { LoopRail } from "@/lib/audio-engine";
import { resolveFocusPlaybackSegment } from "@/lib/focus-playback-segment";
import type { PracticeLoop } from "@/lib/loop-engine";
import type { LoopPracticeScope } from "@/store/woodshed-store";

/** Fields read from store for loop-boundary playback and restart. */
export type PlaybackLoopRailSnapshot = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  loopPlaybackEnabled: boolean;
  activeSegmentId: string | null;
  loopPracticeScope: LoopPracticeScope;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
};

export function buildPlaybackLoopRail(
  snapshot: PlaybackLoopRailSnapshot,
): LoopRail {
  const {
    loops,
    activeLoopId,
    loopPlaybackEnabled,
    activeSegmentId,
    loopPracticeScope,
    lastPracticeSegmentIdByPhrase,
  } = snapshot;
  const target = loops.find((l) => l.id === activeLoopId);
  if (!target || !loopPlaybackEnabled) {
    return { enabled: false, start: 0, end: Number.POSITIVE_INFINITY };
  }
  if (loopPracticeScope === "practice_region" && target.segments?.length) {
    const seg = resolveFocusPlaybackSegment({
      loop: target,
      activeSegmentId,
      lastPracticeSegmentIdByPhrase,
    });
    if (seg && seg.endTime > seg.startTime) {
      return { enabled: true, start: seg.startTime, end: seg.endTime };
    }
  }
  return { enabled: true, start: target.start, end: target.end };
}

/** Seek position for transport restart / replay (phrase start vs focus region start). */
export function getRestartSeekSeconds(args: {
  loop: PracticeLoop;
  loopPracticeScope: LoopPracticeScope;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
}): number {
  const {
    loop,
    loopPracticeScope,
    activeSegmentId,
    lastPracticeSegmentIdByPhrase,
  } = args;
  if (loopPracticeScope !== "practice_region") return loop.start;
  const seg = resolveFocusPlaybackSegment({
    loop,
    activeSegmentId,
    lastPracticeSegmentIdByPhrase,
  });
  if (seg && seg.endTime > seg.startTime) return seg.startTime;
  return loop.start;
}
