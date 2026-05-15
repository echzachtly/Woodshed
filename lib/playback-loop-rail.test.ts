import { describe, expect, test, vi } from "vitest";

import {
  warpPlaybackToLoopRailIfNeeded,
  type PlaybackLoopRailSnapshot,
} from "@/lib/playback-loop-rail";
import {
  loopFromBounds,
  phraseSegmentFromBounds,
  type PracticeLoop,
} from "@/lib/loop-engine";

function snapshot(partial: Partial<PlaybackLoopRailSnapshot>): PlaybackLoopRailSnapshot {
  return {
    loops: [],
    activeLoopId: null,
    loopPlaybackEnabled: false,
    activeSegmentId: null,
    loopPracticeScope: "phrase",
    lastPracticeSegmentIdByPhrase: {},
    ...partial,
  };
}

describe("warpPlaybackToLoopRailIfNeeded", () => {
  test("does nothing when loop playback is disabled", () => {
    const phrase = loopFromBounds(2, 8, 60, "A");
    const surface = {
      getCurrentTime: () => 50,
      seek: vi.fn(),
    };
    warpPlaybackToLoopRailIfNeeded(
      surface,
      snapshot({
        loops: [phrase],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: false,
      }),
    );
    expect(surface.seek).not.toHaveBeenCalled();
  });

  test("warps phrase loop when playhead passes end", () => {
    const phrase = loopFromBounds(2, 8, 60, "A");
    const surface = {
      getCurrentTime: () => 8.02,
      seek: vi.fn(),
    };
    warpPlaybackToLoopRailIfNeeded(
      surface,
      snapshot({
        loops: [phrase],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
    );
    expect(surface.seek).toHaveBeenCalledWith(phrase.start);
  });

  test("warps focus-region rail when scope is practice_region", () => {
    const phrase = loopFromBounds(0, 60, 120, "A");
    const seg = phraseSegmentFromBounds(phrase.id, 10, 20, "Focus");
    const loopWithSeg: PracticeLoop = {
      ...phrase,
      segments: [seg],
    };
    const surface = {
      getCurrentTime: () => 20.05,
      seek: vi.fn(),
    };
    warpPlaybackToLoopRailIfNeeded(
      surface,
      snapshot({
        loops: [loopWithSeg],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: seg.id,
      }),
    );
    expect(surface.seek).toHaveBeenCalledWith(seg.startTime);
  });

  test("pulls playhead forward when before rail start", () => {
    const phrase = loopFromBounds(10, 20, 60, "A");
    const surface = {
      getCurrentTime: () => 9,
      seek: vi.fn(),
    };
    warpPlaybackToLoopRailIfNeeded(
      surface,
      snapshot({
        loops: [phrase],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: true,
      }),
    );
    expect(surface.seek).toHaveBeenCalledWith(phrase.start);
  });
});
