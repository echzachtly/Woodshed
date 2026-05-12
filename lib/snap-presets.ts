/** Discrete snap strengths for Phase 2 “precision” UX (still drives `snapAssist` 0–1). */
export const SNAP_PRESETS = [
  { key: "off", label: "Off", strength: 0 },
  { key: "soft", label: "Soft", strength: 0.28 },
  { key: "std", label: "Std", strength: 0.45 },
  { key: "grip", label: "Grip", strength: 0.82 },
] as const;
