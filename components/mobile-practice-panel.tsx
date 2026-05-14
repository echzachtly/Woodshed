"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { memo, useCallback, useState, type ChangeEvent, type RefObject } from "react";

import { HeaderAccount } from "@/components/header-account";
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
  getLoopModeDescription,
  getLoopModeDisplay,
  getNextLoopModeDisplay,
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
};

/**
 * Mobile practice stack: project → phrase → loop mode → focus targets → play/restart → tempo.
 * Phrase list: bottom sheet. Project list: separate bottom sheet.
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
  } = props;

  const [phraseSheetOpen, setPhraseSheetOpen] = useState(false);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const roundedTempo = Math.round(tempoPercent);

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
  const loopTooltip = `${getLoopModeDescription(loopCurrent)} — Next: ${getLoopModeDescription(loopNext)}. Tap to cycle.`;
  const loopAria = `Practice loop. ${getLoopModeDescription(loopCurrent)}. Next: ${getLoopModeDescription(loopNext)}.`;

  const restartHelp =
    phraseHasFocusRegions && loopPracticeScope === "practice_region"
      ? "Restart focus region"
      : "Restart phrase";

  const openProjectSheet = () => {
    setPhraseSheetOpen(false);
    setProjectSheetOpen(true);
  };

  const openPhraseSheet = () => {
    setProjectSheetOpen(false);
    setPhraseSheetOpen(true);
  };

  const openAudioFromProjectSheet = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const showFocusChips = focusSegments.length > 0;

  return (
    <div
      className="shrink-0 space-y-4 border-b border-stone-800/45 bg-gradient-to-b from-stone-950 to-[#0a0908] px-4 py-3 min-[769px]:hidden"
      aria-label="Mobile practice controls"
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

      <div className="flex w-full max-w-[min(100%,24rem)] mx-auto items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <MobileProjectSelectorTrigger
            projectName={projectName}
            isDemoProject={isDemoProject}
            sheetOpen={projectSheetOpen}
            onOpen={openProjectSheet}
          />
          <MobilePhraseSelectorTrigger
            activePhraseName={activePhraseName}
            sheetOpen={phraseSheetOpen}
            onOpen={openPhraseSheet}
          />
        </div>
        <div className="shrink-0 pt-0.5">
          <HeaderAccount compactMobile />
        </div>
      </div>

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
      />

      <MobilePhraseBottomSheet
        isOpen={phraseSheetOpen}
        onClose={() => setPhraseSheetOpen(false)}
        loops={loops}
        activeLoopId={activeLoopId}
        onSelectPhrase={onSelectPhrase}
      />

      <div className="flex w-full max-w-[min(100%,24rem)] mx-auto flex-col items-center gap-2.5">
        <div className="flex w-full flex-col items-center gap-0.5">
          <button
            type="button"
            className={cn(
              "min-h-[44px] max-w-[min(100%,18rem)] rounded-full border px-3 py-2 text-center text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] transition-colors touch-manipulation",
              loopPlaybackEnabled
                ? "border-violet-500/30 bg-violet-500/10 text-violet-200/95"
                : "border-stone-700/35 bg-stone-900/40 text-stone-500",
            )}
            aria-label={loopAria}
            disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
            title={loopTooltip}
            onClick={onCycleLoopPlaybackMode}
          >
            <span className="block tracking-[0.14em]">{loopCurrent}</span>
          </button>
          <p
            className="max-w-[min(100%,18rem)] text-center text-[10px] leading-snug text-stone-500"
            aria-live="polite"
          >
            Next:{" "}
            <span className="font-medium text-stone-400">
              {getLoopModeDescription(loopNext)}
            </span>
          </p>
        </div>

        {showFocusChips ? (
          <div
            className="w-full max-w-[min(100%,24rem)]"
            role="group"
            aria-label="Focus targets"
          >
            <p className="mb-1.5 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-600">
              Focus
            </p>
            <div
              className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
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
                    aria-label={`Focus: ${focusChipLabel(seg, index)}`}
                  >
                    {focusChipLabel(seg, index)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-center gap-3 pt-0.5">
          <Button
            variant="secondary"
            type="button"
            size="icon"
            aria-label={restartHelp}
            title={restartHelp}
            disabled={!canRestartPractice}
            className={cn(
              "h-12 w-12 shrink-0 rounded-full border shadow-md shadow-black/30",
              "border-stone-600/75 bg-stone-900/90 text-stone-200",
              "hover:border-violet-500/35 hover:bg-stone-800/90 hover:text-violet-100",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
            onClick={onRestartPractice}
          >
            <RotateCcw className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Button>
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
        </div>
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
    </div>
  );
});
