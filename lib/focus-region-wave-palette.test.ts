import { describe, expect, it } from "vitest";

import {
  FOCUS_REGION_WAVE_PALETTE,
  focusRegionWavePaletteIndex,
} from "@/lib/focus-region-wave-palette";

describe("focusRegionWavePaletteIndex", () => {
  it("cycles within palette length", () => {
    const n = FOCUS_REGION_WAVE_PALETTE.length;
    expect(focusRegionWavePaletteIndex(0)).toBe(0);
    expect(focusRegionWavePaletteIndex(n - 1)).toBe(n - 1);
    expect(focusRegionWavePaletteIndex(n)).toBe(0);
    expect(focusRegionWavePaletteIndex(n + 1)).toBe(1);
  });

  it("clamps invalid indices to 0", () => {
    expect(focusRegionWavePaletteIndex(-1)).toBe(0);
    expect(focusRegionWavePaletteIndex(Number.NaN)).toBe(0);
  });
});
