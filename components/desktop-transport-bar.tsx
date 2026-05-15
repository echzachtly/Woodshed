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

  const deleteTitle = regionContextActive
    ? "Delete focus region"
    : "Delete phrase";

  const playbackCluster = (
    <div
      className="flex items-center gap-1.5 rounded-xl border border-stone-800/60 bg-stone-950/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      role="group"
      aria-label="Playback and replay"
    >
      <button
        type="button"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-stone-200 shadow-sm shadow-black/35 transition-colors",
          "border-stone-600/75 bg-stone-900/90 hover:border-violet-500/35 hover:bg-stone-800/90 hover:text-violet-100",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500/50",
          !hasActivePhrase && "opacity-40",
        )}
        aria-label={restartHelp}
        title={restartHelp}
        disabled={!hasActivePhrase}
        onClick={onRestartLoop}
      >
        <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <Button
        variant={isPlaying ? "secondary" : "default"}
        aria-label={isPlaying ? "Pause" : "Play"}
        type="button"
        size="icon"
        className={cn(
          "h-11 w-11 shrink-0 rounded-full border shadow-md shadow-black/45",
          isPlaying
            ? "border-stone-600/80 bg-stone-800 text-stone-50"
            : "border-violet-400/35 bg-violet-600 text-white hover:bg-violet-500",
        )}
        onClick={onTogglePlay}
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" strokeWidth={2} />
        ) : (
          <Play className="ml-0.5 h-5 w-5" strokeWidth={2} />
        )}
      </Button>
    </div>
  );

  return (
    <div
      className="relative grid w-full min-w-0 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-stone-800/60 bg-[#060504] px-2 py-1.5 sm:px-2.5"
      aria-label="Transport"
    >
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums tracking-tight",
            duration ? "text-stone-400" : "text-stone-600",
          )}
          aria-label="Current time over total duration"
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        {loopPlaybackEnabled ? (
          <span className="hidden max-w-[8rem] truncate text-[10px] font-medium text-violet-300/90 sm:inline">
            {loopCurrent}
          </span>
        ) : null}
      </div>

      <div className="justify-self-center">{playbackCluster}</div>

      <div className="flex min-w-0 items-center justify-end gap-1.5 justify-self-end">
        <button
          type="button"
          className={cn(
            "inline-flex h-8 max-w-[10rem] shrink-0 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors sm:max-w-[12rem] sm:px-2.5",
            loopPlaybackEnabled
              ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
              : "border-stone-700/70 bg-stone-950/40 text-stone-500 hover:border-stone-600 hover:bg-stone-900/50 hover:text-stone-300",
          )}
          aria-label={loopAriaLabel}
          title={loopTooltip}
          disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
          onClick={onCycleLoopPlaybackMode}
        >
          <Repeat className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">{loopCurrent}</span>
        </button>

        <Button
          variant="ghost"
          type="button"
          className={cn(
            "h-8 w-8 p-0 text-stone-500 hover:text-stone-200",
            editingPhrase && "text-amber-100/95 hover:text-amber-50",
          )}
          disabled={!hasActivePhrase}
          aria-label={editTitle}
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
          aria-label={deleteTitle}
          title={deleteTitle}
          onClick={onDeleteContext}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <div
          className="ml-0.5 hidden items-center gap-2 border-l border-stone-800/55 pl-2 sm:flex"
          role="group"
          aria-label="Practice speed"
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-stone-500">
            Speed
          </span>
          <TempoPillPicker
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
            className="relative w-[min(100%,7.5rem)] shrink-0"
          />
        </div>

        <div className="sm:hidden">
          <TempoPillPicker
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
            className="relative w-[5.5rem] shrink-0"
          />
        </div>
      </div>
    </div>
  );
});
