import { useWoodshedStore } from "@/store/woodshed-store";
import {
  canEnterPracticeEditMode,
  resolvePracticeEditCompatibility,
  resolvePracticeEditExitCleanup,
} from "@/lib/interaction/practice-edit-mode";

/** Mirrors transport “Practice” — no phrase or focus waveform unlock maps armed. */
export function isStructuralPracticeMode(snapshot = useWoodshedStore.getState()): boolean {
  return resolvePracticeEditCompatibility(snapshot).practiceMode;
}

/** Leave Edit Mode and return to structural Practice Mode. */
export function exitPracticeEditModeToPractice(
  snapshot = useWoodshedStore.getState(),
): void {
  const cleanup = resolvePracticeEditExitCleanup("explicit_done_action");
  if (cleanup.clearEditableLoopId) {
    snapshot.setEditableLoopId(null);
  }
  if (cleanup.clearFocusUnlocks) {
    for (const sid of Object.keys(snapshot.focusRegionWaveformEditUnlockedById)) {
      snapshot.setFocusRegionWaveformEditUnlocked(sid, false);
    }
  }
  if (cleanup.clearPhraseUnlocks) {
    for (const loopId of Object.keys(snapshot.phraseWaveformEditUnlockedById)) {
      snapshot.setPhraseWaveformEditUnlocked(loopId, false);
    }
  }
}

/** Double-click gesture: Practice Section → phrase waveform edit handles (preserve playback clock). */
export function enterPracticeSectionStructuralEdit(loopId: string): boolean {
  if (
    !canEnterPracticeEditMode({
      formFactor: "desktop",
      intent: "double_click_structural_edit_entry",
    })
  ) {
    return false;
  }
  const st = useWoodshedStore.getState();
  if (!st.loops.some((l) => l.id === loopId)) return false;
  for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
    st.setFocusRegionWaveformEditUnlocked(sid, false);
  }
  st.selectLoop(loopId);
  st.setActiveSegmentId(null);
  st.setEditableLoopId(loopId);
  return true;
}

/**
 * Double-click gesture: Focus Loop → focus waveform handles — phrase boundary edit off so handles stay unambiguous.
 * Does **not** auto-expand inspector (avoid layout jump); waveform affordances unlock immediately.
 */
export function enterFocusLoopStructuralEdit(
  phraseId: string,
  segmentId: string,
): boolean {
  if (
    !canEnterPracticeEditMode({
      formFactor: "desktop",
      intent: "double_click_structural_edit_entry",
    })
  ) {
    return false;
  }
  const st = useWoodshedStore.getState();
  const loop = st.loops.find((l) => l.id === phraseId);
  if (!loop?.segments?.some((s) => s.id === segmentId)) return false;
  st.setEditableLoopId(null);
  for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
    st.setFocusRegionWaveformEditUnlocked(sid, false);
  }
  st.selectSegment(phraseId, segmentId);
  st.setFocusRegionWaveformEditUnlocked(segmentId, true);
  return true;
}

/** Double-click target parity: toggles Practice <-> Edit for phrase context. */
export function togglePracticeSectionStructuralEdit(loopId: string): void {
  const st = useWoodshedStore.getState();
  const compatibility = resolvePracticeEditCompatibility(st);
  if (compatibility.editMode) {
    exitPracticeEditModeToPractice(st);
    return;
  }
  enterPracticeSectionStructuralEdit(loopId);
}

/** Double-click target parity: toggles Practice <-> Edit for focus context. */
export function toggleFocusLoopStructuralEdit(
  phraseId: string,
  segmentId: string,
): void {
  const st = useWoodshedStore.getState();
  const compatibility = resolvePracticeEditCompatibility(st);
  if (compatibility.editMode) {
    exitPracticeEditModeToPractice(st);
    return;
  }
  enterFocusLoopStructuralEdit(phraseId, segmentId);
}
