import type { PracticeLoop } from "@/lib/loop-engine";

export function totalFocusSegmentCount(loops: PracticeLoop[]): number {
  let n = 0;
  for (const l of loops) {
    n += l.segments?.length ?? 0;
  }
  return n;
}

/** At least one Practice Section with usable span (`PracticeLoop`). */
export function hasUsablePracticeSection(loops: PracticeLoop[]): boolean {
  return loops.some((l) => l.end > l.start);
}

/**
 * Phase 3 desktop “D1”: subtle Shift+drag guidance on the waveform.
 * Not shown once desktop onboarding completed or Focus Loops already exist on the graph.
 */
export function desktopShowShiftFocusCreationGuidance(args: {
  focusLoopAuthoringComplete: boolean;
  durationSec: number;
  loops: PracticeLoop[];
}): boolean {
  if (args.focusLoopAuthoringComplete) return false;
  if (!(args.durationSec > 0)) return false;
  if (!hasUsablePracticeSection(args.loops)) return false;
  return totalFocusSegmentCount(args.loops) === 0;
}
