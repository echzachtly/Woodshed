import { describe, expect, it } from "vitest";

import { SNAP_PRESETS } from "@/lib/snap-presets";

describe("snap-presets", () => {
  it("stays strictly within 0–1", () => {
    for (const row of SNAP_PRESETS) {
      expect(row.strength).toBeGreaterThanOrEqual(0);
      expect(row.strength).toBeLessThanOrEqual(1);
    }
  });
});
