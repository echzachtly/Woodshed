import { describe, expect, test } from "vitest";

import { loopFromBounds } from "@/lib/loop-engine";
import type { StoredProjectMeta } from "@/lib/project-db";
import {
  captureYoutubeDexieProjectPayload,
  hydrateYoutubeDexieIntoStore,
  inferYoutubeTimelineDurationSec,
  validateYoutubeDexieProjectMeta,
} from "@/lib/youtube/youtube-dexie-project";
import { useWoodshedStore } from "@/store/woodshed-store";

describe("validateYoutubeDexieProjectMeta", () => {
  test("accepts valid YouTube discriminator rows", () => {
    const loop = loopFromBounds(1, 9, 120, "A");
    const meta: StoredProjectMeta = {
      id: "yt-1",
      name: "Demo YT",
      updatedAt: 1,
      loops: [loop],
      activeLoopId: loop.id,
      mediaSource: {
        kind: "youtube",
        videoId: "jNQXAC9IVRw",
        canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        durationSeconds: 200,
      },
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
        activeSegmentId: null,
        lastPracticeSegmentIdByPhrase: {},
      },
      minPxPerSecPersist: 72,
    };
    const v = validateYoutubeDexieProjectMeta(meta);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.meta.mediaSource.videoId).toBe("jNQXAC9IVRw");
      expect(v.meta.mediaSource.durationSeconds).toBe(200);
    }
  });

  test("rejects legacy upload-shaped rows", () => {
    const meta: StoredProjectMeta = {
      id: "up-1",
      name: "Upload",
      updatedAt: 1,
      loops: [],
      activeLoopId: null,
      blobId: "blob-a",
    };
    expect(validateYoutubeDexieProjectMeta(meta).ok).toBe(false);
  });

  test("rejects malformed youtube metadata", () => {
    const meta: StoredProjectMeta = {
      id: "bad-yt",
      name: "Bad",
      updatedAt: 1,
      loops: [],
      activeLoopId: null,
      mediaSource: {
        kind: "youtube",
        videoId: "",
        canonicalUrl: "",
      },
    };
    expect(validateYoutubeDexieProjectMeta(meta).ok).toBe(false);
  });

  test("recovers mixed blobId + youtube discriminator by clearing blob FK", () => {
    const meta: StoredProjectMeta = {
      id: "mixed",
      name: "Mixed",
      updatedAt: 1,
      loops: [],
      activeLoopId: null,
      blobId: "oops",
      mediaSource: {
        kind: "youtube",
        videoId: "jNQXAC9IVRw",
        canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
      },
    };
    const v = validateYoutubeDexieProjectMeta(meta);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.meta.blobId).toBeUndefined();
      expect(v.meta.mediaSource.videoId).toBe("jNQXAC9IVRw");
    }
  });
});

describe("inferYoutubeTimelineDurationSec", () => {
  test("uses max of saved hint and phrase extents", () => {
    const loop = loopFromBounds(0, 10, 500, "Long");
    const meta: StoredProjectMeta = {
      id: "x",
      name: "x",
      updatedAt: 2,
      loops: [loop],
      activeLoopId: loop.id,
      mediaSource: {
        kind: "youtube",
        videoId: "abc",
        canonicalUrl: "https://youtu.be/abc",
        durationSeconds: 30,
      },
    };
    expect(inferYoutubeTimelineDurationSec(meta)).toBeGreaterThanOrEqual(30);
    expect(inferYoutubeTimelineDurationSec(meta)).toBeGreaterThanOrEqual(loop.end);
  });
});

describe("captureYoutubeDexieProjectPayload", () => {
  test("writes youtube discriminator without blob audio FK", () => {
    const loop = loopFromBounds(2, 8, 90, "Intro");
    const payload = captureYoutubeDexieProjectPayload({
      projectId: null,
      projectName: "Session",
      mediaSource: {
        kind: "youtube",
        videoId: "abc",
        canonicalUrl: "https://youtu.be/abc",
        durationSeconds: null,
      },
      loops: [loop],
      activeLoopId: loop.id,
      durationSeconds: 88,
      minPxPerSec: 55,
      loopPlaybackEnabled: false,
      loopPracticeScope: "phrase",
      activeSegmentId: null,
      lastPracticeSegmentIdByPhrase: {},
    });
    expect(payload.mediaSource?.kind).toBe("youtube");
    if (payload.mediaSource?.kind !== "youtube") {
      throw new Error("expected youtube mediaSource");
    }
    expect((payload as { blobId?: string }).blobId).toBeUndefined();
    expect(payload.practiceStateV1?.v).toBe(1);
    expect(payload.minPxPerSecPersist).toBe(55);
    expect(payload.mediaSource.durationSeconds).toBe(88);
    expect(payload.id.length).toBeGreaterThan(4);
  });
});

describe("hydrateYoutubeDexieIntoStore", () => {
  test("reloads loops, youtube mediaSource, and practice prefs", () => {
    useWoodshedStore.getState().resetWorkspace();
    const loop = loopFromBounds(3, 12, 180, "Section");
    const meta: StoredProjectMeta = {
      id: "reload-yt",
      name: "Reload me",
      updatedAt: 1,
      loops: [loop],
      activeLoopId: loop.id,
      mediaSource: {
        kind: "youtube",
        videoId: "jNQXAC9IVRw",
        canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        durationSeconds: 190,
      },
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
        activeSegmentId: null,
        lastPracticeSegmentIdByPhrase: {},
      },
      minPxPerSecPersist: 61,
    };
    const v = validateYoutubeDexieProjectMeta(meta);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    hydrateYoutubeDexieIntoStore(v.meta);
    const st = useWoodshedStore.getState();
    expect(st.mediaSource.kind).toBe("youtube");
    expect(st.projectId).toBe("reload-yt");
    expect(st.loops.length).toBe(1);
    expect(st.activeLoopId).toBe(loop.id);
    expect(st.loopPlaybackEnabled).toBe(true);
    expect(st.minPxPerSec).toBe(61);
  });

  test("preserves valid same-project focus context when practiceState is missing", () => {
    useWoodshedStore.getState().resetWorkspace();
    const loop = loopFromBounds(2, 12, 180, "Section");
    const focus = {
      id: "focus-1",
      phraseId: loop.id,
      name: "Focus",
      startTime: 4,
      endTime: 6,
      notes: "",
      createdAt: 0,
      updatedAt: 0,
    };
    const base: StoredProjectMeta = {
      id: "same-yt",
      name: "Same YT",
      updatedAt: 1,
      loops: [{ ...loop, segments: [focus] }],
      activeLoopId: loop.id,
      mediaSource: {
        kind: "youtube",
        videoId: "jNQXAC9IVRw",
        canonicalUrl: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
        durationSeconds: 190,
      },
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: focus.id,
        lastPracticeSegmentIdByPhrase: { [loop.id]: focus.id },
      },
      minPxPerSecPersist: 61,
    };
    const first = validateYoutubeDexieProjectMeta(base);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    hydrateYoutubeDexieIntoStore(first.meta);

    // Simulate active in-session selection before a same-project reload.
    useWoodshedStore.getState().selectSegment(loop.id, focus.id);
    useWoodshedStore.getState().setLoopPracticeScope("practice_region");

    const sameWithoutPractice: StoredProjectMeta = {
      ...base,
      practiceStateV1: undefined,
    };
    const second = validateYoutubeDexieProjectMeta(sameWithoutPractice);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    hydrateYoutubeDexieIntoStore(second.meta);

    const st = useWoodshedStore.getState();
    expect(st.activeLoopId).toBe(loop.id);
    expect(st.activeSegmentId).toBe(focus.id);
    expect(st.loopPracticeScope).toBe("practice_region");
  });
});
