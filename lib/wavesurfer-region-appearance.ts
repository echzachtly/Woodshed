/**
 * WaveSurfer 7 mounts region roots inside the waveform's **shadow** tree. Rules in
 * `app/globals.css` that hang off `[data-testid="primary-waveform"]` do not cross
 * the shadow boundary, so phrase/focus **frames must be applied inline** on each
 * `region.element` (same rationale as phrase-handle interactivity in
 * `woodshed-workspace.tsx`).
 */

import type { FocusRegionWaveSlot } from "@/lib/focus-region-wave-palette";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type PhraseRegionTier = "locked" | "active" | "editing";

/** Focus Loop mode: focus regions sit in front when the phrase has segments to practice. */
export function focusIsVisualFront(
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): boolean {
  return loopPracticeScope === "practice_region" && phraseHasFocusRegions;
}

/** Loop Phrase mode (or no focus regions): phrase is the foreground practice frame. */
export function phraseIsVisualFront(
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): boolean {
  return !focusIsVisualFront(loopPracticeScope, phraseHasFocusRegions);
}

const FOCUS_FRAME = [
  { rim: "rgba(188, 178, 222, 0.98)", rail: "rgba(206, 194, 236, 0.94)" },
  { rim: "rgba(172, 188, 224, 0.98)", rail: "rgba(190, 208, 242, 0.94)" },
  { rim: "rgba(198, 182, 228, 0.98)", rail: "rgba(214, 200, 244, 0.94)" },
  { rim: "rgba(172, 194, 218, 0.98)", rail: "rgba(196, 216, 236, 0.94)" },
  { rim: "rgba(206, 186, 206, 0.98)", rail: "rgba(222, 202, 224, 0.94)" },
  { rim: "rgba(176, 200, 192, 0.98)", rail: "rgba(200, 224, 216, 0.94)" },
] as const;

function dimRgbaString(rgba: string, factor: number): string {
  const m = rgba.match(
    /^rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)\s*$/,
  );
  if (!m) return rgba;
  const a = Math.min(1, Number(m[4]) * factor);
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${Number(a.toFixed(3))})`;
}

function focusFrameDimmed(
  p: (typeof FOCUS_FRAME)[number],
  factor: number,
): { rim: string; rail: string } {
  return { rim: dimRgbaString(p.rim, factor), rail: dimRgbaString(p.rail, factor) };
}

function clampPalette(paletteIndex: number): number {
  if (!Number.isFinite(paletteIndex) || paletteIndex < 0) return 0;
  return paletteIndex % FOCUS_FRAME.length;
}

/** WaveSurfer `color` for phrase region — warm amber; stronger when phrase is the front layer. */
export function phraseRegionWaveColor(
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  phraseIsFront: boolean,
): string {
  const hi = phraseIsFront;
  if (isMobilePractice) {
    if (tier === "locked") return hi ? "rgba(245, 190, 95, 0.11)" : "rgba(245, 190, 95, 0.07)";
    if (tier === "active") return hi ? "rgba(245, 190, 95, 0.14)" : "rgba(245, 190, 95, 0.09)";
    return hi ? "rgba(255, 205, 130, 0.16)" : "rgba(245, 190, 95, 0.10)";
  }
  if (tier === "locked") return hi ? "rgba(245, 190, 95, 0.10)" : "rgba(245, 190, 95, 0.06)";
  if (tier === "active") return hi ? "rgba(245, 190, 95, 0.16)" : "rgba(245, 190, 95, 0.08)";
  return hi ? "rgba(255, 210, 135, 0.18)" : "rgba(245, 190, 95, 0.10)";
}

/** WaveSurfer `color` for focus segments — cool palette; slightly dimmed when phrase is front. */
export function focusRegionFillForWave(
  slot: FocusRegionWaveSlot,
  selected: boolean,
  focusIsFront: boolean,
): string {
  const src = selected ? slot.selectedFill : slot.inactiveFill;
  if (focusIsFront) return src;
  return dimRgbaString(src, 0.78);
}

export function phraseRegionBoxShadow(
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  phraseIsFront: boolean,
): string {
  const f = phraseIsFront;
  if (isMobilePractice) {
    if (tier === "locked") {
      return f
        ? [
            "inset 0 0 0 1px rgba(255, 214, 130, 0.48)",
            "inset 0 0 0 2px rgba(8, 7, 6, 0.44)",
            "inset 0 0 52px rgba(90, 50, 10, 0.05)",
          ].join(", ")
        : [
            "inset 0 0 0 1px rgba(200, 160, 90, 0.32)",
            "inset 0 0 0 2px rgba(8, 7, 6, 0.42)",
            "inset 0 0 52px rgba(15, 23, 42, 0.03)",
          ].join(", ");
    }
    if (tier === "active") {
      return f
        ? [
            "inset 3px 0 0 0 rgba(255, 210, 150, 0.75)",
            "inset -3px 0 0 0 rgba(255, 210, 150, 0.75)",
            "inset 0 1px 0 0 rgba(255, 228, 180, 0.28)",
            "inset 0 -1px 0 0 rgba(255, 228, 180, 0.22)",
            "0 0 0 1px rgba(120, 80, 30, 0.35)",
            "0 0 16px rgba(230, 150, 50, 0.12)",
          ].join(", ")
        : [
            "inset 2px 0 0 0 rgba(220, 175, 100, 0.45)",
            "inset -2px 0 0 0 rgba(220, 175, 100, 0.45)",
            "0 0 0 1px rgba(90, 65, 30, 0.28)",
          ].join(", ");
    }
    return f
      ? [
          "inset 3px 0 0 0 rgba(255, 220, 160, 0.88)",
          "inset -3px 0 0 0 rgba(255, 220, 160, 0.88)",
          "inset 0 1px 0 0 rgba(255, 235, 200, 0.22)",
          "inset 0 -1px 0 0 rgba(255, 235, 200, 0.18)",
          "inset 0 0 0 1px rgba(10, 9, 8, 0.42)",
          "inset 0 0 88px rgba(200, 120, 30, 0.04)",
          "0 0 0 1px rgba(140, 95, 40, 0.38)",
          "0 0 14px rgba(240, 160, 50, 0.14)",
        ].join(", ")
      : [
          "inset 2px 0 0 0 rgba(210, 170, 95, 0.55)",
          "inset -2px 0 0 0 rgba(210, 170, 95, 0.55)",
          "inset 0 0 0 1px rgba(10, 9, 8, 0.4)",
          "0 0 10px rgba(0, 0, 0, 0.22)",
        ].join(", ");
  }
  if (tier === "locked") {
    return f
      ? [
          "inset 0 0 0 1px rgba(255, 214, 130, 0.52)",
          "inset 0 0 0 2px rgba(8, 7, 6, 0.5)",
          "inset 0 0 44px rgba(100, 55, 12, 0.05)",
          "0 0 0 1px rgba(50, 36, 12, 0.32)",
          "0 0 12px rgba(220, 140, 40, 0.1)",
        ].join(", ")
      : [
          "inset 0 0 0 1px rgba(200, 165, 95, 0.28)",
          "inset 0 0 0 2px rgba(8, 7, 6, 0.48)",
          "inset 0 0 44px rgba(15, 23, 42, 0.02)",
        ].join(", ");
  }
  if (tier === "active") {
    return f
      ? [
          "inset 2px 0 0 0 rgba(255, 205, 130, 0.62)",
          "inset -2px 0 0 0 rgba(255, 205, 130, 0.62)",
          "inset 0 1px 0 0 rgba(255, 224, 170, 0.18)",
          "inset 0 -1px 0 0 rgba(255, 224, 170, 0.14)",
          "inset 0 0 0 1px rgba(12, 10, 9, 0.44)",
          "inset 0 0 96px rgba(200, 110, 20, 0.04)",
          "0 0 0 1px rgba(70, 50, 18, 0.38)",
          "0 0 18px rgba(230, 150, 55, 0.14)",
        ].join(", ")
      : [
          "inset 1px 0 0 0 rgba(210, 170, 95, 0.35)",
          "inset -1px 0 0 0 rgba(210, 170, 95, 0.35)",
          "inset 0 0 0 1px rgba(12, 10, 9, 0.4)",
          "inset 0 0 72px rgba(80, 45, 10, 0.03)",
        ].join(", ");
  }
  return f
    ? [
        "inset 3px 0 0 0 rgba(255, 220, 155, 0.88)",
        "inset -3px 0 0 0 rgba(255, 220, 155, 0.88)",
        "inset 0 1px 0 0 rgba(255, 232, 190, 0.22)",
        "inset 0 -1px 0 0 rgba(255, 232, 190, 0.18)",
        "inset 0 0 0 1px rgba(10, 9, 8, 0.42)",
        "inset 0 0 96px rgba(210, 125, 25, 0.05)",
        "0 0 0 1px rgba(90, 62, 22, 0.4)",
        "0 0 16px rgba(240, 155, 45, 0.16)",
      ].join(", ")
    : [
        "inset 2px 0 0 0 rgba(215, 175, 100, 0.5)",
        "inset -2px 0 0 0 rgba(215, 175, 100, 0.5)",
        "inset 0 0 0 1px rgba(10, 9, 8, 0.4)",
        "inset 0 0 88px rgba(120, 70, 15, 0.03)",
        "0 0 10px rgba(0, 0, 0, 0.28)",
      ].join(", ");
}

export function applyPhraseRegionVisuals(
  el: HTMLElement,
  tier: PhraseRegionTier,
  isMobilePractice: boolean,
  loopPracticeScope: LoopPracticeScope,
  phraseHasFocusRegions: boolean,
): void {
  const phraseFront = phraseIsVisualFront(loopPracticeScope, phraseHasFocusRegions);
  const z =
    phraseFront && tier === "editing"
      ? "8"
      : phraseFront
        ? "7"
        : "2";
  el.style.zIndex = z;
  el.style.borderRadius = "2px";
  el.style.boxShadow = phraseRegionBoxShadow(tier, isMobilePractice, phraseFront);
}

/** Desktop focus overlay — cool tint; stronger when Focus Loop mode is active. */
export function desktopFocusRegionBoxShadow(
  paletteIndex: number,
  selected: boolean,
  editable: boolean,
  focusIsFront: boolean,
): string {
  const pRaw = FOCUS_FRAME[clampPalette(paletteIndex)];
  const p = focusIsFront ? pRaw : focusFrameDimmed(pRaw, 0.88);
  const rim = p.rim;
  const rail = p.rail;

  const edge = focusIsFront ? 0.78 : 0.72;
  const drop = focusIsFront ? 0.58 : 0.48;
  const vignette = focusIsFront ? 0.15 : 0.11;

  const baseDepth = [
    `inset 0 0 0 1px ${rim}`,
    `inset 0 0 0 2px rgba(5, 4, 3, ${edge})`,
    "inset 0 2px 4px rgba(255, 255, 255, 0.1)",
    `inset 0 -14px 30px rgba(0, 0, 0, ${vignette})`,
    `0 0 0 1px rgba(16, 14, 12, ${focusIsFront ? 0.55 : 0.45})`,
    `0 1px 6px rgba(0, 0, 0, ${drop})`,
  ];

  if (!selected) {
    return baseDepth.join(", ");
  }

  const rails = editable
    ? [
        `inset 5px 0 0 0 ${rail}`,
        `inset -5px 0 0 0 ${rail}`,
        "inset 0 3px 6px rgba(255, 255, 255, 0.12)",
        `inset 0 -16px 36px rgba(0, 0, 0, ${focusIsFront ? 0.2 : 0.15})`,
      ]
    : [
        `inset 4px 0 0 0 ${rail}`,
        `inset -4px 0 0 0 ${rail}`,
        "inset 0 2px 6px rgba(255, 255, 255, 0.11)",
        `inset 0 -14px 34px rgba(0, 0, 0, ${focusIsFront ? 0.19 : 0.14})`,
      ];

  const glow = focusIsFront ? "0 0 28px rgba(130, 110, 200, 0.16)" : "0 0 20px rgba(100, 90, 150, 0.1)";

  const frame = [
    "inset 0 0 0 1px rgba(252, 248, 255, 0.96)",
    `inset 0 0 0 2px rgba(5, 4, 3, ${focusIsFront ? 0.68 : 0.6})`,
    ...rails,
    `0 0 0 1px rgba(18, 16, 14, ${focusIsFront ? 0.62 : 0.5})`,
    `0 2px 12px rgba(0, 0, 0, ${focusIsFront ? 0.52 : 0.42})`,
    glow,
  ];
  return frame.join(", ");
}

export function mobileReadonlyFocusBoxShadow(
  selected: boolean,
  focusIsFront: boolean,
): string {
  const strong = focusIsFront;
  if (!selected) {
    return strong
      ? [
          "inset 0 0 0 1px rgba(148, 156, 188, 0.52)",
          "inset 0 0 0 2px rgba(8, 7, 6, 0.52)",
          "inset 0 -10px 22px rgba(0, 0, 0, 0.1)",
          "0 0 0 1px rgba(14, 12, 11, 0.4)",
          "0 1px 5px rgba(0, 0, 0, 0.45)",
        ].join(", ")
      : [
          "inset 0 0 0 1px rgba(130, 138, 160, 0.38)",
          "inset 0 0 0 2px rgba(8, 7, 6, 0.46)",
          "inset 0 -10px 22px rgba(0, 0, 0, 0.08)",
          "0 0 0 1px rgba(14, 12, 11, 0.32)",
          "0 1px 4px rgba(0, 0, 0, 0.35)",
        ].join(", ");
  }
  return strong
    ? [
        "inset 0 0 0 1px rgba(222, 212, 250, 0.72)",
        "inset 0 0 0 2px rgba(8, 7, 6, 0.48)",
        "inset 3px 0 0 0 rgba(196, 181, 253, 0.58)",
        "inset -3px 0 0 0 rgba(196, 181, 253, 0.58)",
        "0 0 0 1px rgba(14, 12, 11, 0.48)",
        "0 2px 10px rgba(0, 0, 0, 0.42)",
        "0 0 18px rgba(130, 110, 200, 0.12)",
      ].join(", ")
    : [
        "inset 0 0 0 1px rgba(190, 182, 215, 0.48)",
        "inset 0 0 0 2px rgba(8, 7, 6, 0.44)",
        "inset 2px 0 0 0 rgba(170, 158, 210, 0.42)",
        "inset -2px 0 0 0 rgba(170, 158, 210, 0.42)",
        "0 0 0 1px rgba(14, 12, 11, 0.36)",
        "0 1px 6px rgba(0, 0, 0, 0.34)",
      ].join(", ");
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
  el.style.borderRadius = "1px";
  el.style.isolation = "isolate";
  if (focusFront) {
    el.style.zIndex = editable && selected ? "10" : selected ? "8" : "6";
  } else {
    el.style.zIndex = editable && selected ? "5" : selected ? "4" : "3";
  }
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
  el.style.borderRadius = "1px";
  el.style.zIndex = focusFront ? (selected ? "4" : "3") : selected ? "2" : "1";
  el.style.boxShadow = mobileReadonlyFocusBoxShadow(selected, focusFront);
}
