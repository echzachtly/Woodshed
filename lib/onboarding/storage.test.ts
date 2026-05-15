import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import {
  CURRENT_ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
} from "@/lib/onboarding/schema";
import {
  loadOnboardingDocument,
  patchOnboardingDocument,
  saveOnboardingDocument,
} from "@/lib/onboarding/storage";

describe("onboarding/storage", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map<string, string>();
    const ls = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => {
        store.clear();
      },
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
    } satisfies Storage;

    vi.stubGlobal("window", { localStorage: ls });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults when storage empty", () => {
    const doc = loadOnboardingDocument();
    expect(doc.v).toBe(CURRENT_ONBOARDING_SCHEMA_VERSION);
    expect(doc.desktop.focusLoopAuthoringComplete).toBe(false);
    expect(doc.desktop.demoOrientationSeen).toBe(false);
    expect(doc.mobile.practiceIntroductionComplete).toBe(false);
  });

  test("patch merges and persists desktop flag", () => {
    const next = patchOnboardingDocument({
      desktop: { focusLoopAuthoringComplete: true },
    });
    expect(next.desktop.focusLoopAuthoringComplete).toBe(true);
    expect(next.desktop.demoOrientationSeen).toBe(false);
    expect(next.mobile.practiceIntroductionComplete).toBe(false);

    const raw = store.get(ONBOARDING_STORAGE_KEY) ?? null;
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.v).toBe(CURRENT_ONBOARDING_SCHEMA_VERSION);
    expect(parsed.desktop.focusLoopAuthoringComplete).toBe(true);
  });

  test("unknown schema version resets to defaults", () => {
    store.set(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ v: 999, desktop: {}, mobile: {} }),
    );
    const doc = loadOnboardingDocument();
    expect(doc.desktop.focusLoopAuthoringComplete).toBe(false);
    expect(doc.desktop.demoOrientationSeen).toBe(false);
  });

  test("saveOnboardingDocument round-trips mobile flag", () => {
    saveOnboardingDocument({
      v: CURRENT_ONBOARDING_SCHEMA_VERSION,
      desktop: {
        focusLoopAuthoringComplete: false,
        demoOrientationSeen: false,
      },
      mobile: {
        practiceIntroductionComplete: true,
      },
    });
    expect(loadOnboardingDocument().mobile.practiceIntroductionComplete).toBe(
      true,
    );
  });

  test("demo orientation flag persists independently of authoring onboarding", () => {
    patchOnboardingDocument({
      desktop: {
        demoOrientationSeen: true,
        focusLoopAuthoringComplete: false,
      },
    });
    const doc = loadOnboardingDocument();
    expect(doc.desktop.demoOrientationSeen).toBe(true);
    expect(doc.desktop.focusLoopAuthoringComplete).toBe(false);
  });
});
