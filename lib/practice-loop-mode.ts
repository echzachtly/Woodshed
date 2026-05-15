import type { LoopPracticeScope } from "@/store/woodshed-store";

export type LoopModeDisplay = "Focus Loop" | "Loop Section" | "Play Through";

export function getLoopModeDisplay(
  loopPlaybackEnabled: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): LoopModeDisplay {
  if (!loopPlaybackEnabled) return "Play Through";
  if (
    phraseHasFocusRegions &&
    loopPracticeScope === "practice_region"
  ) {
    return "Focus Loop";
  }
  return "Loop Section";
}

export function getNextLoopModeDisplay(
  loopPlaybackEnabled: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): LoopModeDisplay {
  if (!phraseHasFocusRegions) {
    return loopPlaybackEnabled ? "Play Through" : "Loop Section";
  }
  if (!loopPlaybackEnabled) return "Loop Section";
  if (loopPracticeScope === "phrase") return "Focus Loop";
  return "Play Through";
}

/** Short copy for tooltips / aria (current mode). */
export function getLoopModeDescription(mode: LoopModeDisplay): string {
  switch (mode) {
    case "Loop Section":
      return "Loop current Practice Section";
    case "Focus Loop":
      return "Loop active Focus Loop";
    case "Play Through":
      return "Play through song";
    default:
      return mode;
  }
}

/** Accessible descriptions for mobile tooltips / aria. */
export function describeLoopModeForMobile(mode: LoopModeDisplay): string {
  switch (mode) {
    case "Loop Section":
      return "Repeat playback within the current Practice Section";
    case "Focus Loop":
      return "Repeat playback within the selected Focus Loop";
    case "Play Through":
      return "Play through without looping a span";
    default:
      return getLoopModeDescription(mode);
  }
}
