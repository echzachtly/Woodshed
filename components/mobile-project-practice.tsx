"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { ProjectPickerList } from "@/components/project-picker-list";
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type MobileProjectBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionSelectValue: string;
  demoProjectId: string;
  demoProjectLabel: string;
  userProjects: StoredProjectMeta[];
  cloudProjects: CloudProjectSummary[];
  showCloudSessions: boolean;
  onSelectProject: (id: string) => void | Promise<void>;
  /** Close sheet then open the hidden audio file input (mobile practice). */
  onOpenAudioFile: () => void;
  showYoutubeImport?: boolean;
  onPasteYoutubeLink?: () => void;
};

export const MobileProjectBottomSheet = memo(function MobileProjectBottomSheet(
  props: MobileProjectBottomSheetProps,
) {
  const {
    isOpen,
    onClose,
    sessionSelectValue,
    demoProjectId,
    demoProjectLabel,
    userProjects,
    cloudProjects,
    showCloudSessions,
    onSelectProject,
    onOpenAudioFile,
    showYoutubeImport = false,
    onPasteYoutubeLink,
  } = props;
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getFocusables = useCallback(() => {
    const root = sheetRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = getFocusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, onClose, getFocusables]);

  const handlePick = (id: string) => {
    void onSelectProject(id);
    onClose();
  };

  const handleOpenAudioFile = () => {
    onClose();
    window.requestAnimationFrame(() => {
      onOpenAudioFile();
    });
  };

  const handlePasteYoutubeLink = () => {
    if (!onPasteYoutubeLink) return;
    onClose();
    window.requestAnimationFrame(() => {
      onPasteYoutubeLink();
    });
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="project-backdrop"
            className="fixed inset-0 z-[122] bg-black/55 backdrop-blur-[2px] min-[769px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
            onClick={onClose}
          />
          <motion.div
            key="woodshed-project-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[123] flex max-h-[min(78dvh,640px)] flex-col min-[769px]:hidden",
              "rounded-t-2xl border border-stone-700/50 border-b-0 bg-stone-950 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1",
            )}
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            exit={{ y: "105%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
          >
            <div className="flex shrink-0 flex-col items-center px-4 pb-2 pt-2">
              <div
                className="mb-2 h-1 w-10 shrink-0 rounded-full bg-stone-600/80"
                aria-hidden
              />
              <div className="flex w-full items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2
                    id={titleId}
                    className="text-[12px] font-semibold uppercase tracking-[0.2em] text-stone-400"
                  >
                    Projects
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                    Example, this device, or cloud.
                  </p>
                </div>
                <Button
                  ref={closeBtnRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
                  aria-label="Close"
                  onClick={onClose}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </Button>
              </div>
            </div>

            <ProjectPickerList
              sessionSelectValue={sessionSelectValue}
              demoProjectId={demoProjectId}
              demoProjectLabel={demoProjectLabel}
              userProjects={userProjects}
              cloudProjects={cloudProjects}
              showCloudSessions={showCloudSessions}
              onPickProject={handlePick}
              onOpenAudioFile={handleOpenAudioFile}
              showYoutubeImport={showYoutubeImport}
              onPasteYoutubeLink={
                showYoutubeImport && onPasteYoutubeLink
                  ? handlePasteYoutubeLink
                  : undefined
              }
              listClassName="min-h-0 flex-1 px-3 pb-4"
            />
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
});

export type MobileProjectSelectorTriggerProps = {
  projectName: string;
  isDemoProject: boolean;
  sheetOpen: boolean;
  onOpen: () => void;
  /** Widen or restyle the pill (e.g. desktop). */
  triggerClassName?: string;
  /** Timeline not decoded — quieter project pill. */
  chromeIdle?: boolean;
  /** Desktop dropdown uses `menu`; mobile sheet uses `dialog`. */
  ariaHasPopup?: "dialog" | "menu";
};

/** Tappable pill — smaller / subtler than the phrase selector. */
export const MobileProjectSelectorTrigger = memo(
  function MobileProjectSelectorTrigger(props: MobileProjectSelectorTriggerProps) {
    const {
      projectName,
      isDemoProject,
      sheetOpen,
      onOpen,
      triggerClassName,
      chromeIdle = false,
      ariaHasPopup = "dialog",
    } = props;
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={sheetOpen}
          aria-haspopup={ariaHasPopup}
          aria-label={`Current project: ${projectName}. Tap to switch project.`}
          className={cn(
            "mx-auto flex min-h-[44px] w-full max-w-[min(100%,22rem)] items-center gap-2 rounded-xl border px-3.5 py-2",
            "transition-[transform,border-color,background-color] active:scale-[0.99] touch-manipulation",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70",
            chromeIdle
              ? "border-stone-800/55 bg-gradient-to-b from-stone-950/90 to-[#080605] text-stone-500 shadow-inner shadow-black/15 hover:border-stone-700/60 hover:bg-stone-950/95 hover:text-stone-400"
              : cn(
                  "border-stone-600/40 bg-gradient-to-b from-stone-900/85 to-stone-950/95 text-stone-200",
                  "shadow-inner shadow-black/25",
                  "hover:border-stone-500/50 hover:bg-stone-900/90 hover:text-stone-100",
                ),
            triggerClassName,
          )}
        >
          <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium leading-snug tracking-tight">
            {projectName}
          </span>
          {isDemoProject ? (
            <span
              className="shrink-0 rounded border border-violet-500/20 bg-violet-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-violet-300/80"
              title="Built-in example project"
            >
              Demo
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-stone-500 transition-transform",
              sheetOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
    );
  },
);
