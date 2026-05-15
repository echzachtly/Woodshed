/**
 * Phase 4 — YouTube-backed {@link MediaPlaybackSurface}.
 *
 * **Architectural intent:** reuse `MediaPlaybackSurface` from {@link ../audio-engine}
 * so WaveSurfer vs YouTube swap stays at the adapter boundary for future workspace wiring.
 *
 * **Differences vs uploaded `<audio>` / WaveSurfer:**
 * - No `HTMLMediaElement` — {@link MediaPlaybackSurface.getMediaElement} always returns `undefined`
 *   (`applyPlaybackTempo` pitch-preservation path is irrelevant).
 * - Time reported by Google's iframe clock — coarse vs sample-accurate decoding.
 *
 * **Known limitations (IFrame API):**
 * - {@link MediaPlaybackSurface.seek} maps to `seekTo`, which lands on encoder keyframes → small jitter vs WAV seeks.
 * - {@link MediaPlaybackSurface.setPlaybackRate} only succeeds for rates YouTube exposes for that video;
 *   unsupported rates may be ignored silently.
 * - {@link MediaPlaybackSurface.getDuration} often returns `0` until `onReady` / buffering completes — callers should gate UI.
 * - {@link MediaPlaybackSurface.isPlaying} follows numeric player state — brief `BUFFERING` gaps may flip false depending on timing.
 *
 * **Future integration:** workspace transport would obtain `MediaPlaybackSurface` from either WaveSurfer or this adapter,
 * keep phrase math in seconds unchanged; timeline visuals separate per Phase 3 neutral strip.
 */

import type { MediaPlaybackSurface } from "@/lib/audio-engine";

import type { YoutubeIframePlayerLike } from "@/lib/youtube/iframe-player-types";
import { YT_PLAYER_STATE } from "@/lib/youtube/iframe-player-types";

export class YoutubeIframePlaybackSurface implements MediaPlaybackSurface {
  constructor(private readonly player: YoutubeIframePlayerLike) {}

  getDuration(): number {
    try {
      const d = this.player.getDuration?.() ?? 0;
      return typeof d === "number" && Number.isFinite(d) ? Math.max(0, d) : 0;
    } catch {
      return 0;
    }
  }

  getCurrentTime(): number {
    try {
      const t = this.player.getCurrentTime?.() ?? 0;
      return typeof t === "number" && Number.isFinite(t) ? Math.max(0, t) : 0;
    } catch {
      return 0;
    }
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    try {
      this.player.seekTo?.(Math.max(0, seconds), true);
    } catch {
      /* iframe race — ignore */
    }
  }

  play(): void | Promise<void> {
    try {
      this.player.playVideo?.();
    } catch {
      /* ignore */
    }
  }

  pause(): void {
    try {
      this.player.pauseVideo?.();
    } catch {
      /* ignore */
    }
  }

  isPlaying(): boolean {
    try {
      return this.player.getPlayerState?.() === YT_PLAYER_STATE.PLAYING;
    } catch {
      return false;
    }
  }

  setPlaybackRate(multiplier: number): void {
    if (!Number.isFinite(multiplier)) return;
    try {
      this.player.setPlaybackRate?.(multiplier);
    } catch {
      /* unsupported rate — ignore */
    }
  }

  getMediaElement(): HTMLMediaElement | undefined {
    return undefined;
  }
}
