import { describe, expect, test } from "vitest";

import { loopFromBounds, phraseSegmentFromBounds } from "@/lib/loop-engine";
import {
  resolvePlaybackRestartTarget,
  type RestartSnapshot,
} from "@/lib/playback/restart-target";

function snapshot(partial: Partial<RestartSnapshot>): RestartSnapshot {
  return {
    duration: 120,
    loops: [],
    activeLoopId: null,
    activeSegmentId: null,
    loopPlaybackEnabled: false,
    loopPracticeScope: "phrase",
    lastPracticeSegmentIdByPhrase: {},
    currentTime: 0,
    ...partial,
  };
}

describe("resolvePlaybackRestartTarget", () => {
  test("Focus Loop scope restarts at active Focus Loop start", () => {
    const loop = loopFromBounds(10, 40, 120, "Phrase");
    const focus = phraseSegmentFromBounds(loop.id, 18, 21, "Focus");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        loops: [{ ...loop, segments: [focus] }],
        activeLoopId: loop.id,
        activeSegmentId: focus.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(resolved).toEqual({
      restartTargetSeconds: 18,
      resolvedLoopPlaybackEnabled: true,
      resolvedLoopPracticeScope: "practice_region",
      resolvedActiveLoopId: loop.id,
      resolvedActiveSegmentId: focus.id,
    });
  });

  test("Practice Section loop scope restarts at active Practice Section start", () => {
    const loop = loopFromBounds(30, 70, 120, "Phrase");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        loops: [loop],
        activeLoopId: loop.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
    );
    expect(resolved.restartTargetSeconds).toBe(30);
    expect(resolved.resolvedLoopPracticeScope).toBe("phrase");
  });

  test("Play Through restarts from transport context (zero), not loop rails", () => {
    const loop = loopFromBounds(20, 60, 120, "Phrase");
    const focus = phraseSegmentFromBounds(loop.id, 26, 31, "Focus");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        loops: [{ ...loop, segments: [focus] }],
        activeLoopId: loop.id,
        activeSegmentId: focus.id,
        loopPlaybackEnabled: false,
        loopPracticeScope: "practice_region",
        currentTime: 47,
      }),
    );
    expect(resolved.restartTargetSeconds).toBe(0);
    expect(resolved.resolvedLoopPlaybackEnabled).toBe(false);
    expect(resolved.resolvedLoopPracticeScope).toBe("phrase");
  });

  test("stale active Focus Loop id degrades deterministically to last-used or first valid", () => {
    const loop = loopFromBounds(10, 40, 120, "Phrase");
    const a = phraseSegmentFromBounds(loop.id, 14, 18, "A");
    const b = phraseSegmentFromBounds(loop.id, 25, 29, "B");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        loops: [{ ...loop, segments: [a, b] }],
        activeLoopId: loop.id,
        activeSegmentId: "stale-segment",
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        lastPracticeSegmentIdByPhrase: { [loop.id]: b.id },
      }),
    );
    expect(resolved.restartTargetSeconds).toBe(25);
    expect(resolved.resolvedActiveSegmentId).toBe(b.id);
    expect(resolved.resolvedLoopPracticeScope).toBe("practice_region");
  });

  test("missing active Practice Section fallback picks deterministic phrase", () => {
    const later = loopFromBounds(60, 80, 120, "Later");
    const earlier = loopFromBounds(10, 30, 120, "Earlier");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        loops: [later, earlier],
        activeLoopId: "missing-loop",
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
    );
    expect(resolved.restartTargetSeconds).toBe(10);
    expect(resolved.resolvedActiveLoopId).toBe(earlier.id);
    expect(resolved.resolvedLoopPlaybackEnabled).toBe(true);
  });

  test("boundary clamps restart target into [0, duration]", () => {
    const loop = loopFromBounds(110, 140, 200, "OutOfBoundsForMedia");
    const resolved = resolvePlaybackRestartTarget(
      snapshot({
        duration: 90,
        loops: [loop],
        activeLoopId: loop.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
    );
    expect(resolved.restartTargetSeconds).toBe(90);
  });
});
