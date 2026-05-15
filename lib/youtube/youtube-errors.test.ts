import { describe, expect, test } from "vitest";

import { describeYoutubeIframeError } from "@/lib/youtube/youtube-errors";

describe("describeYoutubeIframeError", () => {
  test("maps documented iframe API error codes", () => {
    expect(describeYoutubeIframeError(2)).toContain("Invalid");
    expect(describeYoutubeIframeError(5)).toContain("HTML5");
    expect(describeYoutubeIframeError(100)).toContain("not found");
    expect(describeYoutubeIframeError(101)).toContain("Embedding disabled");
    expect(describeYoutubeIframeError(150)).toContain("Embedding disabled");
  });

  test("falls back for unknown codes", () => {
    expect(describeYoutubeIframeError(999)).toContain("Unknown");
    expect(describeYoutubeIframeError(999)).toContain("999");
  });
});
