/**
 * Minimal typings for the official YouTube IFrame Player API surface we rely on.
 * Full docs: https://developers.google.com/youtube/iframe_api_reference
 *
 * Keeps Phase 4 isolated without pulling `@types/youtube` unless desired later.
 */

/** Values returned by {@link YoutubeIframePlayerLike.getPlayerState}. */
export const YT_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export interface YoutubeIframePlayerLike {
  getDuration(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  /** Returns numeric {@link YT_PLAYER_STATE}. */
  getPlayerState(): number;
  /** Supported rates vary by video/platform — may no-op or clamp. */
  setPlaybackRate(suggestedRate: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?:
      | {
          Player: new (
            containerId: string | HTMLElement,
            options: Record<string, unknown>,
          ) => YoutubeIframePlayerLike;
        }
      | undefined;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export {};
