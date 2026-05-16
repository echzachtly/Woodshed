import { describe, expect, test } from "vitest";

import {
  canAutoEnterPracticeEditMode,
  canEnterPracticeEditMode,
  hasProjectOrMediaContextSwitch,
  normalizePracticeEditAfterContextSwitch,
  resolvePracticeEditCompatibility,
  resolvePracticeEditExitCleanup,
} from "@/lib/interaction/practice-edit-mode";

describe("practice-edit-mode transitions", () => {
  test("desktop Shift+drag intent may enter Edit Mode", () => {
    expect(
      canEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "shift_drag_create",
      }),
    ).toBe(true);
    expect(
      canAutoEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "shift_drag_create",
      }),
    ).toBe(true);
  });

  test("desktop double-click edit intent may enter Edit Mode", () => {
    expect(
      canEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "double_click_structural_edit_entry",
      }),
    ).toBe(true);
  });

  test("desktop explicit edit action may enter Edit Mode", () => {
    expect(
      canEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "explicit_edit_action",
      }),
    ).toBe(true);
    expect(
      canAutoEnterPracticeEditMode({
        formFactor: "desktop",
        intent: "explicit_edit_action",
      }),
    ).toBe(false);
  });

  test("mobile tap/drag/chip selection does not auto-enter Edit Mode", () => {
    expect(
      canAutoEnterPracticeEditMode({
        formFactor: "mobile",
        intent: "tap_or_drag_navigation",
      }),
    ).toBe(false);
    expect(
      canAutoEnterPracticeEditMode({
        formFactor: "mobile",
        intent: "chip_selection",
      }),
    ).toBe(false);
    expect(
      canEnterPracticeEditMode({
        formFactor: "mobile",
        intent: "tap_or_drag_navigation",
      }),
    ).toBe(false);
  });

  test("mobile explicit edit action may enter Edit Mode", () => {
    expect(
      canEnterPracticeEditMode({
        formFactor: "mobile",
        intent: "explicit_edit_action",
      }),
    ).toBe(true);
  });

  test("explicit exit clears editable/unlocked state", () => {
    expect(resolvePracticeEditExitCleanup("explicit_done_action")).toEqual({
      clearEditableLoopId: true,
      clearPhraseUnlocks: true,
      clearFocusUnlocks: true,
      clearActiveSegmentId: false,
    });
  });

  test("project/media switch defensively exits Edit Mode", () => {
    const switchState = hasProjectOrMediaContextSwitch({
      previousProjectId: "project-a",
      nextProjectId: "project-b",
      previousMediaSource: { kind: "upload", fileName: "a.wav" },
      nextMediaSource: { kind: "upload", fileName: "a.wav" },
    });
    expect(switchState).toEqual({ projectSwitched: true, mediaSwitched: false });
    const normalized = normalizePracticeEditAfterContextSwitch({
      state: {
        editableLoopId: "loop-a",
        activeSegmentId: "seg-a",
        phraseWaveformEditUnlockedById: { "loop-a": true },
        focusRegionWaveformEditUnlockedById: { "seg-a": true },
      },
      projectSwitched: switchState.projectSwitched,
      mediaSwitched: switchState.mediaSwitched,
    });
    expect(normalized).toEqual({
      editableLoopId: null,
      activeSegmentId: null,
      phraseWaveformEditUnlockedById: {},
      focusRegionWaveformEditUnlockedById: {},
    });
  });

  test("lock/unlock compatibility mapping remains stable", () => {
    expect(
      resolvePracticeEditCompatibility({
        editableLoopId: null,
        phraseWaveformEditUnlockedById: {},
        focusRegionWaveformEditUnlockedById: {},
      }),
    ).toMatchObject({
      mode: "practice",
      practiceMode: true,
      editMode: false,
      legacyLockAlias: "locked",
    });
    expect(
      resolvePracticeEditCompatibility({
        editableLoopId: null,
        phraseWaveformEditUnlockedById: { "loop-1": true },
        focusRegionWaveformEditUnlockedById: {},
      }),
    ).toMatchObject({
      mode: "edit",
      practiceMode: false,
      editMode: true,
      legacyLockAlias: "unlocked",
      unlockedPhraseIds: ["loop-1"],
    });
  });
});
