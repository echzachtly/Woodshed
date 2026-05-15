/**
 * Versioned onboarding document stored in **localStorage** (user/device-level).
 *
 * Persistence is deliberately **outside** `woodshed-store` and project payloads.
 *
 * Product rules: survives `resetWorkspace()`, imports, demo load, restores.
 * Milestone writes are wired in later phases; Phase 1 only defines shape + accessors.
 *
 * See: docs/APPLICATION_STATE_MODEL.md, docs/ONBOARDING_STRATEGY.md
 */

export const ONBOARDING_STORAGE_KEY = "woodshed.onboarding.state" as const;

export const CURRENT_ONBOARDING_SCHEMA_VERSION = 1 as const;

export type OnboardingSchemaVersion = typeof CURRENT_ONBOARDING_SCHEMA_VERSION;

export type DesktopOnboardingFlagsV1 = {
  /**
   * True after desktop onboarding milestones are satisfied.
   * Per product direction: eventual trigger is intentional Focus Loop creation—not demo open or bootstrap sections.
   */
  focusLoopAuthoringComplete: boolean;
  /**
   * User dismissed the lightweight first-open demo project ribbon (device-local).
   * Independent of Focus Loop authoring onboarding.
   */
  demoOrientationSeen: boolean;
};

export type MobileOnboardingFlagsV1 = {
  /** True after mobile practice onboarding milestones (Phase 4+). */
  practiceIntroductionComplete: boolean;
};

export type OnboardingPersistDocumentV1 = {
  readonly v: 1;
  desktop: DesktopOnboardingFlagsV1;
  mobile: MobileOnboardingFlagsV1;
};

export function defaultOnboardingDocument(): OnboardingPersistDocumentV1 {
  return {
    v: CURRENT_ONBOARDING_SCHEMA_VERSION,
    desktop: {
      focusLoopAuthoringComplete: false,
      demoOrientationSeen: false,
    },
    mobile: {
      practiceIntroductionComplete: false,
    },
  };
}
