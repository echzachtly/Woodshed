import type { LoopPracticeScope } from "@/store/woodshed-store";
import type { PracticeLoop } from "@/lib/loop-engine";
import { normalizePlaybackScopeSnapshot } from "@/lib/playback/playback-scope-normalization";

/** Versioned blob stored on `StoredProjectMeta` / cloud `practice_state`. */
export type PracticeStatePersistV1 = {
  v: 1;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
};

export function capturePracticeStatePersistV1(args: {
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
}): PracticeStatePersistV1 {
  return {
    v: 1,
    loopPlaybackEnabled: args.loopPlaybackEnabled,
    loopPracticeScope: args.loopPracticeScope,
    activeSegmentId: args.activeSegmentId,
    lastPracticeSegmentIdByPhrase: { ...args.lastPracticeSegmentIdByPhrase },
  };
}

function pruneLastPracticeMap(
  map: Record<string, string>,
  loops: PracticeLoop[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [phraseId, segId] of Object.entries(map)) {
    const loop = loops.find((l) => l.id === phraseId);
    if (!loop?.segments?.some((s) => s.id === segId)) continue;
    out[phraseId] = segId;
  }
  return out;
}

function inferDurationFromLoops(loops: PracticeLoop[]): number {
  let max = 0;
  for (const loop of loops) {
    max = Math.max(max, loop.start, loop.end);
    for (const seg of loop.segments ?? []) {
      max = Math.max(max, seg.startTime, seg.endTime);
    }
  }
  return max;
}

/**
 * Validates persisted practice prefs against loaded loops.
 * Returns a patch safe to merge via `applyHydratedPracticePreferences`, or null to skip.
 */
export function normalizePracticeStatePersistV1(
  raw: unknown,
  loops: PracticeLoop[],
  activeLoopId: string | null,
): Omit<PracticeStatePersistV1, "v"> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const loopPlaybackEnabled = o.loopPlaybackEnabled === true;
  const scopeRaw = o.loopPracticeScope;
  const loopPracticeScope: LoopPracticeScope =
    scopeRaw === "practice_region" ? "practice_region" : "phrase";
  const activeSegmentId =
    typeof o.activeSegmentId === "string" ? o.activeSegmentId : null;
  const lastIn = o.lastPracticeSegmentIdByPhrase;
  const lastPracticeSegmentIdByPhrase =
    lastIn && typeof lastIn === "object" && !Array.isArray(lastIn)
      ? pruneLastPracticeMap(lastIn as Record<string, string>, loops)
      : {};

  const normalized = normalizePlaybackScopeSnapshot({
    duration: inferDurationFromLoops(loops),
    loops,
    activeLoopId,
    activeSegmentId,
    lastPracticeSegmentIdByPhrase,
    loopPlaybackEnabled,
    loopPracticeScope,
  });

  return {
    loopPlaybackEnabled: normalized.loopPlaybackEnabled,
    loopPracticeScope: normalized.loopPracticeScope,
    activeSegmentId: normalized.activeSegmentId,
    lastPracticeSegmentIdByPhrase,
  };
}
