import {
  CURRENT_ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
  defaultOnboardingDocument,
  type DesktopOnboardingFlagsV1,
  type MobileOnboardingFlagsV1,
  type OnboardingPersistDocumentV1,
} from "./schema";

function getLs(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeDesktop(raw: unknown, fallback: DesktopOnboardingFlagsV1) {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const next = { ...fallback };

  const fc = o.focusLoopAuthoringComplete;
  if (typeof fc === "boolean") {
    next.focusLoopAuthoringComplete = fc;
  }

  const demoSeen = o.demoOrientationSeen;
  if (typeof demoSeen === "boolean") {
    next.demoOrientationSeen = demoSeen;
  }

  return next;
}

function normalizeMobile(raw: unknown, fallback: MobileOnboardingFlagsV1) {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const pc = o.practiceIntroductionComplete;
  if (typeof pc === "boolean") {
    return { ...fallback, practiceIntroductionComplete: pc };
  }
  return fallback;
}

/**
 * Coerce persisted JSON into the current schema. Unknown schema versions yield defaults (safe reset).
 */
function normalize(parsed: unknown): OnboardingPersistDocumentV1 {
  const def = defaultOnboardingDocument();
  if (!parsed || typeof parsed !== "object") return def;
  const o = parsed as Record<string, unknown>;
  const v = o.v;
  if (v !== CURRENT_ONBOARDING_SCHEMA_VERSION) return def;

  return {
    v: CURRENT_ONBOARDING_SCHEMA_VERSION,
    desktop: normalizeDesktop(o.desktop, def.desktop),
    mobile: normalizeMobile(o.mobile, def.mobile),
  };
}

/** Load onboarding flags; safe on SSR / parse errors / missing keys. */
export function loadOnboardingDocument(): OnboardingPersistDocumentV1 {
  const ls = getLs();
  if (!ls) return defaultOnboardingDocument();
  try {
    const raw = ls.getItem(ONBOARDING_STORAGE_KEY);
    if (raw == null || raw === "") return defaultOnboardingDocument();
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return defaultOnboardingDocument();
  }
}

/** Replace entire document. No-op outside browser or if storage throws (quota / blocked). */
export function saveOnboardingDocument(doc: OnboardingPersistDocumentV1): void {
  const ls = getLs();
  if (!ls) return;
  try {
    ls.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(doc));
  } catch {
    /* noop */
  }
}

export type OnboardingPartialPatch = {
  desktop?: Partial<DesktopOnboardingFlagsV1>;
  mobile?: Partial<MobileOnboardingFlagsV1>;
};

/** Merge partial updates shallowly under `desktop` / `mobile`; persist and return merged doc. */
export function patchOnboardingDocument(
  patch: OnboardingPartialPatch,
): OnboardingPersistDocumentV1 {
  const current = loadOnboardingDocument();
  const next: OnboardingPersistDocumentV1 = {
    v: CURRENT_ONBOARDING_SCHEMA_VERSION,
    desktop: { ...current.desktop, ...patch.desktop },
    mobile: { ...current.mobile, ...patch.mobile },
  };
  saveOnboardingDocument(next);
  return next;
}
