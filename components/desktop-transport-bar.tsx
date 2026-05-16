"use client";

import {
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
  /** Decoded timeline not ready — quieter idle transport (no playback yet). */
  timelineIdle?: boolean;
  /** Optional label for explicit Practice vs Edit mode (YouTube / synthetic timeline). */
  interactionModeChip?: {
    /** When true → "Edit Mode" styling; false → Practice Mode styling. */
    editingEnabled: boolean;
  };
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
    timelineIdle = false,
    interactionModeChip,
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

  const modeEditingEnabled = interactionModeChip?.editingEnabled ?? editingPhrase;
  const modeLabel = modeEditingEnabled ? "Edit" : "Practice";
  const modeNextLabel = modeEditingEnabled ? "Practice" : "Edit";
  const modeTitle = modeEditingEnabled
    ? "Edit Mode — region editing enabled. Click to switch to Practice Mode."
    : "Practice Mode — protected from accidental edits. Click to switch to Edit Mode.";
  const modeAriaLabel = `${modeLabel} Mode. Click to switch to ${modeNextLabel} Mode.`;

  const deleteTitle = regionContextActive
    ? "Delete focus region"
    : "Delete phrase";

  const playbackCluster = (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-xl border border-stone-800/60 bg-stone-950/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[box-shadow,border-color,opacity] duration-300",
        timelineIdle && "border-stone-800/40 bg-stone-950/35 shadow-none",
        !timelineIdle &&
          isPlaying &&
          "border-violet-500/25 shadow-[inset_0_0_0_1px_rgba(167,139,250,0.08),0_4px_20px_-8px_rgba(109,40,217,0.35)]",
      )}
      role="group"
      aria-label={timelineIdle ? "Playback (idle)" : "Playback and replay"}
    >
        <button
          type="button"
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-stone-200 shadow-sm shadow-black/35 transition-[border-color,box-shadow,opacity] duration-300",
          "border-stone-600/75 bg-stone-900/90 hover:border-violet-500/35 hover:bg-stone-800/90 hover:text-violet-100",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500/50",
          (!hasActivePhrase || timelineIdle) && "opacity-40",
          timelineIdle &&
            "pointer-events-none border-stone-800/60 bg-stone-950/50 text-stone-600 shadow-none",
        )}
        aria-label={restartHelp}
        title={timelineIdle ? "Available after loading audio" : restartHelp}
        disabled={!hasActivePhrase || timelineIdle}
        onClick={onRestartLoop}
      >
        <RotateCcw className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <Button
        variant={isPlaying ? "secondary" : "default"}
        aria-label={timelineIdle ? "Play — waiting for audio" : isPlaying ? "Pause" : "Play"}
        type="button"
        size="icon"
        disabled={timelineIdle}
        className={cn(
          "h-11 w-11 shrink-0 rounded-full border shadow-md shadow-black/45",
          isPlaying
            ? "border-stone-600/80 bg-stone-800 text-stone-50"
            : "border-violet-400/35 bg-violet-600 text-white hover:bg-violet-500",
          timelineIdle &&
            "pointer-events-none border-stone-800/65 bg-stone-950/60 text-stone-600 opacity-65 shadow-none",
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
      className={cn(
        "relative grid w-full min-w-0 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-t px-2 py-1 sm:px-2.5 transition-[background-color,box-shadow] duration-300",
        timelineIdle
          ? "border-stone-900/65 bg-[#070605]/95"
          : "border-stone-800/55 bg-[#060504]",
        !timelineIdle && isPlaying && "bg-[#070605] shadow-[inset_0_1px_0_rgba(167,139,250,0.05)]",
      )}
      aria-label="Transport"
    >
      <div className="flex min-w-0 items-center gap-2 justify-self-start">
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums tracking-tight",
            timelineIdle
              ? "text-stone-600"
              : duration
                ? "text-stone-400"
                : "text-stone-600",
          )}
          aria-label={
            timelineIdle
              ? "Position — idle until audio is loaded"
              : "Current time over total duration"
          }
        >
          {timelineIdle
            ? "— · —"
            : `${formatTime(currentTime)} / ${formatTime(duration)}`}
        </span>
        {!timelineIdle && loopPlaybackEnabled ? (
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
            timelineIdle &&
              "pointer-events-none border-stone-800/60 bg-stone-950/50 text-stone-600 opacity-70",
            !timelineIdle &&
              (loopPlaybackEnabled
                ? "border-violet-500/40 bg-violet-500/10 text-violet-100"
                : "border-stone-700/70 bg-stone-950/40 text-stone-500 hover:border-stone-600 hover:bg-stone-900/50 hover:text-stone-300"),
          )}
          aria-label={
            timelineIdle ? "Repeat mode — idle until audio is loaded" : loopAriaLabel
          }
          title={
            timelineIdle ? "Available after loading audio" : loopTooltip
          }
          disabled={
            timelineIdle ||
            (!loopPlaybackEnabled && !canEnableLoopPlayback)
          }
          onClick={onCycleLoopPlaybackMode}
        >
          <Repeat className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">
            {timelineIdle ? "—" : loopCurrent}
          </span>
        </button>

        <button
          type="button"
          className={cn(
            "inline-flex h-8 shrink-0 items-center rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em] transition-[border-color,background-color,color,box-shadow,transform] duration-150",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500/50",
            "active:translate-y-[0.5px]",
            timelineIdle &&
              "pointer-events-none border-stone-800/60 bg-stone-950/50 text-stone-600 opacity-70",
            !timelineIdle &&
              (modeEditingEnabled
                ? "border-amber-500/38 bg-amber-500/[0.11] text-amber-100/93 hover:border-amber-400/52 hover:bg-amber-500/[0.16] hover:text-amber-50"
                : "border-emerald-500/[0.26] bg-emerald-950/45 text-emerald-100/[0.92] hover:border-emerald-400/42 hover:bg-emerald-900/50 hover:text-emerald-50"),
          )}
          disabled={!hasActivePhrase || timelineIdle}
          aria-label={modeAriaLabel}
          title={modeTitle}
          onClick={onToggleEditContext}
        >
          {modeLabel}
        </button>
        <Button
          variant="ghost"
          type="button"
          className="h-8 w-8 p-0 text-stone-500 hover:text-red-300/90"
          disabled={!hasActivePhrase || timelineIdle}
          aria-label={deleteTitle}
          title={deleteTitle}
          onClick={onDeleteContext}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <div
          className={cn(
            "ml-0.5 hidden items-center gap-2 border-l pl-2 sm:flex",
            timelineIdle ? "border-stone-900/70" : "border-stone-800/55",
          )}
          role="group"
          aria-label="Practice speed"
        >
          <span
            className={cn(
              "text-[9px] font-semibold uppercase tracking-[0.16em]",
              timelineIdle ? "text-stone-700" : "text-stone-500",
            )}
          >
            Speed
          </span>
          <TempoPillPicker
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
            disabled={timelineIdle}
            className="relative w-[min(100%,7.5rem)] shrink-0"
          />
        </div>

        <div className={cn("sm:hidden", timelineIdle && "opacity-80")}>
          <TempoPillPicker
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
            disabled={timelineIdle}
            className="relative w-[5.5rem] shrink-0"
          />
        </div>
      </div>
    </div>
  );
});
