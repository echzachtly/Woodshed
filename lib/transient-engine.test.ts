import { describe, expect, it } from "vitest";

import { detectTransientSeconds } from "@/lib/transient-engine";

describe("transient-engine", () => {
  it("returns sparse markers for sine-like signal", () => {
    const sampleRate = 48000;
    const seconds = 0.75;
    const length = Math.floor(sampleRate * seconds);
    const buffer = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      buffer[i] = Math.sin((i / sampleRate) * 220 * Math.PI * 2) * 0.2;
    }
    /** Impulse spike to simulate percussion */
    buffer[sampleRate / 4] += 2;
    buffer[sampleRate / 4 + 1] += 2;
    const hits = detectTransientSeconds(buffer, sampleRate, {
      sensitivity: 0.3,
      maxMarkers: 32,
    });
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.every((time) => time >= 0 && time <= seconds)).toBeTruthy();
  });
});
