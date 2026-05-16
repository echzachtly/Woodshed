import { describe, expect, test } from "vitest";

import { deriveRegionVisualState, type RegionVisualStateContext } from "@/lib/regions/region-visual-state";

function context(
  partial: Partial<RegionVisualStateContext> = {},
): RegionVisualStateContext {
  return {
    surface: "desktop",
    activeLoopId: null,
    activeSegmentId: null,
    editableLoopId: null,
    loopPlaybackEnabled: false,
    loopPracticeScope: "phrase",
    phraseWaveformEditUnlockedById: {},
    focusRegionWaveformEditUnlockedById: {},
    practiceEditCompatibility: { editMode: false, practiceMode: true },
    ...partial,
  };
}

describe("deriveRegionVisualState", () => {
  test("Practice Section derivation in Practice Mode stays non-editable", () => {
    const state = deriveRegionVisualState({
      context: context({
        activeLoopId: "p1",
      }),
      target: { kind: "phrase", phraseId: "p1", phraseHasFocusRegions: true },
    });
    expect(state.isSectionActive).toBe(true);
    expect(state.isPracticeProtected).toBe(true);
    expect(state.isEditable).toBe(false);
    expect(state.pointerBehaviorTier).toBe("section_select");
  });

  test("Practice Section derivation in Edit Mode becomes editable", () => {
    const state = deriveRegionVisualState({
      context: context({
        activeLoopId: "p1",
        editableLoopId: "p1",
        phraseWaveformEditUnlockedById: { p1: true },
        practiceEditCompatibility: { editMode: true, practiceMode: false },
      }),
      target: { kind: "phrase", phraseId: "p1", phraseHasFocusRegions: false },
    });
    expect(state.isEditing).toBe(true);
    expect(state.isEditable).toBe(true);
    expect(state.zIndexTier).toBe("section_editing_foreground");
  });

  test("Focus Loop derivation foregrounds in focus scope", () => {
    const state = deriveRegionVisualState({
      context: context({
        activeLoopId: "p1",
        activeSegmentId: "s1",
        loopPracticeScope: "practice_region",
        loopPlaybackEnabled: true,
      }),
      target: {
        kind: "focus",
        phraseId: "p1",
        segmentId: "s1",
        phraseHasFocusRegions: true,
      },
    });
    expect(state.isFocusForeground).toBe(true);
    expect(state.isPlaybackEmphasized).toBe(true);
    expect(state.zIndexTier).toBe("focus_active_foreground");
  });

  test("Focus Loop editability requires edit mode and unlock", () => {
    const locked = deriveRegionVisualState({
      context: context({
        activeLoopId: "p1",
        activeSegmentId: "s1",
        practiceEditCompatibility: { editMode: false, practiceMode: true },
      }),
      target: {
        kind: "focus",
        phraseId: "p1",
        segmentId: "s1",
        phraseHasFocusRegions: true,
      },
    });
    expect(locked.isEditable).toBe(false);

    const editable = deriveRegionVisualState({
      context: context({
        activeLoopId: "p1",
        activeSegmentId: "s1",
        practiceEditCompatibility: { editMode: true, practiceMode: false },
        focusRegionWaveformEditUnlockedById: { s1: true },
      }),
      target: {
        kind: "focus",
        phraseId: "p1",
        segmentId: "s1",
        phraseHasFocusRegions: true,
      },
    });
    expect(editable.isEditable).toBe(true);
    expect(editable.pointerBehaviorTier).toBe("focus_handles");
    expect(editable.zIndexTier).toBe("focus_editing_context");
  });

  test("mobile focus derivation remains readonly", () => {
    const state = deriveRegionVisualState({
      context: context({
        surface: "mobile",
        activeLoopId: "p1",
        activeSegmentId: "s1",
        practiceEditCompatibility: { editMode: true, practiceMode: false },
        focusRegionWaveformEditUnlockedById: { s1: true },
      }),
      target: {
        kind: "focus",
        phraseId: "p1",
        segmentId: "s1",
        phraseHasFocusRegions: true,
      },
    });
    expect(state.isMobileReadonly).toBe(true);
    expect(state.isEditable).toBe(false);
    expect(state.pointerBehaviorTier).toBe("readonly_overlay");
  });

  test("deterministic z-tier derivation for inactive entities", () => {
    const phrase = deriveRegionVisualState({
      context: context(),
      target: { kind: "phrase", phraseId: "p1", phraseHasFocusRegions: false },
    });
    const focus = deriveRegionVisualState({
      context: context(),
      target: {
        kind: "focus",
        phraseId: "p1",
        segmentId: "s1",
        phraseHasFocusRegions: false,
      },
    });
    expect(phrase.zIndexTier).toBe("section_inactive_context");
    expect(focus.zIndexTier).toBe("focus_inactive_context");
  });
});

