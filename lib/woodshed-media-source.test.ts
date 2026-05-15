import { describe, expect, test } from "vitest";

import {
  DEFAULT_UPLOAD_MEDIA_SOURCE,
  normalizeMediaSourceFromStoredProject,
  persistMediaSourceForDexieRow,
  type WoodshedMediaSource,
} from "@/lib/woodshed-media-source";

describe("normalizeMediaSourceFromStoredProject", () => {
  test("legacy row without mediaSource → upload + blobId from row", () => {
    expect(
      normalizeMediaSourceFromStoredProject({ blobId: "abc" }),
    ).toEqual({
      kind: "upload",
      blobId: "abc",
      fileName: null,
      mimeType: null,
    });
  });

  test("legacy row missing blobId → upload + null blobId", () => {
    expect(normalizeMediaSourceFromStoredProject({})).toEqual({
      kind: "upload",
      blobId: null,
      fileName: null,
      mimeType: null,
    });
  });

  test("explicit upload mediaSource merges blobId fallback", () => {
    expect(
      normalizeMediaSourceFromStoredProject({
        blobId: "row-blob",
        mediaSource: {
          kind: "upload",
          fileName: "x.wav",
          mimeType: "audio/wav",
        },
      }),
    ).toEqual({
      kind: "upload",
      blobId: "row-blob",
      fileName: "x.wav",
      mimeType: "audio/wav",
    });
  });

  test("malformed youtube → upload fallback", () => {
    expect(
      normalizeMediaSourceFromStoredProject({
        blobId: null,
        mediaSource: {
          kind: "youtube",
          videoId: "",
          canonicalUrl: "",
        } as WoodshedMediaSource,
      }),
    ).toEqual({
      kind: "upload",
      blobId: null,
      fileName: null,
      mimeType: null,
    });
  });

  test("valid youtube preserved", () => {
    expect(
      normalizeMediaSourceFromStoredProject({
        mediaSource: {
          kind: "youtube",
          videoId: "dQw4w9WgXcQ",
          canonicalUrl: "https://youtu.be/dQw4w9WgXcQ",
          title: "Example",
          durationSeconds: 212,
        },
      }),
    ).toEqual({
      kind: "youtube",
      videoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://youtu.be/dQw4w9WgXcQ",
      title: "Example",
      durationSeconds: 212,
    });
  });
});

describe("persistMediaSourceForDexieRow", () => {
  test("upload merges resolved blob id", () => {
    expect(
      persistMediaSourceForDexieRow({
        source: {
          kind: "upload",
          fileName: "a.mp3",
          mimeType: "audio/mpeg",
        },
        resolvedBlobId: "pid-1",
      }),
    ).toEqual({
      kind: "upload",
      blobId: "pid-1",
      fileName: "a.mp3",
      mimeType: "audio/mpeg",
    });
  });

  test("upload-only default constant shape", () => {
    expect(DEFAULT_UPLOAD_MEDIA_SOURCE.kind).toBe("upload");
  });
});
