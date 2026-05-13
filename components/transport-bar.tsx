"use client";

import {
  ZoomOut,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from "lucide-react";
import type { ComponentProps } from "react";
import { memo } from "react";

import { HeaderAccount } from "@/components/header-account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import { cloudSessionPickerValue } from "@/lib/cloud-projects/constants";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";

const transportBtn =
  "h-8 gap-1.5 px-2.5 text-xs font-medium border-stone-800/60 text-stone-200";

export type AppHeaderProps = {
  projectName: string;
  /** Current value for the session `<select>` (Dexie id or built-in demo id). */
  sessionSelectValue: string;
  /** Built-in example project id (must match `public/demo/demo-project.json`). */
  demoProjectId: string;
  /** Title shown for the built-in example in the picker. */
  demoProjectLabel: string;
  /** Saved sessions from local storage (excludes built-in id if present). */
  userProjects: StoredProjectMeta[];
  /** Cloud-backed sessions (logged-in Supabase). */
  cloudProjects?: CloudProjectSummary[];
  /** When true, show the Cloud sessions optgroup (typically same as logged-in). */
  showCloudSessions?: boolean;
  /** Shown when the built-in demo session is active. */
  isDemoProject?: boolean;
  /** Built-in example: session name is not editable. */
  sessionNameReadOnly?: boolean;
  /** Built-in example: Save is disabled (read-only). */
  saveDisabled?: boolean;
  /** Optional label for the Save button (e.g. Save to cloud). */
  saveLabel?: string;
  /** Disables Save and shows a pending state on the label when combined with saveLabel. */
  saveBusy?: boolean;
  /**
   * Dev-only: export current loops as JSON (clipboard + console).
   * Only pass when `process.env.NODE_ENV === "development"`.
   */
  devExportLoopsJson?: () => void;
  onRenameProject: (name: string) => void;
  onOpenFileClick: () => void;
  onSaveProject: () => void;
  onRestoreProject: (id: string) => void | Promise<void>;
  hiddenFileProps: Omit<ComponentProps<"input">, "children"> & {
    "data-testid"?: string;
  };
};

export const AppHeader = memo(function AppHeader(props: AppHeaderProps) {
  const {
    projectName,
    sessionSelectValue,
    demoProjectId,
    demoProjectLabel,
    userProjects,
    cloudProjects = [],
    showCloudSessions = false,
    isDemoProject,
    sessionNameReadOnly,
    saveDisabled,
    saveLabel = "Save",
    saveBusy = false,
    devExportLoopsJson,
    onRenameProject,
    onOpenFileClick,
    onSaveProject,
    onRestoreProject,
    hiddenFileProps,
  } = props;

  return (
    <header className="flex flex-col gap-2 border-b border-stone-800/55 bg-stone-950 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <Label className="sr-only" htmlFor="session-name">
          Session name
        </Label>
        <Input
          id="session-name"
          value={projectName}
          readOnly={Boolean(sessionNameReadOnly)}
          title={
            sessionNameReadOnly
              ? "Rename is disabled for the built-in example project."
              : undefined
          }
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
          className="h-9 min-w-0 max-w-[16rem] rounded-md border border-stone-800/80 bg-stone-950/80 px-2.5 text-xs text-stone-100 outline-none sm:max-w-[18rem] sm:text-sm"
          value={sessionSelectValue}
          aria-label="Switch session"
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            void onRestoreProject(v);
          }}
        >
          <option value="">Sessions…</option>
          <optgroup label="Example projects">
            <option value={demoProjectId}>{`${demoProjectLabel} (built-in)`}</option>
          </optgroup>
          <optgroup label="My projects (this device)">
            {userProjects.length === 0 ? (
              <option value="" disabled>
                No saved sessions yet
              </option>
            ) : (
              userProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name ?? p.id}
                </option>
              ))
            )}
          </optgroup>
          {showCloudSessions ? (
            <optgroup label="Cloud">
              {cloudProjects.length === 0 ? (
                <option value="" disabled>
                  No cloud projects yet
                </option>
              ) : (
                cloudProjects.map((p) => (
                  <option
                    key={p.id}
                    value={cloudSessionPickerValue(p.id)}
                  >
                    {p.name ?? p.id}
                  </option>
                ))
              )}
            </optgroup>
          ) : null}
        </select>
        <Button
          variant="secondary"
          type="button"
          className="h-9 border-stone-700/80 px-3 text-xs"
          disabled={saveDisabled || saveBusy}
          title={
            saveDisabled
              ? "Save is disabled for the built-in example. Upload or open your own session to save."
              : undefined
          }
          onClick={onSaveProject}
        >
          {saveBusy ? "Saving…" : saveLabel}
        </Button>
        {isDemoProject ? (
          <span
            className="shrink-0 rounded-md border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/95"
            title="Built-in example — use Sessions to open your own saved work"
          >
            Demo
          </span>
        ) : null}
        {devExportLoopsJson ? (
          <Button
            type="button"
            variant="outline"
            className="h-8 border-amber-800/45 bg-amber-950/35 px-2 text-[11px] text-amber-100/90"
            onClick={devExportLoopsJson}
          >
            Export Loops JSON
          </Button>
        ) : null}
      </div>
      <HeaderAccount />
    </header>
  );
});

export type WorkspaceTransportBarProps = {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopPlaybackEnabled: boolean;
  /** True when the active loop has a valid span — required to turn loop playback on. */
  canEnableLoopPlayback: boolean;
  tempoPercent: number;
  onTogglePlay: () => void;
  onStop: () => void;
  onRestartLoop: () => void;
  onResetZoomFullSong: () => void;
  onToggleLoopPlayback: () => void;
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
    canEnableLoopPlayback,
    tempoPercent,
    onTogglePlay,
    onStop,
    onRestartLoop,
    onResetZoomFullSong,
    onToggleLoopPlayback,
    onTempoSlider,
    formatTime,
  } = props;

  return (
    <nav
      aria-label="Playback and practice"
      className="flex flex-col gap-2 border-b border-stone-800/40 bg-gradient-to-b from-stone-950/90 to-[#0a0908]/95 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5"
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
          aria-label="Reset zoom and show full song"
          disabled={!duration}
          onClick={onResetZoomFullSong}
        >
          <ZoomOut className="h-3.5 w-3.5" /> Full song
        </Button>
        <Button
          variant={loopPlaybackEnabled ? "outline" : "ghost"}
          type="button"
          className={cn(
            transportBtn,
            "min-w-0 max-w-[11rem] sm:max-w-none",
            loopPlaybackEnabled && "border-violet-500/35 bg-violet-500/5",
          )}
          aria-pressed={loopPlaybackEnabled}
          aria-label={
            loopPlaybackEnabled
              ? "Turn loop playback off — play the full song"
              : "Turn loop playback on — repeat the selected section"
          }
          disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
          onClick={onToggleLoopPlayback}
        >
          {loopPlaybackEnabled ? "Loop Playback: ON" : "Loop Playback: OFF"}
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
            title="Double-click to reset tempo to 100%"
            onValueChange={(v) => onTempoSlider(v[0] ?? 100)}
            onDoubleClick={(e) => {
              e.preventDefault();
              onTempoSlider(100);
            }}
          />
          <button
            type="button"
            title="Reset tempo to 100%"
            aria-label="Reset tempo to 100%"
            className={cn(
              "w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-stone-200",
              "cursor-pointer rounded border-0 bg-transparent p-0 transition-colors",
              "hover:bg-stone-800/35 hover:text-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400/80",
            )}
            onClick={() => onTempoSlider(100)}
          >
            {Math.round(tempoPercent)}%
          </button>
        </div>
      </div>
    </nav>
  );
});
