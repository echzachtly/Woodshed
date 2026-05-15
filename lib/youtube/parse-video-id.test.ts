import { describe, expect, test } from "vitest";

import { extractYoutubeVideoId } from "@/lib/youtube/parse-video-id";

describe("extractYoutubeVideoId", () => {
  test("bare 11-char id", () => {
    expect(extractYoutubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  test("watch URL", () => {
    expect(
      extractYoutubeVideoId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  test("youtu.be short link", () => {
    expect(extractYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=42")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("embed path", () => {
    expect(
      extractYoutubeVideoId(
        "https://youtube.com/embed/dQw4w9WgXcQ?autoplay=0",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  test("shorts path", () => {
    expect(extractYoutubeVideoId("youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("missing scheme URL", () => {
    expect(extractYoutubeVideoId("youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  test("invalid token → null", () => {
    expect(extractYoutubeVideoId("not-a-url")).toBeNull();
    expect(extractYoutubeVideoId("")).toBeNull();
    expect(extractYoutubeVideoId("https://youtube.com/watch?v=bad")).toBeNull();
  });
});
