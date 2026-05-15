import { describe, expect, it } from "vitest";

import {
  desktopFocusRegionBoxShadow,
  mobileReadonlyFocusBoxShadow,
  phraseRegionBoxShadow,
} from "@/lib/wavesurfer-region-appearance";

describe("wavesurfer-region-appearance", () => {
  it("desktop inactive focus stacks rim, inner key, and outer drop", () => {
    const s = desktopFocusRegionBoxShadow(0, false, false, true);
    expect(s).toContain("inset 0 0 0 1px rgba(188, 178, 222");
    expect(s).toContain("inset 0 0 0 2px rgba(5, 4, 3");
    expect(s).toContain("0 1px 6px rgba(0, 0, 0");
  });

  it("desktop selected focus adds stronger framing than inactive", () => {
    const inactive = desktopFocusRegionBoxShadow(2, false, false, true);
    const selected = desktopFocusRegionBoxShadow(2, true, false, true);
    expect(selected.length).toBeGreaterThan(inactive.length);
    expect(selected).toContain("inset 4px 0 0 0");
  });

  it("desktop editable selected uses wider rails than selected-only", () => {
    const selected = desktopFocusRegionBoxShadow(1, true, false, true);
    const editable = desktopFocusRegionBoxShadow(1, true, true, true);
    expect(editable).toContain("inset 5px 0 0 0");
    expect(selected).toContain("inset 4px 0 0 0");
  });

  it("phrase desktop active uses warm amber rails when phrase is front", () => {
    const s = phraseRegionBoxShadow("active", false, true);
    expect(s).toContain("rgba(255, 205, 130");
    expect(s).toContain("rgba(230, 150, 55");
  });

  it("mobile readonly selected focus adds side rails when focus is front", () => {
    const s = mobileReadonlyFocusBoxShadow(true, true);
    expect(s).toContain("inset 3px 0 0 0 rgba(196, 181, 253");
  });
});
