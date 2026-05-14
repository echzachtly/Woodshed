"use client";

import { MoreHorizontal, Save, Upload } from "lucide-react";
import type { ComponentProps } from "react";
import { memo, useEffect, useRef, useState } from "react";

import { HeaderAccount } from "@/components/header-account";
import {
  MobileProjectSelectorTrigger,
} from "@/components/mobile-project-practice";
import { MobilePhraseSelectorTrigger } from "@/components/mobile-phrase-bottom-sheet";
import { PhrasePickerList } from "@/components/phrase-picker-list";
import { ProjectPickerList } from "@/components/project-picker-list";
import { Button } from "@/components/ui/button";
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import type { PracticeLoop } from "@/lib/loop-engine";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";

type OpenMenu = null | "project" | "phrase";

const menuShell =
  "absolute left-0 top-[calc(100%+6px)] z-[95] w-[min(100%,min(26rem,calc(100vw-2rem)))] overflow-hidden rounded-xl border border-stone-700/55 bg-stone-950 py-2 shadow-[0_16px_48px_rgba(0,0,0,0.55)]";

const menuItemClass =
  "flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-stone-200 transition-colors hover:bg-stone-800/70";

export type DesktopHeaderBarProps = {
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
  onCreateNewPhrase: () => void;
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
};

export const DesktopHeaderBar = memo(function DesktopHeaderBar(
  props: DesktopHeaderBarProps,
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
    <header
      className="shrink-0 border-b border-stone-800/50 bg-gradient-to-r from-[#090807] via-[#0c0a08] to-[#090807]"
      aria-label="Session"
    >
      {cloudListError ? (
        <div className="border-b border-amber-900/30 bg-amber-950/25 px-4 py-1.5 text-[11px] text-amber-100/90">
          Could not load cloud projects: {cloudListError}
        </div>
      ) : null}
      {saveStatusMessage ? (
        <div
          className={cn(
            "border-b px-4 py-1.5 text-[11px] leading-snug",
            saveStatusTone === "error" &&
              "border-red-900/35 bg-red-950/30 text-red-100/95",
            saveStatusTone === "success" &&
              "border-emerald-900/30 bg-emerald-950/25 text-emerald-100/90",
            saveStatusTone === "progress" &&
              "border-violet-900/30 bg-violet-950/25 text-violet-100/90",
            saveStatusTone === "neutral" &&
              "border-stone-800/40 bg-stone-900/40 text-stone-300",
          )}
          role={saveStatusTone === "error" ? "alert" : "status"}
        >
          {saveStatusMessage}
        </div>
      ) : null}

      <div className="flex min-h-10 items-center gap-2 px-3 py-1.5 sm:px-4">
        <input {...hiddenFileProps} />
        <div
          ref={wrapRef}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2"
        >
          <div className="relative min-w-[8rem] max-w-[14rem] flex-1 sm:max-w-[18rem]">
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
                "w-full min-h-[34px] gap-2 border-stone-700/40 bg-stone-950/80 px-2.5 py-1 text-[12px]",
                "shadow-none",
              )}
            />
            {open === "project" ? (
              <div className={menuShell}>
                <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
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
                  listClassName="max-h-[min(46vh,360px)] px-2 pb-2"
                />
              </div>
            ) : null}
          </div>

          <span className="hidden text-stone-600 sm:inline" aria-hidden>
            /
          </span>

          <div className="relative min-w-[8rem] max-w-[16rem] flex-1 sm:max-w-[20rem]">
            <MobilePhraseSelectorTrigger
              activePhraseName={activePhraseName}
              sheetOpen={open === "phrase"}
              onOpen={() => {
                setUtilOpen(false);
                toggleMenu("phrase");
              }}
              ariaHasPopup="menu"
              triggerClassName="w-full min-h-[34px] border-stone-700/40 bg-stone-950/80 px-2.5 py-1 text-[13px] sm:text-[14px]"
            />
            {open === "phrase" ? (
              <div className={menuShell}>
                <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Phrases
                </p>
                <PhrasePickerList
                  loops={loops}
                  activeLoopId={activeLoopId}
                  onPickPhrase={handlePhrasePick}
                  showNewPhrase
                  onNewPhrase={handleNewPhrase}
                  listClassName="max-h-[min(46vh,380px)] px-2 pb-2"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            className="hidden h-8 gap-1.5 rounded-md border border-violet-500/35 bg-violet-600/90 px-3 text-[12px] text-white hover:bg-violet-500 sm:inline-flex"
            disabled={saveDisabled || saveBusy}
            title={
              saveDisabled ? "Save is disabled for the built-in example." : undefined
            }
            onClick={() => {
              if (saveDisabled || saveBusy) return;
              onSaveProject();
            }}
          >
            <Save className="h-3.5 w-3.5 opacity-90" aria-hidden />
            {saveBusy ? (savePendingLabel ?? "Saving…") : saveLabel}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="hidden h-8 border-stone-700/50 bg-stone-950/50 text-[12px] text-stone-300 hover:bg-stone-900/80 sm:inline-flex"
            onClick={() => onOpenAudioFile()}
          >
            <Upload className="mr-1 h-3.5 w-3.5 opacity-80" aria-hidden />
            Import
          </Button>

          <HeaderAccount compactMobile />

          <div ref={utilRef} className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-stone-500 hover:bg-stone-900/70 hover:text-stone-300"
              aria-expanded={utilOpen}
              aria-haspopup="menu"
              aria-label="More — save, import, developer"
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
                  className={cn(menuItemClass, "sm:hidden")}
                  disabled={saveDisabled || saveBusy}
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
                  className={cn(menuItemClass, "sm:hidden")}
                  onClick={() => {
                    setUtilOpen(false);
                    requestAnimationFrame(() => onOpenAudioFile());
                  }}
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Import audio…
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    menuItemClass,
                    "border-t border-stone-800/50 sm:border-t-0",
                  )}
                  onClick={() => {
                    setUtilOpen(false);
                    requestAnimationFrame(() => onOpenAudioFile());
                  }}
                >
                  <Upload className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Open audio file…
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
    </header>
  );
});
