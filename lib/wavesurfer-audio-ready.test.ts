import { describe, expect, it } from "vitest";

import { isWaveSurferAudioDecoded } from "@/lib/wavesurfer-audio-ready";

describe("isWaveSurferAudioDecoded", () => {
  it("returns false for null/undefined", () => {
    expect(isWaveSurferAudioDecoded(null)).toBe(false);
    expect(isWaveSurferAudioDecoded(undefined)).toBe(false);
  });

  it("returns false when getDecodedData is missing or returns nullish", () => {
    expect(isWaveSurferAudioDecoded({} as never)).toBe(false);
    expect(
      isWaveSurferAudioDecoded({ getDecodedData: () => null } as never),
    ).toBe(false);
  });

  it("returns true when a decoded buffer object exists", () => {
    const stub = { numberOfChannels: 1 } as unknown;
    expect(
      isWaveSurferAudioDecoded({
        getDecodedData: () => stub,
      } as never),
    ).toBe(true);
  });
});
