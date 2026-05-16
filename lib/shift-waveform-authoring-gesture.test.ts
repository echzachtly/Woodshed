import { describe, expect, it } from "vitest";

import { shouldIgnoreShiftAuthoringPointerTarget } from "@/lib/shift-waveform-authoring-gesture";

function targetWithClosest(
  resolver: (selector: string) => Element | null,
): Element {
  return { closest: resolver } as unknown as Element;
}

describe("shouldIgnoreShiftAuthoringPointerTarget", () => {
  it("ignores resize-handle starts so WaveSurfer handle edits keep priority", () => {
    const target = targetWithClosest((selector) =>
      selector === '.woodshed-region-editing [part*="region-handle"]'
        ? ({} as Element)
        : null,
    );
    expect(shouldIgnoreShiftAuthoringPointerTarget(target)).toBe(true);
  });

  it("does not ignore starts over focus overlays", () => {
    const target = targetWithClosest((selector) =>
      selector === ".woodshed-region-segment" ? ({} as Element) : null,
    );
    expect(shouldIgnoreShiftAuthoringPointerTarget(target)).toBe(false);
  });

  it("does not ignore null targets", () => {
    expect(shouldIgnoreShiftAuthoringPointerTarget(null)).toBe(false);
  });
});
