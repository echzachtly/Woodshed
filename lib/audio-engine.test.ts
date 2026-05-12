import { describe, expect, it, vi } from "vitest";

import {
  applyPlaybackTempo,
  loopSeekDecision,
} from "@/lib/audio-engine";

describe("audio-engine.loopSeekDecision", () => {
  const rail = { enabled: true, start: 2, end: 5 };

  it("warp to start inside loop playback window", () => {
    expect(loopSeekDecision(1.2, rail, 0.1).warpTo).toBeCloseTo(rail.start, 6);
  });

  it("wrap once near boundary", () => {
    expect(loopSeekDecision(4.99, rail, 0.05).warpTo).toBeCloseTo(rail.start, 6);
  });

  it("respects disable flag", () => {
    expect(loopSeekDecision(6, { ...rail, enabled: false }, 0.1).warpTo).toBeNull();
  });
});

describe("applyPlaybackTempo", () => {
  it("pipes rate through surface shim when DOM element absent", () => {
    const surface = {
      getDuration: () => 60,
      getCurrentTime: () => 10,
      seek: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      isPlaying: () => false,
      setPlaybackRate: vi.fn(),
    };
    applyPlaybackTempo(surface, 1.05);
    expect(surface.setPlaybackRate).toHaveBeenCalledWith(1.05);
  });
});
