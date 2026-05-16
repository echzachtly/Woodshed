import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";

export const LAST_ACTIVE_WORKSPACE_STORAGE_KEY =
  "woodshed-last-active-workspace-v1";

export type LastActiveWorkspaceKind = "upload-local" | "youtube-local";

export type LastActiveWorkspacePointer = {
  v: 1;
  projectId: string;
  kind: LastActiveWorkspaceKind;
};

function getLs(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizePointer(raw: unknown): LastActiveWorkspacePointer | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (rec.v !== 1) return null;
  const projectId =
    typeof rec.projectId === "string" ? rec.projectId.trim() : "";
  const kind = rec.kind;
  if (!projectId) return null;
  if (kind !== "upload-local" && kind !== "youtube-local") return null;
  return { v: 1, projectId, kind };
}

export function readLastActiveWorkspacePointer(): LastActiveWorkspacePointer | null {
  const ls = getLs();
  if (!ls) return null;
  try {
    const raw = ls.getItem(LAST_ACTIVE_WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    return normalizePointer(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeLastActiveWorkspacePointer(
  pointer: LastActiveWorkspacePointer,
): void {
  const ls = getLs();
  if (!ls) return;
  try {
    ls.setItem(LAST_ACTIVE_WORKSPACE_STORAGE_KEY, JSON.stringify(pointer));
  } catch {
    /* noop */
  }
}

export function clearLastActiveWorkspacePointer(): void {
  const ls = getLs();
  if (!ls) return;
  try {
    ls.removeItem(LAST_ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function inferLocalWorkspaceKind(
  mediaSource: WoodshedMediaSource,
): LastActiveWorkspaceKind {
  return mediaSource.kind === "youtube" ? "youtube-local" : "upload-local";
}
