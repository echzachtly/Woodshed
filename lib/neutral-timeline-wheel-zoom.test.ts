/** @vitest-environment jsdom */

import { describe, expect, test } from "vitest";

import {
  NEUTRAL_TIMELINE_MAX_PX_PER_SEC,
  NEUTRAL_TIMELINE_MIN_PX_PER_SEC,
  applyNeutralTimelineWheelZoomAnchoredToCursor,
  neutralTimelineAnchorTimeAtClientX,
  neutralTimelineScrollToKeepTimeUnderClientX,
} from "@/lib/neutral-timeline-wheel-zoom";

describe("neutralTimelineAnchorTimeAtClientX", () => {
  test("maps viewport center to mid-song time when scroll origin", () => {
    const scrollEl = document.createElement("div");
    scrollEl.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 200,
        height: 40,
        right: 300,
        bottom: 40,
        x: 100,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
    Object.defineProperty(scrollEl, "scrollLeft", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollEl, "clientWidth", { value: 200 });

    const t = neutralTimelineAnchorTimeAtClientX({
      scrollEl,
      clientX: 200,
      pxPerSec: 50,
      durationSec: 100,
    });
    expect(t).toBeCloseTo(2, 5);
  });
});

describe("neutralTimelineScrollToKeepTimeUnderClientX", () => {
  test("positions scroll so anchor time stays under clientX", () => {
    const scrollEl = document.createElement("div");
    scrollEl.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 200,
        height: 40,
        right: 300,
        bottom: 40,
        x: 100,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
    Object.defineProperty(scrollEl, "scrollLeft", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollEl, "scrollWidth", { value: 5000 });
    Object.defineProperty(scrollEl, "clientWidth", { value: 200 });

    neutralTimelineScrollToKeepTimeUnderClientX({
      scrollEl,
      clientX: 200,
      timeSec: 10,
      pxPerSec: 50,
    });
    expect(scrollEl.scrollLeft).toBeCloseTo(400, 3);
  });
});

describe("zoom clamps", () => {
  test("exports match waveform wheel clamp band", () => {
    expect(NEUTRAL_TIMELINE_MIN_PX_PER_SEC).toBe(4);
    expect(NEUTRAL_TIMELINE_MAX_PX_PER_SEC).toBe(1500);
  });
});

describe("applyNeutralTimelineWheelZoomAnchoredToCursor", () => {
  test("invokes onPxPerSecChange and prevents default when zoom changes", () => {
    const scrollEl = document.createElement("div");
    scrollEl.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 0,
        width: 200,
        height: 40,
        right: 300,
        bottom: 40,
        x: 100,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
    Object.defineProperty(scrollEl, "scrollLeft", {
      value: 0,
      writable: true,
    });
    Object.defineProperty(scrollEl, "clientWidth", { value: 200 });

    const changes: number[] = [];
    const event = new WheelEvent("wheel", {
      deltaY: -120,
      clientX: 200,
      bubbles: true,
      cancelable: true,
    });
    applyNeutralTimelineWheelZoomAnchoredToCursor({
      scrollEl,
      durationSec: 60,
      pxPerSec: 50,
      event,
      onPxPerSecChange: (n) => changes.push(n),
    });
    expect(changes.length).toBe(1);
    expect(changes[0]).toBeGreaterThan(50);
    expect(event.defaultPrevented).toBe(true);
  });

  test("does nothing when already at max px/sec and scrolling further out", () => {
    const scrollEl = document.createElement("div");
    scrollEl.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 100,
        height: 40,
        right: 100,
        bottom: 40,
        x: 0,
        y: 0,
        toJSON: () => "",
      }) as DOMRect;
    Object.defineProperty(scrollEl, "scrollLeft", { value: 0, writable: true });
    Object.defineProperty(scrollEl, "clientWidth", { value: 100 });

    const changes: number[] = [];
    const event = new WheelEvent("wheel", {
      deltaY: -500,
      clientX: 50,
      bubbles: true,
      cancelable: true,
    });
    applyNeutralTimelineWheelZoomAnchoredToCursor({
      scrollEl,
      durationSec: 10,
      pxPerSec: NEUTRAL_TIMELINE_MAX_PX_PER_SEC,
      event,
      onPxPerSecChange: (n) => changes.push(n),
    });
    expect(changes).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});
