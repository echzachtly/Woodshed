import { describe, expect, test } from "vitest";

import { loopFromBounds, phraseSegmentFromBounds } from "@/lib/loop-engine";
import { activateHydratedProjectState } from "@/lib/persistence/activate-hydrated-project-state";
import { useWoodshedStore } from "@/store/woodshed-store";

describe("activateHydratedProjectState", () => {
  test("normalizes stale persisted focus ids to deterministic phrase scope fallback", () => {
    useWoodshedStore.getState().resetWorkspace();
    const phrase = loopFromBounds(2, 12, 90, "Phrase");
    activateHydratedProjectState({
      projectId: "p-hydrate",
      projectName: "Hydrate",
      mediaSource: {
        kind: "upload",
        blobId: "blob-a",
        fileName: "a.mp3",
        mimeType: "audio/mpeg",
      },
      loops: [{ ...phrase }],
      activeLoopId: phrase.id,
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: "missing-focus",
        lastPracticeSegmentIdByPhrase: {},
      },
      durationSeconds: 90,
    });
    const st = useWoodshedStore.getState();
    expect(st.activeLoopId).toBe(phrase.id);
    expect(st.activeSegmentId).toBeNull();
    expect(st.loopPracticeScope).toBe("phrase");
  });

  test("preserves valid in-session context on same project/media reload when prefs are absent", () => {
    useWoodshedStore.getState().resetWorkspace();
    const phrase = loopFromBounds(1, 9, 80, "Phrase");
    const focus = phraseSegmentFromBounds(phrase.id, 3, 5, "Focus");
    activateHydratedProjectState({
      projectId: "same-project",
      projectName: "Same Project",
      mediaSource: {
        kind: "upload",
        blobId: "blob-same",
        fileName: "same.mp3",
        mimeType: "audio/mpeg",
      },
      loops: [{ ...phrase, segments: [focus] }],
      activeLoopId: phrase.id,
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: focus.id,
        lastPracticeSegmentIdByPhrase: { [phrase.id]: focus.id },
      },
      durationSeconds: 80,
    });
    const st = useWoodshedStore.getState();
    st.selectSegment(phrase.id, focus.id);
    st.setLoopPracticeScope("practice_region");

    // Reload same project without persisted practice prefs; preserve valid context.
    activateHydratedProjectState({
      projectId: "same-project",
      projectName: "Same Project",
      mediaSource: {
        kind: "upload",
        blobId: "blob-same",
        fileName: "same.mp3",
        mimeType: "audio/mpeg",
      },
      loops: [{ ...phrase, segments: [focus] }],
      activeLoopId: null,
      practiceStateV1: null,
      durationSeconds: 80,
    });
    const next = useWoodshedStore.getState();
    expect(next.activeLoopId).toBe(phrase.id);
    expect(next.activeSegmentId).toBe(focus.id);
    expect(next.loopPracticeScope).toBe("practice_region");
  });

  test("clears edit leakage on cross-project switch", () => {
    useWoodshedStore.getState().resetWorkspace();
    const a = loopFromBounds(0, 10, 120, "A");
    const focusA = phraseSegmentFromBounds(a.id, 2, 4, "A-Focus");
    activateHydratedProjectState({
      projectId: "proj-a",
      projectName: "A",
      mediaSource: {
        kind: "upload",
        blobId: "blob-a",
        fileName: "a.mp3",
        mimeType: "audio/mpeg",
      },
      loops: [{ ...a, segments: [focusA] }],
      activeLoopId: a.id,
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        activeSegmentId: focusA.id,
        lastPracticeSegmentIdByPhrase: { [a.id]: focusA.id },
      },
      durationSeconds: 120,
    });
    const st = useWoodshedStore.getState();
    st.setEditableLoopId(a.id);
    st.setPhraseWaveformEditUnlocked(a.id, true);
    st.setFocusRegionWaveformEditUnlocked(focusA.id, true);

    const b = loopFromBounds(20, 40, 120, "B");
    activateHydratedProjectState({
      projectId: "proj-b",
      projectName: "B",
      mediaSource: {
        kind: "upload",
        blobId: "blob-b",
        fileName: "b.mp3",
        mimeType: "audio/mpeg",
      },
      loops: [{ ...b }],
      activeLoopId: b.id,
      practiceStateV1: {
        v: 1,
        loopPlaybackEnabled: true,
        loopPracticeScope: "phrase",
        activeSegmentId: null,
        lastPracticeSegmentIdByPhrase: {},
      },
      durationSeconds: 120,
    });

    const next = useWoodshedStore.getState();
    expect(next.projectId).toBe("proj-b");
    expect(next.editableLoopId).toBeNull();
    expect(next.phraseWaveformEditUnlockedById).toEqual({});
    expect(next.focusRegionWaveformEditUnlockedById).toEqual({});
    expect(next.activeSegmentId).toBeNull();
    expect(next.activeLoopId).toBe(b.id);
  });
});
