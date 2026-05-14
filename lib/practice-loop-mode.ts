import type { LoopPracticeScope } from "@/store/woodshed-store";

export type LoopModeDisplay = "Focus Loop" | "Loop Phrase" | "Play Through";

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
  return "Loop Phrase";
}

export function getNextLoopModeDisplay(
  loopPlaybackEnabled: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): LoopModeDisplay {
  if (!phraseHasFocusRegions) {
    return loopPlaybackEnabled ? "Play Through" : "Loop Phrase";
  }
  if (!loopPlaybackEnabled) return "Loop Phrase";
  if (loopPracticeScope === "phrase") return "Focus Loop";
  return "Play Through";
}

/** Short copy for tooltips / aria (current mode). */
export function getLoopModeDescription(mode: LoopModeDisplay): string {
  switch (mode) {
    case "Loop Phrase":
      return "Loop current phrase";
    case "Focus Loop":
      return "Loop active focus region";
    case "Play Through":
      return "Play through song";
    default:
      return mode;
  }
}
