import { describe, expect, it } from "vitest";

import { resolveFixedPlayheadViewportLock } from "@/lib/playhead-sync";

describe("resolveFixedPlayheadViewportLock", () => {
  it("keeps playhead centered through middle playback", () => {
    const result = resolveFixedPlayheadViewportLock({
      seconds: 30,
      duration: 120,
      pxPerSec: 10,
      viewportWidthPx: 200,
      scrollWidthPx: 1400,
    });
    expect(result.centered).toBe(true);
    expect(result.scrollLeftPx).toBeCloseTo(272, 4);
    expect(result.playheadViewportXPx).toBeCloseTo(100, 4);
  });

  it("allows left-edge offset when content cannot center yet", () => {
    const result = resolveFixedPlayheadViewportLock({
      seconds: 0.8,
      duration: 120,
      pxPerSec: 10,
      viewportWidthPx: 200,
      scrollWidthPx: 1400,
    });
    expect(result.centered).toBe(false);
    expect(result.scrollLeftPx).toBe(0);
    expect(result.playheadViewportXPx).toBeCloseTo(80, 4);
  });

  it("allows right-edge offset when max scroll reached", () => {
    const result = resolveFixedPlayheadViewportLock({
      seconds: 119.6,
      duration: 120,
      pxPerSec: 10,
      viewportWidthPx: 200,
      scrollWidthPx: 1300,
    });
    expect(result.centered).toBe(false);
    expect(result.scrollLeftPx).toBeCloseTo(1100, 4);
    expect(result.playheadViewportXPx).toBeCloseTo(168, 4);
  });
});
