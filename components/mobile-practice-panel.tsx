"use client";

import { Pause, Play } from "lucide-react";
import { memo } from "react";

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
            "rounded-full border px-3.5 py-1.5 text-[11px] font-medium transition-colors",
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

      <div className="text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-stone-500">
          Active phrase
        </p>
        <p
          className="mt-1 line-clamp-2 text-xl font-semibold leading-snug text-stone-50"
          title={activePhraseName}
        >
          {activePhraseName}
        </p>
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
            className="rounded-md border border-transparent px-2 py-1 font-mono text-xs tabular-nums text-stone-200 hover:border-stone-700/60 hover:bg-stone-800/60"
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
              className="h-8 min-w-[3.25rem] px-2 text-xs text-stone-400 hover:bg-stone-800/70 hover:text-stone-100"
              onClick={() => onTempoSlider(pct)}
            >
              {pct}%
            </Button>
          ))}
        </div>
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

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-stone-800/40 bg-stone-950/90 min-[769px]:hidden">
      <header className="shrink-0 px-4 pb-2 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-400">
          Phrases
        </p>
        <p className="text-[10px] text-stone-500">
          Tap a phrase to select it and turn on repeat.
        </p>
      </header>
      <ul
        className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-y-contain px-3 pb-3 [-webkit-overflow-scrolling:touch]"
        role="list"
      >
        {loops.length === 0 ? (
          <li className="px-1 py-6 text-center text-[12px] text-stone-500">
            No phrases in this project yet.
          </li>
        ) : null}
        {loops.map((loop) => {
          const active = loop.id === activeLoopId;
          return (
            <li key={loop.id}>
              <button
                type="button"
                onClick={() => onSelectPhrase(loop.id)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md py-2.5 pl-2.5 pr-3 text-left transition-colors touch-manipulation",
                  active
                    ? "bg-violet-500/[0.09] text-stone-50"
                    : "text-stone-300 hover:bg-stone-800/50 active:bg-stone-800/70",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    active ? "bg-violet-400" : "bg-stone-600",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug">
                    {loop.name}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] tabular-nums text-stone-500">
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
