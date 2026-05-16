import {
  resolveNeutralTimelineHit,
  resolveTimelinePlaybackIntent,
  type NeutralTimelineHit,
} from "@/lib/interaction/timeline-playback-intent";
import { useWoodshedStore } from "@/store/woodshed-store";

export type { NeutralTimelineHit };
export { resolveNeutralTimelineHit };

/**
 * YouTube synthetic timeline: interpret a tap at `sec` for loop-mode + selection.
 * Caller is responsible for seeking the media surface and `setCurrentTime`.
 */
export function applyYoutubeNeutralTimelinePlaybackIntent(sec: number): void {
  const st = useWoodshedStore.getState();
  const decision = resolveTimelinePlaybackIntent(
    {
      duration: st.duration,
      loops: st.loops,
      activeLoopId: st.activeLoopId,
      activeSegmentId: st.activeSegmentId,
      loopPlaybackEnabled: st.loopPlaybackEnabled,
      loopPracticeScope: st.loopPracticeScope,
    },
    sec,
  );
  if (!decision) return;
  if (decision.selectLoopId) {
    st.selectLoop(decision.selectLoopId);
  }
  if (decision.selectSegment) {
    st.selectSegment(
      decision.selectSegment.phraseId,
      decision.selectSegment.segmentId,
    );
  }
  if (decision.setLoopPracticeScope) {
    st.setLoopPracticeScope(decision.setLoopPracticeScope);
  }
  if (decision.setLoopPlaybackEnabled !== undefined) {
    st.setLoopPlaybackEnabled(decision.setLoopPlaybackEnabled);
  }
}
