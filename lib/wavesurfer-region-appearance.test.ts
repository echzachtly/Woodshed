import { describe, expect, it } from "vitest";

import {
  desktopFocusRegionBoxShadow,
  mobileReadonlyFocusBoxShadow,
  phraseRegionBoxShadow,
} from "@/lib/wavesurfer-region-appearance";

describe("wavesurfer-region-appearance", () => {
  it("desktop inactive focus uses neutral chrome framing", () => {
    const s = desktopFocusRegionBoxShadow(0, false, false, true);
    expect(s).toContain("inset 0 0 0 1px rgba(255, 255, 255, 0.05)");
    expect(s).toContain("inset 0 -14px 28px rgba(0, 0, 0");
    expect(s).toContain("0 1px 6px rgba(0, 0, 0");
  });

  it("desktop selected focus adds side rails over neutral base", () => {
    const inactive = desktopFocusRegionBoxShadow(2, false, false, true);
    const selected = desktopFocusRegionBoxShadow(2, true, false, true);
    expect(selected.length).toBeGreaterThan(inactive.length);
    expect(selected).toContain("inset 2px 0 0 0");
  });

  it("desktop editable selected uses wider rails than selected-only", () => {
    const selected = desktopFocusRegionBoxShadow(1, true, false, true);
    const editable = desktopFocusRegionBoxShadow(1, true, true, true);
    expect(editable).toContain("inset 3px 0 0 0");
    expect(selected).toContain("inset 2px 0 0 0");
  });

  it("phrase desktop active uses warm amber rails when phrase is front", () => {
    const s = phraseRegionBoxShadow("active", false, true);
    expect(s).toContain("rgba(167, 139, 250");
    expect(s).toContain("inset 0 -20px 40px");
  });

  it("mobile readonly selected focus keeps neutral focus rails", () => {
    const s = mobileReadonlyFocusBoxShadow(true, true);
    expect(s).toContain("inset 2px 0 0 0 rgba(196, 181, 253");
  });
});
