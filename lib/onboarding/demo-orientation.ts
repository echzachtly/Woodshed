import { patchOnboardingDocument } from "./storage";

/** Persists device-local dismissal of the demo project orientation ribbon. */
export function markDemoOrientationDismissed(): void {
  patchOnboardingDocument({ desktop: { demoOrientationSeen: true } });
}
