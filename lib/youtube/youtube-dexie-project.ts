/**
 * Phase 6 — Dexie persistence for YouTube-backed sessions (local-only, dev workspace today).
 *
 * **Persistence strategy:** Reuse `StoredProjectMeta` (`loops`, `activeLoopId`, `practiceStateV1`)
 * with `mediaSource: { kind: "youtube", videoId, canonicalUrl, durationSeconds?, ... }`.
 * Phrase notes live on each {@link PracticeLoop} (`notes`). Optional `minPxPerSecPersist` restores zoom.
 *
 * **What we deliberately never store:** decoded PCM, waveform peaks, cached iframe streams, or any
 * substitute audio blob — playback always re-attaches via the official iframe API (`videoId`).
 *
 * **Cloud note:** Current Supabase paths assume uploaded audio objects; syncing YouTube sessions would
 * require nullable storage + explicit media-source JSON — future work only.
 */

import type { StoredProjectMeta } from "@/lib/project-db";
import { listProjects } from "@/lib/project-db";
import { nanoid } from "@/lib/id";
import type { PracticeLoop } from "@/lib/loop-engine";
import {
  capturePracticeStatePersistV1,
} from "@/lib/practice-state-persist";
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";
import { normalizeMediaSourceFromStoredProject } from "@/lib/woodshed-media-source";
import { activateHydratedProjectState } from "@/lib/persistence/activate-hydrated-project-state";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type ValidatedYoutubeDexieProjectMeta = StoredProjectMeta & {
  mediaSource: Extract<WoodshedMediaSource, { kind: "youtube" }>;
};

export type YoutubeDexieValidateResult =
  | { ok: true; meta: ValidatedYoutubeDexieProjectMeta }
  | { ok: false; reason: string };

/** Narrow + sanitize Dexie rows before hydrating the workspace or listing saved sessions. */
export function validateYoutubeDexieProjectMeta(
  meta: StoredProjectMeta,
): YoutubeDexieValidateResult {
  if (meta.mediaSource?.kind !== "youtube") {
    return { ok: false, reason: "Not a YouTube-backed Dexie row." };
  }
  const normalized = normalizeMediaSourceFromStoredProject(meta);
  if (normalized.kind !== "youtube") {
    return {
      ok: false,
      reason:
        "Corrupt YouTube metadata (missing video id / URL — normalized away).",
    };
  }
  if (meta.blobId) {
    /** Recover legacy/corrupt rows: YouTube sessions never use Dexie audio blobs. */
    const recovered: ValidatedYoutubeDexieProjectMeta = {
      ...meta,
      blobId: undefined,
      mediaSource: normalized,
    };
    return { ok: true, meta: recovered };
  }
  return {
    ok: true,
    meta: { ...meta, mediaSource: normalized } as ValidatedYoutubeDexieProjectMeta,
  };
}

/** Timeline width hint until iframe duration reconciles — max(saved hint, furthest phrase/focus edge). */
export function inferYoutubeTimelineDurationSec(meta: StoredProjectMeta): number {
  let hint = 0;
  const normalized = normalizeMediaSourceFromStoredProject(meta);
  if (
    normalized.kind === "youtube" &&
    normalized.durationSeconds &&
    normalized.durationSeconds > 0
  ) {
    hint = normalized.durationSeconds;
  }
  let maxLoop = 0;
  for (const l of meta.loops ?? []) {
    maxLoop = Math.max(maxLoop, l.start, l.end);
    for (const s of l.segments ?? []) {
      maxLoop = Math.max(maxLoop, s.startTime, s.endTime);
    }
  }
  return Math.max(hint, maxLoop);
}

export type YoutubeDexieCaptureSnapshot = {
  projectId: string | null;
  projectName: string;
  mediaSource: WoodshedMediaSource;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  durationSeconds: number;
  minPxPerSec: number;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
};

/** Dexie row writer — never sets `blobId` (upload FK only). */
export function captureYoutubeDexieProjectPayload(
  snap: YoutubeDexieCaptureSnapshot,
): Omit<StoredProjectMeta, "updatedAt"> {
  if (snap.mediaSource.kind !== "youtube") {
    throw new Error(
      'captureYoutubeDexieProjectPayload: expected mediaSource.kind === "youtube"',
    );
  }
  const id = snap.projectId ?? nanoid();
  const mergedDuration =
    snap.durationSeconds > 0
      ? snap.durationSeconds
      : snap.mediaSource.durationSeconds ?? null;
  return {
    id,
    name: snap.projectName.trim() || "Untitled session",
    loops: snap.loops,
    activeLoopId: snap.activeLoopId,
    practiceStateV1: capturePracticeStatePersistV1({
      loopPlaybackEnabled: snap.loopPlaybackEnabled,
      loopPracticeScope: snap.loopPracticeScope,
      activeSegmentId: snap.activeSegmentId,
      lastPracticeSegmentIdByPhrase: snap.lastPracticeSegmentIdByPhrase,
    }),
    mediaSource: {
      ...snap.mediaSource,
      durationSeconds: mergedDuration,
    },
    minPxPerSecPersist: snap.minPxPerSec,
  };
}

export async function listValidatedYoutubeDexieProjects(): Promise<
  ValidatedYoutubeDexieProjectMeta[]
> {
  const rows = await listProjects();
  const out: ValidatedYoutubeDexieProjectMeta[] = [];
  for (const row of rows) {
    const v = validateYoutubeDexieProjectMeta(row);
    if (v.ok) out.push(v.meta);
  }
  return out;
}

/** Applies Dexie snapshot — mirrors upload hydration ordering from `woodshed-workspace.tsx`. */
export function hydrateYoutubeDexieIntoStore(
  meta: ValidatedYoutubeDexieProjectMeta,
): void {
  activateHydratedProjectState({
    projectId: meta.id,
    projectName: meta.name,
    mediaSource: meta.mediaSource,
    loops: meta.loops,
    activeLoopId: meta.activeLoopId,
    practiceStateV1: meta.practiceStateV1,
    durationSeconds: inferYoutubeTimelineDurationSec(meta),
    minPxPerSecPersist: meta.minPxPerSecPersist,
    preserveInSessionContextOnSameProjectReload: true,
  });
}
