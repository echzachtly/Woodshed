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
import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import { cloudSessionPickerValue } from "@/lib/cloud-projects/constants";
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

            <ul
              className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-3 pb-4 [-webkit-overflow-scrolling:touch]"
              role="list"
            >
              <li className="px-1 pt-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  Example
                </p>
              </li>
              <li className="min-w-0">
                <button
                  type="button"
                  onClick={() => handlePick(demoProjectId)}
                  className={cn(
                    "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors touch-manipulation",
                    sessionSelectValue === demoProjectId
                      ? "bg-violet-500/[0.12] text-stone-50"
                      : "text-stone-300 hover:bg-stone-800/50 active:bg-stone-800/70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none",
                      sessionSelectValue === demoProjectId
                        ? "border-violet-400/45 bg-violet-500/20 text-violet-100"
                        : "border-stone-700/40 bg-stone-800/50",
                    )}
                    aria-hidden
                  >
                    {sessionSelectValue === demoProjectId ? "✓" : (
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug">
                    {demoProjectLabel}
                  </span>
                </button>
              </li>

              <li className="px-1 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                  This device
                </p>
              </li>
              {userProjects.length === 0 ? (
                <li className="px-2 py-2 text-[13px] text-stone-500">
                  No saved projects on this device yet.
                </li>
              ) : (
                userProjects.map((p) => {
                  const active = sessionSelectValue === p.id;
                  return (
                    <li key={p.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => handlePick(p.id)}
                        className={cn(
                          "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors touch-manipulation",
                          active
                            ? "bg-violet-500/[0.12] text-stone-50"
                            : "text-stone-300 hover:bg-stone-800/50 active:bg-stone-800/70",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none",
                            active
                              ? "border-violet-400/45 bg-violet-500/20 text-violet-100"
                              : "border-stone-700/40 bg-stone-800/50",
                          )}
                          aria-hidden
                        >
                          {active ? "✓" : (
                            <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug">
                          {p.name ?? p.id}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}

              {showCloudSessions ? (
                <>
                  <li className="px-1 pt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      Cloud
                    </p>
                  </li>
                  {cloudProjects.length === 0 ? (
                    <li className="px-2 py-2 text-[13px] text-stone-500">
                      No cloud projects yet.
                    </li>
                  ) : (
                    cloudProjects.map((p) => {
                      const v = cloudSessionPickerValue(p.id);
                      const active = sessionSelectValue === v;
                      return (
                        <li key={p.id} className="min-w-0">
                          <button
                            type="button"
                            onClick={() => handlePick(v)}
                            className={cn(
                              "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors touch-manipulation",
                              active
                                ? "bg-violet-500/[0.12] text-stone-50"
                                : "text-stone-300 hover:bg-stone-800/50 active:bg-stone-800/70",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none",
                                active
                                  ? "border-violet-400/45 bg-violet-500/20 text-violet-100"
                                  : "border-stone-700/40 bg-stone-800/50",
                              )}
                              aria-hidden
                            >
                              {active ? "✓" : (
                                <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug">
                              {p.name ?? p.id}
                            </span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </>
              ) : null}
            </ul>
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
};

/** Tappable pill — smaller / subtler than the phrase selector. */
export const MobileProjectSelectorTrigger = memo(
  function MobileProjectSelectorTrigger(props: MobileProjectSelectorTriggerProps) {
    const { projectName, isDemoProject, sheetOpen, onOpen } = props;
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          aria-label={`Current project: ${projectName}. Tap to switch project.`}
          className={cn(
            "mx-auto flex min-h-[44px] w-full max-w-[min(100%,22rem)] items-center gap-2 rounded-xl border px-3.5 py-2",
            "border-stone-600/40 bg-gradient-to-b from-stone-900/85 to-stone-950/95 text-stone-200",
            "shadow-inner shadow-black/25",
            "transition-[transform,border-color,background-color] active:scale-[0.99] touch-manipulation",
            "hover:border-stone-500/50 hover:bg-stone-900/90 hover:text-stone-100",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70",
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
