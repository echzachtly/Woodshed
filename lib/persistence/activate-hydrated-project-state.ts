"use client";

import type { PracticeLoop } from "@/lib/loop-engine";
import { capturePracticeStatePersistV1, normalizePracticeStatePersistV1 } from "@/lib/practice-state-persist";
import type { PracticeStatePersistV1 } from "@/lib/practice-state-persist";
import type { WoodshedMediaSource } from "@/lib/woodshed-media-source";
import { hasProjectOrMediaContextSwitch } from "@/lib/interaction/practice-edit-mode";
import { useWoodshedStore } from "@/store/woodshed-store";

type ActivateHydratedProjectStateArgs = {
  projectId: string;
  projectName: string;
  mediaSource: WoodshedMediaSource;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  practiceStateV1?: PracticeStatePersistV1 | null;
  durationSeconds?: number;
  minPxPerSecPersist?: number | null;
  /**
   * When same project/media are reloaded and persisted practice prefs are missing,
   * keep valid in-session context instead of aggressively clearing selection/scope.
   */
  preserveInSessionContextOnSameProjectReload?: boolean;
};

export function activateHydratedProjectState(
  args: ActivateHydratedProjectStateArgs,
): void {
  const before = useWoodshedStore.getState();
  const switchState = hasProjectOrMediaContextSwitch({
    previousProjectId: before.projectId,
    nextProjectId: args.projectId,
    previousMediaSource: before.mediaSource,
    nextMediaSource: args.mediaSource,
  });
  const sameProjectAndMedia =
    !switchState.projectSwitched && !switchState.mediaSwitched;
  const preserveSameProjectContext =
    sameProjectAndMedia &&
    (args.preserveInSessionContextOnSameProjectReload ?? true);

  // Invariant: always pass through the store's context-switch cleanup boundary.
  const st = useWoodshedStore.getState();
  st.setProjectMeta(args.projectId, args.projectName, args.mediaSource);
  if (typeof args.durationSeconds === "number" && Number.isFinite(args.durationSeconds)) {
    st.setDuration(Math.max(0, args.durationSeconds));
  }
  const px = args.minPxPerSecPersist;
  if (typeof px === "number" && Number.isFinite(px) && px > 0) {
    st.setMinPxPerSec(px);
  }
  if (!preserveSameProjectContext) {
    st.setCurrentTime(0);
    st.setPlaying(false);
  }

  // Invariant: all ingest paths activate loops via the same upsert/select sequence.
  st.upsertLoops(args.loops);
  const activeLoopFromSnapshot =
    args.activeLoopId && args.loops.some((l) => l.id === args.activeLoopId)
      ? args.activeLoopId
      : null;
  const activeLoopFromSession =
    preserveSameProjectContext &&
    before.activeLoopId &&
    args.loops.some((l) => l.id === before.activeLoopId)
      ? before.activeLoopId
      : null;
  const resolvedActiveLoopId =
    activeLoopFromSession ??
    activeLoopFromSnapshot ??
    args.loops[0]?.id ??
    null;
  st.selectLoop(resolvedActiveLoopId);

  // Invariant: all persisted/same-session practice scope enters via one normalizer.
  const persistedPractice = args.practiceStateV1 ?? null;
  const inSessionFallback =
    !persistedPractice && preserveSameProjectContext
      ? capturePracticeStatePersistV1({
          loopPlaybackEnabled: before.loopPlaybackEnabled,
          loopPracticeScope: before.loopPracticeScope,
          activeSegmentId: before.activeSegmentId,
          lastPracticeSegmentIdByPhrase: before.lastPracticeSegmentIdByPhrase,
        })
      : null;
  const rawPractice = persistedPractice ?? inSessionFallback;
  if (!rawPractice) return;
  const afterSelect = useWoodshedStore.getState();
  const normalized = normalizePracticeStatePersistV1(
    rawPractice,
    afterSelect.loops,
    afterSelect.activeLoopId,
  );
  if (!normalized) return;
  useWoodshedStore.getState().applyHydratedPracticePreferences(normalized);
}
