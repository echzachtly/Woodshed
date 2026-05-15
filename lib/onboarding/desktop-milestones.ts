import { loadOnboardingDocument, patchOnboardingDocument } from "./storage";

/** Dispatched after `patchOnboardingDocument` when desktop authoring completion flips to true. */
export const DESKTOP_ONBOARDING_UPDATED_EVENT =
  "woodshed:desktop-onboarding-updated" as const;

export type DesktopOnboardingUpdatedDetail = {
  /** First transition to desktop Focus Loop authoring complete (this session tab). */
  transitionedToComplete: boolean;
};

declare global {
  interface WindowEventMap {
    [DESKTOP_ONBOARDING_UPDATED_EVENT]: CustomEvent<DesktopOnboardingUpdatedDetail>;
  }
}

/**
 * Record that the user authored a Focus Loop (Shift+drag or inspector Add).
 *
 * Hydration / restores never call this — only intentional creation paths (Phase 3).
 *
 * Dispatches {@link DESKTOP_ONBOARDING_UPDATED_EVENT} with
 * `{ transitionedToComplete: true }` exactly once until storage is cleared.
 */
export function markDesktopFocusLoopCreatedByUser(): void {
  const cur = loadOnboardingDocument();
  if (cur.desktop.focusLoopAuthoringComplete) return;

  patchOnboardingDocument({
    desktop: { focusLoopAuthoringComplete: true },
  });

  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<DesktopOnboardingUpdatedDetail>(
      DESKTOP_ONBOARDING_UPDATED_EVENT,
      { detail: { transitionedToComplete: true } },
    ),
  );
}
