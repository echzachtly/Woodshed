"use client";

import { Pause, Play } from "lucide-react";
import { memo, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatCompactTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type MobilePracticeControlsProps = {
  activePhraseName: string;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  tempoPercent: number;
  loopPlaybackEnabled: boolean;
  canEnableLoopPlayback: boolean;
  onToggleLoopPlayback: () => void;
  onTogglePlay: () => void;
  onTempoSlider: (pct: number) => void;
  onResetTempoTo100: () => void;
};

/**
 * Mobile stack: Repeat → Play / time → Tempo → current phrase (above waveform in page order).
 */
export const MobilePracticeControls = memo(function MobilePracticeControls(
  props: MobilePracticeControlsProps,
) {
  const {
    activePhraseName,
    isPlaying,
    duration,
    currentTime,
    tempoPercent,
    loopPlaybackEnabled,
    canEnableLoopPlayback,
    onToggleLoopPlayback,
    onTogglePlay,
    onTempoSlider,
    onResetTempoTo100,
  } = props;

  const roundedTempo = Math.round(tempoPercent);

  return (
    <div
      className="shrink-0 space-y-4 border-b border-stone-800/45 bg-gradient-to-b from-stone-950 to-[#0a0908] px-4 py-4 min-[769px]:hidden"
      aria-label="Mobile practice controls"
    >
      <div className="flex justify-center">
        <button
          type="button"
          className={cn(
            "min-h-[44px] rounded-full border px-4 py-2 text-[11px] font-medium transition-colors",
            loopPlaybackEnabled
              ? "border-violet-500/45 bg-violet-500/12 text-violet-100"
              : "border-stone-700/60 bg-stone-900/50 text-stone-400",
          )}
          aria-pressed={loopPlaybackEnabled}
          disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
          title={
            loopPlaybackEnabled
              ? "Turn off — play past phrase boundaries"
              : "Turn on — repeat the selected phrase"
          }
          onClick={onToggleLoopPlayback}
        >
          {loopPlaybackEnabled ? "Repeat phrase: ON" : "Repeat phrase: OFF"}
        </button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          variant={isPlaying ? "secondary" : "default"}
          type="button"
          size="icon"
          aria-label={isPlaying ? "Pause" : "Play"}
          className={cn(
            "h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border shadow-lg shadow-violet-950/30",
            isPlaying
              ? "border-stone-600/80 bg-stone-800 text-stone-50"
              : "border-violet-400/35 bg-violet-600 text-white hover:bg-violet-500",
          )}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Pause className="h-10 w-10" strokeWidth={2} />
          ) : (
            <Play className="ml-1 h-10 w-10" strokeWidth={2} />
          )}
        </Button>
        <p
          className="font-mono text-sm tabular-nums text-stone-300"
          aria-label="Current time over total duration"
        >
          {formatCompactTime(currentTime)} / {formatCompactTime(duration)}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-stone-500">
            Tempo
          </span>
          <button
            type="button"
            className="min-h-[40px] min-w-[44px] rounded-md border border-transparent px-2 py-1 font-mono text-xs tabular-nums text-stone-200 hover:border-stone-700/60 hover:bg-stone-800/60"
            title="Reset tempo to 100%"
            aria-label="Reset tempo to 100%"
            onClick={onResetTempoTo100}
          >
            {roundedTempo}%
          </button>
        </div>
        <Slider
          className="w-full"
          min={25}
          max={150}
          step={1}
          value={[tempoPercent]}
          title="Drag to adjust tempo"
          onValueChange={(v) => onTempoSlider(v[0] ?? 100)}
        />
        <div className="flex justify-center gap-2">
          {([50, 75, 100] as const).map((pct) => (
            <Button
              key={pct}
              type="button"
              variant="ghost"
              className="h-10 min-w-[44px] px-2 text-xs text-stone-400 hover:bg-stone-800/70 hover:text-stone-100"
              onClick={() => onTempoSlider(pct)}
            >
              {pct}%
            </Button>
          ))}
        </div>
      </div>

      <div className="border-t border-stone-800/35 pt-3 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
          Active phrase
        </p>
        <p
          className="mt-1 line-clamp-2 text-lg font-semibold leading-snug text-stone-50"
          title={activePhraseName}
        >
          {activePhraseName}
        </p>
      </div>
    </div>
  );
});

export type MobilePhraseNavProps = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onSelectPhrase: (id: string) => void;
};

export const MobilePhraseNav = memo(function MobilePhraseNav(
  props: MobilePhraseNavProps,
) {
  const { loops, activeLoopId, onSelectPhrase } = props;
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!activeLoopId) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;
      activeRowRef.current?.scrollIntoView({
        block: "nearest",
        behavior: prefersReduced ? "auto" : "smooth",
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [activeLoopId]);

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-stone-800/35 bg-stone-950/95 min-[769px]:hidden">
      <header className="shrink-0 px-4 pb-1.5 pt-3">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-stone-500">
          Phrases
        </h2>
      </header>
      <ul
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-3 pb-4 pt-0.5 [-webkit-overflow-scrolling:touch]"
        role="list"
        aria-label="Saved phrases"
      >
        {loops.length === 0 ? (
          <li className="flex min-h-[48px] items-center justify-center px-2 py-4 text-center text-[13px] text-stone-500">
            No phrases in this project yet.
          </li>
        ) : null}
        {loops.map((loop) => {
          const active = loop.id === activeLoopId;
          return (
            <li key={loop.id} className="min-w-0">
              <button
                ref={active ? activeRowRef : null}
                aria-current={active ? "true" : undefined}
                type="button"
                onClick={() => onSelectPhrase(loop.id)}
                className={cn(
                  "flex min-h-[48px] w-full max-w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors touch-manipulation sm:min-h-[52px]",
                  active
                    ? "bg-violet-500/[0.12] text-stone-50"
                    : "text-stone-300 hover:bg-stone-800/45 active:bg-stone-800/65",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full transition-colors",
                    active
                      ? "bg-violet-400 shadow-[0_0_0_3px_rgba(167,139,250,0.12)]"
                      : "bg-stone-600",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 py-0.5">
                  <span
                    className={cn(
                      "block truncate text-[15px] leading-snug",
                      active
                        ? "font-semibold text-stone-50"
                        : "font-medium text-stone-200",
                    )}
                  >
                    {loop.name}
                  </span>
                  <span
                    className={cn(
                      "mt-1 block font-mono text-[12px] tabular-nums leading-none",
                      active ? "text-violet-200/70" : "text-stone-500",
                    )}
                  >
                    {formatPhraseTime(loop.start)} → {formatPhraseTime(loop.end)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
