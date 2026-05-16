import { describe, expect, test } from "vitest";

import {
  loopFromBounds,
  phraseSegmentFromBounds,
} from "@/lib/loop-engine";
import { resolveNeutralTimelineHit } from "@/lib/youtube/neutral-timeline-playback-intent";

describe("resolveNeutralTimelineHit", () => {
  test("returns gap when no phrase contains t", () => {
    const a = loopFromBounds(10, 20, 120, "A");
    expect(resolveNeutralTimelineHit(5, [a])).toEqual({ kind: "gap" });
    expect(resolveNeutralTimelineHit(25, [a])).toEqual({ kind: "gap" });
  });

  test("returns phrase when inside loop but not in a segment", () => {
    const a = loopFromBounds(10, 40, 120, "A");
    expect(resolveNeutralTimelineHit(15, [a])).toEqual({
      kind: "phrase",
      phraseId: a.id,
    });
  });

  test("returns smallest containing phrase when overlaps", () => {
    const outer = loopFromBounds(0, 60, 120, "Outer");
    const inner = loopFromBounds(20, 40, 120, "Inner");
    expect(resolveNeutralTimelineHit(30, [outer, inner])).toEqual({
      kind: "phrase",
      phraseId: inner.id,
    });
  });

  test("returns focus when t lies inside a segment (smallest segment on overlap)", () => {
    const a = loopFromBounds(0, 80, 120, "A");
    const wide = phraseSegmentFromBounds(a.id, 10, 70, "Wide");
    const narrow = phraseSegmentFromBounds(a.id, 30, 35, "Narrow");
    const loop = { ...a, segments: [wide, narrow] };
    expect(resolveNeutralTimelineHit(32, [loop])).toEqual({
      kind: "focus",
      phraseId: a.id,
      segmentId: narrow.id,
    });
  });
});
