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
import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type MobilePhraseBottomSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  loops: PracticeLoop[];
  activeLoopId: string | null;
  /** Select phrase, enable repeat, seek — parent handles store + audio. */
  onSelectPhrase: (id: string) => void;
};

export const MobilePhraseBottomSheet = memo(function MobilePhraseBottomSheet(
  props: MobilePhraseBottomSheetProps,
) {
  const { isOpen, onClose, loops, activeLoopId, onSelectPhrase } = props;
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
    onSelectPhrase(id);
    onClose();
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="phrase-backdrop"
            className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-[2px] min-[769px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
            onClick={onClose}
          />
          <motion.div
            key="woodshed-phrase-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[121] flex max-h-[min(78dvh,640px)] flex-col min-[769px]:hidden",
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
                    Phrases
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                    Select a phrase to practice.
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
              {loops.length === 0 ? (
                <li className="flex min-h-[52px] items-center justify-center px-2 py-6 text-center text-[13px] text-stone-500">
                  No phrases in this project yet.
                </li>
              ) : null}
              {loops.map((loop) => {
                const active = loop.id === activeLoopId;
                return (
                  <li key={loop.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => handlePick(loop.id)}
                      className={cn(
                        "flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors touch-manipulation sm:min-h-[56px]",
                        active
                          ? "bg-violet-500/[0.14] text-stone-50"
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
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-[15px] leading-snug",
                            active
                              ? "font-semibold text-stone-50"
                              : "font-medium text-stone-200",
                          )}
                        >
                          {loop.name}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block font-mono text-[12px] tabular-nums leading-none",
                            active ? "text-violet-200/75" : "text-stone-500",
                          )}
                        >
                          {formatPhraseTime(loop.start)} →{" "}
                          {formatPhraseTime(loop.end)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
});

export type MobilePhraseSelectorTriggerProps = {
  activePhraseName: string;
  sheetOpen: boolean;
  onOpen: () => void;
};

/** Tappable pill showing current phrase; opens bottom sheet. */
export const MobilePhraseSelectorTrigger = memo(
  function MobilePhraseSelectorTrigger(props: MobilePhraseSelectorTriggerProps) {
    const { activePhraseName, sheetOpen, onOpen } = props;
    return (
      <div className="text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-500">
          Active phrase
        </p>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={sheetOpen}
          aria-haspopup="dialog"
          className={cn(
            "mx-auto mt-2 flex min-h-[48px] max-w-[min(100%,22rem)] items-center justify-center gap-2 rounded-full border px-4 py-2.5",
            "border-violet-500/25 bg-gradient-to-b from-stone-900/90 to-stone-950/95 text-stone-100 shadow-inner shadow-black/20",
            "transition-colors active:scale-[0.99] touch-manipulation",
            "hover:border-violet-400/40 hover:bg-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70",
          )}
        >
          <span className="truncate text-[15px] font-semibold tracking-tight">
            {activePhraseName}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-violet-300/80 transition-transform",
              sheetOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      </div>
    );
  },
);
