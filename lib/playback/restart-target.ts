import { resolveFocusPlaybackSegment } from "@/lib/focus-playback-segment";
import type { PracticeLoop } from "@/lib/loop-engine";
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

function compareLoopsByStartThenId(a: PracticeLoop, b: PracticeLoop): number {
  return a.start - b.start || a.end - b.end || a.id.localeCompare(b.id);
}

function listValidLoops(loops: PracticeLoop[]): PracticeLoop[] {
  return loops
    .filter((loop) => loop.end > loop.start && Number.isFinite(loop.start))
    .slice()
    .sort(compareLoopsByStartThenId);
}

function resolveSegmentIdForLoop(
  loop: PracticeLoop | null,
  segmentId: string | null,
): string | null {
  if (!loop || !segmentId) return null;
  return loop.segments?.some((seg) => seg.id === segmentId) ? segmentId : null;
}

/**
 * Resolve one canonical restart target across desktop/mobile/upload/youtube surfaces.
 * Play Through always restarts from transport start (0), never from stale loop rails.
 */
export function resolvePlaybackRestartTarget(
  snapshot: RestartSnapshot,
): RestartResolution {
  const duration = snapshot.duration;
  const orderedLoops = listValidLoops(snapshot.loops);
  const activeLoop = snapshot.activeLoopId
    ? orderedLoops.find((loop) => loop.id === snapshot.activeLoopId) ?? null
    : null;

  if (!snapshot.loopPlaybackEnabled) {
    return {
      restartTargetSeconds: 0,
      resolvedLoopPlaybackEnabled: false,
      resolvedLoopPracticeScope: "phrase",
      resolvedActiveLoopId: activeLoop?.id ?? null,
      resolvedActiveSegmentId: resolveSegmentIdForLoop(
        activeLoop,
        snapshot.activeSegmentId,
      ),
    };
  }

  const loop = activeLoop ?? orderedLoops[0] ?? null;
  if (!loop) {
    return {
      restartTargetSeconds: clampTime(snapshot.currentTime ?? 0, duration),
      resolvedLoopPlaybackEnabled: false,
      resolvedLoopPracticeScope: "phrase",
      resolvedActiveLoopId: null,
      resolvedActiveSegmentId: null,
    };
  }

  if (snapshot.loopPracticeScope === "practice_region") {
    const seg = resolveFocusPlaybackSegment({
      loop,
      activeSegmentId: snapshot.activeSegmentId,
      lastPracticeSegmentIdByPhrase: snapshot.lastPracticeSegmentIdByPhrase ?? {},
    });
    if (seg && seg.endTime > seg.startTime) {
      return {
        restartTargetSeconds: clampTime(seg.startTime, duration),
        resolvedLoopPlaybackEnabled: true,
        resolvedLoopPracticeScope: "practice_region",
        resolvedActiveLoopId: loop.id,
        resolvedActiveSegmentId: seg.id,
      };
    }
    return {
      restartTargetSeconds: clampTime(loop.start, duration),
      resolvedLoopPlaybackEnabled: true,
      resolvedLoopPracticeScope: "phrase",
      resolvedActiveLoopId: loop.id,
      resolvedActiveSegmentId: null,
    };
  }

  return {
    restartTargetSeconds: clampTime(loop.start, duration),
    resolvedLoopPlaybackEnabled: true,
    resolvedLoopPracticeScope: "phrase",
    resolvedActiveLoopId: loop.id,
    resolvedActiveSegmentId: resolveSegmentIdForLoop(
      loop,
      snapshot.activeSegmentId,
    ),
  };
}
