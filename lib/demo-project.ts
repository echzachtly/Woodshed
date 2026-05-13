import { clampTempo, type PracticeLoop } from "@/lib/loop-engine";

/** Fixed id in `public/demo/demo-project.json` — used to show the Demo label. */
export const DEMO_PROJECT_ID = "demo-project";

export const DEMO_PROJECT_JSON_PATH = "/demo/demo-project.json";

/** Shown in the session picker before JSON is fetched, and as JSON `title` fallback. */
export const DEMO_PROJECT_DISPLAY_FALLBACK = "Demo Blues Practice Project";

export type DemoLoopJson = {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  /** Playback tempo as UI percent (25–150), e.g. 100 = normal speed. */
  tempo?: number;
  index?: number;
};

export type DemoProjectJsonFile = {
  id: string;
  title: string;
  audioUrl: string;
  activeLoopId: string;
  loops: DemoLoopJson[];
};

export type PendingDemoHydration = {
  projectId: string;
  title: string;
  audioUrl: string;
  loopRows: DemoLoopJson[];
  activeLoopId: string;
};

function jsonTempoToMultiplier(tempo: unknown): number {
  if (typeof tempo !== "number" || !Number.isFinite(tempo)) return 1;
  /** Values like 75 or 100 are treated as UI percent; multipliers stay ≤ 1.5. */
  if (tempo > 4) return clampTempo(tempo / 100);
  return clampTempo(tempo);
}

export function demoRowsToPracticeLoops(
  rows: DemoLoopJson[],
  duration: number,
): PracticeLoop[] {
  const d = Number.isFinite(duration) && duration > 0 ? duration : 1e9;
  return rows.map((row, index) => {
    const start = Math.max(0, Math.min(row.startTime, row.endTime, d));
    const end = Math.max(
      start + 0.05,
      Math.min(Math.max(row.startTime, row.endTime), d),
    );
    return {
      id: row.id,
      name: row.name || `Section ${index + 1}`,
      start,
      end,
      tempo: jsonTempoToMultiplier(row.tempo),
    };
  });
}

export function parseDemoProjectFile(raw: unknown): PendingDemoHydration | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : DEMO_PROJECT_ID;
  const title =
    typeof o.title === "string" ? o.title : DEMO_PROJECT_DISPLAY_FALLBACK;
  const audioUrl = typeof o.audioUrl === "string" ? o.audioUrl : "";
  const activeLoopId =
    typeof o.activeLoopId === "string" ? o.activeLoopId : "";
  if (!audioUrl || !Array.isArray(o.loops) || o.loops.length === 0) {
    return null;
  }
  const loopRows = o.loops as DemoLoopJson[];
  for (const row of loopRows) {
    if (
      typeof row.id !== "string" ||
      typeof row.startTime !== "number" ||
      typeof row.endTime !== "number"
    ) {
      return null;
    }
  }
  return {
    projectId: id,
    title,
    audioUrl,
    loopRows,
    activeLoopId,
  };
}

export type ExportedLoopJson = {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  tempo: number;
};

export function loopsToExportJson(loops: PracticeLoop[]): ExportedLoopJson[] {
  return loops.map((l) => ({
    id: l.id,
    name: l.name,
    startTime: Math.round(l.start * 1000) / 1000,
    endTime: Math.round(l.end * 1000) / 1000,
    tempo: Math.round(l.tempo * 100),
  }));
}

export function formatLoopsJsonForClipboard(loops: PracticeLoop[]): string {
  return JSON.stringify(loopsToExportJson(loops), null, 2);
}

/** Load bundled demo audio from `public/` (served at `audioUrl`). Does not synthesize audio. */
export async function resolveDemoAudioBlob(audioUrl: string): Promise<Blob> {
  const trimmed = audioUrl.trim();
  if (!trimmed) {
    throw new Error("Demo project JSON is missing audioUrl");
  }
  const res = await fetch(trimmed, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Demo audio not found (${trimmed}): HTTP ${res.status}. From repo root, run: npm run sync:demo-audio`,
    );
  }
  return res.blob();
}
