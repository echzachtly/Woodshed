import { resolveFocusPlaybackSegment } from "@/lib/focus-playback-segment";
import type { PracticeLoop } from "@/lib/loop-engine";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type PlaybackScopeNormalizationReason =
  | "repeat_off_forces_play_through"
  | "no_valid_loops_disables_repeat"
  | "active_loop_fell_back_to_first_valid"
  | "active_segment_cleared_invalid"
  | "focus_scope_degraded_to_phrase";

export type PlaybackScopeNormalizationSnapshot = {
  duration: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  /** Per-phrase last-used focus ids from store/persistence snapshots. */
  lastPracticeSegmentIdByPhrase?: Record<string, string>;
  /** Optional per-loop last-used focus id for narrow callsites. */
  lastUsedSegmentId?: string | null;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
};

export type PlaybackScopeNormalizationResult = {
  activeLoopId: string | null;
  activeSegmentId: string | null;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  reasons: PlaybackScopeNormalizationReason[];
};

function compareLoopsByStartThenId(a: PracticeLoop, b: PracticeLoop): number {
  return a.start - b.start || a.end - b.end || a.id.localeCompare(b.id);
}

function listValidLoops(loops: PracticeLoop[]): PracticeLoop[] {
  return loops
    .filter((loop) => loop.end > loop.start && Number.isFinite(loop.start))
    .slice()
    .sort(compareLoopsByStartThenId);
}

/**
 * Canonical playback scope normalization for stale ids and invalid scope combinations.
 * This helper is pure and can run in deletion, hydration, restart, and project-switch flows.
 */
export function normalizePlaybackScopeSnapshot(
  snapshot: PlaybackScopeNormalizationSnapshot,
): PlaybackScopeNormalizationResult {
  const reasons: PlaybackScopeNormalizationReason[] = [];
  const validLoops = listValidLoops(snapshot.loops);
  const requestedLoop = snapshot.activeLoopId
    ? validLoops.find((loop) => loop.id === snapshot.activeLoopId) ?? null
    : null;

  let activeLoop = requestedLoop ?? null;
  if (!activeLoop && validLoops.length > 0) {
    activeLoop = validLoops[0] ?? null;
    reasons.push("active_loop_fell_back_to_first_valid");
  }

  if (!snapshot.loopPlaybackEnabled) {
    reasons.push("repeat_off_forces_play_through");
    const activeSegmentId =
      activeLoop && snapshot.activeSegmentId
        ? (activeLoop.segments?.some((seg) => seg.id === snapshot.activeSegmentId)
            ? snapshot.activeSegmentId
            : null)
        : null;
    if (snapshot.activeSegmentId && !activeSegmentId) {
      reasons.push("active_segment_cleared_invalid");
    }
    return {
      activeLoopId: activeLoop?.id ?? null,
      activeSegmentId,
      loopPlaybackEnabled: false,
      loopPracticeScope: "phrase",
      reasons,
    };
  }

  if (!activeLoop) {
    reasons.push("no_valid_loops_disables_repeat");
    return {
      activeLoopId: null,
      activeSegmentId: null,
      loopPlaybackEnabled: false,
      loopPracticeScope: "phrase",
      reasons,
    };
  }

  if (snapshot.loopPracticeScope === "practice_region") {
    const lastIdFromMap = snapshot.lastPracticeSegmentIdByPhrase?.[activeLoop.id];
    const lastUsedSegmentId = snapshot.lastUsedSegmentId ?? lastIdFromMap;
    const resolvedFocus = resolveFocusPlaybackSegment({
      loop: activeLoop,
      activeSegmentId: snapshot.activeSegmentId,
      lastPracticeSegmentIdByPhrase: lastUsedSegmentId
        ? { [activeLoop.id]: lastUsedSegmentId }
        : {},
    });
    if (resolvedFocus && resolvedFocus.endTime > resolvedFocus.startTime) {
      return {
        activeLoopId: activeLoop.id,
        activeSegmentId: resolvedFocus.id,
        loopPlaybackEnabled: true,
        loopPracticeScope: "practice_region",
        reasons,
      };
    }
    reasons.push("focus_scope_degraded_to_phrase");
    if (snapshot.activeSegmentId) {
      reasons.push("active_segment_cleared_invalid");
    }
    return {
      activeLoopId: activeLoop.id,
      activeSegmentId: null,
      loopPlaybackEnabled: true,
      loopPracticeScope: "phrase",
      reasons,
    };
  }

  const activeSegmentId = snapshot.activeSegmentId
    ? (activeLoop.segments?.some((seg) => seg.id === snapshot.activeSegmentId)
        ? snapshot.activeSegmentId
        : null)
    : null;
  if (snapshot.activeSegmentId && !activeSegmentId) {
    reasons.push("active_segment_cleared_invalid");
  }
  return {
    activeLoopId: activeLoop.id,
    activeSegmentId,
    loopPlaybackEnabled: true,
    loopPracticeScope: "phrase",
    reasons,
  };
}
