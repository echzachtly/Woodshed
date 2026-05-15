/**
 * Loads the official YouTube IFrame Player API (`iframe_api`) exactly once per page.
 *
 * - Single `<script src="https://www.youtube.com/iframe_api">` injection (deduped via DOM query).
 * - Chains `window.onYouTubeIframeAPIReady` without wiping prior callbacks.
 * - Multiple concurrent `loadYoutubeIframeApi()` callers share one readiness flush.
 *
 * Does **not** remove injected scripts on teardown — matches typical SPA/embed patterns.
 */

const IFRAME_API_SRC = "https://www.youtube.com/iframe_api";

let hookInstalled = false;

/** Pending continuations invoked when `onYouTubeIframeAPIReady` fires. */
let pendingReadyCallbacks: Array<() => void> = [];

function flushPendingReadyCallbacks(): void {
  const batch = pendingReadyCallbacks;
  pendingReadyCallbacks = [];
  for (const fn of batch) {
    fn();
  }
}

function ensureYoutubeIframeApiGlobalHook(): void {
  if (hookInstalled || typeof window === "undefined") return;
  hookInstalled = true;
  const w = window;
  const previous = w.onYouTubeIframeAPIReady;
  w.onYouTubeIframeAPIReady = () => {
    try {
      previous?.();
    } finally {
      flushPendingReadyCallbacks();
    }
  };
}

/** Vitest helper — resets internal queues (cannot unload third-party scripts). */
export function resetYoutubeIframeApiLoaderForTests(): void {
  hookInstalled = false;
  pendingReadyCallbacks = [];
}

export function loadYoutubeIframeApi(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("YouTube IFrame API can only load in a browser environment."),
    );
  }

  const w = window;
  if (w.YT?.Player) return Promise.resolve();

  ensureYoutubeIframeApiGlobalHook();

  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      if (w.YT?.Player) resolve();
      else {
        reject(
          new Error(
            "YouTube iframe_api signaled ready but `YT.Player` is unavailable.",
          ),
        );
      }
    };

    pendingReadyCallbacks.push(finish);

    const existing = document.querySelector(
      `script[src="${IFRAME_API_SRC}"]`,
    ) as HTMLScriptElement | null;

    if (!existing) {
      const tag = document.createElement("script");
      tag.src = IFRAME_API_SRC;
      tag.async = true;
      tag.onerror = () => {
        pendingReadyCallbacks = pendingReadyCallbacks.filter((fn) => fn !== finish);
        reject(new Error("Failed to load youtube.com/iframe_api script."));
      };
      document.head.appendChild(tag);
    }
  });
}
