import { describe, expect, test } from "vitest";

import {
  pickMajorTickIntervalSec,
  pointerClientToSeconds,
  timelineLogicalWidthPx,
  timelineScrollWidthPx,
  timelineViewportRatios,
} from "@/components/neutral-timeline/timeline-coordinates";

describe("timelineLogicalWidthPx / timelineScrollWidthPx", () => {
  test("logical width is duration × px/sec", () => {
    expect(timelineLogicalWidthPx(60, 50)).toBe(3000);
  });

  test("scroll width pads up to viewport when zoomed out", () => {
    expect(timelineScrollWidthPx(100, 800)).toBe(800);
    expect(timelineScrollWidthPx(900, 800)).toBe(900);
  });
});

describe("pointerClientToSeconds", () => {
  test("maps scroll-relative X into clamped seconds", () => {
    expect(
      pointerClientToSeconds({
        clientX: 400,
        scrollHostLeft: 100,
        scrollLeft: 0,
        pxPerSec: 100,
        durationSec: 10,
      }),
    ).toBe(3);

    expect(
      pointerClientToSeconds({
        clientX: 600,
        scrollHostLeft: 100,
        scrollLeft: 500,
        pxPerSec: 100,
        durationSec: 10,
      }),
    ).toBe(10);
  });
});

describe("timelineViewportRatios", () => {
  test("delegates to waveform ratio helper shape", () => {
    const v = timelineViewportRatios({
      scrollLeft: 250,
      scrollWidth: 1250,
      viewportWidth: 250,
    });
    expect(v.startRatio).toBeCloseTo(250 / 1000);
    expect(v.durationRatio).toBeCloseTo(250 / 1250);
  });
});

describe("pickMajorTickIntervalSec", () => {
  test("coarser zoom yields wider tick spacing", () => {
    expect(pickMajorTickIntervalSec(200)).toBeLessThanOrEqual(
      pickMajorTickIntervalSec(10),
    );
  });
});
