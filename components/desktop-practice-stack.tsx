"use client";

import {
  ListMusic,
  MoreHorizontal,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  Save,
  Upload,
  ZoomOut,
} from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useEffect, useRef, useState } from "react";

import { HeaderAccount } from "@/components/header-account";
import {
  MobileProjectSelectorTrigger,
} from "@/components/mobile-project-practice";
import { MobilePhraseSelectorTrigger } from "@/components/mobile-phrase-bottom-sheet";
import { PhrasePickerList } from "@/components/phrase-picker-list";
import { ProjectPickerList } from "@/components/project-picker-list";
import { TempoPillPicker } from "@/components/tempo-pill-picker";
import { Button } from "@/components/ui/button";
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import type { PracticeLoop } from "@/lib/loop-engine";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";

type OpenMenu = null | "project" | "phrase";

export type DesktopPracticeStackProps = {
  projectName: string;
  isDemoProject: boolean;
  sessionSelectValue: string;
  demoProjectId: string;
  demoProjectLabel: string;
  userProjects: StoredProjectMeta[];
  cloudProjects: CloudProjectSummary[];
  showCloudSessions: boolean;
  onRestoreProject: (id: string) => void | Promise<void>;
  onOpenAudioFile: () => void;
  activePhraseName: string;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onSelectPhrase: (id: string) => void;
  /** Add draft phrase (active + editable); desktop phrase menu + keyboard A. */
  onCreateNewPhrase: () => void;
  phrasesPanelOpen: boolean;
  onTogglePhrasesPanel: () => void;
  saveDisabled?: boolean;
  saveLabel?: string;
  saveBusy?: boolean;
  savePendingLabel?: string;
  saveStatusMessage?: string | null;
  saveStatusTone?: "neutral" | "progress" | "success" | "error";
  cloudListError?: string | null;
  devExportLoopsJson?: () => void;
  onSaveProject: () => void;
  hiddenFileProps: Omit<ComponentProps<"input">, "children"> & {
    "data-testid"?: string;
  };
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  loopPlaybackEnabled: boolean;
  canEnableLoopPlayback: boolean;
  tempoPercent: number;
  onTogglePlay: () => void;
  onRestartLoop: () => void;
  onResetZoomFullSong: () => void;
  onToggleLoopPlayback: () => void;
  onTempoSlider: (pct: number) => void;
  formatTime: (t: number) => string;
};

const menuShell =
  "absolute left-1/2 top-full z-[95] mt-2 w-[min(100%,min(26rem,calc(100vw-2rem)))] -translate-x-1/2 overflow-hidden rounded-xl border border-stone-700/55 bg-stone-950 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.55)]";

const practiceGhost =
  "h-8 gap-1 whitespace-nowrap rounded-full border border-transparent px-2.5 text-[11px] font-medium text-stone-500 transition-colors hover:border-stone-700/45 hover:bg-stone-900/50 hover:text-stone-300";

const menuItemClass =
  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-stone-200 transition-colors hover:bg-stone-800/70";

/**
 * Single centered desktop practice column: minimal utilities (account + menu),
 * project → phrase → play/time → repeat + navigation + tempo, then waveform.
 */
export const DesktopPracticeStack = memo(function DesktopPracticeStack(
  props: DesktopPracticeStackProps,
) {
  const {
    projectName,
    isDemoProject,
    sessionSelectValue,
    demoProjectId,
    demoProjectLabel,
    userProjects,
    cloudProjects,
    showCloudSessions,
    onRestoreProject,
    onOpenAudioFile,
    activePhraseName,
    loops,
    activeLoopId,
    onSelectPhrase,
    onCreateNewPhrase,
    phrasesPanelOpen,
    onTogglePhrasesPanel,
    saveDisabled = false,
    saveLabel = "Save",
    saveBusy = false,
    savePendingLabel,
    saveStatusMessage,
    saveStatusTone = "neutral",
    cloudListError,
    devExportLoopsJson,
    onSaveProject,
    hiddenFileProps,
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
  } = props;

  const [open, setOpen] = useState<OpenMenu>(null);
  const [utilOpen, setUtilOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const utilRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!utilOpen) return;
    const onDoc = (e: PointerEvent) => {
      if (utilRef.current?.contains(e.target as Node)) return;
      setUtilOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUtilOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [utilOpen]);

  const toggleMenu = (m: Exclude<OpenMenu, null>) =>
    setOpen((prev) => (prev === m ? null : m));

  const handleProjectPick = async (id: string) => {
    await onRestoreProject(id);
    setOpen(null);
  };

  const handlePhrasePick = (id: string) => {
    onSelectPhrase(id);
    setOpen(null);
  };

  const handleNewPhrase = () => {
    onCreateNewPhrase();
    setOpen(null);
  };

  const handleOpenAudioFromPicker = () => {
    setOpen(null);
    requestAnimationFrame(() => onOpenAudioFile());
  };

  return (
    <div
      className="shrink-0 border-b border-stone-800/45 bg-gradient-to-b from-stone-950 via-[#0c0a08] to-[#090807]"
      aria-label="Practice workspace"
    >
      {cloudListError ? (
        <div
          className="mx-auto max-w-lg px-4 pt-3 text-center sm:max-w-2xl sm:px-6"
          role="alert"
        >
          <div className="rounded-lg border border-amber-800/45 bg-amber-950/35 px-3 py-2 text-[11px] leading-snug text-amber-100/95">
            Could not load cloud projects: {cloudListError}
          </div>
        </div>
      ) : null}

      {saveStatusMessage ? (
        <div
          className={cn(
            "mx-auto max-w-lg px-4 pt-2 text-center sm:max-w-2xl sm:px-6",
            cloudListError ? "pt-2" : "pt-3",
          )}
          role={saveStatusTone === "error" ? "alert" : "status"}
        >
          <div
            className={cn(
              "rounded-lg border px-3 py-2 text-[11px] leading-snug",
              saveStatusTone === "error" &&
                "border-red-800/50 bg-red-950/40 text-red-100/95",
              saveStatusTone === "success" &&
                "border-emerald-800/40 bg-emerald-950/30 text-emerald-100/90",
              saveStatusTone === "progress" &&
                "border-violet-800/40 bg-violet-950/30 text-violet-100/90",
              saveStatusTone === "neutral" &&
                "border-stone-700/55 bg-stone-900/45 text-stone-300/95",
            )}
          >
            {saveStatusMessage}
          </div>
        </div>
      ) : null}

      <div className="relative mx-auto max-w-xl px-4 pb-1.5 pt-2 sm:max-w-2xl sm:px-6">
        <input {...hiddenFileProps} />
        <div className="flex items-center justify-end gap-2">
          <HeaderAccount compactMobile />
          <div ref={utilRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-500 hover:bg-stone-900/70 hover:text-stone-300"
              aria-expanded={utilOpen}
              aria-haspopup="menu"
              aria-label="Workspace menu — save, files, phrase list"
              onClick={() => {
                setUtilOpen((o) => {
                  const next = !o;
                  if (next) setOpen(null);
                  return next;
                });
              }}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </Button>
            {utilOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+4px)] z-[120] min-w-[13.5rem] rounded-xl border border-stone-700/55 bg-stone-950 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
              >
                <button
                  type="button"
                  role="menuitem"
                  disabled={saveDisabled || saveBusy}
                  title={
                    saveDisabled
                      ? "Save is disabled for the built-in example."
                      : undefined
                  }
                  className={cn(
                    menuItemClass,
                    (saveDisabled || saveBusy) &&
                      "cursor-not-allowed opacity-50 hover:bg-transparent",
                  )}
                  onClick={() => {
                    if (saveDisabled || saveBusy) return;
                    setUtilOpen(false);
                    onSaveProject();
                  }}
                >
                  <Save className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  {saveBusy ? (savePendingLabel ?? "Saving…") : saveLabel}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(menuItemClass, "border-t border-stone-800/50")}
                  onClick={() => {
                    setUtilOpen(false);
                    requestAnimationFrame(() => onOpenAudioFile());
                  }}
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Open audio file…
                </button>
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={phrasesPanelOpen}
                  aria-label={
                    phrasesPanelOpen
                      ? "Phrase list panel visible"
                      : "Phrase list panel hidden"
                  }
                  className={cn(menuItemClass, "border-t border-stone-800/50")}
                  onClick={() => {
                    setUtilOpen(false);
                    onTogglePhrasesPanel();
                  }}
                >
                  <ListMusic className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                  {phrasesPanelOpen ? "Hide phrase list" : "Show phrase list"}
                </button>
                {devExportLoopsJson ? (
                  <button
                    type="button"
                    role="menuitem"
                    className={cn(
                      menuItemClass,
                      "border-t border-stone-800/50 text-[12px] text-amber-200/90 hover:bg-amber-950/25",
                    )}
                    onClick={() => {
                      setUtilOpen(false);
                      devExportLoopsJson();
                    }}
                  >
                    Export loops JSON
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 pb-8 pt-5 sm:max-w-lg sm:gap-5 sm:pb-9 sm:pt-6"
      >
        <div className="relative w-full max-w-[min(100%,19rem)] sm:max-w-[21rem]">
          <MobileProjectSelectorTrigger
            projectName={projectName}
            isDemoProject={isDemoProject}
            sheetOpen={open === "project"}
            onOpen={() => {
              setUtilOpen(false);
              toggleMenu("project");
            }}
            ariaHasPopup="menu"
            triggerClassName={cn(
              "max-w-none w-full min-h-[40px] gap-2.5 border-stone-700/35 bg-stone-950/75 px-4 py-2 text-[12px] opacity-95",
              "shadow-none",
            )}
          />
          {open === "project" ? (
            <div className={menuShell}>
              <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Projects
              </p>
              <ProjectPickerList
                sessionSelectValue={sessionSelectValue}
                demoProjectId={demoProjectId}
                demoProjectLabel={demoProjectLabel}
                userProjects={userProjects}
                cloudProjects={cloudProjects}
                showCloudSessions={showCloudSessions}
                onPickProject={handleProjectPick}
                onOpenAudioFile={handleOpenAudioFromPicker}
                listClassName="max-h-[min(50vh,380px)] px-2 pb-2"
              />
            </div>
          ) : null}
        </div>

        <div className="relative mt-0.5 w-full max-w-[min(100%,24rem)] sm:max-w-[28rem]">
          <MobilePhraseSelectorTrigger
            activePhraseName={activePhraseName}
            sheetOpen={open === "phrase"}
            onOpen={() => {
              setUtilOpen(false);
              toggleMenu("phrase");
            }}
            ariaHasPopup="menu"
            triggerClassName="max-w-none w-full min-h-[52px] sm:min-h-[58px] sm:px-6 sm:text-[17px]"
          />
          {open === "phrase" ? (
            <div className={menuShell}>
              <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Phrases
              </p>
              <PhrasePickerList
                loops={loops}
                activeLoopId={activeLoopId}
                onPickPhrase={handlePhrasePick}
                showNewPhrase
                onNewPhrase={handleNewPhrase}
                listClassName="max-h-[min(52vh,420px)] px-2 pb-2"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <Button
            variant={isPlaying ? "secondary" : "default"}
            aria-label={isPlaying ? "Pause" : "Play"}
            type="button"
            size="icon"
            className={cn(
              "h-[4.25rem] w-[4.25rem] shrink-0 rounded-full border shadow-lg shadow-violet-950/30 sm:h-[4.5rem] sm:w-[4.5rem]",
              isPlaying
                ? "border-stone-600/80 bg-stone-800 text-stone-50"
                : "border-violet-400/40 bg-violet-600 text-white hover:bg-violet-500",
            )}
            onClick={onTogglePlay}
          >
            {isPlaying ? (
              <Pause className="h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2} />
            ) : (
              <Play className="ml-1 h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2} />
            )}
          </Button>
          <span
            className={cn(
              "font-mono text-[13px] tabular-nums tracking-tight",
              duration ? "text-stone-400" : "text-stone-600",
            )}
            aria-label="Current time over total duration"
          >
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div
          className="inline-flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-2 rounded-2xl border border-stone-800/40 bg-stone-900/30 px-2.5 py-2 sm:gap-x-2"
          aria-label="Practice controls"
        >
          <button
            type="button"
            className={cn(
              "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              loopPlaybackEnabled
                ? "border-violet-500/45 bg-violet-500/[0.12] text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                : "border-stone-700/50 bg-stone-900/35 text-stone-500 hover:border-stone-600/55 hover:bg-stone-900/55 hover:text-stone-400",
            )}
            aria-pressed={loopPlaybackEnabled}
            aria-label={
              loopPlaybackEnabled
                ? "Turn off repeat phrase"
                : "Turn on repeat phrase"
            }
            disabled={!loopPlaybackEnabled && !canEnableLoopPlayback}
            onClick={onToggleLoopPlayback}
          >
            <Repeat className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            {loopPlaybackEnabled ? "Repeat on" : "Repeat off"}
          </button>

          <Button
            variant="ghost"
            type="button"
            className={practiceGhost}
            aria-label="Jump to phrase start"
            onClick={onRestartLoop}
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Phrase start
          </Button>
          <Button
            variant="ghost"
            type="button"
            className={practiceGhost}
            aria-label="Reset zoom and show full song"
            disabled={!duration}
            onClick={onResetZoomFullSong}
          >
            <ZoomOut className="h-3 w-3" /> Full song
          </Button>

          <TempoPillPicker
            tempoPercent={tempoPercent}
            onSetPercent={onTempoSlider}
            className="relative mx-0 w-[min(100%,8.75rem)] shrink-0"
          />
        </div>
      </div>
    </div>
  );
});
