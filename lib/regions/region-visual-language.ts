export const CANONICAL_FOCUS_FRAME = [
  { rim: "rgba(172, 168, 204, 0.72)", rail: "rgba(188, 182, 220, 0.62)" },
  { rim: "rgba(160, 176, 206, 0.72)", rail: "rgba(178, 194, 224, 0.62)" },
  { rim: "rgba(182, 170, 208, 0.72)", rail: "rgba(196, 186, 226, 0.62)" },
  { rim: "rgba(158, 182, 204, 0.72)", rail: "rgba(176, 200, 220, 0.62)" },
  { rim: "rgba(188, 174, 198, 0.72)", rail: "rgba(204, 188, 212, 0.62)" },
  { rim: "rgba(164, 188, 182, 0.72)", rail: "rgba(184, 208, 202, 0.62)" },
] as const;

export const CANONICAL_WAVE_SECTION_ALPHA = {
  mobile: {
    lockedFront: 0.042,
    lockedContext: 0.024,
    activeFront: 0.062,
    activeContext: 0.034,
    editingFront: 0.078,
    editingContext: 0.046,
  },
  desktop: {
    lockedFront: 0.044,
    lockedContext: 0.026,
    activeFront: 0.064,
    activeContext: 0.036,
    editingFront: 0.082,
    editingContext: 0.048,
  },
} as const;

export function resolveNeutralSectionChrome(args: {
  active: boolean;
  calm: boolean;
}): {
  borderColor: string;
  background: string;
  labelColor: string;
} {
  if (args.active && args.calm) {
    return {
      borderColor: "rgba(167, 139, 250, 0.17)",
      background:
        "linear-gradient(to bottom, rgba(109, 93, 217, 0.055), rgba(24, 22, 40, 0.215))",
      labelColor: "rgba(237, 233, 254, 0.79)",
    };
  }
  if (args.active) {
    return {
      borderColor: "rgba(167, 139, 250, 0.31)",
      background:
        "linear-gradient(to bottom, rgba(109, 93, 217, 0.125), rgba(24, 22, 40, 0.33))",
      labelColor: "rgba(237, 233, 254, 0.86)",
    };
  }
  return {
    borderColor: "rgba(255, 255, 255, 0.042)",
    background:
      "linear-gradient(to bottom, rgba(38, 38, 62, 0.11), rgba(13, 12, 19, 0.285))",
    labelColor: "rgba(255, 255, 255, 0.64)",
  };
}

export function resolveNeutralFocusChrome(args: {
  active: boolean;
  chipHover: boolean;
  hovered?: boolean;
  dimmed: boolean;
  calm: boolean;
}): {
  borderColor: string;
  backgroundColor: string;
  shadow: string;
  labelColor: string;
} {
  if (args.active && args.calm) {
    return {
      borderColor: "rgba(172, 188, 220, 0.28)",
      backgroundColor: "rgba(23, 28, 40, 0.3)",
      shadow:
        "inset 0 0 0 1px rgba(8, 9, 14, 0.42), inset 0 1px 0 rgba(255, 255, 255, 0.028), inset 0 -10px 18px rgba(0, 0, 0, 0.22)",
      labelColor: "rgba(227, 239, 255, 0.88)",
    };
  }
  if (args.active) {
    return {
      borderColor: "rgba(186, 204, 236, 0.38)",
      backgroundColor: "rgba(28, 34, 48, 0.34)",
      shadow:
        "inset 0 0 0 1px rgba(8, 9, 14, 0.44), inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -12px 22px rgba(0, 0, 0, 0.26), inset 0 0 14px rgba(202, 223, 255, 0.05), 0 1px 6px rgba(0, 0, 0, 0.24)",
      labelColor: "rgba(240, 247, 255, 0.95)",
    };
  }
  if (args.hovered || args.chipHover) {
    return {
      borderColor: "rgba(186, 204, 236, 0.26)",
      backgroundColor: "rgba(26, 32, 46, 0.24)",
      shadow:
        "inset 0 0 0 1px rgba(8, 9, 14, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.035), inset 0 -10px 18px rgba(0, 0, 0, 0.2), 0 0 8px rgba(176, 196, 230, 0.12)",
      labelColor: "rgba(229, 240, 255, 0.91)",
    };
  }
  if (args.dimmed) {
    return {
      borderColor: "rgba(255, 255, 255, 0.042)",
      backgroundColor: "rgba(20, 24, 34, 0.18)",
      shadow:
        "inset 0 0 0 1px rgba(8, 9, 14, 0.34), inset 0 -8px 14px rgba(0, 0, 0, 0.16)",
      labelColor: "rgba(218, 228, 242, 0.75)",
    };
  }
  return {
    borderColor: "rgba(255, 255, 255, 0.05)",
    backgroundColor: "rgba(22, 28, 38, 0.2)",
    shadow:
      "inset 0 0 0 1px rgba(8, 9, 14, 0.36), inset 0 -9px 15px rgba(0, 0, 0, 0.17)",
    labelColor: "rgba(222, 232, 246, 0.79)",
  };
}

export const NEUTRAL_FOCUS_LANE_CHROME = {
  shellShadow:
    "inset 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 2px rgba(5,6,10,0.32), inset 0 1px 0 rgba(255,255,255,0.02), inset 0 -14px 24px rgba(0,0,0,0.26)",
  scrimColor: "rgba(0, 0, 0, 0.22)",
} as const;

export const TIMELINE_REGION_LAYOUT = {
  sectionHeaderTopPx: 8,
  sectionHeaderInsetX: 12,
  sectionHeaderInsetXCompact: 8,
  focusHeaderTopPx: 4,
  focusHeaderInsetX: 8,
  focusHeaderInsetXCompact: 6,
  focusHeaderReservedHeightPx: 12,
  focusBodyInsetBottomPx: 4,
  focusHeaderRailOpacity: 0.34,
} as const;
