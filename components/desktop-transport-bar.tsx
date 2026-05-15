"use client";

import {
  Lock,
  LockOpen,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { memo } from "react";

import { TempoPillPicker } from "@/components/tempo-pill-picker";
import { Button } from "@/components/ui/button";
import {
  getLoopModeDescription,
  getLoopModeDisplay,
  getNextLoopModeDisplay,
} from "@/lib/practice-loop-mode";
import { cn } from "@/lib/utils";
import type { LoopPracticeScope } from "@/store/woodshed-store";

export type DesktopTransportBarProps = {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopPlaybackEnabled: boolean;
  canEnableLoopPlayback: boolean;
  loopPracticeScope: LoopPracticeScope;
  hasActivePhrase: boolean;
  /** Active phrase has ≥1 focus region (enables Focus Loop in the cycle). */
  phraseHasFocusRegions: boolean;
  /** True when a practice region is selected (edit/delete context). */
  regionContextActive: boolean;
  activeLoopId: string | null;
  editableLoopId: string | null;
  onToggleEditContext: () => void;
  onDeleteContext: () => void;
  tempoPercent: number;
  onTogglePlay: () => void;
  onRestartLoop: () => void;
  onCycleLoopPlaybackMode: () => void;
  onTempoSlider: (pct: number) => void;
  formatTime: (t: number) => string;
};

const rail = "mx-1 hidden h-5 w-px shrink-0 bg-stone-700/55 sm:block";

export const DesktopTransportBar = memo(function DesktopTransportBar(
  props: DesktopTransportBarProps,
) {
  const {
    duration,
    currentTime,
    isPlaying,
    loopPlaybackEnabled,
    canEnableLoopPlayback,
    loopPracticeScope,
    hasActivePhrase,
    phraseHasFocusRegions,
    regionContextActive,
    activeLoopId,
    editableLoopId,
    onToggleEditContext,
    onDeleteContext,
    tempoPercent,
    onTogglePlay,
    onRestartLoop,
    onCycleLoopPlaybackMode,
    onTempoSlider,
    formatTime,
  } = props;

  const editingPhrase = Boolean(
    activeLoopId &&
      editableLoopId === activeLoopId &&
      !regionContextActive,
  );

  const restartHelp =
    phraseHasFocusRegions && loopPracticeScope === "practice_region"
      ? "Restart focus region"
      : "Restart active phrase";

  const loopCurrent = getLoopModeDisplay(
    loopPlaybackEnabled,
    loopPracticeScope,
    phraseHasFocusRegions,
  );
  const loopNext = getNextLoopModeDisplay(
    loopPlaybackEnabled,
    loopPracticeScope,
    phraseHasFocusRegions,
  );

  const loopTooltip = `${getLoopModeDescription(loopCurrent)} — Next: ${getLoopModeDescription(loopNext)}. Click to cycle.`;
  const loopAriaLabel = `Practice loop. ${getLoopModeDescription(loopCurrent)}. Next: ${getLoopModeDescription(loopNext)}.`;

  const editTitle = editingPhrase
    ? "Lock phrase waveform boundaries"
    : regionContextActive
      ? "Unlock focus region boundaries (inspector)"
      : "Unlock phrase waveform boundaries";

  const editAria = editTitle;

  const deleteTitle = regionContextActive
    ? "Delete focus region"
    : "Delete phrase";

  const deleteAria = deleteTitle;

  return (
    <div
      className="flex min-h-9 w-full min-w-0 shrink-0 flex-wrap items-center gap-x-0 gap-y-1 border-t border-stone-800/60 bg-[#060504] px-2 py-1 sm:min-h-10 sm:px-2.5"
      aria-label="Transport"
    >
      <div className="flex min-w-0 flex-[1_1_12rem] flex-wrap items-center gap-x-0 gap-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-1">
          <div
            className="flex items-center gap-1 rounded-xl border border-stone-800/60 bg-stone-950/50 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            role="group"
            aria-label="Playback and replay"
          >
            <Button
              variant={isPlaying ? "secondary" : "default"}
              aria-label={isPlaying ? "Pause" : "Play"}
              type="button"
              size="icon"
              className={cn(
                "h-9 w-9 shrink-0 rounded-full border shadow-sm shadow-black/40",
                isPlaying
                  ? "border-stone-600/80 bg-stone-800 text-stone-50"
                  : "border-violet-400/30 bg-violet-600 text-white hover:bg-violet-500",
              )}
              onClick={onTogglePlay}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" strokeWidth={2} />
              ) : (
                <Play className="ml-0.5 h-4 w-4" strokeWidth={2} />
              )}
            </Button>
            <button
              type="button"
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-stone-300 shadow-sm shadow-black/30 transition-colors",
                "border-stone-600/75 bg-stone-900/90 hover:border-violet-500/35 hover:bg-stone-800/90 hover:text-violet-100",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500/50",
                !hasActivePhrase && "opacity-40",
              )}
              aria-label={restartHelp}
              title={restartHelp}
              disabled={!hasActivePhrase}
              onClick={onRestartLoop}
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <span
            className={cn(
              "min-w-[7.5rem] font-mono text-[11px] tabular-nums tracking-tight",
              duration ? "text-stone-400" : "text-stone-600",
            )}
            aria-label="Current time over total duration"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className={rail} role="separator" aria-hidden />

        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-stone-800/55 bg-stone-950/35 px-1 py-0.5"
          role="group"
          aria-label="Practice loop"
        >
          <button
            type="button"
            className={cn(
              "inline-flex h-8 max-w-[12rem] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors",
              loopPlaybackEnabled
                ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                : "border-transparent bg-transparent text-stone-500 hover:border-stone-700/80 hover:bg-stone-900/40 hover:text-stone-400",
            )}
            aria-label={loopAriaLabel}
            title={loopTooltip}
            disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
            onClick={onCycleLoopPlaybackMode}
          >
            <Repeat className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">{loopCurrent}</span>
          </button>
        </div>

        <div className={rail} role="separator" aria-hidden />

        <div className="flex items-center gap-0.5 px-1">
          <Button
            variant="ghost"
            type="button"
            className={cn(
              "h-8 w-8 p-0 text-stone-500 hover:text-stone-200",
              editingPhrase && "text-amber-100/95 hover:text-amber-50",
            )}
            disabled={!hasActivePhrase}
            aria-label={editAria}
            title={editTitle}
            onClick={onToggleEditContext}
          >
            {editingPhrase ? (
              <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <LockOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            type="button"
            className="h-8 w-8 p-0 text-stone-500 hover:text-red-300/90"
            disabled={!hasActivePhrase}
            aria-label={deleteAria}
            title={deleteTitle}
            onClick={onDeleteContext}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        className="ml-auto flex shrink-0 items-center gap-2 border-stone-800/55 pl-2 sm:border-l sm:pl-3"
        role="group"
        aria-label="Practice speed"
      >
        <span className="hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500 sm:inline">
          Practice speed
        </span>
        <TempoPillPicker
          tempoPercent={tempoPercent}
          onSetPercent={onTempoSlider}
          className="relative w-[min(100%,8.5rem)] shrink-0"
        />
      </div>
    </div>
  );
});
