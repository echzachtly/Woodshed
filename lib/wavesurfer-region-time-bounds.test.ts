import { describe, expect, it } from "vitest";

import { normalizeWaveSurferRegionBounds } from "@/lib/wavesurfer-region-time-bounds";

describe("normalizeWaveSurferRegionBounds", () => {
  it("uses explicit start and end when valid", () => {
    const r = normalizeWaveSurferRegionBounds({
      startRaw: 10,
      endRaw: 25,
      trackDuration: 120,
    });
    expect(r).toEqual({ start: 10, end: 25 });
  });

  it("when end is missing, uses start + 5s (clamped to duration)", () => {
    const r = normalizeWaveSurferRegionBounds({
      startRaw: 100,
      endRaw: undefined,
      trackDuration: 120,
    });
    expect(r.start).toBe(100);
    expect(r.end).toBe(105);
  });

  it("when end <= start, expands by default span", () => {
    const r = normalizeWaveSurferRegionBounds({
      startRaw: 20,
      endRaw: 20,
      trackDuration: 120,
    });
    expect(r.end - r.start).toBeGreaterThan(0.04);
    expect(r.start).toBe(20);
    expect(r.end).toBe(25);
  });

  it("clamps end to duration but keeps span > start", () => {
    const r = normalizeWaveSurferRegionBounds({
      startRaw: 119,
      endRaw: 500,
      trackDuration: 120,
    });
    expect(r.end).toBe(120);
    expect(r.end).toBeGreaterThan(r.start);
  });

  it("does not force end to full duration when end is missing", () => {
    const r = normalizeWaveSurferRegionBounds({
      startRaw: 2,
      endRaw: null,
      trackDuration: 600,
    });
    expect(r.end).toBe(7);
  });
});
