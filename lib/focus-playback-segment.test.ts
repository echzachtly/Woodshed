import { describe, expect, test } from "vitest";

import {
  listOrderedValidFocusSegments,
  resolveFocusDeletionFallbackId,
  resolveFocusPlaybackSegment,
} from "@/lib/focus-playback-segment";
import { loopFromBounds, phraseSegmentFromBounds } from "@/lib/loop-engine";

describe("resolveFocusPlaybackSegment", () => {
  test("uses deterministic time ordering when no active/last segment exists", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const late = phraseSegmentFromBounds(loop.id, 20, 25, "Late");
    const early = phraseSegmentFromBounds(loop.id, 10, 12, "Early");
    const resolved = resolveFocusPlaybackSegment({
      loop: { ...loop, segments: [late, early] },
      activeSegmentId: null,
      lastPracticeSegmentIdByPhrase: {},
    });
    expect(resolved?.id).toBe(early.id);
  });
});

describe("resolveFocusDeletionFallbackId", () => {
  test("prefers next sibling then previous sibling", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const a = phraseSegmentFromBounds(loop.id, 10, 12, "A");
    const b = phraseSegmentFromBounds(loop.id, 20, 22, "B");
    const c = phraseSegmentFromBounds(loop.id, 30, 32, "C");
    const fallback = resolveFocusDeletionFallbackId({
      segments: [c, a, b],
      removedSegmentId: b.id,
      lastUsedSegmentId: a.id,
    });
    expect(fallback).toBe(c.id);
  });

  test("uses previous sibling when no next sibling exists", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const a = phraseSegmentFromBounds(loop.id, 10, 12, "A");
    const b = phraseSegmentFromBounds(loop.id, 20, 22, "B");
    const fallback = resolveFocusDeletionFallbackId({
      segments: [a, b],
      removedSegmentId: b.id,
      lastUsedSegmentId: null,
    });
    expect(fallback).toBe(a.id);
  });

  test("falls back to last-used in same phrase when sibling order is unavailable", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const a = phraseSegmentFromBounds(loop.id, 10, 12, "A");
    const b = phraseSegmentFromBounds(loop.id, 20, 22, "B");
    const c = phraseSegmentFromBounds(loop.id, 30, 32, "C");
    const fallback = resolveFocusDeletionFallbackId({
      segments: [a, b, c],
      removedSegmentId: "missing",
      lastUsedSegmentId: c.id,
    });
    expect(fallback).toBe(c.id);
  });

  test("returns null when no segments remain", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const only = phraseSegmentFromBounds(loop.id, 10, 12, "Only");
    const fallback = resolveFocusDeletionFallbackId({
      segments: [only],
      removedSegmentId: only.id,
      lastUsedSegmentId: only.id,
    });
    expect(fallback).toBeNull();
  });
});

describe("listOrderedValidFocusSegments", () => {
  test("filters invalid spans", () => {
    const loop = loopFromBounds(0, 60, 120, "A");
    const ok = phraseSegmentFromBounds(loop.id, 10, 12, "ok");
    const invalid = { ...ok, id: "bad", startTime: 15, endTime: 15 };
    const ordered = listOrderedValidFocusSegments([invalid, ok]);
    expect(ordered.map((s) => s.id)).toEqual([ok.id]);
  });
});
