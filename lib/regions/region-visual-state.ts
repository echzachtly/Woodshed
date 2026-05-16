import type { PracticeEditCompatibility } from "@/lib/interaction/practice-edit-mode";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type RegionRenderSurface = "desktop" | "mobile";

export type RegionVisualTarget =
  | { kind: "phrase"; phraseId: string; phraseHasFocusRegions: boolean }
  | {
      kind: "focus";
      phraseId: string;
      segmentId: string;
      phraseHasFocusRegions: boolean;
    };

export type RegionVisualStateContext = {
  surface: RegionRenderSurface;
  activeLoopId: string | null;
  activeSegmentId: string | null;
  editableLoopId: string | null;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  phraseWaveformEditUnlockedById: Record<string, true>;
  focusRegionWaveformEditUnlockedById: Record<string, true>;
  practiceEditCompatibility: Pick<
    PracticeEditCompatibility,
    "editMode" | "practiceMode"
  >;
};

export type RegionZIndexTier =
  | "section_inactive_context"
  | "section_active_context"
  | "section_active_foreground"
  | "section_editing_context"
  | "section_editing_foreground"
  | "focus_inactive_context"
  | "focus_active_context"
  | "focus_inactive_foreground"
  | "focus_active_foreground"
  | "focus_editing_context"
  | "focus_editing_foreground";

export type RegionPointerBehaviorTier =
  | "passive"
  | "section_select"
  | "section_handles"
  | "focus_select"
  | "focus_handles"
  | "readonly_overlay";

export type RegionVisualState = {
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isEditable: boolean;
  isPlaybackEmphasized: boolean;
  isPracticeProtected: boolean;
  isFocusForeground: boolean;
  isDimmed: boolean;
  isMobileReadonly: boolean;
  isFocusActive: boolean;
  isSectionActive: boolean;
  zIndexTier: RegionZIndexTier;
  pointerBehaviorTier: RegionPointerBehaviorTier;
};

function focusForeground(args: {
  phraseHasFocusRegions: boolean;
  loopPracticeScope: LoopPracticeScope;
}): boolean {
  return args.phraseHasFocusRegions && args.loopPracticeScope === "practice_region";
}

export function deriveRegionVisualState(args: {
  context: RegionVisualStateContext;
  target: RegionVisualTarget;
}): RegionVisualState {
  const { context, target } = args;
  const sectionActive = context.activeLoopId === target.phraseId;
  const fgFocus = focusForeground({
    phraseHasFocusRegions: target.phraseHasFocusRegions,
    loopPracticeScope: context.loopPracticeScope,
  });
  const practiceProtected = context.practiceEditCompatibility.practiceMode;

  if (target.kind === "phrase") {
    const unlocked = Boolean(
      context.phraseWaveformEditUnlockedById[target.phraseId],
    );
    const phraseEditing = Boolean(
      context.editableLoopId === target.phraseId || unlocked,
    );
    const isEditable = !practiceProtected && phraseEditing;
    const isPlaybackEmphasized = sectionActive && !fgFocus;
    const zIndexTier: RegionZIndexTier = phraseEditing
      ? fgFocus
        ? "section_editing_context"
        : "section_editing_foreground"
      : sectionActive
        ? fgFocus
          ? "section_active_context"
          : "section_active_foreground"
        : "section_inactive_context";
    return {
      isActive: sectionActive,
      isSelected: sectionActive,
      isEditing: phraseEditing,
      isEditable,
      isPlaybackEmphasized,
      isPracticeProtected: practiceProtected,
      isFocusForeground: fgFocus,
      isDimmed: !sectionActive || fgFocus,
      isMobileReadonly: false,
      isFocusActive: false,
      isSectionActive: sectionActive,
      zIndexTier,
      pointerBehaviorTier: isEditable ? "section_handles" : "section_select",
    };
  }

  const focusActive = sectionActive && context.activeSegmentId === target.segmentId;
  const focusUnlocked = Boolean(
    context.focusRegionWaveformEditUnlockedById[target.segmentId],
  );
  const isMobileReadonly = context.surface === "mobile";
  const isEditable =
    !practiceProtected && !isMobileReadonly && focusActive && focusUnlocked;
  const isEditing = !practiceProtected && focusUnlocked;
  const isPlaybackEmphasized =
    context.loopPlaybackEnabled && focusActive && fgFocus;
  const zIndexTier: RegionZIndexTier = isEditing
    ? fgFocus
      ? "focus_editing_foreground"
      : "focus_editing_context"
    : focusActive
      ? fgFocus
        ? "focus_active_foreground"
        : "focus_active_context"
      : fgFocus
        ? "focus_inactive_foreground"
        : "focus_inactive_context";
  const pointerBehaviorTier: RegionPointerBehaviorTier = isMobileReadonly
    ? "readonly_overlay"
    : isEditable
      ? "focus_handles"
      : "focus_select";
  return {
    isActive: focusActive,
    isSelected: focusActive,
    isEditing,
    isEditable,
    isPlaybackEmphasized,
    isPracticeProtected: practiceProtected,
    isFocusForeground: fgFocus,
    isDimmed: !focusActive,
    isMobileReadonly,
    isFocusActive: focusActive,
    isSectionActive: sectionActive,
    zIndexTier,
    pointerBehaviorTier,
  };
}

