import { describe, expect, it } from "vitest";

import {
  downsamplePeaks,
  minimapSeekSeconds,
  ratioFromScroll,
  scrollPixelsFromNormalizedRatio,
} from "@/lib/waveform-manager";

describe("waveform-manager", () => {
  it("downsamples peaks symmetrically", () => {
    const peaks = Array.from({ length: 100 }, (_, idx) =>
      idx % 3 === 0 ? 1 : 0,
    );
    const down = downsamplePeaks(peaks, 10);
    expect(down.length).toBe(10);
    expect(down.some((v) => v > 0)).toBeTruthy();
  });

  it("derives ratios from scroll container", () => {
    expect(ratioFromScroll(40, 200, 100)).toEqual({
      startRatio: 0.4,
      durationRatio: 0.5,
    });
  });

  it("maps minimap clicks to timestamps", () => {
    expect(
      minimapSeekSeconds({
        clientX: 50 + 240,
        minimapLeft: 50,
        minimapWidth: 400,
        duration: 200,
      }),
    ).toBeCloseTo(120, 6);
  });

  it("maps normalized scroll ratios to pixel offsets", () => {
    expect(scrollPixelsFromNormalizedRatio(0.5, 400)).toBe(200);
    expect(scrollPixelsFromNormalizedRatio(-1, 120)).toBe(0);
  });
});
