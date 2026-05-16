import { describe, expect, test } from "vitest";

import { loopFromBounds, phraseSegmentFromBounds } from "@/lib/loop-engine";
import {
  resolveTimelinePlaybackIntent,
  type TimelinePlaybackIntentSnapshot,
} from "@/lib/interaction/timeline-playback-intent";

function snapshot(
  partial: Partial<TimelinePlaybackIntentSnapshot>,
): TimelinePlaybackIntentSnapshot {
  return {
    duration: 120,
    loops: [],
    activeLoopId: null,
    activeSegmentId: null,
    loopPlaybackEnabled: false,
    loopPracticeScope: "phrase",
    ...partial,
  };
}

describe("resolveTimelinePlaybackIntent", () => {
  test("repeat-off click inside active phrase body resolves to phrase loop", () => {
    const phrase = loopFromBounds(10, 30, 120, "A");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [phrase],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: false,
        loopPracticeScope: "phrase",
      }),
      20,
    );
    expect(decision).toEqual({
      clampedTime: 20,
      selectLoopId: phrase.id,
      setLoopPlaybackEnabled: true,
      setLoopPracticeScope: "phrase",
    });
  });

  test("repeat-off click inside active focus resolves to focus loop", () => {
    const phrase = loopFromBounds(10, 40, 120, "A");
    const focus = phraseSegmentFromBounds(phrase.id, 20, 25, "Focus");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [{ ...phrase, segments: [focus] }],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: false,
      }),
      22,
    );
    expect(decision).toEqual({
      clampedTime: 22,
      selectSegment: { phraseId: phrase.id, segmentId: focus.id },
      setLoopPlaybackEnabled: true,
      setLoopPracticeScope: "practice_region",
    });
  });

  test("outside active phrase resolves to play through from phrase loop mode", () => {
    const phraseA = loopFromBounds(10, 30, 120, "A");
    const phraseB = loopFromBounds(60, 80, 120, "B");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [phraseA, phraseB],
        activeLoopId: phraseA.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
      65,
    );
    expect(decision).toEqual({
      clampedTime: 65,
      selectLoopId: phraseB.id,
      setLoopPlaybackEnabled: false,
    });
  });

  test("outside active phrase resolves to play through from focus loop mode", () => {
    const phraseA = loopFromBounds(10, 30, 120, "A");
    const phraseB = loopFromBounds(60, 80, 120, "B");
    const focusB = phraseSegmentFromBounds(phraseB.id, 64, 67, "B Focus");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [phraseA, { ...phraseB, segments: [focusB] }],
        activeLoopId: phraseA.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
      65,
    );
    expect(decision).toEqual({
      clampedTime: 65,
      selectSegment: { phraseId: phraseB.id, segmentId: focusB.id },
      setLoopPlaybackEnabled: false,
    });
  });

  test("phrase loop tap on focus enters practice_region scope", () => {
    const phrase = loopFromBounds(10, 40, 120, "A");
    const focus = phraseSegmentFromBounds(phrase.id, 20, 25, "Focus");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [{ ...phrase, segments: [focus] }],
        activeLoopId: phrase.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
      22,
    );
    expect(decision).toEqual({
      clampedTime: 22,
      selectSegment: { phraseId: phrase.id, segmentId: focus.id },
      setLoopPracticeScope: "practice_region",
    });
  });

  test("focus loop tap inside phrase but outside focus broadens to phrase loop", () => {
    const phrase = loopFromBounds(10, 40, 120, "A");
    const focus = phraseSegmentFromBounds(phrase.id, 20, 25, "Focus");
    const decision = resolveTimelinePlaybackIntent(
      snapshot({
        loops: [{ ...phrase, segments: [focus] }],
        activeLoopId: phrase.id,
        activeSegmentId: focus.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
      30,
    );
    expect(decision).toEqual({
      clampedTime: 30,
      setLoopPracticeScope: "phrase",
    });
  });
});
