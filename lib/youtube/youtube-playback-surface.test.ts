import { describe, expect, test, vi } from "vitest";

import {
  YT_PLAYER_STATE,
  type YoutubeIframePlayerLike,
} from "@/lib/youtube/iframe-player-types";
import { YoutubeIframePlaybackSurface } from "@/lib/youtube/youtube-playback-surface";

function mockPlayer(partial: Partial<YoutubeIframePlayerLike>): YoutubeIframePlayerLike {
  return {
    getDuration: () => 0,
    getCurrentTime: () => 0,
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    getPlayerState: () => YT_PLAYER_STATE.PAUSED,
    setPlaybackRate: vi.fn(),
    destroy: vi.fn(),
    ...partial,
  };
}

describe("YoutubeIframePlaybackSurface", () => {
  test("delegates play/pause/seek/state to iframe player", () => {
    const player = mockPlayer({
      getDuration: () => 212,
      getCurrentTime: () => 30,
      getPlayerState: () => YT_PLAYER_STATE.PLAYING,
    });
    const surface = new YoutubeIframePlaybackSurface(player);

    expect(surface.getDuration()).toBe(212);
    expect(surface.getCurrentTime()).toBe(30);
    expect(surface.isPlaying()).toBe(true);

    surface.seek(44);
    expect(player.seekTo).toHaveBeenCalledWith(44, true);

    surface.play();
    expect(player.playVideo).toHaveBeenCalled();

    surface.pause();
    expect(player.pauseVideo).toHaveBeenCalled();

    surface.setPlaybackRate(1.25);
    expect(player.setPlaybackRate).toHaveBeenCalledWith(1.25);

    expect(surface.getMediaElement()).toBeUndefined();
  });

  test("guards NaN seek / playbackRate", () => {
    const player = mockPlayer({});
    const surface = new YoutubeIframePlaybackSurface(player);

    surface.seek(Number.NaN);
    surface.setPlaybackRate(Number.NaN);

    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.setPlaybackRate).not.toHaveBeenCalled();
  });
});
