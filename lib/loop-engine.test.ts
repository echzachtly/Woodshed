import { describe, expect, it } from "vitest";

import {
  clampTempo,
  createInitialLoop,
  loopFromBounds,
  softSnapSeconds,
  TEMPO_MAX,
  TEMPO_MIN,
} from "@/lib/loop-engine";

describe("loop-engine", () => {
  it("clamps tempo to PRD boundaries", () => {
    expect(clampTempo(0)).toBe(TEMPO_MIN);
    expect(clampTempo(999)).toBe(TEMPO_MAX);
  });

  it("creates a sensible initial loop spanning part of duration", () => {
    const loop = createInitialLoop(120);
    expect(loop.start).toBeGreaterThanOrEqual(0);
    expect(loop.end).toBeLessThanOrEqual(120);
    expect(loop.end - loop.start).toBeGreaterThan(3);
    expect(loop.name.length).toBeGreaterThan(0);
  });

  it("loops from bounds enforces proportional minimum span", () => {
    const durationSeconds = 30;
    /** Mirrors `loopFromBounds`: min(50ms, 0.1% of file length) */
    const expectedMinSeconds = Math.min(0.05, durationSeconds * 0.001);
    const loop = loopFromBounds(5, 5.01, durationSeconds);
    expect(loop.end - loop.start).toBeCloseTo(expectedMinSeconds, 4);
    expect(loop.end - loop.start).toBeGreaterThanOrEqual(expectedMinSeconds);
  });

  it("snaps softly when thresholds allow", () => {
    const transients = [1.02, 1.94, 2.73];
    const snappedStart = softSnapSeconds(1, transients, 0.06);
    expect(snappedStart).toBe(1.02);
    expect(softSnapSeconds(0.2, transients, 0.005)).toBeCloseTo(0.2, 6);
  });
});
