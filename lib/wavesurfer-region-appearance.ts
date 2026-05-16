/**
 * WaveSurfer 7 mounts region roots inside the waveform's **shadow** tree. Rules in
 * `app/globals.css` that hang off `[data-testid="primary-waveform"]` do not cross
 * the shadow boundary, so phrase/focus **frames must be applied inline** on each
 * `region.element` (same rationale as phrase-handle interactivity in
 * `woodshed-workspace.tsx`).
 */

import type { FocusRegionWaveSlot } from "@/lib/focus-region-wave-palette";
import {
  CANONICAL_FOCUS_FRAME,
  CANONICAL_WAVE_SECTION_ALPHA,
  resolveNeutralFocusChrome,
  resolveNeutralSectionChrome,
} from "@/lib/regions/region-visual-language";
import { deriveRegionVisualState } from "@/lib/regions/region-visual-state";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type PhraseRegionTier = "locked" | "active" | "editing";

/** Focus Loop mode: focus regions sit in front when the phrase has segments to practice. */
export function focusIsVisualFront(
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): boolean {
  const state = deriveRegionVisualState({
    context: {
      surface: "desktop",
      activeLoopId: "phrase",
      activeSegmentId: "segment",
      editableLoopId: null,
      loopPlaybackEnabled: false,
      loopPracticeScope,
      phraseWaveformEditUnlockedById: {},
      focusRegionWaveformEditUnlockedById: {},
      practiceEditCompatibility: {
        editMode: false,
        practiceMode: true,
      },
    },
    target: {
      kind: "focus",
      phraseId: "phrase",
      segmentId: "segment",
      phraseHasFocusRegions,
    },
  });
  return state.isFocusForeground;
}

/** Loop Phrase mode (or no focus regions): phrase is the foreground practice frame. */
export function phraseIsVisualFront(
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): boolean {
  return !focusIsVisualFront(loopPracticeScope, phraseHasFocusRegions);
}

function dimRgbaString(rgba: string, factor: number): string {
  const m = rgba.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/,
  );
  if (!m) return rgba;
  const a = Math.min(1, Number(m[4]) * factor);
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(a.toFixed(3))})`;
}

function focusFrameDimmed(
  p: (typeof CANONICAL_FOCUS_FRAME)[number],
  factor: number,
): { rim: string; rail: string } {
  return { rim: dimRgbaString(p.rim, factor), rail: dimRgbaString(p.rail, factor) };
}

function clampPalette(paletteIndex: number): number {
  if (!Number.isFinite(paletteIndex) || paletteIndex < 0) return 0;
  return paletteIndex % CANONICAL_FOCUS_FRAME.length;
}

function phraseZIndexFromTier(tier: PhraseRegionTier, focusForeground: boolean): string {
  if (focusForeground) {
    return "2";
  }
  if (tier === "editing") return "8";
  return "7";
}

function desktopFocusZIndexFromState(state: {
  zIndexTier: string;
}): string {
  switch (state.zIndexTier) {
    case "focus_editing_foreground":
      return "10";
    case "focus_active_foreground":
      return "8";
    case "focus_inactive_foreground":
      return "6";
    case "focus_editing_context":
      return "5";
    case "focus_active_context":
      return "4";
    default:
      return "3";
  }
}

function mobileReadonlyFocusZIndexFromState(state: { zIndexTier: string }): string {
  switch (state.zIndexTier) {
    case "focus_active_foreground":
      return "4";
    case "focus_inactive_foreground":
      return "3";
    case "focus_active_context":
      return "2";
    default:
      return "1";
  }
}

/** WaveSurfer `color` for phrase region — warm amber; stronger when phrase is the front layer. */
export function phraseRegionWaveColor(
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  phraseIsFront: boolean,
): string {
  const hi = phraseIsFront;
  const alpha = isMobilePractice
    ? tier === "locked"
      ? hi
        ? CANONICAL_WAVE_SECTION_ALPHA.mobile.lockedFront
        : CANONICAL_WAVE_SECTION_ALPHA.mobile.lockedContext
      : tier === "active"
        ? hi
          ? CANONICAL_WAVE_SECTION_ALPHA.mobile.activeFront
          : CANONICAL_WAVE_SECTION_ALPHA.mobile.activeContext
        : hi
          ? CANONICAL_WAVE_SECTION_ALPHA.mobile.editingFront
          : CANONICAL_WAVE_SECTION_ALPHA.mobile.editingContext
    : tier === "locked"
      ? hi
        ? CANONICAL_WAVE_SECTION_ALPHA.desktop.lockedFront
        : CANONICAL_WAVE_SECTION_ALPHA.desktop.lockedContext
      : tier === "active"
        ? hi
          ? CANONICAL_WAVE_SECTION_ALPHA.desktop.activeFront
          : CANONICAL_WAVE_SECTION_ALPHA.desktop.activeContext
        : hi
          ? CANONICAL_WAVE_SECTION_ALPHA.desktop.editingFront
          : CANONICAL_WAVE_SECTION_ALPHA.desktop.editingContext;
  return `rgba(109, 93, 217, ${Number((alpha * 0.3).toFixed(4))})`;
}

/** WaveSurfer `color` for focus segments — cool palette; slightly dimmed when phrase is front. */
export function focusRegionFillForWave(
  _slot: FocusRegionWaveSlot,
  selected: boolean,
  focusIsFront: boolean,
): string {
  const chrome = resolveNeutralFocusChrome({
    active: selected,
    chipHover: false,
    dimmed: !selected && !focusIsFront,
    calm: !selected && !focusIsFront,
  });
  return chrome.backgroundColor;
}

export function phraseRegionBoxShadow(
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  phraseIsFront: boolean,
): string {
  const editing = tier === "editing";
  const active = tier !== "locked";
  const depth = phraseIsFront ? 0.2 : 0.16;
  const edge = active ? 0.2 : 0.11;
  const rail = editing ? 2 : active ? 1 : 0;
  return [
    rail > 0 ? `inset ${rail}px 0 0 0 rgba(167, 139, 250, ${editing ? 0.31 : 0.18})` : "",
    rail > 0 ? `inset -${rail}px 0 0 0 rgba(167, 139, 250, ${editing ? 0.31 : 0.18})` : "",
    `inset 0 0 0 1px rgba(167, 139, 250, ${edge})`,
    "inset 0 1px 0 rgba(255, 255, 255, 0.035)",
    `inset 0 -20px 40px rgba(0, 0, 0, ${depth})`,
    `inset 0 10px 22px rgba(118, 96, 186, ${phraseIsFront ? 0.036 : 0.022})`,
    `0 1px 7px rgba(0, 0, 0, ${isMobilePractice ? 0.16 : 0.2})`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function applyPhraseRegionVisuals(
  el: HTMLElement,
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): void {
  const focusForeground = focusIsVisualFront(
    loopPracticeScope,
    phraseHasFocusRegions,
  );
  const phraseFront = !focusForeground;
  const sectionChrome = resolveNeutralSectionChrome({
    active: tier !== "locked",
    calm: tier === "locked",
  });
  const laneScrim = phraseHasFocusRegions
    ? "linear-gradient(to bottom, rgba(4, 3, 8, 0.18) 0%, rgba(10, 9, 14, 0.1) 24%, rgba(10, 9, 14, 0.04) 39%, rgba(10, 9, 14, 0.04) 64%, rgba(10, 9, 14, 0.11) 80%, rgba(4, 3, 8, 0.18) 100%)"
    : "linear-gradient(to bottom, rgba(4, 3, 8, 0.13), rgba(4, 3, 8, 0.06))";
  el.style.zIndex = phraseZIndexFromTier(tier, focusForeground);
  el.style.borderRadius = "8px";
  el.style.borderStyle = "solid";
  el.style.borderWidth = "1px";
  el.style.borderColor = sectionChrome.borderColor;
  el.style.background = `${laneScrim}, ${sectionChrome.background}`;
  el.style.boxShadow = phraseRegionBoxShadow(tier, isMobilePractice, phraseFront);
}

/** Desktop focus overlay — cool tint; stronger when Focus Loop mode is active. */
export function desktopFocusRegionBoxShadow(
  paletteIndex: number,
  selected: boolean,
  editable: boolean,
  focusIsFront: boolean,
): string {
  const pRaw = CANONICAL_FOCUS_FRAME[clampPalette(paletteIndex)];
  const p = focusIsFront ? pRaw : focusFrameDimmed(pRaw, 0.82);
  const rail = p.rail;
  const chrome = resolveNeutralFocusChrome({
    active: selected,
    chipHover: false,
    hovered: false,
    dimmed: !selected && !focusIsFront,
    calm: !selected && !editable,
  });

  if (!selected) {
    return [
      chrome.shadow,
      `inset 0 0 0 1px ${chrome.borderColor}`,
      "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
      `inset 0 -14px 28px rgba(0, 0, 0, ${focusIsFront ? 0.15 : 0.12})`,
      `0 1px 6px rgba(0, 0, 0, ${focusIsFront ? 0.21 : 0.17})`,
    ].join(", ");
  }

  const railWidth = editable ? 3 : 2;
  return [
    chrome.shadow,
    `inset ${railWidth}px 0 0 0 ${rail}`,
    `inset -${railWidth}px 0 0 0 ${rail}`,
    `inset 0 0 0 1px ${chrome.borderColor}`,
    "inset 0 1px 0 rgba(255, 255, 255, 0.07)",
    `inset 0 -18px 34px rgba(0, 0, 0, ${focusIsFront ? 0.23 : 0.18})`,
    "inset 0 0 0 2px rgba(255, 255, 255, 0.02)",
    `0 2px 10px rgba(0, 0, 0, ${focusIsFront ? 0.28 : 0.22})`,
  ].join(", ");
}

export function mobileReadonlyFocusBoxShadow(
  selected: boolean,
  focusIsFront: boolean,
): string {
  const chrome = resolveNeutralFocusChrome({
    active: selected,
    chipHover: false,
    hovered: false,
    dimmed: !selected && !focusIsFront,
    calm: !selected,
  });
  return [
    chrome.shadow,
    `inset 0 0 0 1px ${chrome.borderColor}`,
    selected ? "inset 2px 0 0 0 rgba(196, 181, 253, 0.42)" : "",
    selected ? "inset -2px 0 0 0 rgba(196, 181, 253, 0.42)" : "",
    `inset 0 -14px 26px rgba(0, 0, 0, ${focusIsFront ? 0.16 : 0.12})`,
    `0 1px 6px rgba(0, 0, 0, ${focusIsFront ? 0.3 : 0.24})`,
  ]
    .filter(Boolean)
    .join(", ");
}

export function applyDesktopFocusRegionVisuals(
  el: HTMLElement,
  paletteIndex: number,
  selected: boolean,
  editable: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): void {
  const focusFront = focusIsVisualFront(loopPracticeScope, phraseHasFocusRegions);
  const visualState = deriveRegionVisualState({
    context: {
      surface: "desktop",
      activeLoopId: "phrase",
      activeSegmentId: selected ? "segment" : null,
      editableLoopId: null,
      loopPlaybackEnabled: false,
      loopPracticeScope,
      phraseWaveformEditUnlockedById: {},
      focusRegionWaveformEditUnlockedById: editable ? { segment: true } : {},
      practiceEditCompatibility: {
        editMode: editable,
        practiceMode: !editable,
      },
    },
    target: {
      kind: "focus",
      phraseId: "phrase",
      segmentId: "segment",
      phraseHasFocusRegions,
    },
  });
  const focusChrome = resolveNeutralFocusChrome({
    active: selected,
    chipHover: false,
    hovered: false,
    dimmed: !selected && !focusFront,
    calm: !selected && !editable,
  });
  el.style.borderRadius = "6px";
  el.style.isolation = "isolate";
  el.style.borderStyle = "solid";
  el.style.borderWidth = "1px";
  el.style.borderColor = focusChrome.borderColor;
  el.style.backgroundColor = focusChrome.backgroundColor;
  el.style.zIndex = desktopFocusZIndexFromState(visualState);
  el.style.boxShadow = desktopFocusRegionBoxShadow(
    paletteIndex,
    selected,
    editable,
    focusFront,
  );
}

export function applyMobileReadonlyFocusRegionVisuals(
  el: HTMLElement,
  selected: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): void {
  const focusFront = focusIsVisualFront(loopPracticeScope, phraseHasFocusRegions);
  const visualState = deriveRegionVisualState({
    context: {
      surface: "mobile",
      activeLoopId: "phrase",
      activeSegmentId: selected ? "segment" : null,
      editableLoopId: null,
      loopPlaybackEnabled: false,
      loopPracticeScope,
      phraseWaveformEditUnlockedById: {},
      focusRegionWaveformEditUnlockedById: {},
      practiceEditCompatibility: {
        editMode: false,
        practiceMode: true,
      },
    },
    target: {
      kind: "focus",
      phraseId: "phrase",
      segmentId: "segment",
      phraseHasFocusRegions,
    },
  });
  const focusChrome = resolveNeutralFocusChrome({
    active: selected,
    chipHover: false,
    hovered: false,
    dimmed: !selected && !focusFront,
    calm: !selected,
  });
  el.style.borderRadius = "5px";
  el.style.borderStyle = "solid";
  el.style.borderWidth = "1px";
  el.style.borderColor = focusChrome.borderColor;
  el.style.backgroundColor = focusChrome.backgroundColor;
  el.style.zIndex = mobileReadonlyFocusZIndexFromState(visualState);
  el.style.boxShadow = mobileReadonlyFocusBoxShadow(selected, focusFront);
}
