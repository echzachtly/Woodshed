import { describe, expect, test } from "vitest";

import { loopFromBounds, phraseSegmentFromBounds } from "@/lib/loop-engine";
import {
  normalizePlaybackScopeSnapshot,
  type PlaybackScopeNormalizationSnapshot,
} from "@/lib/playback/playback-scope-normalization";

function snapshot(
  partial: Partial<PlaybackScopeNormalizationSnapshot>,
): PlaybackScopeNormalizationSnapshot {
  return {
    duration: 120,
    loops: [],
    activeLoopId: null,
    activeSegmentId: null,
    lastPracticeSegmentIdByPhrase: {},
    loopPlaybackEnabled: false,
    loopPracticeScope: "phrase",
    ...partial,
  };
}

describe("normalizePlaybackScopeSnapshot", () => {
  test("repeat off forces Play Through semantics", () => {
    const phrase = loopFromBounds(10, 30, 120, "Phrase");
    const focus = phraseSegmentFromBounds(phrase.id, 12, 14, "Focus");
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [{ ...phrase, segments: [focus] }],
        activeLoopId: phrase.id,
        activeSegmentId: focus.id,
        loopPlaybackEnabled: false,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(normalized.loopPlaybackEnabled).toBe(false);
    expect(normalized.loopPracticeScope).toBe("phrase");
  });

  test("stale active Practice Section falls back deterministically", () => {
    const later = loopFromBounds(60, 80, 120, "Later");
    const earlier = loopFromBounds(10, 30, 120, "Earlier");
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [later, earlier],
        activeLoopId: "missing",
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
      }),
    );
    expect(normalized.activeLoopId).toBe(earlier.id);
    expect(normalized.loopPlaybackEnabled).toBe(true);
  });

  test("stale active Focus Loop falls back deterministically", () => {
    const phrase = loopFromBounds(10, 40, 120, "Phrase");
    const a = phraseSegmentFromBounds(phrase.id, 14, 18, "A");
    const b = phraseSegmentFromBounds(phrase.id, 25, 29, "B");
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [{ ...phrase, segments: [a, b] }],
        activeLoopId: phrase.id,
        activeSegmentId: "stale-focus-id",
        lastPracticeSegmentIdByPhrase: { [phrase.id]: b.id },
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(normalized.loopPracticeScope).toBe("practice_region");
    expect(normalized.activeSegmentId).toBe(b.id);
  });

  test("focus scope with no valid Focus Loops degrades to Practice Section loop", () => {
    const phrase = loopFromBounds(10, 40, 120, "Phrase");
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [phrase],
        activeLoopId: phrase.id,
        activeSegmentId: "missing-focus",
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(normalized.loopPlaybackEnabled).toBe(true);
    expect(normalized.loopPracticeScope).toBe("phrase");
    expect(normalized.activeSegmentId).toBeNull();
  });

  test("no loops available degrades to Play Through and clears stale ids", () => {
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [],
        activeLoopId: "missing-loop",
        activeSegmentId: "missing-segment",
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(normalized).toEqual({
      activeLoopId: null,
      activeSegmentId: null,
      loopPlaybackEnabled: false,
      loopPracticeScope: "phrase",
      reasons: expect.arrayContaining(["no_valid_loops_disables_repeat"]),
    });
  });

  test("deletion scenario does not preserve stale segment ids", () => {
    const phrase = loopFromBounds(10, 40, 120, "Phrase");
    const focus = phraseSegmentFromBounds(phrase.id, 14, 18, "Focus");
    const normalized = normalizePlaybackScopeSnapshot(
      snapshot({
        loops: [{ ...phrase, segments: [] }],
        activeLoopId: phrase.id,
        activeSegmentId: focus.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
      }),
    );
    expect(normalized.activeLoopId).toBe(phrase.id);
    expect(normalized.activeSegmentId).toBeNull();
    expect(normalized.loopPracticeScope).toBe("phrase");
  });
});
