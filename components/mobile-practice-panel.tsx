"use client";

import { Pause, Play } from "lucide-react";
import { memo, useState } from "react";

import {
  MobilePhraseBottomSheet,
  MobilePhraseSelectorTrigger,
} from "@/components/mobile-phrase-bottom-sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

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
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onSelectPhrase: (id: string) => void;
};

/**
 * Mobile stack: phrase selector → Repeat → Play / time → Tempo.
 * Phrase list lives in a bottom sheet (opened from the selector).
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
    loops,
    activeLoopId,
    onSelectPhrase,
  } = props;

  const [phraseSheetOpen, setPhraseSheetOpen] = useState(false);
  const roundedTempo = Math.round(tempoPercent);

  return (
    <div
      className="shrink-0 space-y-4 border-b border-stone-800/45 bg-gradient-to-b from-stone-950 to-[#0a0908] px-4 py-4 min-[769px]:hidden"
      aria-label="Mobile practice controls"
    >
      <MobilePhraseSelectorTrigger
        activePhraseName={activePhraseName}
        sheetOpen={phraseSheetOpen}
        onOpen={() => setPhraseSheetOpen(true)}
      />

      <MobilePhraseBottomSheet
        isOpen={phraseSheetOpen}
        onClose={() => setPhraseSheetOpen(false)}
        loops={loops}
        activeLoopId={activeLoopId}
        onSelectPhrase={onSelectPhrase}
      />

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
          {([50, 75, 100] as const).map((pct) => {
            const isPreset = roundedTempo === pct;
            return (
              <Button
                key={pct}
                type="button"
                variant="ghost"
                className={cn(
                  "h-10 min-w-[44px] border px-2 text-xs font-medium tabular-nums transition-colors",
                  isPreset
                    ? "border-violet-500/45 bg-violet-500/14 text-violet-100 shadow-sm shadow-violet-950/20 hover:bg-violet-500/20 hover:text-violet-50"
                    : "border-stone-700/50 bg-stone-900/40 text-stone-200 hover:border-stone-600/70 hover:bg-stone-800/80 hover:text-stone-50",
                )}
                aria-pressed={isPreset}
                onClick={() => onTempoSlider(pct)}
              >
                {pct}%
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
