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
  normalizePracticeStatePersistV1,
} from "@/lib/practice-state-persist";
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";
import { normalizeMediaSourceFromStoredProject } from "@/lib/woodshed-media-source";
import type { LoopPracticeScope } from "@/store/woodshed-store";
import { useWoodshedStore } from "@/store/woodshed-store";

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
    return {
      ok: false,
      reason:
        "Mixed Dexie row: `blobId` present alongside YouTube media — refusing to load.",
    };
  }
  return { ok: true, meta: { ...meta, mediaSource: normalized } };
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
  const st = useWoodshedStore.getState();
  st.setProjectMeta(meta.id, meta.name, meta.mediaSource);
  st.setDuration(inferYoutubeTimelineDurationSec(meta));
  const px = meta.minPxPerSecPersist;
  if (typeof px === "number" && Number.isFinite(px) && px > 0) {
    st.setMinPxPerSec(px);
  }
  st.setCurrentTime(0);
  st.setPlaying(false);
  st.upsertLoops(meta.loops);
  const active =
    meta.activeLoopId && meta.loops.some((l) => l.id === meta.activeLoopId)
      ? meta.activeLoopId
      : meta.loops[0]?.id ?? null;
  if (active) {
    st.selectLoop(active);
  } else {
    st.selectLoop(null);
  }
  const rawPractice = meta.practiceStateV1;
  if (rawPractice != null) {
    const normalized = normalizePracticeStatePersistV1(
      rawPractice,
      meta.loops,
      active,
    );
    if (normalized) {
      st.applyHydratedPracticePreferences(normalized);
    }
  }
}
