import { describe, expect, it } from "vitest";

import { normalizePracticeStatePersistV1 } from "@/lib/practice-state-persist";
import type { PracticeLoop } from "@/lib/loop-engine";

const phrase: PracticeLoop = {
  id: "p1",
  name: "A",
  start: 1,
  end: 10,
  tempo: 1,
  segments: [
    {
      id: "s1",
      phraseId: "p1",
      name: "F1",
      startTime: 2,
      endTime: 5,
      notes: "",
      createdAt: 0,
      updatedAt: 0,
    },
  ],
};

describe("normalizePracticeStatePersistV1", () => {
  it("returns null for non-v1 payloads", () => {
    expect(normalizePracticeStatePersistV1({ v: 2 }, [phrase], "p1")).toBeNull();
    expect(normalizePracticeStatePersistV1(null, [phrase], "p1")).toBeNull();
  });

  it("coerces practice_region to phrase when phrase has no segments", () => {
    const plain: PracticeLoop = {
      id: "p2",
      name: "B",
      start: 0,
      end: 8,
      tempo: 1,
    };
    const out = normalizePracticeStatePersistV1(
      {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: "s1",
        lastPracticeSegmentIdByPhrase: {},
      },
      [plain],
      "p2",
    );
    expect(out).not.toBeNull();
    expect(out!.loopPracticeScope).toBe("phrase");
    expect(out!.activeSegmentId).toBeNull();
  });

  it("drops stale segment ids for the active phrase", () => {
    const out = normalizePracticeStatePersistV1(
      {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: "missing",
        lastPracticeSegmentIdByPhrase: { p1: "s1" },
      },
      [phrase],
      "p1",
    );
    expect(out!.activeSegmentId).toBeNull();
    expect(out!.loopPracticeScope).toBe("phrase");
  });

  it("keeps valid focus selection", () => {
    const out = normalizePracticeStatePersistV1(
      {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: "s1",
        lastPracticeSegmentIdByPhrase: { p1: "s1" },
      },
      [phrase],
      "p1",
    );
    expect(out!.activeSegmentId).toBe("s1");
    expect(out!.loopPracticeScope).toBe("practice_region");
  });
});
