"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

type Props = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  /** The single loop currently in draft / edit mode (locked otherwise). */
  editableLoopId: string | null;
  onSelectLoop: (id: string) => void;
  onRenameLoop: (id: string, name: string) => void;
  onAddLoop: () => void;
  onRemoveLoop: (id: string) => void;
  /** Toggle edit mode for a loop (null = finalize/lock). */
  onSetEditable: (id: string | null) => void;
};

/**
 * Compact m:ss formatter — phrase rows show the practice-friendly version,
 * not the precise fractional seconds used internally. Floor on seconds so
 * "0:03 → 0:28" reads like a track timestamp rather than a stopwatch.
 */
function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const LoopSidebar = memo(function LoopSidebar(props: Props) {
  const {
    loops,
    activeLoopId,
    editableLoopId,
    onSelectLoop,
    onRenameLoop,
    onAddLoop,
    onRemoveLoop,
    onSetEditable,
  } = props;

  const prefersReducedMotion = useReducedMotion();

  return (
    <aside
      className={cn(
        "flex w-full shrink-0 flex-col border-t border-stone-800/35 bg-stone-950/80",
        "xl:w-[320px] xl:border-l xl:border-stone-800/35 xl:border-t-0",
      )}
      aria-label="Phrases"
    >
      {/* Title + helper — minimal premium header, no inline Add button. */}
      <header className="flex flex-col gap-1 px-5 pb-2 pt-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-stone-400">
          Phrases
        </p>
        <p className="text-[10px] leading-snug text-stone-500">
          Select a phrase to practice; use Repeat phrase to stay inside it.
        </p>
      </header>

      {/*
        Scrollable phrase list. Constrained on mobile so the panel doesn't
        overtake the screen; uncapped on xl so the list fills available
        vertical space (the surrounding flex column has h-dvh).
      */}
      <ul
        className={cn(
          "loop-sidebar-scroll flex max-h-56 flex-col gap-px overflow-y-auto px-3 pb-2",
          "xl:max-h-none xl:flex-1",
        )}
        role="list"
      >
        {loops.map((loop) => (
          <PhraseRow
            key={loop.id}
            loop={loop}
            active={loop.id === activeLoopId}
            editing={loop.id === editableLoopId}
            prefersReducedMotion={Boolean(prefersReducedMotion)}
            onSelect={onSelectLoop}
            onRename={onRenameLoop}
            onRemove={onRemoveLoop}
            onSetEditable={onSetEditable}
          />
        ))}
      </ul>

      {/*
        + Add Phrase pinned to the bottom — separate from the scrolling list
        so it's always reachable, no matter how many phrases exist.
      */}
      <footer className="border-t border-stone-800/40 px-3 py-2">
        <button
          type="button"
          onClick={onAddLoop}
          className={cn(
            "group/add flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2",
            "text-[12px] text-stone-400 transition-colors",
            "hover:bg-violet-500/8 hover:text-violet-100",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400/80",
          )}
        >
          <Plus className="h-3.5 w-3.5 transition-transform group-hover/add:scale-110" />
          <span>Add Phrase</span>
        </button>
      </footer>
    </aside>
  );
});

/* -------------------------------------------------------------------------- */
/*                                  Row                                       */
/* -------------------------------------------------------------------------- */

type PhraseRowProps = {
  loop: PracticeLoop;
  active: boolean;
  editing: boolean;
  prefersReducedMotion: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onSetEditable: (id: string | null) => void;
};

/**
 * Single phrase row — playlist-style compact entry.
 *
 * Visual states:
 *   inactive → low-contrast text, no chrome, hover reveals actions
 *   active   → soft violet wash + left accent + leading dot indicator
 *   editing  → adds a violet ring; LockOpen swaps to Lock (protect boundaries)
 *
 * Interactions:
 *   - click row        → select phrase
 *   - dblclick name    → enter inline rename (name only, no bounds unlock)
 *   - lock control     → toggle waveform boundary lock (same as transport)
 *   - trash            → delete phrase
 *   - Enter / blur     → commit rename
 *   - Escape           → cancel rename (no save)
 *
 * Hover-only actions: the lock and trash icons start at opacity-0 and fade
 * in on row hover or focus-within. The editing state keeps the Lock icon
 * visible at all times so the user can always protect boundaries again.
 */
function PhraseRow({
  loop,
  active,
  editing,
  prefersReducedMotion,
  onSelect,
  onRename,
  onRemove,
  onSetEditable,
}: PhraseRowProps) {
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const isRenaming = renameDraft !== null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** Tracks whether the imminent blur should commit (Enter, click-away) or revert (Escape). */
  const commitOnBlurRef = useRef(true);

  useEffect(() => {
    if (!isRenaming) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [isRenaming]);

  const startRename = useCallback(() => {
    commitOnBlurRef.current = true;
    setRenameDraft(loop.name);
  }, [loop.name]);

  const commitRename = useCallback(() => {
    if (renameDraft === null) return;
    const next = renameDraft.trim();
    if (next.length > 0 && next !== loop.name) {
      onRename(loop.id, next);
    }
    setRenameDraft(null);
  }, [loop.id, loop.name, onRename, renameDraft]);

  const cancelRename = useCallback(() => {
    commitOnBlurRef.current = false;
    setRenameDraft(null);
  }, []);

  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitRename();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelRename();
      }
    },
    [cancelRename, commitRename],
  );

  return (
    <motion.li
      layout={prefersReducedMotion ? false : "position"}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 420, damping: 34 }
      }
      className={cn(
        /**
         * `group/row` powers the hover-only action reveal. We also use
         * `focus-within` so keyboard users see the controls without needing
         * a pointer hover.
         */
        "group/row relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-1.5",
        "transition-colors duration-150",
        active
          ? "bg-violet-500/8 text-stone-50"
          : "text-stone-300 hover:bg-stone-900/40",
        editing && "ring-1 ring-inset ring-violet-300/40",
      )}
    >
      {/*
        Left accent rail — only on the active row. Communicates selection
        without heavy borders. Slightly brighter when editing.
      */}
      {active ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-y-1 left-0.5 w-[2px] rounded-full",
            editing ? "bg-violet-300" : "bg-violet-400/70",
          )}
        />
      ) : null}

      <button
        type="button"
        aria-pressed={active}
        aria-label={`Open phrase: ${loop.name}`}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-sm",
          "text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400",
        )}
        onClick={() => {
          if (isRenaming) return;
          onSelect(loop.id);
        }}
      >
        <span className="flex w-full min-w-0 items-center gap-1.5">
          {/* Small leading dot indicator — only on active phrase. */}
          {active ? (
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                editing ? "bg-violet-200" : "bg-violet-300",
              )}
            />
          ) : null}
          {isRenaming ? (
            <input
              ref={inputRef}
              value={renameDraft ?? ""}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={handleKey}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => {
                if (commitOnBlurRef.current) commitRename();
                else {
                  setRenameDraft(null);
                  commitOnBlurRef.current = true;
                }
              }}
              aria-label={`Rename phrase ${loop.name}`}
              /**
               * Visual: borderless, transparent — looks like the same text it
               * replaces, just editable. No "form input" chrome.
               */
              className={cn(
                "min-w-0 flex-1 border-0 bg-transparent p-0",
                "text-sm font-medium text-stone-50 outline-none",
                "focus-visible:outline-none focus-visible:ring-0",
              )}
            />
          ) : (
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm font-medium",
                active ? "text-stone-50" : "text-stone-200",
              )}
              onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                startRename();
              }}
              title="Double-click to rename"
            >
              {loop.name}
            </span>
          )}
        </span>
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums",
            active ? "text-stone-400" : "text-stone-500",
          )}
        >
          {formatPhraseTime(loop.start)} → {formatPhraseTime(loop.end)}
        </span>
      </button>

      {/*
        Row actions — hidden by default; revealed on hover, focus, or while
        editing. Keep these as small ghost icon buttons; do not let them
        compete with phrase content for visual weight.
      */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition-opacity duration-150",
          editing
            ? "opacity-100"
            : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
        )}
      >
        <RowIconButton
          aria-label={
            editing
              ? `Lock waveform boundaries for ${loop.name}`
              : `Unlock waveform boundaries for ${loop.name}`
          }
          title={
            editing
              ? "Lock phrase boundaries — handles hidden"
              : "Unlock phrase boundaries — drag handles on waveform"
          }
          tone={editing ? "amber" : "muted"}
          onClick={(e) => {
            e.stopPropagation();
            onSetEditable(editing ? null : loop.id);
          }}
        >
          {editing ? (
            <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          ) : (
            <LockOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          )}
        </RowIconButton>
        <RowIconButton
          aria-label={`Delete phrase ${loop.name}`}
          title="Delete phrase"
          tone="muted"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(loop.id);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </RowIconButton>
      </div>
    </motion.li>
  );
}

/* -------------------------------------------------------------------------- */
/*                              Row icon button                               */
/* -------------------------------------------------------------------------- */

type RowIconButtonProps = {
  children: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  "aria-label": string;
  title?: string;
  tone: "muted" | "amber";
};

/**
 * Tiny ghost icon button used for the per-row boundary lock / Delete actions.
 * Lives only on the active or hovered row, so its resting state must be
 * subtle — no border, no background — and the hover state must be calm
 * (low-saturation violet, never a harsh ring).
 */
function RowIconButton({
  children,
  onClick,
  title,
  tone,
  "aria-label": ariaLabel,
}: RowIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-md",
        "transition-colors duration-150",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400/80",
        tone === "amber"
          ? "text-amber-100/95 hover:bg-amber-500/14"
          : "text-stone-500 hover:bg-stone-800/60 hover:text-stone-200",
      )}
    >
      {children}
    </button>
  );
}
