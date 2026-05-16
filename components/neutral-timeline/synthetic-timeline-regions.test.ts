import { describe, expect, test } from "vitest";

import { loopFromBounds } from "@/lib/loop-engine";
import {
  clampPhraseMoveDelta,
  clampPhraseStartEnd,
  clampSegmentMoveDeltaInPhrase,
  clampSegmentStartEndInPhrase,
  minPhraseOrSegmentSpanSec,
  secondsDeltaFromPixelDelta,
  frontmostPhraseAtTime,
} from "@/components/neutral-timeline/synthetic-timeline-regions";

describe("minPhraseOrSegmentSpanSec", () => {
  test("floors tiny durations", () => {
    expect(minPhraseOrSegmentSpanSec(3600)).toBeLessThanOrEqual(0.05);
    expect(minPhraseOrSegmentSpanSec(10)).toBeGreaterThan(0);
  });
});

describe("clampPhraseStartEnd", () => {
  test("corrects swapped bounds and clamps to media range", () => {
    expect(clampPhraseStartEnd(80, 20, 100)).toEqual({ start: 20, end: 80 });
    expect(clampPhraseStartEnd(-10, 5, 12)).toMatchObject({
      start: expect.any(Number),
      end: expect.any(Number),
    });
    const c = clampPhraseStartEnd(-10, 5, 12);
    expect(c.start).toBeGreaterThanOrEqual(0);
    expect(c.end).toBeLessThanOrEqual(12);
    expect(c.end - c.start).toBeGreaterThanOrEqual(minPhraseOrSegmentSpanSec(12) - 1e-9);
  });
});

describe("secondsDeltaFromPixelDelta", () => {
  test("converts Δpx to seconds", () => {
    expect(secondsDeltaFromPixelDelta(100, 50)).toBe(2);
    expect(secondsDeltaFromPixelDelta(-50, 25)).toBe(-2);
  });
});

describe("clampPhraseMoveDelta", () => {
  test("pins to media edges preserving span", () => {
    const d = clampPhraseMoveDelta(10, 20, -15, 100);
    expect(d.start).toBeGreaterThanOrEqual(0);
    expect(d.end).toBe(d.start + 10);
    const d2 = clampPhraseMoveDelta(90, 100, 20, 100);
    expect(d2.end).toBeLessThanOrEqual(100);
    expect(d2.end - d2.start).toBe(10);
  });
});

describe("clampSegmentStartEndInPhrase", () => {
  test("keeps bounds inside phrase", () => {
    expect(clampSegmentStartEndInPhrase(100, 200, 10, 50)).toMatchObject({
      start: expect.any(Number),
      end: expect.any(Number),
    });
    const c = clampSegmentStartEndInPhrase(22, 40, 20, 60);
    expect(c.start).toBeGreaterThanOrEqual(20);
    expect(c.end).toBeLessThanOrEqual(60);
    expect(c.end).toBeGreaterThan(c.start);
  });
});

describe("clampSegmentMoveDeltaInPhrase", () => {
  test("clips delta so segment stays fully inside phrase", () => {
    const r = clampSegmentMoveDeltaInPhrase(25, 35, -20, 20, 60);
    expect(r.start).toBeGreaterThanOrEqual(20);
    expect(r.end).toBeLessThanOrEqual(60);
    expect(r.end - r.start).toBeCloseTo(10, 5);
  });
});

describe("frontmostPhraseAtTime", () => {
  test("returns inner/narrow overlay last (tie-break widest last in sort)", () => {
    const a = loopFromBounds(0, 100, 200, "A");
    const b = loopFromBounds(40, 60, 200, "B");
    const fr = frontmostPhraseAtTime([a, b], 50);
    expect(fr?.id).toBe(b.id);
  });
});
