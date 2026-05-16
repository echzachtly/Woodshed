"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type ChangeEvent, type RefObject } from "react";

import { HeaderAccount } from "@/components/header-account";
import { MobileEditActionsSheet } from "@/components/mobile-edit-actions-sheet";
import {
  MobilePhraseBottomSheet,
  MobilePhraseSelectorTrigger,
} from "@/components/mobile-phrase-bottom-sheet";
import {
  MobileProjectBottomSheet,
  MobileProjectSelectorTrigger,
} from "@/components/mobile-project-practice";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import {
  describeLoopModeForMobile,
  getLoopModeDisplay,
} from "@/lib/practice-loop-mode";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";
import type { PhraseSegment, PracticeLoop } from "@/lib/loop-engine";
import type { LoopPracticeScope } from "@/store/woodshed-store";

function formatCompactTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function focusChipLabel(seg: PhraseSegment, index: number): string {
  const n = seg.name?.trim();
  if (n) return n;
  return `Target ${index + 1}`;
}

export type MobilePracticeControlsProps = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileAccept: string;
  onFileInputChange: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  projectName: string;
  isDemoProject: boolean;
  sessionSelectValue: string;
  demoProjectId: string;
  demoProjectLabel: string;
  userProjects: StoredProjectMeta[];
  cloudProjects: CloudProjectSummary[];
  showCloudSessions: boolean;
  onRestoreProject: (id: string) => void | Promise<void>;
  saveStatusMessage?: string | null;
  saveStatusTone?: "neutral" | "progress" | "success" | "error";
  cloudListError?: string | null;
  activePhraseName: string;
  isPlaying: boolean;
  duration: number;
  currentTime: number;
  tempoPercent: number;
  loopPlaybackEnabled: boolean;
  canEnableLoopPlayback: boolean;
  loopPracticeScope: LoopPracticeScope;
  phraseHasFocusRegions: boolean;
  onCycleLoopPlaybackMode: () => void;
  onTogglePlay: () => void;
  onTempoSlider: (pct: number) => void;
  onResetTempoTo100: () => void;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onSelectPhrase: (id: string) => void;
  /** Focus regions on the active phrase (playback targets, not navigation). */
  focusSegments: PhraseSegment[];
  onRestartPractice: () => void;
  onSelectFocusSegment: (segmentId: string) => void;
  /** True when restart can seek to a valid phrase or focus boundary. */
  canRestartPractice: boolean;
  /** Chip highlight (includes resolver when Focus Loop from pill only). */
  focusChipSelectedSegmentId: string | null;
  /**
   * Increment to open the project bottom sheet from the parent (e.g. empty workspace).
   */
  projectPickerOpenSignal?: number;
  /** Decoded timeline not ready — quieter mobile transport chrome. */
  timelineIdle?: boolean;
  /** Mobile M1: explicit editing posture scaffolding (structure tools deferred). */
  mobileEditModeActive?: boolean;
  onEnterMobileEditMode?: () => void;
  onExitMobileEditMode?: () => void;
  showYoutubeImport?: boolean;
  onPasteYoutubeLink?: () => void;
  /**
   * Replaces default “only open native file picker” behavior after picking Open audio file… from mobile Projects sheet.
   */
  onOpenAudioFromProjectPicker?: () => void;
};

/**
 * Bottom-docked controls: transport (Edit + Restart·Play·loop) under waveform,
 * project + Practice Section, Focus Loop chips, speed, edit banner when active, account.
 */
export const MobilePracticeControls = memo(function MobilePracticeControls(
  props: MobilePracticeControlsProps,
) {
  const {
    fileInputRef,
    fileAccept,
    onFileInputChange,
    projectName,
    isDemoProject,
    sessionSelectValue,
    demoProjectId,
    demoProjectLabel,
    userProjects,
    cloudProjects,
    showCloudSessions,
    onRestoreProject,
    saveStatusMessage,
    saveStatusTone = "neutral",
    cloudListError,
    activePhraseName,
    isPlaying,
    duration,
    currentTime,
    tempoPercent,
    loopPlaybackEnabled,
    canEnableLoopPlayback,
    loopPracticeScope,
    phraseHasFocusRegions,
    onCycleLoopPlaybackMode,
    onTogglePlay,
    onTempoSlider,
    onResetTempoTo100,
    loops,
    activeLoopId,
    onSelectPhrase,
    focusSegments,
    onRestartPractice,
    onSelectFocusSegment,
    canRestartPractice,
    focusChipSelectedSegmentId,
    projectPickerOpenSignal = 0,
    timelineIdle = false,
    mobileEditModeActive = false,
    onEnterMobileEditMode,
    onExitMobileEditMode,
    showYoutubeImport = false,
    onPasteYoutubeLink,
    onOpenAudioFromProjectPicker,
  } = props;

  const [phraseSheetOpen, setPhraseSheetOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [editActionsSheetOpen, setEditActionsSheetOpen] = useState(false);
  const handledProjectPickerSignalRef = useRef(0);
  const roundedTempo = Math.round(tempoPercent);

  const loopCurrent = getLoopModeDisplay(
    loopPlaybackEnabled,
    loopPracticeScope,
    phraseHasFocusRegions,
  );
  const loopTooltip = `${describeLoopModeForMobile(loopCurrent)}. Tap to cycle.`;
  const loopAria = `${loopCurrent}. ${describeLoopModeForMobile(loopCurrent)}. Tap to cycle modes.`;

  const restartHelp =
    phraseHasFocusRegions && loopPracticeScope === "practice_region"
      ? "Restart Focus Loop"
      : "Restart Practice Section";

  const openProjectSheet = () => {
    setPhraseSheetOpen(false);
    setEditActionsSheetOpen(false);
    setProjectSheetOpen(true);
  };

  useEffect(() => {
    if (projectPickerOpenSignal <= handledProjectPickerSignalRef.current) {
      return;
    }
    handledProjectPickerSignalRef.current = projectPickerOpenSignal;
    setPhraseSheetOpen(false);
    setEditActionsSheetOpen(false);
    setProjectSheetOpen(true);
  }, [projectPickerOpenSignal]);

  const openPhraseSheet = () => {
    setProjectSheetOpen(false);
    setEditActionsSheetOpen(false);
    setPhraseSheetOpen(true);
  };

  const openEditActionsSheet = () => {
    setPhraseSheetOpen(false);
    setProjectSheetOpen(false);
    setEditActionsSheetOpen(true);
  };

  useEffect(() => {
    if (!mobileEditModeActive) {
      setEditActionsSheetOpen(false);
    }
  }, [mobileEditModeActive]);

  const openAudioFromProjectSheet = useCallback(() => {
    if (onOpenAudioFromProjectPicker) {
      onOpenAudioFromProjectPicker();
      return;
    }
    fileInputRef.current?.click();
  }, [fileInputRef, onOpenAudioFromProjectPicker]);

  const showFocusChips = focusSegments.length > 0;
  const pickerClass = "max-w-none w-full mx-0 min-h-[48px]";
  const hasMobileEditCallbacks = Boolean(
    onEnterMobileEditMode && onExitMobileEditMode,
  );
  const showEditEntry =
    !timelineIdle && hasMobileEditCallbacks && !mobileEditModeActive;
  /** Avoid an empty left rail during timeline idle — keeps the transport cluster centered. */
  const reserveTransportEditRail =
    hasMobileEditCallbacks && (!timelineIdle || mobileEditModeActive);

  return (
    <div
      className={cn(
        "shrink-0 space-y-2 border-t border-stone-800/80 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 min-[769px]:hidden transition-[border-color,background-image,box-shadow] duration-150",
        "shadow-[0_-8px_28px_rgba(0,0,0,0.22)]",
        mobileEditModeActive
          ? "border-violet-500/30 bg-gradient-to-t from-violet-950/30 via-[#0a0908] to-[#0a0908]"
          : "border-stone-800/50 bg-gradient-to-b from-[#0c0a09] to-[#0a0908]",
      )}
      aria-label="Playback and practice controls"
      data-mobile-edit-mode={mobileEditModeActive ? "true" : "false"}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={fileAccept}
        className="sr-only"
        aria-hidden
        onChange={onFileInputChange}
      />
      {cloudListError ? (
        <div
          className="rounded-md border border-amber-800/40 bg-amber-950/30 px-2.5 py-1.5 text-[10px] leading-snug text-amber-100/95"
          role="alert"
        >
          Cloud list: {cloudListError}
        </div>
      ) : null}

      {saveStatusMessage ? (
        <div
          className={cn(
            "rounded-md border px-2.5 py-1.5 text-[10px] leading-snug",
            saveStatusTone === "error" &&
              "border-red-800/50 bg-red-950/35 text-red-100/95",
            saveStatusTone === "success" &&
              "border-emerald-800/40 bg-emerald-950/30 text-emerald-100/90",
            saveStatusTone === "progress" &&
              "border-violet-800/40 bg-violet-950/30 text-violet-100/90",
            saveStatusTone === "neutral" &&
              "border-stone-700/50 bg-stone-900/45 text-stone-300/95",
          )}
          role={saveStatusTone === "error" ? "alert" : "status"}
        >
          {saveStatusMessage}
        </div>
      ) : null}

      {/* Transport — Edit (waveform-adjacent) + primary cluster Restart → Play → loop */}
      <div className="mx-auto flex w-full max-w-[min(100%,24rem)] flex-col gap-1.5">
        <div
          className={cn(
            "flex w-full items-center gap-1.5",
            !reserveTransportEditRail && "justify-center",
          )}
          role="group"
          aria-label="Playback transport"
        >
          {reserveTransportEditRail ? (
            <div className="flex w-11 shrink-0 flex-col items-center justify-center self-stretch">
              {showEditEntry ? (
                <button
                  type="button"
                  disabled={isDemoProject}
                  title={
                    isDemoProject
                      ? "Editing isn’t available for the demo project yet."
                      : "Enter Edit mode"
                  }
                  aria-label={
                    isDemoProject
                      ? "Edit unavailable for the demo project"
                      : "Edit"
                  }
                  onClick={() => onEnterMobileEditMode?.()}
                  className={cn(
                    "flex h-11 min-w-[44px] max-w-[3.25rem] flex-col items-center justify-center rounded-lg border px-1 py-1 text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] transition-colors touch-manipulation",
                    isDemoProject
                      ? "border-stone-800/50 bg-stone-950/30 text-stone-600 opacity-55"
                      : "border-stone-700/55 bg-stone-900/55 text-stone-400 hover:border-violet-500/35 hover:bg-stone-800/80 hover:text-stone-100",
                  )}
                >
                  Edit
                </button>
              ) : (
                <span className="inline-block h-11 w-11 shrink-0" aria-hidden />
              )}
            </div>
          ) : null}
          <div
            className={cn(
              "flex min-h-[48px] min-w-0 items-center justify-center gap-1.5",
              reserveTransportEditRail ? "flex-1" : "",
            )}
          >
            <Button
              variant="secondary"
              type="button"
              size="icon"
              aria-label={restartHelp}
              title={
                timelineIdle ? "Available after loading audio" : restartHelp
              }
              disabled={!canRestartPractice || timelineIdle}
              className={cn(
                "h-12 w-12 shrink-0 rounded-full border shadow-md shadow-black/30",
                "border-stone-600/75 bg-stone-900/90 text-stone-200",
                "hover:border-violet-500/35 hover:bg-stone-800/90 hover:text-violet-100",
                "disabled:pointer-events-none disabled:opacity-40",
                timelineIdle &&
                  "border-stone-800/60 bg-stone-950/50 text-stone-600 shadow-none",
              )}
              onClick={onRestartPractice}
            >
              <RotateCcw className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Button>
            <Button
              variant={isPlaying ? "secondary" : "default"}
              type="button"
              size="icon"
              aria-label={
                timelineIdle ? "Play — waiting for audio" : isPlaying ? "Pause" : "Play"
              }
              disabled={timelineIdle}
              className={cn(
                "h-[4.5rem] w-[4.5rem] shrink-0 rounded-full border shadow-lg shadow-violet-950/30",
                isPlaying
                  ? "border-stone-600/80 bg-stone-800 text-stone-50"
                  : "border-violet-400/35 bg-violet-600 text-white hover:bg-violet-500",
                timelineIdle &&
                  "pointer-events-none border-stone-800/65 bg-stone-950/55 text-stone-600 opacity-65 shadow-none",
              )}
              onClick={onTogglePlay}
            >
              {isPlaying ? (
                <Pause className="h-10 w-10" strokeWidth={2} />
              ) : (
                <Play className="ml-1 h-10 w-10" strokeWidth={2} />
              )}
            </Button>
            {timelineIdle ? (
              <div
                className="flex min-h-[44px] min-w-[5.5rem] max-w-[8.5rem] flex-col items-center justify-center rounded-full border border-stone-800/55 bg-stone-950/40 px-2 py-1 text-center opacity-85"
                role="status"
                aria-label="Repeat mode idle until audio is loaded"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-600">
                  —
                </span>
              </div>
            ) : (
              <button
                type="button"
                className={cn(
                  "flex min-h-[44px] min-w-[5.5rem] max-w-[8.5rem] flex-col items-center justify-center rounded-full border px-2 py-1.5 text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.06em] transition-colors touch-manipulation",
                  loopPlaybackEnabled
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-200/95"
                    : "border-stone-700/35 bg-stone-900/40 text-stone-500",
                )}
                aria-label={loopAria}
                disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
                title={loopTooltip}
                onClick={onCycleLoopPlaybackMode}
              >
                <span className="line-clamp-2 text-balance">{loopCurrent}</span>
              </button>
            )}
          </div>
        </div>
        <p
          className={cn(
            "text-center font-mono text-sm tabular-nums",
            timelineIdle ? "text-stone-600" : "text-stone-300",
          )}
          aria-label={
            timelineIdle
              ? "Position — idle until audio is loaded"
              : "Current time over total duration"
          }
        >
          {timelineIdle
            ? "— · —"
            : `${formatCompactTime(currentTime)} / ${formatCompactTime(duration)}`}
        </p>
      </div>

      {/* Project + Practice Section */}
      <div className="mx-auto w-full max-w-[min(100%,24rem)] border-t border-stone-800/45 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <MobileProjectSelectorTrigger
            projectName={projectName}
            isDemoProject={isDemoProject}
            sheetOpen={projectSheetOpen}
            onOpen={openProjectSheet}
            chromeIdle={timelineIdle}
            triggerClassName={pickerClass}
          />
          <MobilePhraseSelectorTrigger
            activePhraseName={activePhraseName}
            sheetOpen={phraseSheetOpen}
            onOpen={openPhraseSheet}
            chromeIdle={timelineIdle}
            triggerClassName={pickerClass}
          />
        </div>
      </div>

      {showFocusChips ? (
        <div
          className="mx-auto w-full max-w-[min(100%,24rem)]"
          role="group"
          aria-label="Focus Loops"
        >
          <p className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-600">
            Focus Loops
          </p>
          <div className="flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {focusSegments.map((seg, index) => {
              const selected = seg.id === focusChipSelectedSegmentId;
              return (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => onSelectFocusSegment(seg.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-left text-[11px] font-medium leading-tight transition-colors touch-manipulation",
                    selected
                      ? "border-violet-400/50 bg-violet-500/20 text-violet-50 shadow-sm shadow-violet-950/25"
                      : "border-stone-700/45 bg-stone-900/50 text-stone-300 hover:border-stone-600/70 hover:bg-stone-800/60",
                  )}
                  aria-pressed={selected}
                  aria-label={`Focus Loop: ${focusChipLabel(seg, index)}`}
                >
                  {focusChipLabel(seg, index)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "mx-auto w-full max-w-[min(100%,24rem)] space-y-2 border-t border-stone-800/40 pt-2",
          timelineIdle && "opacity-[0.88]",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[10px] font-medium uppercase tracking-[0.14em]",
              timelineIdle ? "text-stone-700" : "text-stone-500",
            )}
          >
            Speed
          </span>
          <button
            type="button"
            className="min-h-[40px] min-w-[44px] rounded-md border border-transparent px-2 py-1 font-mono text-xs tabular-nums disabled:pointer-events-none disabled:opacity-40 text-stone-200 hover:border-stone-700/60 hover:bg-stone-800/60"
            title={
              timelineIdle ? "Available after loading audio" : "Reset to 100% speed"
            }
            aria-label={
              timelineIdle ? "Speed idle until audio loads" : "Reset tempo to 100%"
            }
            disabled={timelineIdle}
            onClick={onResetTempoTo100}
          >
            {roundedTempo}%
          </button>
        </div>
        <Slider
          className={cn(
            "w-full",
            timelineIdle && "[&_[role=slider]]:opacity-55",
          )}
          min={25}
          max={150}
          step={1}
          disabled={timelineIdle}
          value={[tempoPercent]}
          title={
            timelineIdle ? "Adjust speed after loading audio" : "Drag to adjust speed"
          }
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
                disabled={timelineIdle}
                className={cn(
                  "h-10 min-w-[44px] border px-2 text-xs font-medium tabular-nums transition-colors disabled:pointer-events-none disabled:opacity-45",
                  isPreset
                    ? "border-violet-500/45 bg-violet-500/14 text-violet-100 shadow-sm shadow-violet-950/20 hover:bg-violet-500/20 hover:text-violet-50"
                    : "border-stone-800/35 bg-stone-950/40 text-stone-400 hover:border-stone-700/45 hover:bg-stone-900/70 hover:text-stone-200",
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

      {!timelineIdle && onEnterMobileEditMode && onExitMobileEditMode && mobileEditModeActive ? (
        <div className="mx-auto flex w-full max-w-[min(100%,24rem)] min-h-[40px] items-center justify-between gap-2 rounded-xl border border-violet-500/30 bg-violet-950/18 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200/90">
            Adjust on waveform
          </span>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[4.5rem] border-violet-500/35 bg-violet-950/30 text-violet-50 hover:bg-violet-900/45"
              onClick={openEditActionsSheet}
              aria-haspopup="dialog"
              aria-expanded={editActionsSheetOpen}
            >
              Actions
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 min-w-[4.75rem] border-violet-500/40 bg-violet-950/40 text-violet-50 hover:bg-violet-900/55"
              onClick={onExitMobileEditMode}
            >
              Done
            </Button>
          </div>
        </div>
      ) : null}

      <MobileProjectBottomSheet
        isOpen={projectSheetOpen}
        onClose={() => setProjectSheetOpen(false)}
        sessionSelectValue={sessionSelectValue}
        demoProjectId={demoProjectId}
        demoProjectLabel={demoProjectLabel}
        userProjects={userProjects}
        cloudProjects={cloudProjects}
        showCloudSessions={showCloudSessions}
        onSelectProject={onRestoreProject}
        onOpenAudioFile={openAudioFromProjectSheet}
        showYoutubeImport={showYoutubeImport}
        onPasteYoutubeLink={onPasteYoutubeLink}
      />

      <MobilePhraseBottomSheet
        isOpen={phraseSheetOpen}
        onClose={() => setPhraseSheetOpen(false)}
        loops={loops}
        activeLoopId={activeLoopId}
        onSelectPhrase={onSelectPhrase}
      />

      <MobileEditActionsSheet
        isOpen={editActionsSheetOpen}
        onClose={() => setEditActionsSheetOpen(false)}
        focusTargetSegmentId={focusChipSelectedSegmentId}
        isDemoProject={isDemoProject}
      />

      <div className="mx-auto flex w-full max-w-[min(100%,24rem)] justify-end border-t border-stone-800/35 pt-1.5">
        <HeaderAccount compactMobile />
      </div>
    </div>
  );
});
