/**
 * Thin playback + loop seam coordinator (PRD audio engine).
 * Concrete transport is usually provided by WaveSurfer / MediaElement in the UI layer.
 */

export type MediaPlaybackSurface = {
  getDuration(): number;
  getCurrentTime(): number;
  seek(seconds: number): void;
  play(): void | Promise<void>;
  pause(): void;
  /** True while audio is progressing */
  isPlaying(): boolean;
  /** 0.25–1.5 typical */
  setPlaybackRate(multiplier: number): void;
  /** Optional raw element for preservesPitch */
  getMediaElement?(): HTMLMediaElement | undefined;
};

export type LoopRail = {
  start: number;
  end: number;
  enabled: boolean;
};

const clamp = (x: number, lo: number, hi: number) =>
  Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;

/** Apply browser pitch preservation flag when slowing/speeding (Chromium-supported). */
export function applyPlaybackTempo(surface: MediaPlaybackSurface, multiplier: number) {
  const m = clamp(multiplier, 0.05, 4);
  const el = surface.getMediaElement?.();
  if (el) {
    try {
      el.preservesPitch = true;
      // Deprecated but still respected in Blink for gradual migration
      Reflect.set(el, "mozPreservesPitch", true);
      Reflect.set(el, "webkitPreservesPitch", true);
    } catch {
      /* ignore */
    }
    el.playbackRate = m;
  }
  surface.setPlaybackRate(m);
}

/**
 * Decide where to warp playback on each tick near the loop boundary.
 * `crossFadeMs` controls a simplistic micro-fade envelope on the MediaElement gain (optional).
 */
export function loopSeekDecision(
  t: number,
  loop: LoopRail,
  lookaheadSec = 0.03,
): { warpTo: number | null } {
  if (!loop.enabled || !Number.isFinite(t)) return { warpTo: null };
  if (loop.end <= loop.start) return { warpTo: null };
  if (t < loop.start) return { warpTo: loop.start };
  if (t >= loop.end - lookaheadSec) {
    return { warpTo: loop.start };
  }
  return { warpTo: null };
}

type FadeState = ReturnType<typeof createMicroFadeEnvelope>;

/** Very small fades around loop wraps to tame clicks (best-effort, MediaElement-volume based). */
export function createMicroFadeEnvelope(media: HTMLMediaElement) {
  const original = media.volume || 1;
  let ticking = false;
  let rampToken = 0;

  async function pulseDown(durationMs: number): Promise<number> {
    const token = ++rampToken;
    const steps = Math.max(4, Math.floor(durationMs / 10));
    for (let i = steps; i >= 0; i--) {
      if (token !== rampToken) return token;
      media.volume = clamp((original * i) / steps, 0, 1);
      await new Promise((r) => requestAnimationFrame(r));
    }
    return token;
  }

  async function pulseUp(durationMs: number, tokenMustMatch: number) {
    const steps = Math.max(4, Math.floor(durationMs / 10));
    for (let i = 1; i <= steps; i++) {
      if (tokenMustMatch !== rampToken) return;
      media.volume = clamp((original * i) / steps, 0, 1);
      await new Promise((r) => requestAnimationFrame(r));
    }
    if (tokenMustMatch === rampToken) media.volume = original;
  }

  return {
    begin() {
      ticking = true;
    },
    async wrap(crossFadeMs: number) {
      if (!ticking) return;
      const token = await pulseDown(crossFadeMs / 2);
      await pulseUp(crossFadeMs / 2, token);
    },
    cancel() {
      rampToken++;
      media.volume = original;
      ticking = false;
    },
  };
}

export type MicroFadeControls = FadeState;

/** Fire-and-forget loop warp with optional volume micro-fade */
export async function warpLoopPlayback(
  surface: MediaPlaybackSurface,
  warpTo: number,
  fades: MicroFadeControls | null,
  crossFadeMs: number,
) {
  fades?.begin();
  if (fades && crossFadeMs > 4) {
    await fades.wrap(crossFadeMs);
  }
  surface.seek(warpTo);
  fades?.cancel();
  if (surface.isPlaying()) void surface.play();
}
