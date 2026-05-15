/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  loadYoutubeIframeApi,
  resetYoutubeIframeApiLoaderForTests,
} from "@/lib/youtube/load-youtube-iframe-api";

describe("loadYoutubeIframeApi", () => {
  beforeEach(() => {
    resetYoutubeIframeApiLoaderForTests();
    delete window.onYouTubeIframeAPIReady;
    Reflect.deleteProperty(window, "YT");
    document
      .querySelectorAll('script[src="https://www.youtube.com/iframe_api"]')
      .forEach((el) => el.remove());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("resolves immediately when YT.Player already exists", async () => {
    (
      window as unknown as {
        YT: { Player: new (...args: unknown[]) => unknown };
      }
    ).YT = {
      Player: class Mock {},
    };

    await expect(loadYoutubeIframeApi()).resolves.toBeUndefined();
  });

  test("injects iframe_api script once and resolves after ready callback", async () => {
    const appendSpy = vi.spyOn(document.head, "appendChild");

    const p = loadYoutubeIframeApi();

    expect(appendSpy.mock.calls.some((c) => c[0] instanceof HTMLScriptElement)).toBe(
      true,
    );

    (
      window as unknown as {
        YT: { Player: new (...args: unknown[]) => unknown };
      }
    ).YT = {
      Player: class Mock {},
    };

    window.onYouTubeIframeAPIReady?.();

    await expect(p).resolves.toBeUndefined();

    /** Second call should not inject another script */
    appendSpy.mockClear();
    await expect(loadYoutubeIframeApi()).resolves.toBeUndefined();
    expect(
      appendSpy.mock.calls.filter((c) => c[0] instanceof HTMLScriptElement).length,
    ).toBe(0);
  });

  test("rejects when script fails to load", async () => {
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      const el = node as HTMLScriptElement;
      if (el.tagName === "SCRIPT" && el.src.includes("youtube.com")) {
        queueMicrotask(() => el.onerror?.(new Event("error")));
      }
      return node;
    });

    (
      window as unknown as {
        YT?: unknown;
      }
    ).YT = undefined;

    await expect(loadYoutubeIframeApi()).rejects.toThrow(/Failed to load/);
  });
});
