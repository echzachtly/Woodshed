export {
  CURRENT_ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
  defaultOnboardingDocument,
  type DesktopOnboardingFlagsV1,
  type MobileOnboardingFlagsV1,
  type OnboardingPersistDocumentV1,
  type OnboardingSchemaVersion,
} from "./schema";

export {
  loadOnboardingDocument,
  patchOnboardingDocument,
  saveOnboardingDocument,
  type OnboardingPartialPatch,
} from "./storage";

export {
  DESKTOP_ONBOARDING_UPDATED_EVENT,
  markDesktopFocusLoopCreatedByUser,
  type DesktopOnboardingUpdatedDetail,
} from "./desktop-milestones";

export {
  markDemoOrientationDismissed,
} from "./demo-orientation";

export {
  desktopShowShiftFocusCreationGuidance,
  hasUsablePracticeSection,
  totalFocusSegmentCount,
} from "./triggers";
