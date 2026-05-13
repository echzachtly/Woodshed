"use client";

import { Maximize2, Pause, Play, RotateCcw, Upload } from "lucide-react";
import type { ComponentProps } from "react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StoredProjectMeta } from "@/lib/project-db";

const transportBtn =
  "h-8 gap-1.5 px-2.5 text-xs font-medium border-stone-800/60 text-stone-200";

export type AppHeaderProps = {
  projectName: string;
  projects: StoredProjectMeta[];
  onRenameProject: (name: string) => void;
  onOpenFileClick: () => void;
  onSaveProject: () => void;
  onRestoreProject: (id: string) => void;
  hiddenFileProps: Omit<ComponentProps<"input">, "children"> & {
    "data-testid"?: string;
  };
};

export const AppHeader = memo(function AppHeader(props: AppHeaderProps) {
  const {
    projectName,
    projects,
    onRenameProject,
    onOpenFileClick,
    onSaveProject,
    onRestoreProject,
    hiddenFileProps,
  } = props;

  return (
    <header className="flex flex-col gap-2 border-b border-stone-800/55 bg-stone-950 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Label className="sr-only" htmlFor="session-name">
          Session name
        </Label>
        <Input
          id="session-name"
          value={projectName}
          onChange={(e) => onRenameProject(e.target.value)}
          className="h-9 min-w-0 flex-1 border-stone-800/80 bg-stone-950/80 sm:max-w-xs"
          aria-label="Session name"
        />
        <input {...hiddenFileProps} />
        <Button
          variant="secondary"
          size="icon"
          className="h-9 w-9 shrink-0 border-stone-700/80"
          aria-label="Open audio file"
          type="button"
          onClick={onOpenFileClick}
        >
          <Upload className="h-4 w-4" />
        </Button>
        <select
          className="h-9 min-w-0 max-w-[14rem] rounded-md border border-stone-800/80 bg-stone-950/80 px-2.5 text-xs text-stone-100 outline-none sm:text-sm"
          defaultValue=""
          aria-label="Open saved session"
          onChange={(e) => {
            if (e.target.value) {
              void onRestoreProject(e.target.value);
              e.target.selectedIndex = 0;
            }
          }}
        >
          <option value="">Open saved session…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.id}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          type="button"
          className="h-9 border-stone-700/80 px-3 text-xs"
          onClick={onSaveProject}
        >
          Save
        </Button>
      </div>
    </header>
  );
});

export type WorkspaceTransportBarProps = {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopPlaybackEnabled: boolean;
  tempoPercent: number;
  canFitLoop: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onRestartLoop: () => void;
  onFitToLoop: () => void;
  onToggleLoopRail: () => void;
  onTempoSlider: (pct: number) => void;
  formatTime: (t: number) => string;
};

export const WorkspaceTransportBar = memo(function WorkspaceTransportBar(
  props: WorkspaceTransportBarProps,
) {
  const {
    duration,
    currentTime,
    isPlaying,
    loopPlaybackEnabled,
    tempoPercent,
    canFitLoop,
    onTogglePlay,
    onStop,
    onRestartLoop,
    onFitToLoop,
    onToggleLoopRail,
    onTempoSlider,
    formatTime,
  } = props;

  return (
    <nav
      aria-label="Playback and loop"
      className="flex flex-col gap-2 border-b border-stone-800/40 bg-gradient-to-b from-stone-950/90 to-[#0a0908]/95 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3"
    >
      <div className="flex flex-wrap items-center gap-1">
        <Button
          variant={isPlaying ? "secondary" : "default"}
          aria-label={isPlaying ? "Pause" : "Play"}
          type="button"
          className={cn(transportBtn, "h-8 w-8 px-0", isPlaying && "border-stone-600/80")}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          type="button"
          className={transportBtn}
          onClick={onStop}
        >
          Stop
        </Button>
        <Button
          variant="ghost"
          type="button"
          className={transportBtn}
          aria-label="Restart active loop (R)"
          onClick={onRestartLoop}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Loop start
        </Button>
        <Button
          variant="ghost"
          type="button"
          className={transportBtn}
          aria-label="Fit waveform to active loop"
          disabled={!canFitLoop}
          onClick={onFitToLoop}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Fit to loop
        </Button>
        <Button
          variant={loopPlaybackEnabled ? "outline" : "ghost"}
          type="button"
          className={cn(
            transportBtn,
            loopPlaybackEnabled && "border-violet-500/35 bg-violet-500/5",
          )}
          onClick={onToggleLoopRail}
        >
          {loopPlaybackEnabled ? "Loop armed" : "Loop off"}
        </Button>
      </div>

      <Separator
        orientation="vertical"
        className="hidden h-7 bg-stone-800/50 sm:block"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 border-t border-stone-800/35 pt-2 sm:max-w-md sm:flex-row sm:items-center sm:gap-3 sm:border-t-0 sm:pt-0">
        <div className="flex shrink-0 items-center justify-between gap-2 sm:min-w-[9.5rem] sm:flex-col sm:items-end sm:justify-center sm:gap-0">
          <span className="text-[10px] uppercase tracking-[0.16em] text-stone-500 sm:hidden">
            Time
          </span>
          <span
            className={cn(
              "font-mono text-xs tabular-nums sm:text-[11px]",
              duration ? "text-stone-200" : "text-stone-500",
            )}
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[11px] text-stone-400">Tempo</span>
          <Slider
            className="flex-1 py-0.5"
            min={25}
            max={150}
            step={1}
            value={[tempoPercent]}
            onValueChange={(v) => onTempoSlider(v[0] ?? 100)}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-stone-200">
            {Math.round(tempoPercent)}%
          </span>
        </div>
      </div>
    </nav>
  );
});
