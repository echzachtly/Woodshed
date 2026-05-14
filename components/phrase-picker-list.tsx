"use client";

import { memo } from "react";

import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export type PhrasePickerListProps = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onPickPhrase: (id: string) => void;
  listClassName?: string;
  /** Desktop: show “+ New Phrase” below the list (phrase authoring). */
  showNewPhrase?: boolean;
  onNewPhrase?: () => void;
};

export const PhrasePickerList = memo(function PhrasePickerList(
  props: PhrasePickerListProps,
) {
  const {
    loops,
    activeLoopId,
    onPickPhrase,
    listClassName,
    showNewPhrase = false,
    onNewPhrase,
  } = props;

  const showFooter = Boolean(showNewPhrase && onNewPhrase);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        showFooter ? "max-h-[min(56vh,420px)]" : "max-h-[min(56vh,400px)]",
        listClassName,
      )}
    >
      <ul
        className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain py-1 [-webkit-overflow-scrolling:touch]"
      >
        {loops.length === 0 ? (
          <li className="px-3 py-4 text-center text-[13px] text-stone-500">
            No phrases in this project yet.
          </li>
        ) : (
          loops.map((loop) => {
            const active = loop.id === activeLoopId;
            return (
              <li key={loop.id} className="min-w-0 px-1">
                <button
                  type="button"
                  onClick={() => onPickPhrase(loop.id)}
                  className={cn(
                    "flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
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
                    {active ? (
                      "✓"
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-medium leading-snug",
                        active ? "text-stone-50" : "text-stone-200",
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
          })
        )}
      </ul>

      {showFooter ? (
        <>
          <div
            role="separator"
            className="mx-3 shrink-0 border-t border-stone-800/70"
          />
          <div className="shrink-0 px-2 pb-2 pt-1.5">
            <button
              type="button"
              aria-label="Create new phrase"
              className={cn(
                "flex min-h-[48px] w-full items-center justify-center rounded-xl border border-dashed border-violet-500/35",
                "bg-violet-500/[0.06] px-3 py-2.5 text-sm font-medium text-violet-200/95",
                "transition-colors hover:border-violet-400/45 hover:bg-violet-500/12 hover:text-violet-50",
              )}
              onClick={onNewPhrase}
            >
              + New Phrase
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
});
