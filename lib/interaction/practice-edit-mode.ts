import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";

export type PracticeEditFormFactor = "desktop" | "mobile";

export type PracticeEditEnterIntent =
  | "shift_drag_create"
  | "resize_trim_handle"
  | "double_click_structural_edit_entry"
  | "explicit_create_action"
  | "explicit_edit_action"
  | "tap_or_drag_navigation"
  | "chip_selection";

export type PracticeEditExitIntent =
  | "explicit_done_action"
  | "project_switch"
  | "media_switch";

export type PracticeEditMode = "practice" | "edit";

type LegacyEditAliasSnapshot = {
  editableLoopId: string | null;
  phraseWaveformEditUnlockedById: Record<string, true>;
  focusRegionWaveformEditUnlockedById: Record<string, true>;
};

export type PracticeEditCompatibility = {
  mode: PracticeEditMode;
  practiceMode: boolean;
  editMode: boolean;
  legacyLockAlias: "locked" | "unlocked";
  editableLoopId: string | null;
  unlockedPhraseIds: string[];
  unlockedFocusIds: string[];
};

export type PracticeEditExitCleanup = {
  clearEditableLoopId: boolean;
  clearPhraseUnlocks: boolean;
  clearFocusUnlocks: boolean;
  clearActiveSegmentId: boolean;
};

export type PracticeEditContextSnapshot = LegacyEditAliasSnapshot & {
  activeSegmentId: string | null;
};

const DESKTOP_AUTO_ENTRY_INTENTS: ReadonlySet<PracticeEditEnterIntent> = new Set([
  "shift_drag_create",
  "resize_trim_handle",
  "double_click_structural_edit_entry",
]);

const EXPLICIT_ENTRY_INTENTS: ReadonlySet<PracticeEditEnterIntent> = new Set([
  "explicit_create_action",
  "explicit_edit_action",
]);

function stableTruthyKeys(map: Record<string, true>): string[] {
  return Object.keys(map).sort((a, b) => a.localeCompare(b));
}

function mediaSourceSignature(source: WoodshedMediaSource): string {
  if (source.kind === "youtube") {
    return `youtube:${source.videoId}:${source.canonicalUrl}`;
  }
  return `upload:${source.fileName ?? ""}:${source.mimeType ?? ""}:${source.blobId ?? ""}`;
}

export function resolvePracticeEditCompatibility(
  snapshot: LegacyEditAliasSnapshot,
): PracticeEditCompatibility {
  const unlockedPhraseIds = stableTruthyKeys(snapshot.phraseWaveformEditUnlockedById);
  const unlockedFocusIds = stableTruthyKeys(
    snapshot.focusRegionWaveformEditUnlockedById,
  );
  const editMode =
    snapshot.editableLoopId != null ||
    unlockedPhraseIds.length > 0 ||
    unlockedFocusIds.length > 0;
  return {
    mode: editMode ? "edit" : "practice",
    practiceMode: !editMode,
    editMode,
    legacyLockAlias: editMode ? "unlocked" : "locked",
    editableLoopId: snapshot.editableLoopId,
    unlockedPhraseIds,
    unlockedFocusIds,
  };
}

export function canEnterPracticeEditMode(args: {
  formFactor: PracticeEditFormFactor;
  intent: PracticeEditEnterIntent;
}): boolean {
  if (EXPLICIT_ENTRY_INTENTS.has(args.intent)) return true;
  if (args.formFactor === "desktop") {
    return DESKTOP_AUTO_ENTRY_INTENTS.has(args.intent);
  }
  return false;
}

export function canAutoEnterPracticeEditMode(args: {
  formFactor: PracticeEditFormFactor;
  intent: PracticeEditEnterIntent;
}): boolean {
  if (EXPLICIT_ENTRY_INTENTS.has(args.intent)) return false;
  return canEnterPracticeEditMode(args);
}

export function resolvePracticeEditExitCleanup(
  intent: PracticeEditExitIntent,
): PracticeEditExitCleanup {
  if (intent === "explicit_done_action") {
    return {
      clearEditableLoopId: true,
      clearPhraseUnlocks: true,
      clearFocusUnlocks: true,
      clearActiveSegmentId: false,
    };
  }
  return {
    clearEditableLoopId: true,
    clearPhraseUnlocks: true,
    clearFocusUnlocks: true,
    clearActiveSegmentId: true,
  };
}

export function hasProjectOrMediaContextSwitch(args: {
  previousProjectId: string | null;
  nextProjectId: string | null;
  previousMediaSource: WoodshedMediaSource;
  nextMediaSource: WoodshedMediaSource;
}): { projectSwitched: boolean; mediaSwitched: boolean } {
  const projectSwitched = args.previousProjectId !== args.nextProjectId;
  const mediaSwitched =
    mediaSourceSignature(args.previousMediaSource) !==
    mediaSourceSignature(args.nextMediaSource);
  return { projectSwitched, mediaSwitched };
}

export function normalizePracticeEditAfterContextSwitch(args: {
  state: PracticeEditContextSnapshot;
  projectSwitched: boolean;
  mediaSwitched: boolean;
}): Pick<
  PracticeEditContextSnapshot,
  | "editableLoopId"
  | "activeSegmentId"
  | "phraseWaveformEditUnlockedById"
  | "focusRegionWaveformEditUnlockedById"
> {
  if (!args.projectSwitched && !args.mediaSwitched) {
    return {
      editableLoopId: args.state.editableLoopId,
      activeSegmentId: args.state.activeSegmentId,
      phraseWaveformEditUnlockedById: args.state.phraseWaveformEditUnlockedById,
      focusRegionWaveformEditUnlockedById:
        args.state.focusRegionWaveformEditUnlockedById,
    };
  }
  const cleanup = resolvePracticeEditExitCleanup(
    args.mediaSwitched ? "media_switch" : "project_switch",
  );
  return {
    editableLoopId: cleanup.clearEditableLoopId
      ? null
      : args.state.editableLoopId,
    activeSegmentId: cleanup.clearActiveSegmentId ? null : args.state.activeSegmentId,
    phraseWaveformEditUnlockedById: cleanup.clearPhraseUnlocks
      ? {}
      : args.state.phraseWaveformEditUnlockedById,
    focusRegionWaveformEditUnlockedById: cleanup.clearFocusUnlocks
      ? {}
      : args.state.focusRegionWaveformEditUnlockedById,
  };
}
