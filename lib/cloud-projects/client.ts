import type { SupabaseClient } from "@supabase/supabase-js";

import {
  WOODSHED_AUDIO_BUCKET,
  audioStoragePath,
} from "@/lib/cloud-projects/constants";
import { formatSupabaseClientError } from "@/lib/cloud-projects/errors";
import type { PhraseSegment, PracticeLoop } from "@/lib/loop-engine";
import type { PracticeStatePersistV1 } from "@/lib/practice-state-persist";

export type CloudProjectSummary = {
  id: string;
  name: string;
  updatedAt: number;
};

type ProjectRow = {
  id: string;
  name: string;
  audio_storage_path: string;
  audio_mime: string;
  active_loop_id: string | null;
  updated_at: string;
  practice_state?: PracticeStatePersistV1 | null;
};

type LoopRow = {
  loop_id: string;
  name: string;
  start_sec: number;
  end_sec: number;
  tempo: number;
  sort_index: number;
  notes?: string | null;
  segments_json?: unknown;
};

function parseSegmentsJson(raw: unknown): PhraseSegment[] {
  if (!Array.isArray(raw)) return [];
  const out: PhraseSegment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const phraseId = typeof o.phraseId === "string" ? o.phraseId : "";
    const name = typeof o.name === "string" ? o.name : "Focus region";
    const startTime =
      typeof o.startTime === "number" && Number.isFinite(o.startTime)
        ? o.startTime
        : 0;
    const endTime =
      typeof o.endTime === "number" && Number.isFinite(o.endTime)
        ? o.endTime
        : startTime;
    const notes = typeof o.notes === "string" ? o.notes : "";
    const createdAt =
      typeof o.createdAt === "number" && Number.isFinite(o.createdAt)
        ? o.createdAt
        : Date.now();
    const updatedAt =
      typeof o.updatedAt === "number" && Number.isFinite(o.updatedAt)
        ? o.updatedAt
        : createdAt;
    if (!id || !phraseId) continue;
    out.push({
      id,
      phraseId,
      name,
      startTime,
      endTime,
      notes,
      createdAt,
      updatedAt,
    });
  }
  return out;
}

function mapLoopRows(rows: LoopRow[]): PracticeLoop[] {
  return [...rows]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((r) => ({
      id: r.loop_id,
      name: r.name,
      start: r.start_sec,
      end: r.end_sec,
      tempo: r.tempo,
      notes: r.notes ?? "",
      segments: parseSegmentsJson(r.segments_json),
    }));
}

export async function listCloudProjectSummaries(
  supabase: SupabaseClient,
): Promise<CloudProjectSummary[]> {
  const { data, error } = await supabase
    .from("woodshed_projects")
    .select("id,name,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(formatSupabaseClientError(error));
  const rows = (data ?? []) as Pick<ProjectRow, "id" | "name" | "updated_at">[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    updatedAt: Date.parse(r.updated_at),
  }));
}

export type CloudProjectPayload = {
  name: string;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  audioBlob: Blob;
  /** Optional saved practice prefs (loop mode, focus selection). */
  practiceStateV1?: PracticeStatePersistV1 | null;
};

/**
 * Creates or updates a cloud project, uploads audio, and replaces loop rows.
 * Returns the cloud project UUID (new or existing).
 */
export async function upsertCloudProject(
  supabase: SupabaseClient,
  userId: string,
  existingCloudProjectId: string | null,
  payload: CloudProjectPayload,
): Promise<string> {
  const mime = payload.audioBlob.type || "application/octet-stream";
  const projectId = existingCloudProjectId ?? crypto.randomUUID();
  const storagePath = audioStoragePath(userId, projectId);

  /** Upload first so we never insert a DB row without storage (or with missing audio). */
  const { error: uploadError } = await supabase.storage
    .from(WOODSHED_AUDIO_BUCKET)
    .upload(storagePath, payload.audioBlob, {
      upsert: true,
      contentType: mime,
    });
  if (uploadError) {
    throw new Error(
      `Storage upload (${WOODSHED_AUDIO_BUCKET} / ${storagePath}): ${formatSupabaseClientError(uploadError)}`,
    );
  }

  if (existingCloudProjectId) {
    const { error } = await supabase
      .from("woodshed_projects")
      .update({
        name: payload.name,
        audio_mime: mime,
        audio_storage_path: storagePath,
        active_loop_id: payload.activeLoopId,
        practice_state: payload.practiceStateV1 ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("user_id", userId);
    if (error) {
      throw new Error(
        `woodshed_projects update: ${formatSupabaseClientError(error)}`,
      );
    }
  } else {
    const { error } = await supabase.from("woodshed_projects").insert({
      id: projectId,
      user_id: userId,
      name: payload.name,
      audio_storage_path: storagePath,
      audio_mime: mime,
      active_loop_id: payload.activeLoopId,
      practice_state: payload.practiceStateV1 ?? null,
    });
    if (error) {
      throw new Error(
        `woodshed_projects insert: ${formatSupabaseClientError(error)}`,
      );
    }
  }

  const { error: delLoopErr } = await supabase
    .from("woodshed_project_loops")
    .delete()
    .eq("project_id", projectId);
  if (delLoopErr) {
    throw new Error(
      `woodshed_project_loops delete: ${formatSupabaseClientError(delLoopErr)}`,
    );
  }

  if (payload.loops.length > 0) {
    const inserts = payload.loops.map((l, i) => ({
      project_id: projectId,
      loop_id: l.id,
      name: l.name,
      start_sec: l.start,
      end_sec: l.end,
      tempo: l.tempo,
      sort_index: i,
      notes: l.notes ?? "",
      segments_json: l.segments ?? [],
    }));
    const { error: insLoopErr } = await supabase
      .from("woodshed_project_loops")
      .insert(inserts);
    if (insLoopErr) {
      throw new Error(
        `woodshed_project_loops insert: ${formatSupabaseClientError(insLoopErr)}`,
      );
    }
  }

  return projectId;
}

export type LoadedCloudProject = {
  id: string;
  name: string;
  updatedAt: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  audioBlob: Blob;
  practiceStateV1?: PracticeStatePersistV1 | null;
};

export async function loadCloudProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<LoadedCloudProject> {
  const { data: proj, error: pErr } = await supabase
    .from("woodshed_projects")
    .select(
      "id,name,updated_at,audio_storage_path,audio_mime,active_loop_id,practice_state",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (pErr) throw new Error(formatSupabaseClientError(pErr));
  if (!proj) throw new Error("Project not found.");

  const row = proj as ProjectRow;

  const { data: loopData, error: lErr } = await supabase
    .from("woodshed_project_loops")
    .select(
      "loop_id,name,start_sec,end_sec,tempo,sort_index,notes,segments_json",
    )
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true });

  if (lErr) throw new Error(formatSupabaseClientError(lErr));

  const { data: file, error: dErr } = await supabase.storage
    .from(WOODSHED_AUDIO_BUCKET)
    .download(row.audio_storage_path);

  if (dErr) {
    throw new Error(
      `Storage download (${WOODSHED_AUDIO_BUCKET} / ${row.audio_storage_path}): ${formatSupabaseClientError(dErr)}`,
    );
  }
  if (!file) throw new Error("Audio download failed.");

  const buf = await file.arrayBuffer();
  const audioBlob = new Blob([buf], {
    type: row.audio_mime || "application/octet-stream",
  });

  const practiceStateRaw = row.practice_state;
  const practiceStateV1 =
    practiceStateRaw &&
    typeof practiceStateRaw === "object" &&
    !Array.isArray(practiceStateRaw) &&
    (practiceStateRaw as { v?: unknown }).v === 1
      ? (practiceStateRaw as PracticeStatePersistV1)
      : null;

  return {
    id: row.id,
    name: row.name,
    updatedAt: Date.parse(row.updated_at),
    loops: mapLoopRows((loopData ?? []) as LoopRow[]),
    activeLoopId: row.active_loop_id,
    audioBlob,
    practiceStateV1,
  };
}
