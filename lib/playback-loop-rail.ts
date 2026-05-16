import type { LoopRail, MediaPlaybackSurface } from "@/lib/audio-engine";
import { resolveFocusPlaybackSegment } from "@/lib/focus-playback-segment";
import type { PracticeLoop } from "@/lib/loop-engine";
import { normalizePlaybackScopeSnapshot } from "@/lib/playback/playback-scope-normalization";
import { resolvePlaybackRestartTarget } from "@/lib/playback/restart-target";
import type { LoopPracticeScope } from "@/store/woodshed-store";

/** Fields read from store for loop-boundary playback and restart. */
export type PlaybackLoopRailSnapshot = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  loopPlaybackEnabled: boolean;
  activeSegmentId: string | null;
  loopPracticeScope: LoopPracticeScope;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
};

export function buildPlaybackLoopRail(
  snapshot: PlaybackLoopRailSnapshot,
): LoopRail {
  const normalized = normalizePlaybackScopeSnapshot({
    duration: Number.POSITIVE_INFINITY,
    loops: snapshot.loops,
    activeLoopId: snapshot.activeLoopId,
    activeSegmentId: snapshot.activeSegmentId,
    lastPracticeSegmentIdByPhrase: snapshot.lastPracticeSegmentIdByPhrase,
    loopPlaybackEnabled: snapshot.loopPlaybackEnabled,
    loopPracticeScope: snapshot.loopPracticeScope,
  });
  if (!normalized.loopPlaybackEnabled || !normalized.activeLoopId) {
    return { enabled: false, start: 0, end: Number.POSITIVE_INFINITY };
  }
  const target = snapshot.loops.find((l) => l.id === normalized.activeLoopId);
  if (!target) {
    return { enabled: false, start: 0, end: Number.POSITIVE_INFINITY };
  }
  if (normalized.loopPracticeScope === "practice_region" && target.segments?.length) {
    const seg = resolveFocusPlaybackSegment({
      loop: target,
      activeSegmentId: normalized.activeSegmentId,
      lastPracticeSegmentIdByPhrase: snapshot.lastPracticeSegmentIdByPhrase,
    });
    if (seg && seg.endTime > seg.startTime) {
      return { enabled: true, start: seg.startTime, end: seg.endTime };
    }
  }
  return { enabled: true, start: target.start, end: target.end };
}

/** Seek position for transport restart / replay (phrase start vs focus region start). */
export function getRestartSeekSeconds(args: {
  loop: PracticeLoop;
  loopPracticeScope: LoopPracticeScope;
  activeSegmentId: string | null;
  lastPracticeSegmentIdByPhrase: Record<string, string>;
}): number {
  const resolved = resolvePlaybackRestartTarget({
    duration: args.loop.end,
    loops: [args.loop],
    activeLoopId: args.loop.id,
    activeSegmentId: args.activeSegmentId,
    loopPlaybackEnabled: true,
    loopPracticeScope: args.loopPracticeScope,
    lastPracticeSegmentIdByPhrase: args.lastPracticeSegmentIdByPhrase,
  });
  return resolved.restartTargetSeconds;
}

/**
 * Tight-loop boundary warp shared by WaveSurfer's RAF loop (inline duplicate today)
 * and Phase 5 (`components/youtube-workspace.tsx`).
 *
 * Keeps playback inside `[rail.start, rail.end]` when looping is enabled — identical math,
 * avoids drifting past the phrase/focus end before the next poll.
 */
export function warpPlaybackToLoopRailIfNeeded(
  surface: Pick<MediaPlaybackSurface, "getCurrentTime" | "seek">,
  snapshot: PlaybackLoopRailSnapshot,
): void {
  const rail = buildPlaybackLoopRail(snapshot);
  const t = surface.getCurrentTime();
  if (!rail.enabled || !(rail.end > rail.start)) return;
  if (t >= rail.end || t + 1e-4 < rail.start) {
    surface.seek(rail.start);
  }
}
