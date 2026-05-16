import { clampTimeToDuration } from "@/lib/loop-engine";
import { ratioFromScroll } from "@/lib/waveform-manager";

/** Logical timeline width from duration × zoom (seconds × px/sec). */
export function timelineLogicalWidthPx(
  durationSec: number,
  pxPerSec: number,
): number {
  if (!(durationSec > 0) || !(pxPerSec > 0)) return 0;
  return durationSec * pxPerSec;
}

/** Ensure strip is at least as wide as the viewport so empty padding exists only past duration when zoomed out. */
export function timelineScrollWidthPx(
  logicalWidthPx: number,
  viewportWidthPx: number,
): number {
  const vw = Math.max(0, viewportWidthPx);
  return Math.max(logicalWidthPx, vw || logicalWidthPx || 1);
}

/**
 * Synthetic timeline content width: **ends at the end of the song** (no faux extension to fill the viewport).
 * Integer CSS pixels (`ceil(duration × px/sec)`) so canvas + overlays align crisply with ruler time.
 *
 * Prefer this over {@link timelineScrollWidthPx} for neutral / iframe timelines where continuation past duration
 * would read as meaningless “infinite bed”.
 */
export function timelineSongContentWidthPx(
  durationSec: number,
  pxPerSec: number,
): number {
  const logical = timelineLogicalWidthPx(durationSec, pxPerSec);
  return Math.max(1, Math.ceil(logical - 1e-9));
}

/**
 * Left X of the scroll host’s **content box** (inside `padding-left`).
 * Use when mapping `clientX` + `scrollLeft` → timeline seconds so wheel zoom / seeks match
 * the WaveSurfer scrollport model (padding must not be treated as song-time offset).
 */
export function scrollHostContentLeftClientX(scrollEl: HTMLElement): number {
  const rect = scrollEl.getBoundingClientRect();
  const pl = Number.parseFloat(getComputedStyle(scrollEl).paddingLeft);
  return rect.left + (Number.isFinite(pl) ? pl : 0);
}

/** Map pointer position within scroll host → seconds [0, duration]. */
export function pointerClientToSeconds(args: {
  clientX: number;
  scrollHostLeft: number;
  scrollLeft: number;
  pxPerSec: number;
  durationSec: number;
}): number {
  const { clientX, scrollHostLeft, scrollLeft, pxPerSec, durationSec } = args;
  if (!(durationSec > 0) || !(pxPerSec > 0)) return 0;
  const xInTimeline = clientX - scrollHostLeft + scrollLeft;
  const sec = xInTimeline / pxPerSec;
  return clampTimeToDuration(sec, durationSec);
}

/** Physical X inside scroll content for a song-time (may extend past logical duration width when padded). */
export function secondsToContentPx(seconds: number, pxPerSec: number): number {
  if (!(pxPerSec > 0)) return 0;
  return seconds * pxPerSec;
}

/** Visible fraction of scroll width — reuse waveform minimap semantics. */
export function timelineViewportRatios(args: {
  scrollLeft: number;
  scrollWidth: number;
  viewportWidth: number;
}) {
  const { scrollLeft, scrollWidth, viewportWidth } = args;
  return ratioFromScroll(scrollLeft, scrollWidth, viewportWidth);
}

/** Major ruler tick spacing so labels stay readable at varied zoom levels. */
export function pickMajorTickIntervalSec(pxPerSec: number): number {
  const candidates = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
  const minPx = 56;
  for (const sec of candidates) {
    if (sec * pxPerSec >= minPx) return sec;
  }
  return 120;
}
