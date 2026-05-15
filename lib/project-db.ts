import Dexie, { type Table } from "dexie";

import type { PracticeLoop } from "@/lib/loop-engine";
import type { PracticeStatePersistV1 } from "@/lib/practice-state-persist";
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";

export type StoredProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  /** Audio blob FK */
  blobId?: string | null;
  /** Saved loop mode / focus selection (optional for older saves). */
  practiceStateV1?: PracticeStatePersistV1 | null;
  /**
   * Phase 2 — playback origin discriminator (Dexie).
   * Omitted on legacy rows → normalized to `{ kind: \"upload\", blobId }` at load time.
   */
  mediaSource?: WoodshedMediaSource | null;
  /**
   * Phase 6 — timeline zoom hint for reload (`NeutralTimelinePrototype` / WaveSurfer both use `minPxPerSec`).
   * Upload saves omit this field today — harmless optional metadata.
   */
  minPxPerSecPersist?: number | null;
};

export class WoodshedDexie extends Dexie {
  projects!: Table<StoredProjectMeta>;
  blobs!: Table<{ id: string; mime: string; blob: Blob }>;

  constructor() {
    super("woodshed_db");
    this.version(1).stores({
      projects: "id,name,updatedAt",
      blobs: "id,mime",
    });
  }
}

export const woodshedDexie = new WoodshedDexie();

export async function saveProject(meta: Omit<StoredProjectMeta, "updatedAt">): Promise<void> {
  await woodshedDexie.projects.put({ ...meta, updatedAt: Date.now() });
}

export async function loadProject(id: string): Promise<StoredProjectMeta | undefined> {
  return woodshedDexie.projects.get(id);
}

export async function listProjects(): Promise<StoredProjectMeta[]> {
  const list = await woodshedDexie.projects.orderBy("updatedAt").reverse().toArray();
  return list;
}

export async function saveBlobRecord(id: string, blob: Blob, mime: string) {
  await woodshedDexie.blobs.put({ id, blob, mime });
}

export async function loadBlobRecord(id: string): Promise<Blob | undefined> {
  const row = await woodshedDexie.blobs.get(id);
  return row?.blob;
}

export async function deleteProject(id: string) {
  const row = await woodshedDexie.projects.get(id);
  /** YouTube Dexie rows never own blob rows — skip audio deletion even if `blobId` is corrupt/spurious. */
  const skipBlobDeletion = row?.mediaSource?.kind === "youtube";
  if (!skipBlobDeletion && row?.blobId) {
    await woodshedDexie.blobs.delete(row.blobId);
  }
  await woodshedDexie.projects.delete(id);
}
