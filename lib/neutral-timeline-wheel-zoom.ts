import {
  pointerClientToSeconds,
  scrollHostContentLeftClientX,
  secondsToContentPx,
} from "@/components/neutral-timeline/timeline-coordinates";

/** Matches {@link applyWheelZoomAnchoredToCursor} waveform clamp. */
export const NEUTRAL_TIMELINE_MIN_PX_PER_SEC = 4;
export const NEUTRAL_TIMELINE_MAX_PX_PER_SEC = 1500;

/** Song-time (seconds) under a viewport `clientX` on the timeline scroll host. */
export function neutralTimelineAnchorTimeAtClientX(args: {
  scrollEl: HTMLElement;
  clientX: number;
  pxPerSec: number;
  durationSec: number;
}): number {
  const { scrollEl, clientX, pxPerSec, durationSec } = args;
  return pointerClientToSeconds({
    clientX,
    scrollHostLeft: scrollHostContentLeftClientX(scrollEl),
    scrollLeft: scrollEl.scrollLeft,
    pxPerSec,
    durationSec,
  });
}

/** After `pxPerSec` changes, keep `timeSec` under the same viewport X. */
export function neutralTimelineScrollToKeepTimeUnderClientX(args: {
  scrollEl: HTMLElement;
  clientX: number;
  timeSec: number;
  pxPerSec: number;
}): void {
  const { scrollEl, clientX, timeSec, pxPerSec } = args;
  const contentLeft = scrollHostContentLeftClientX(scrollEl);
  const targetXInContent = secondsToContentPx(timeSec, pxPerSec);
  const nextScroll = targetXInContent - (clientX - contentLeft);
  const maxScroll = Math.max(
    0,
    scrollEl.scrollWidth - scrollEl.clientWidth,
  );
  scrollEl.scrollLeft = Math.max(0, Math.min(maxScroll, nextScroll));
}

/**
 * Wheel zoom for the synthetic timeline — same sensitivity curve as the WaveSurfer path
 * ({@link applyWheelZoomAnchoredToCursor}).
 */
export function applyNeutralTimelineWheelZoomAnchoredToCursor(args: {
  scrollEl: HTMLElement;
  durationSec: number;
  pxPerSec: number;
  event: WheelEvent;
  onPxPerSecChange: (next: number) => void;
}): void {
  const { scrollEl, durationSec, pxPerSec, event, onPxPerSecChange } = args;
  if (!(durationSec > 0) || !(pxPerSec > 0)) return;

  const anchorTime = neutralTimelineAnchorTimeAtClientX({
    scrollEl,
    clientX: event.clientX,
    pxPerSec,
    durationSec,
  });
  const factor = Math.exp(event.deltaY * -0.0015);
  const next = Math.min(
    NEUTRAL_TIMELINE_MAX_PX_PER_SEC,
    Math.max(NEUTRAL_TIMELINE_MIN_PX_PER_SEC, pxPerSec * factor),
  );
  if (next === pxPerSec) return;

  event.preventDefault();
  onPxPerSecChange(next);

  const clientX = event.clientX;
  /** Double rAF: parent React commit updates scrollWidth after px/sec changes. */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      neutralTimelineScrollToKeepTimeUnderClientX({
        scrollEl,
        clientX,
        timeSec: anchorTime,
        pxPerSec: next,
      });
    });
  });
}
