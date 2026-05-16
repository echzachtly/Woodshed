import { afterEach, describe, expect, it } from "vitest";

import { resolvePracticeEditCompatibility } from "@/lib/interaction/practice-edit-mode";
import {
  enterFocusLoopStructuralEdit,
  exitPracticeEditModeToPractice,
  toggleFocusLoopStructuralEdit,
  togglePracticeSectionStructuralEdit,
} from "@/lib/woodshed-enter-region-edit";
import { useWoodshedStore } from "@/store/woodshed-store";

function compatibility() {
  const st = useWoodshedStore.getState();
  return resolvePracticeEditCompatibility(st);
}

describe("woodshed-enter-region-edit toggles", () => {
  afterEach(() => {
    useWoodshedStore.getState().resetWorkspace();
  });

  it("toggles phrase structural edit mode symmetrically", () => {
    useWoodshedStore.getState().bootstrapFromDuration(120);
    const st = useWoodshedStore.getState();
    const loopId = st.activeLoopId;
    expect(loopId).toBeTruthy();
    if (!loopId) return;

    exitPracticeEditModeToPractice(st);
    expect(compatibility().practiceMode).toBe(true);

    togglePracticeSectionStructuralEdit(loopId);
    const entered = useWoodshedStore.getState();
    expect(resolvePracticeEditCompatibility(entered).editMode).toBe(true);
    expect(entered.editableLoopId).toBe(loopId);
    expect(entered.phraseWaveformEditUnlockedById[loopId]).toBe(true);

    togglePracticeSectionStructuralEdit(loopId);
    const exited = useWoodshedStore.getState();
    expect(resolvePracticeEditCompatibility(exited).practiceMode).toBe(true);
    expect(exited.editableLoopId).toBeNull();
    expect(Object.keys(exited.phraseWaveformEditUnlockedById)).toHaveLength(0);
    expect(Object.keys(exited.focusRegionWaveformEditUnlockedById)).toHaveLength(0);
  });

  it("toggles focus structural edit mode symmetrically", () => {
    useWoodshedStore.getState().bootstrapFromDuration(120);
    const st = useWoodshedStore.getState();
    const loopId = st.activeLoopId;
    expect(loopId).toBeTruthy();
    if (!loopId) return;
    st.addSegment(loopId);
    const segId = useWoodshedStore.getState().loops[0]?.segments?.[0]?.id;
    expect(segId).toBeTruthy();
    if (!segId) return;

    exitPracticeEditModeToPractice(useWoodshedStore.getState());
    expect(compatibility().practiceMode).toBe(true);

    toggleFocusLoopStructuralEdit(loopId, segId);
    const entered = useWoodshedStore.getState();
    expect(resolvePracticeEditCompatibility(entered).editMode).toBe(true);
    expect(entered.focusRegionWaveformEditUnlockedById[segId]).toBe(true);
    expect(entered.activeSegmentId).toBe(segId);

    toggleFocusLoopStructuralEdit(loopId, segId);
    const exited = useWoodshedStore.getState();
    expect(resolvePracticeEditCompatibility(exited).practiceMode).toBe(true);
    expect(Object.keys(exited.focusRegionWaveformEditUnlockedById)).toHaveLength(0);
    expect(Object.keys(exited.phraseWaveformEditUnlockedById)).toHaveLength(0);
  });

  it("keeps practice mode unchanged on invalid focus target", () => {
    useWoodshedStore.getState().bootstrapFromDuration(120);
    const st = useWoodshedStore.getState();
    const loopId = st.activeLoopId;
    expect(loopId).toBeTruthy();
    if (!loopId) return;
    exitPracticeEditModeToPractice(st);
    const before = useWoodshedStore.getState();
    const entered = enterFocusLoopStructuralEdit(loopId, "missing-segment");
    const after = useWoodshedStore.getState();

    expect(entered).toBe(false);
    expect(resolvePracticeEditCompatibility(after).practiceMode).toBe(true);
    expect(after.editableLoopId).toBe(before.editableLoopId);
  });
});

