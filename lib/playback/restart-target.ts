import type { PracticeLoop } from "@/lib/loop-engine";
import { normalizePlaybackScopeSnapshot } from "@/lib/playback/playback-scope-normalization";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type RestartSnapshot = {
  duration: number;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  activeSegmentId: string | null;
  loopPlaybackEnabled: boolean;
  loopPracticeScope: LoopPracticeScope;
  lastPracticeSegmentIdByPhrase?: Record<string, string>;
  currentTime?: number;
};

export type RestartResolution = {
  restartTargetSeconds: number;
  resolvedLoopPlaybackEnabled: boolean;
  resolvedLoopPracticeScope: LoopPracticeScope;
  resolvedActiveLoopId: string | null;
  resolvedActiveSegmentId: string | null;
};

function clampTime(value: number, duration: number): number {
  if (!(duration > 0)) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.min(duration, Math.max(0, value));
}

/**
 * Resolve one canonical restart target across desktop/mobile/upload/youtube surfaces.
 * Play Through always restarts from transport start (0), never from stale loop rails.
 */
export function resolvePlaybackRestartTarget(
  snapshot: RestartSnapshot,
): RestartResolution {
  const duration = snapshot.duration;
  const normalized = normalizePlaybackScopeSnapshot({
    duration: snapshot.duration,
    loops: snapshot.loops,
    activeLoopId: snapshot.activeLoopId,
    activeSegmentId: snapshot.activeSegmentId,
    lastPracticeSegmentIdByPhrase: snapshot.lastPracticeSegmentIdByPhrase,
    loopPlaybackEnabled: snapshot.loopPlaybackEnabled,
    loopPracticeScope: snapshot.loopPracticeScope,
  });
  if (!normalized.loopPlaybackEnabled) {
    const hasValidLoops = snapshot.loops.some(
      (loop) => loop.end > loop.start && Number.isFinite(loop.start),
    );
    if (hasValidLoops) {
      return {
        restartTargetSeconds: 0,
        resolvedLoopPlaybackEnabled: normalized.loopPlaybackEnabled,
        resolvedLoopPracticeScope: normalized.loopPracticeScope,
        resolvedActiveLoopId: normalized.activeLoopId,
        resolvedActiveSegmentId: normalized.activeSegmentId,
      };
    }
    return {
      restartTargetSeconds: clampTime(snapshot.currentTime ?? 0, duration),
      resolvedLoopPlaybackEnabled: normalized.loopPlaybackEnabled,
      resolvedLoopPracticeScope: normalized.loopPracticeScope,
      resolvedActiveLoopId: normalized.activeLoopId,
      resolvedActiveSegmentId: normalized.activeSegmentId,
    };
  }

  const loop =
    normalized.activeLoopId != null
      ? snapshot.loops.find((candidate) => candidate.id === normalized.activeLoopId) ??
        null
      : null;
  if (!loop) {
    return {
      restartTargetSeconds: clampTime(snapshot.currentTime ?? 0, duration),
      resolvedLoopPlaybackEnabled: false,
      resolvedLoopPracticeScope: "phrase",
      resolvedActiveLoopId: null,
      resolvedActiveSegmentId: null,
    };
  }

  if (normalized.loopPracticeScope === "practice_region" && normalized.activeSegmentId) {
    const seg = loop.segments?.find(
      (candidate) => candidate.id === normalized.activeSegmentId,
    );
    if (seg && seg.endTime > seg.startTime) {
      return {
        restartTargetSeconds: clampTime(seg.startTime, duration),
        resolvedLoopPlaybackEnabled: normalized.loopPlaybackEnabled,
        resolvedLoopPracticeScope: normalized.loopPracticeScope,
        resolvedActiveLoopId: normalized.activeLoopId,
        resolvedActiveSegmentId: normalized.activeSegmentId,
      };
    }
  }
  return {
    restartTargetSeconds: clampTime(loop.start, duration),
    resolvedLoopPlaybackEnabled: normalized.loopPlaybackEnabled,
    resolvedLoopPracticeScope: normalized.loopPracticeScope,
    resolvedActiveLoopId: normalized.activeLoopId,
    resolvedActiveSegmentId: normalized.activeSegmentId,
  };
}
