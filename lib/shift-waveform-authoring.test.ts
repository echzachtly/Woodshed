import { describe, expect, it } from "vitest";

import type { PracticeLoop } from "@/lib/loop-engine";
import { shiftDragShouldCreateFocusInsideActivePhrase } from "@/lib/shift-waveform-authoring";

function loop(start: number, end: number): PracticeLoop {
  return {
    id: "p1",
    name: "Test",
    start,
    end,
    tempo: 1,
    segments: [],
  };
}

describe("shiftDragShouldCreateFocusInsideActivePhrase", () => {
  it("returns false without a valid loop", () => {
    expect(
      shiftDragShouldCreateFocusInsideActivePhrase(undefined, 1, 2),
    ).toBe(false);
    const degenerate: PracticeLoop = { ...loop(5, 10), end: 5 };
    expect(
      shiftDragShouldCreateFocusInsideActivePhrase(degenerate, 6, 8),
    ).toBe(false);
  });

  it("returns true when drag is fully inside the phrase", () => {
    const L = loop(10, 40);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 12, 30)).toBe(true);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 30, 12)).toBe(true);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 10, 40)).toBe(true);
  });

  it("returns false when partially outside (phrase path)", () => {
    const L = loop(10, 40);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 8, 20)).toBe(false);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 35, 50)).toBe(false);
    expect(shiftDragShouldCreateFocusInsideActivePhrase(L, 5, 50)).toBe(false);
  });
});
