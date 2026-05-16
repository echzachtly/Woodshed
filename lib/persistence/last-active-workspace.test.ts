import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  LAST_ACTIVE_WORKSPACE_STORAGE_KEY,
  clearLastActiveWorkspacePointer,
  inferLocalWorkspaceKind,
  readLastActiveWorkspacePointer,
  writeLastActiveWorkspacePointer,
} from "@/lib/persistence/last-active-workspace";

describe("persistence/last-active-workspace", () => {
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

  test("round-trips a valid upload-local pointer", () => {
    writeLastActiveWorkspacePointer({
      v: 1,
      projectId: "proj-123",
      kind: "upload-local",
    });
    expect(readLastActiveWorkspacePointer()).toEqual({
      v: 1,
      projectId: "proj-123",
      kind: "upload-local",
    });
  });

  test("rejects malformed payloads", () => {
    store.set(
      LAST_ACTIVE_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ v: 1, projectId: "", kind: "upload-local" }),
    );
    expect(readLastActiveWorkspacePointer()).toBeNull();

    store.set(
      LAST_ACTIVE_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ v: 1, projectId: "p", kind: "cloud" }),
    );
    expect(readLastActiveWorkspacePointer()).toBeNull();

    store.set(LAST_ACTIVE_WORKSPACE_STORAGE_KEY, JSON.stringify({ v: 99 }));
    expect(readLastActiveWorkspacePointer()).toBeNull();
  });

  test("clear removes stored pointer", () => {
    writeLastActiveWorkspacePointer({
      v: 1,
      projectId: "yt-1",
      kind: "youtube-local",
    });
    clearLastActiveWorkspacePointer();
    expect(store.has(LAST_ACTIVE_WORKSPACE_STORAGE_KEY)).toBe(false);
    expect(readLastActiveWorkspacePointer()).toBeNull();
  });

  test("infers local workspace kind from media source", () => {
    expect(
      inferLocalWorkspaceKind({
        kind: "upload",
        blobId: "blob-a",
        fileName: "a.mp3",
        mimeType: "audio/mpeg",
      }),
    ).toBe("upload-local");
    expect(
      inferLocalWorkspaceKind({
        kind: "youtube",
        videoId: "abc",
        canonicalUrl: "https://youtu.be/abc",
      }),
    ).toBe("youtube-local");
  });
});
