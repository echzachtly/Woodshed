import type { PracticeLoop } from "@/lib/loop-engine";
import { describe, expect, test } from "vitest";

import {
  desktopShowShiftFocusCreationGuidance,
  totalFocusSegmentCount,
} from "@/lib/onboarding/triggers";

const section = (over: Partial<PracticeLoop>): PracticeLoop => ({
  id: "p1",
  name: "A",
  start: 0,
  end: 10,
  tempo: 1,
  segments: [],
  notes: "",
  ...over,
});

describe("onboarding/triggers", () => {
  test("totalFocusSegmentCount sums nested segments", () => {
    expect(
      totalFocusSegmentCount([
        section({
          segments: [
            {
              id: "a",
              phraseId: "p1",
              name: "",
              startTime: 0,
              endTime: 1,
              notes: "",
              createdAt: 0,
              updatedAt: 0,
            },
            {
              id: "b",
              phraseId: "p1",
              name: "",
              startTime: 0,
              endTime: 1,
              notes: "",
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        }),
        section({
          id: "p2",
          segments: [
            {
              id: "c",
              phraseId: "p2",
              name: "",
              startTime: 0,
              endTime: 1,
              notes: "",
              createdAt: 0,
              updatedAt: 0,
            },
          ],
        }),
      ]),
    ).toBe(3);
    expect(totalFocusSegmentCount([section({})])).toBe(0);
    expect(totalFocusSegmentCount([])).toBe(0);
  });

  test("desktopShowShiftFocusCreationGuidance", () => {
    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: true,
        durationSec: 10,
        loops: [section({})],
      }),
    ).toBe(false);

    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: false,
        durationSec: 0,
        loops: [section({})],
      }),
    ).toBe(false);

    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: false,
        durationSec: 10,
        loops: [],
      }),
    ).toBe(false);

    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: false,
        durationSec: 10,
        loops: [section({ start: 0, end: 0 })],
      }),
    ).toBe(false);

    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: false,
        durationSec: 10,
        loops: [section({})],
      }),
    ).toBe(true);

    expect(
      desktopShowShiftFocusCreationGuidance({
        focusLoopAuthoringComplete: false,
        durationSec: 10,
        loops: [
          section({
            segments: [
              {
                id: "x",
                phraseId: "p1",
                name: "",
                startTime: 0,
                endTime: 1,
                notes: "",
                createdAt: 0,
                updatedAt: 0,
              },
            ],
          }),
        ],
      }),
    ).toBe(false);
  });
});
