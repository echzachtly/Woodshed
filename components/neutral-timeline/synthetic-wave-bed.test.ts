import { describe, expect, test } from "vitest";

import { syntheticWaveNormalized } from "@/components/neutral-timeline/synthetic-wave-bed";

describe("syntheticWaveNormalized", () => {
  test("stays bounded and finite across a sweep", () => {
    for (let x = 0; x <= 5000; x += 47) {
      const y = syntheticWaveNormalized(x);
      expect(Number.isFinite(y)).toBe(true);
      expect(y).toBeGreaterThan(-1.01);
      expect(y).toBeLessThan(1.01);
    }
  });

  test("adjacent samples do not jump sharply (smooth decorative bed)", () => {
    let prev = syntheticWaveNormalized(0);
    for (let x = 2; x <= 2000; x += 2) {
      const y = syntheticWaveNormalized(x);
      expect(Math.abs(y - prev)).toBeLessThan(0.085);
      prev = y;
    }
  });
});
