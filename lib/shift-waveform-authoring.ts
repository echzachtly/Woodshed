import type { PracticeLoop } from "@/lib/loop-engine";

const CONTAIN_EPS = 1e-3;

/**
 * Desktop Shift+drag authoring: when the drag range lies fully inside the
 * active phrase, create a focus segment; otherwise create a new phrase.
 */
export function shiftDragShouldCreateFocusInsideActivePhrase(
  activeLoop: PracticeLoop | undefined,
  dragStartSec: number,
  dragEndSec: number,
): boolean {
  if (!activeLoop || activeLoop.end <= activeLoop.start) return false;
  const lo = Math.min(dragStartSec, dragEndSec);
  const hi = Math.max(dragStartSec, dragEndSec);
  return (
    lo >= activeLoop.start - CONTAIN_EPS && hi <= activeLoop.end + CONTAIN_EPS
  );
}

/** Map pointer X to song seconds (matches waveform hover logic in workspace). */
export function pointerClientXToSongSeconds(args: {
  clientX: number;
  scrollContainer: HTMLElement;
  wrapper: HTMLElement;
  durationSec: number;
}): number {
  const { clientX, scrollContainer, wrapper, durationSec } = args;
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0;
  const scRect = scrollContainer.getBoundingClientRect();
  const xInWaveform =
    clientX - scRect.left + scrollContainer.scrollLeft;
  const totalW = Math.max(1, wrapper.scrollWidth);
  const ratio = Math.min(1, Math.max(0, xInWaveform / totalW));
  return ratio * durationSec;
}
