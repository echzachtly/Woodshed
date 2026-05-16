import { describe, expect, test } from "vitest";

import type { StoredProjectMeta } from "@/lib/project-db";
import {
  parseYoutubePasteForMediaSource,
  storedProjectNeedsArchivedAudioBlob,
  storedProjectUsesYoutubeMedia,
} from "@/lib/youtube/youtube-import";

describe("parseYoutubePasteForMediaSource", () => {
  test("parses watch URLs with extra query params", () => {
    const ms = parseYoutubePasteForMediaSource(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx&t=12",
    );
    expect(ms?.videoId).toBe("dQw4w9WgXcQ");
    expect(ms?.canonicalUrl).toContain("v=dQw4w9WgXcQ");
  });

  test("parses shorts and youtu.be", () => {
    expect(parseYoutubePasteForMediaSource("https://youtu.be/dQw4w9WgXcQ?t=3")?.videoId).toBe(
      "dQw4w9WgXcQ",
    );
    expect(
      parseYoutubePasteForMediaSource("youtube.com/shorts/dQw4w9WgXcQ")?.videoId,
    ).toBe("dQw4w9WgXcQ");
  });

  test("returns null for invalid input", () => {
    expect(parseYoutubePasteForMediaSource("")).toBeNull();
    expect(parseYoutubePasteForMediaSource("not youtube")).toBeNull();
  });
});

describe("stored project routing helpers", () => {
  test("upload projects do not use youtube media", () => {
    const meta: StoredProjectMeta = {
      id: "u1",
      name: "Up",
      updatedAt: 1,
      loops: [],
      activeLoopId: null,
      blobId: "b1",
    };
    expect(storedProjectUsesYoutubeMedia(meta)).toBe(false);
    expect(storedProjectNeedsArchivedAudioBlob(meta)).toBe(true);
  });

  test("youtube projects use youtube media and skip blob hydration", () => {
    const meta: StoredProjectMeta = {
      id: "y1",
      name: "Yt",
      updatedAt: 1,
      loops: [],
      activeLoopId: null,
      mediaSource: {
        kind: "youtube",
        videoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    };
    expect(storedProjectUsesYoutubeMedia(meta)).toBe(true);
    expect(storedProjectNeedsArchivedAudioBlob(meta)).toBe(false);
  });
});
