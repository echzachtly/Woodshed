"use client";

import {
  ZoomOut,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from "lucide-react";
import type { ComponentProps, KeyboardEvent } from "react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

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

const transportGhost = cn(transportBtn, "border-transparent text-stone-300/95");

type SessionPickerProps = {
  sessionSelectValue: string;
  demoProjectId: string;
  demoProjectLabel: string;
  userProjects: StoredProjectMeta[];
  cloudProjects: CloudProjectSummary[];
  showCloudSessions: boolean;
  onRestoreProject: (id: string) => void | Promise<void>;
  selectClassName?: string;
  id?: string;
};

function SessionPicker({
  sessionSelectValue,
  demoProjectId,
  demoProjectLabel,
  userProjects,
  cloudProjects,
  showCloudSessions,
  onRestoreProject,
  selectClassName,
  id,
}: SessionPickerProps) {
  return (
    <select
      id={id}
      className={cn(
        "h-9 min-w-0 flex-1 rounded-md border border-stone-800/70 bg-stone-950/80 px-2.5 text-xs text-stone-200/95 outline-none sm:text-sm",
        selectClassName,
      )}
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
              <option key={p.id} value={cloudSessionPickerValue(p.id)}>
                {p.name ?? p.id}
              </option>
            ))
          )}
        </optgroup>
      ) : null}
    </select>
  );
}

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
  /** When true, show the Cloud sessions optgroup (user has an active Supabase session). */
  showCloudSessions?: boolean;
  /** Optional line shown under the header row for save / cloud sync feedback. */
  saveStatusMessage?: string | null;
  /** Visual tone for `saveStatusMessage`. */
  saveStatusTone?: "neutral" | "progress" | "success" | "error";
  /** Shown when cloud project list failed to load (non-blocking). */
  cloudListError?: string | null;
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
  /** Label on the Save button while `saveBusy` (e.g. Saving to cloud…). */
  savePendingLabel?: string;
  /**
   * Dev-only: export current loops as JSON (clipboard + console).
   * Only pass when `process.env.NODE_ENV === "development"`.
   */
  devExportLoopsJson?: () => void;
  /**
   * Mobile practice mode: stack controls, hide upload, show title as read-only text
   * (desktop editor header is unchanged when false / omitted).
   */
  mobilePracticeLayout?: boolean;
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
    savePendingLabel = undefined,
    saveStatusMessage,
    saveStatusTone = "neutral",
    cloudListError,
    devExportLoopsJson,
    mobilePracticeLayout = false,
    onRenameProject,
    onOpenFileClick,
    onSaveProject,
    onRestoreProject,
    hiddenFileProps,
  } = props;

  return (
    <header className="border-b border-stone-800/55 bg-stone-950 px-4 py-2.5">
      <div
        className={cn(
          "mx-auto flex max-w-[1600px] flex-col gap-3",
          mobilePracticeLayout
            ? "gap-3"
            : "lg:flex-row lg:items-center lg:justify-between lg:gap-6",
        )}
      >
        {mobilePracticeLayout ? (
          <>
            <input {...hiddenFileProps} />
            <div className="flex w-full min-w-0 flex-col gap-2">
              <Label className="sr-only" htmlFor="mobile-session-picker">
                Session
              </Label>
              <SessionPicker
                id="mobile-session-picker"
                sessionSelectValue={sessionSelectValue}
                demoProjectId={demoProjectId}
                demoProjectLabel={demoProjectLabel}
                userProjects={userProjects}
                cloudProjects={cloudProjects}
                showCloudSessions={showCloudSessions}
                onRestoreProject={onRestoreProject}
                selectClassName="max-w-none w-full"
              />
              <Label className="sr-only" htmlFor="mobile-session-title">
                Current project
              </Label>
              <p
                id="mobile-session-title"
                className="min-w-0 truncate text-center text-base font-semibold leading-snug text-stone-100"
                title={projectName}
              >
                {projectName}
              </p>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <Button
                variant="secondary"
                type="button"
                className="h-9 shrink-0 border-stone-700/70 px-3 text-xs text-stone-200/95"
                disabled={saveDisabled || saveBusy}
                title={
                  saveDisabled
                    ? "Save is disabled for the built-in example. Upload or open your own session to save."
                    : undefined
                }
                onClick={onSaveProject}
              >
                {saveBusy ? (savePendingLabel ?? "Saving…") : saveLabel}
              </Button>
              <div className="flex shrink-0 items-center gap-2.5">
                {isDemoProject ? (
                  <span
                    className="rounded-md border border-violet-400/22 bg-violet-500/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200/75"
                    title="Built-in example — use Sessions to open your own saved work"
                  >
                    Demo
                  </span>
                ) : null}
                <HeaderAccount />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2.5",
                "lg:max-w-[min(100%,22rem)]",
              )}
            >
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
                className="h-9 min-w-0 flex-1 border-stone-800/80 bg-stone-950/80"
                aria-label="Session name"
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-2.5 lg:justify-center">
              <input {...hiddenFileProps} />
              <Button
                variant="secondary"
                size="icon"
                className="h-9 w-9 shrink-0 border-stone-700/70 text-stone-300"
                aria-label="Open audio file"
                type="button"
                onClick={onOpenFileClick}
              >
                <Upload className="h-4 w-4" />
              </Button>
              <SessionPicker
                sessionSelectValue={sessionSelectValue}
                demoProjectId={demoProjectId}
                demoProjectLabel={demoProjectLabel}
                userProjects={userProjects}
                cloudProjects={cloudProjects}
                showCloudSessions={showCloudSessions}
                onRestoreProject={onRestoreProject}
                selectClassName="max-w-[14rem] sm:max-w-[18rem] sm:flex-none"
              />
              <Button
                variant="secondary"
                type="button"
                className="h-9 shrink-0 border-stone-700/70 px-3 text-xs text-stone-200/95"
                disabled={saveDisabled || saveBusy}
                title={
                  saveDisabled
                    ? "Save is disabled for the built-in example. Upload or open your own session to save."
                    : undefined
                }
                onClick={onSaveProject}
              >
                {saveBusy ? (savePendingLabel ?? "Saving…") : saveLabel}
              </Button>
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

            <div className="flex shrink-0 items-center justify-start gap-2.5 sm:justify-end lg:min-w-[12rem]">
              {isDemoProject ? (
                <span
                  className="rounded-md border border-violet-400/22 bg-violet-500/8 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200/75"
                  title="Built-in example — use Sessions to open your own saved work"
                >
                  Demo
                </span>
              ) : null}
              <HeaderAccount />
            </div>
          </>
        )}
      </div>

      {cloudListError ? (
        <div
          className="mx-auto mt-2 max-w-[1600px] rounded-md border border-amber-800/50 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-100/95"
          role="alert"
        >
          Could not load cloud projects: {cloudListError}
        </div>
      ) : null}

      {saveStatusMessage ? (
        <div
          className={cn(
            "mx-auto mt-2 max-w-[1600px] rounded-md border px-3 py-2 text-[11px]",
            saveStatusTone === "error" &&
              "border-red-800/55 bg-red-950/45 text-red-100/95",
            saveStatusTone === "success" &&
              "border-emerald-800/45 bg-emerald-950/35 text-emerald-100/90",
            saveStatusTone === "progress" &&
              "border-violet-800/45 bg-violet-950/35 text-violet-100/90",
            saveStatusTone === "neutral" &&
              "border-stone-700/60 bg-stone-900/50 text-stone-300/95",
          )}
          role={saveStatusTone === "error" ? "alert" : "status"}
        >
          {saveStatusMessage}
        </div>
      ) : null}
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
  onRestartLoop: () => void;
  onResetZoomFullSong: () => void;
  onToggleLoopPlayback: () => void;
  onTempoSlider: (pct: number) => void;
  formatTime: (t: number) => string;
  /** Optional class on root `<nav>` (e.g. hide on mobile practice). */
  className?: string;
};

/**
 * Three-zone transport bar:
 *   LEFT   — phrase / practice context (Loop Playback toggle, Loop start, Full song)
 *   CENTER — playback focus (large Play/Pause + live time readout)
 *   RIGHT  — tempo control (label, slider, percentage with click/dblclick edit)
 *
 * Stop was removed intentionally — Woodshed is loop-centric, Play/Pause is enough.
 * The three columns use an equal `1fr/auto/1fr` grid so the Play button stays
 * visually centered regardless of the content in the side groups.
 */
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
    onRestartLoop,
    onResetZoomFullSong,
    onToggleLoopPlayback,
    onTempoSlider,
    formatTime,
    className: transportClassName,
  } = props;

  return (
    <nav
      aria-label="Playback and practice"
      className={cn(
        "border-b border-stone-800/40 bg-gradient-to-b from-stone-950/90 to-[#0a0908]/95 px-4 py-2.5",
        transportClassName,
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[1600px] flex-col gap-3",
          /**
           * Equal 1fr / auto / 1fr keeps the Play button in the optical center
           * even when the left and right groups have different content widths.
           */
          "lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-x-4",
        )}
      >
        {/* LEFT — phrase / practice context */}
        <div
          aria-label="Practice context"
          className={cn(
            "flex flex-wrap items-center justify-center gap-2 sm:gap-2.5",
            "lg:col-start-1 lg:justify-self-start lg:flex-nowrap",
          )}
        >
          <Button
            variant={loopPlaybackEnabled ? "outline" : "ghost"}
            type="button"
            className={cn(
              transportGhost,
              "min-w-0 max-w-[12.5rem] sm:max-w-none",
              /** Loop Playback is the most important left-zone control — keep its prominence. */
              loopPlaybackEnabled && "border-violet-500/40 bg-violet-500/10 text-violet-100/95",
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
          <Separator
            orientation="vertical"
            className="hidden h-7 bg-stone-800/55 sm:block"
          />
          <Button
            variant="ghost"
            type="button"
            className={transportGhost}
            aria-label="Restart active loop (R)"
            onClick={onRestartLoop}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Loop start
          </Button>
          <Button
            variant="ghost"
            type="button"
            className={transportGhost}
            aria-label="Reset zoom and show full song"
            disabled={!duration}
            onClick={onResetZoomFullSong}
          >
            <ZoomOut className="h-3.5 w-3.5" /> Full song
          </Button>
        </div>

        {/* CENTER — playback focus */}
        <div
          aria-label="Playback"
          className="flex items-center justify-center gap-3 sm:gap-4 lg:col-start-2"
        >
          <Button
            variant={isPlaying ? "secondary" : "default"}
            aria-label={isPlaying ? "Pause" : "Play"}
            type="button"
            size="icon"
            className={cn(
              "h-[3.25rem] w-[3.25rem] shrink-0 rounded-full border shadow-md shadow-violet-950/25 sm:h-14 sm:w-14",
              isPlaying
                ? "border-stone-600/80 bg-stone-800 text-stone-50"
                : "border-violet-400/35 bg-violet-600 text-white hover:bg-violet-500",
            )}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
            ) : (
              <Play className="ml-0.5 h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2} />
            )}
          </Button>
          {/*
            Time readout sits beside the Play button — no "TIME" label, just the digits.
            Fixed `w-[9.25rem]` + tabular-nums keeps the column width stable as the
            current time ticks, so neighboring controls never jitter.
          */}
          <span
            className={cn(
              "w-[9.25rem] shrink-0 font-mono text-sm tabular-nums",
              duration ? "text-stone-200" : "text-stone-500",
            )}
            aria-label="Current time over total duration"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* RIGHT — tempo control */}
        <div
          aria-label="Tempo"
          className={cn(
            "flex items-center gap-3",
            /**
             * `pr-1` keeps the percentage from kissing the right sidebar border
             * on the desktop layout where col 3 is `justify-self-end`.
             */
            "justify-center lg:col-start-3 lg:justify-self-end lg:pr-1",
          )}
        >
          <span className="text-[10px] uppercase tracking-[0.14em] text-stone-500">
            Tempo
          </span>
          <Slider
            className={cn(
              /**
               * Wide enough to feel like a real control, capped so it doesn't
               * dominate the toolbar visually. Tuned alongside the new layout
               * since the right zone no longer shares space with the time block.
               */
              "w-44 shrink-0 sm:w-56 lg:w-64",
            )}
            min={25}
            max={150}
            step={1}
            value={[tempoPercent]}
            title="Drag to adjust tempo · Double-click to reset to 100%"
            onValueChange={(v) => onTempoSlider(v[0] ?? 100)}
            onDoubleClick={(e) => {
              e.preventDefault();
              onTempoSlider(100);
            }}
          />
          <TempoPercentControl
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
          />
        </div>
      </div>
    </nav>
  );
});

/** PRD tempo range — must match `setActiveLoopTempoFromPercent` clamp in the store. */
const TEMPO_PERCENT_MIN = 25;
const TEMPO_PERCENT_MAX = 150;
/** Browser-typical max gap between a click and its double-click pair. */
const SINGLE_CLICK_DEBOUNCE_MS = 220;

type TempoPercentControlProps = {
  tempoPercent: number;
  onSetPercent: (percent: number) => void;
};

/**
 * Compact tempo readout that doubles as a precision editor.
 *
 * - single-click → reset tempo to 100% (deferred ~220ms so it doesn't preempt the dblclick)
 * - double-click → inline numeric input (Enter saves, Escape cancels, blur saves)
 *
 * Layout stays identical between display and edit modes so the toolbar never reflows.
 */
function TempoPercentControl({
  tempoPercent,
  onSetPercent,
}: TempoPercentControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Tracks whether the current blur should commit (Enter / blur) or revert (Escape). */
  const commitOnBlurRef = useRef(true);

  const rounded = Math.round(tempoPercent);

  const clearClickTimer = useCallback(() => {
    if (clickTimerRef.current != null) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearClickTimer(), [clearClickTimer]);

  const enterEditMode = useCallback(() => {
    clearClickTimer();
    commitOnBlurRef.current = true;
    setDraft(String(rounded));
    setIsEditing(true);
  }, [clearClickTimer, rounded]);

  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isEditing]);

  const commit = useCallback(() => {
    const parsed = Number.parseFloat(draft.trim());
    if (!Number.isFinite(parsed)) {
      setIsEditing(false);
      return;
    }
    const clamped = Math.min(
      TEMPO_PERCENT_MAX,
      Math.max(TEMPO_PERCENT_MIN, parsed),
    );
    onSetPercent(clamped);
    setIsEditing(false);
  }, [draft, onSetPercent]);

  const cancel = useCallback(() => {
    commitOnBlurRef.current = false;
    setIsEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    },
    [cancel, commit],
  );

  if (isEditing) {
    return (
      <div className="flex w-12 shrink-0 items-baseline justify-end gap-0.5">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="Tempo percent"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (commitOnBlurRef.current) {
              commit();
            } else {
              setIsEditing(false);
              commitOnBlurRef.current = true;
            }
          }}
          className={cn(
            "w-9 rounded-md border border-violet-400/40 bg-stone-900/80 px-1 py-0.5",
            "text-right font-mono text-[11px] tabular-nums text-stone-50",
            "outline-none focus-visible:border-violet-300 focus-visible:ring-1 focus-visible:ring-violet-400/40",
          )}
        />
        <span className="font-mono text-[11px] text-stone-400" aria-hidden>
          %
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Click to reset · Double-click to type a tempo"
      aria-label={`Tempo ${rounded}% — click to reset, double-click to edit`}
      className={cn(
        "w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-stone-200/95",
        "cursor-pointer rounded-md border border-transparent bg-transparent px-1 py-0.5",
        "transition-colors duration-150",
        "hover:border-stone-700/60 hover:bg-stone-800/55 hover:text-stone-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400/80",
      )}
      onClick={() => {
        clearClickTimer();
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null;
          onSetPercent(100);
        }, SINGLE_CLICK_DEBOUNCE_MS);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        enterEditMode();
      }}
    >
      {rounded}%
    </button>
  );
}
