/** @vitest-environment jsdom */

import { describe, expect, test } from "vitest";

import {
  pickMajorTickIntervalSec,
  pointerClientToSeconds,
  scrollHostContentLeftClientX,
  timelineLogicalWidthPx,
  timelineScrollWidthPx,
  timelineSongContentWidthPx,
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

describe("timelineSongContentWidthPx", () => {
  test("song width is ceil(duration × zoom) — unlike scroll width, never viewport-padded", () => {
    expect(timelineSongContentWidthPx(60, 10)).toBe(600);
    expect(timelineScrollWidthPx(600, 2400)).toBe(2400);
    expect(timelineSongContentWidthPx(60, 10)).toBeLessThan(
      timelineScrollWidthPx(600, 2400),
    );
  });

  test("ceil fractional duration×zoom so strip fully covers endpoint", () => {
    expect(timelineSongContentWidthPx(10, 8.3333)).toBe(84);
  });

  test("minimal width when timeline not ready", () => {
    expect(timelineSongContentWidthPx(0, 120)).toBe(1);
  });
});

describe("scrollHostContentLeftClientX", () => {
  test("adds padding-left to bounding-client left", () => {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 400,
        height: 100,
        right: 500,
        bottom: 100,
        x: 100,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
    el.style.paddingLeft = "16px";
    expect(scrollHostContentLeftClientX(el)).toBe(116);
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
