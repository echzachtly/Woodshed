import type { PracticeLoop } from "@/lib/loop-engine";
import type { LoopPracticeScope } from "@/store/woodshed-store";
import { useWoodshedStore } from "@/store/woodshed-store";

export type NeutralTimelineHit =
  | { kind: "gap" }
  | { kind: "phrase"; phraseId: string }
  | { kind: "focus"; phraseId: string; segmentId: string };

/**
 * Map a song time to the narrowest containing phrase (smallest span wins on overlap)
 * and the narrowest containing Focus Loop if any.
 */
export function resolveNeutralTimelineHit(
  t: number,
  loops: PracticeLoop[],
): NeutralTimelineHit {
  const hits = loops.filter(
    (l) => l.end > l.start && t >= l.start && t <= l.end,
  );
  if (!hits.length) return { kind: "gap" };
  const loop = [...hits].sort(
    (a, b) => a.end - a.start - (b.end - b.start),
  )[0]!;
  const segs = loop.segments ?? [];
  const segHits = segs.filter(
    (s) => t >= s.startTime && t <= s.endTime,
  );
  if (!segHits.length) return { kind: "phrase", phraseId: loop.id };
  const seg = [...segHits].sort(
    (a, b) => a.endTime - a.startTime - (b.endTime - b.startTime),
  )[0]!;
  return { kind: "focus", phraseId: loop.id, segmentId: seg.id };
}

function timeInPhraseBounds(
  loop: PracticeLoop | undefined,
  t: number,
): boolean {
  return Boolean(loop && t >= loop.start && t <= loop.end);
}

function timeInSegmentBounds(
  seg: { startTime: number; endTime: number } | undefined,
  t: number,
): boolean {
  return Boolean(seg && t >= seg.startTime && t <= seg.endTime);
}

/**
 * YouTube synthetic timeline: interpret a tap at `sec` for loop-mode + selection.
 * Caller is responsible for seeking the media surface and `setCurrentTime`.
 */
export function applyYoutubeNeutralTimelinePlaybackIntent(sec: number): void {
  const st = useWoodshedStore.getState();
  const duration = st.duration;
  if (!(duration > 0)) return;
  const t = Math.min(Math.max(sec, 0), duration);
  const hit = resolveNeutralTimelineHit(t, st.loops);

  const activeLoop =
    st.activeLoopId != null
      ? st.loops.find((l) => l.id === st.activeLoopId)
      : undefined;
  const activeSeg = activeLoop?.segments?.find(
    (s) => s.id === st.activeSegmentId,
  );

  const inActivePhrase = timeInPhraseBounds(activeLoop, t);
  const inActiveFocus = timeInSegmentBounds(activeSeg, t);

  const loopPlaybackEnabled = st.loopPlaybackEnabled;
  const loopPracticeScope: LoopPracticeScope = st.loopPracticeScope;

  const loopSectionMode =
    loopPlaybackEnabled && loopPracticeScope === "phrase";
  const focusLoopMode =
    loopPlaybackEnabled && loopPracticeScope === "practice_region";

  if (!loopPlaybackEnabled) {
    if (hit.kind === "gap") return;
    if (hit.kind === "phrase") {
      st.selectLoop(hit.phraseId);
      st.setLoopPlaybackEnabled(false);
      return;
    }
    st.selectSegment(hit.phraseId, hit.segmentId);
    st.setLoopPlaybackEnabled(false);
    return;
  }

  if (loopSectionMode) {
    if (!inActivePhrase) {
      if (hit.kind === "phrase") st.selectLoop(hit.phraseId);
      else if (hit.kind === "focus") {
        st.selectSegment(hit.phraseId, hit.segmentId);
      }
      st.setLoopPlaybackEnabled(false);
      return;
    }
    if (
      hit.kind === "focus" &&
      hit.phraseId === st.activeLoopId &&
      st.activeLoopId != null
    ) {
      st.selectSegment(hit.phraseId, hit.segmentId);
      st.setLoopPracticeScope("practice_region");
      return;
    }
    return;
  }

  if (focusLoopMode) {
    if (!inActivePhrase) {
      if (hit.kind === "phrase") st.selectLoop(hit.phraseId);
      else if (hit.kind === "focus") {
        st.selectSegment(hit.phraseId, hit.segmentId);
      }
      st.setLoopPlaybackEnabled(false);
      return;
    }
    if (
      inActiveFocus &&
      hit.kind === "focus" &&
      hit.segmentId === st.activeSegmentId
    ) {
      return;
    }
    if (
      hit.kind === "focus" &&
      hit.phraseId === st.activeLoopId &&
      st.activeLoopId != null
    ) {
      st.selectSegment(hit.phraseId, hit.segmentId);
      st.setLoopPracticeScope("practice_region");
      return;
    }
    st.setLoopPracticeScope("phrase");
  }
}
