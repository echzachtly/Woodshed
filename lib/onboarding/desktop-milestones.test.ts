import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";

import {
  DESKTOP_ONBOARDING_UPDATED_EVENT,
  markDesktopFocusLoopCreatedByUser,
} from "@/lib/onboarding/desktop-milestones";
import {
  CURRENT_ONBOARDING_SCHEMA_VERSION,
  ONBOARDING_STORAGE_KEY,
} from "@/lib/onboarding/schema";
import {
  loadOnboardingDocument,
  patchOnboardingDocument,
} from "@/lib/onboarding/storage";

describe("onboarding/desktop-milestones", () => {
  let store: Map<string, string>;
  let listeners: Record<string, ((e: Event) => void)[]>;

  beforeEach(() => {
    store = new Map<string, string>();
    listeners = {};
    const ls = {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
    } satisfies Storage;

    vi.stubGlobal("window", {
      localStorage: ls,
      dispatchEvent: (e: Event) => {
        const type = e.type;
        listeners[type]?.forEach((fn) => fn(e));
        return true;
      },
      addEventListener: (type: string, fn: EventListener) => {
        listeners[type] = listeners[type] ?? [];
        listeners[type].push(fn as (e: Event) => void);
      },
      removeEventListener: (type: string, fn: EventListener) => {
        const arr = listeners[type];
        if (!arr) return;
        listeners[type] = arr.filter((x) => x !== fn);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("markDesktopFocusLoopCreatedByUser is idempotent + fires transition event once", () => {
    const fired: boolean[] = [];
    window.addEventListener(DESKTOP_ONBOARDING_UPDATED_EVENT, (e) => {
      const d = (e as CustomEvent<{ transitionedToComplete?: boolean }>).detail;
      fired.push(Boolean(d?.transitionedToComplete));
    });

    markDesktopFocusLoopCreatedByUser();
    expect(loadOnboardingDocument().desktop.focusLoopAuthoringComplete).toBe(
      true,
    );
    expect(fired).toEqual([true]);

    markDesktopFocusLoopCreatedByUser();
    expect(fired).toEqual([true]);
  });

  test("does not fire when already complete in storage", () => {
    store.set(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        v: CURRENT_ONBOARDING_SCHEMA_VERSION,
        desktop: { focusLoopAuthoringComplete: true },
        mobile: { practiceIntroductionComplete: false },
      }),
    );
    const fired: boolean[] = [];
    window.addEventListener(DESKTOP_ONBOARDING_UPDATED_EVENT, () => {
      fired.push(true);
    });
    markDesktopFocusLoopCreatedByUser();
    expect(fired).toEqual([]);
  });

  test("patchOnboardingDocument alone does not dispatch event", () => {
    const fired: string[] = [];
    window.addEventListener(DESKTOP_ONBOARDING_UPDATED_EVENT, () => {
      fired.push("evt");
    });
    patchOnboardingDocument({ desktop: { focusLoopAuthoringComplete: true } });
    expect(fired).toEqual([]);
  });
});
