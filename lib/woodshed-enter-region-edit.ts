import { useWoodshedStore } from "@/store/woodshed-store";
import {
  canEnterPracticeEditMode,
  resolvePracticeEditCompatibility,
} from "@/lib/interaction/practice-edit-mode";

/** Mirrors transport “Practice” — no phrase or focus waveform unlock maps armed. */
export function isStructuralPracticeMode(snapshot = useWoodshedStore.getState()): boolean {
  return resolvePracticeEditCompatibility(snapshot).practiceMode;
}

/** Double-click gesture: Practice Section → phrase waveform edit handles (preserve playback clock). */
export function enterPracticeSectionStructuralEdit(loopId: string): void {
  if (
    !canEnterPracticeEditMode({
      formFactor: "desktop",
      intent: "double_click_structural_edit_entry",
    })
  ) {
    return;
  }
  const st = useWoodshedStore.getState();
  if (!st.loops.some((l) => l.id === loopId)) return;
  for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
    st.setFocusRegionWaveformEditUnlocked(sid, false);
  }
  st.selectLoop(loopId);
  st.setActiveSegmentId(null);
  st.setEditableLoopId(loopId);
}

/**
 * Double-click gesture: Focus Loop → focus waveform handles — phrase boundary edit off so handles stay unambiguous.
 * Does **not** auto-expand inspector (avoid layout jump); waveform affordances unlock immediately.
 */
export function enterFocusLoopStructuralEdit(
  phraseId: string,
  segmentId: string,
): void {
  if (
    !canEnterPracticeEditMode({
      formFactor: "desktop",
      intent: "double_click_structural_edit_entry",
    })
  ) {
    return;
  }
  const st = useWoodshedStore.getState();
  const loop = st.loops.find((l) => l.id === phraseId);
  if (!loop?.segments?.some((s) => s.id === segmentId)) return;
  st.setEditableLoopId(null);
  for (const sid of Object.keys(st.focusRegionWaveformEditUnlockedById)) {
    st.setFocusRegionWaveformEditUnlocked(sid, false);
  }
  st.selectSegment(phraseId, segmentId);
  st.setFocusRegionWaveformEditUnlocked(segmentId, true);
}
