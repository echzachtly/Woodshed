"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SNAP_PRESETS } from "@/lib/snap-presets";
import { cn } from "@/lib/utils";
import type { PracticeLoop } from "@/lib/loop-engine";

type Props = {
  loops: PracticeLoop[];
  activeLoopId: string | null;
  onSelectLoop: (id: string) => void;
  onRenameLoop: (id: string, name: string) => void;
  onAddLoop: () => void;
  onRemoveLoop: (id: string) => void;
  snapAssist: number;
  onSnapAssistChange: (value: number) => void;
  autoScroll: boolean;
  onAutoScrollToggle: () => void;
};

export const LoopSidebar = memo(function LoopSidebar(props: Props) {
  const {
    loops,
    activeLoopId,
    onSelectLoop,
    onRenameLoop,
    onAddLoop,
    onRemoveLoop,
    snapAssist,
    onSnapAssistChange,
    autoScroll,
    onAutoScrollToggle,
  } = props;

  const prefersReducedMotion = useReducedMotion();

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 border-t border-stone-800/35 bg-stone-950/80 px-5 py-4 xl:w-[340px] xl:border-l xl:border-stone-800/35 xl:border-t-0">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400">
          Practice sections
        </p>
        <Button
          type="button"
          variant="outline"
          className="h-8 px-3 text-xs"
          onClick={onAddLoop}
        >
          Add loop
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-stone-400">
          Snap assist
        </p>
        <div className="flex flex-wrap gap-1">
          {SNAP_PRESETS.map((p) => {
            const activePreset = Math.abs(snapAssist - p.strength) < 0.05;
            return (
              <button
                key={p.key}
                type="button"
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] transition-colors",
                  activePreset
                    ? "border-violet-400/50 bg-violet-400/8 text-violet-100"
                    : "border-stone-800/70 text-stone-400 hover:border-stone-700/90 hover:text-stone-200",
                )}
                aria-pressed={activePreset}
                onClick={() => onSnapAssistChange(p.strength)}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="mt-1 flex flex-1 items-center gap-2 text-xs text-stone-400">
          <span className="w-20 shrink-0">Fine tune</span>
          <input
            type="range"
            min={0}
            max={100}
            value={snapAssist * 100}
            onChange={(e) =>
              onSnapAssistChange(Number(e.target.value) / 100)
            }
            aria-label="Snap assist fine tuning"
            className="flex-1 accent-violet-400"
          />
        </label>
      </div>

      <button
        type="button"
        className={cn(
          "w-fit rounded-full border px-3 py-1 text-xs transition-colors",
          autoScroll
            ? "border-violet-400/45 bg-violet-400/8 text-violet-100"
            : "border-stone-800/70 text-stone-400 hover:border-stone-700 hover:text-stone-200",
        )}
        onClick={onAutoScrollToggle}
      >
        Follow playhead {autoScroll ? "on" : "off"}
      </button>

      <Separator className="bg-stone-800/35" />

      <ul
        className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1 xl:max-h-[30rem]"
        role="list"
      >
        {loops.map((loop) => {
          const active = loop.id === activeLoopId;
          return (
            <motion.li
              layout={prefersReducedMotion ? false : "position"}
              key={loop.id}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 420, damping: 34 }
              }
              className={cn(
                "rounded-lg border border-transparent px-3 py-2.5 transition-colors",
                active
                  ? "border-violet-400/25 bg-violet-400/8 ring-1 ring-violet-400/30"
                  : "border-stone-800/40 bg-stone-900/25 hover:border-stone-700/50 hover:bg-stone-900/40",
              )}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Activate ${loop.name}`}
                  className="flex flex-1 flex-col rounded-sm px-1 py-0.5 text-left outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
                  onClick={() => onSelectLoop(loop.id)}
                >
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-[0.18em]",
                      active ? "text-violet-200" : "text-stone-500",
                    )}
                  >
                    {active ? "Active" : "Saved"}
                  </span>
                  <span className="text-sm font-medium text-stone-100">
                    {loop.name}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-stone-400">
                    {loop.start.toFixed(2)}s → {loop.end.toFixed(2)}s ·{" "}
                    {(loop.tempo * 100).toFixed(0)}%
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove loop ${loop.name}`}
                  onClick={() => onRemoveLoop(loop.id)}
                  className="h-8 w-8 text-stone-500 hover:text-stone-200"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                className="mt-2 h-8 border-stone-800/60 bg-stone-950/40 font-mono text-xs"
                value={loop.name}
                onFocus={() => {
                  void onSelectLoop(loop.id);
                }}
                onChange={(e) => onRenameLoop(loop.id, e.target.value)}
              />
            </motion.li>
          );
        })}
      </ul>
    </aside>
  );
});
