"use client";

import { memo } from "react";

import { cn } from "@/lib/utils";

export type DemoProjectOrientationRibbonProps = {
  onDismiss: () => void;
  className?: string;
};

/**
 * First explicit open of the built-in demo — brief, non-modal context.
 * Desktop Focus Loop authoring onboarding is separate (`focusLoopAuthoringComplete`).
 */
export const DemoProjectOrientationRibbon = memo(
  function DemoProjectOrientationRibbon({
    onDismiss,
    className,
  }: DemoProjectOrientationRibbonProps) {
    return (
      <div
        role="note"
        aria-label="Demo project tips"
        className={cn(
          "flex shrink-0 items-start gap-3 border-b border-violet-950/35 bg-gradient-to-r from-violet-950/18 via-[#0c0a09] to-[#0c0a09] px-3 py-2 sm:px-4 sm:py-2.5",
          className,
        )}
      >
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-stone-500 sm:text-[12px]">
          <span className="font-medium text-stone-400">This demo is already prepared.</span>{" "}
          It includes <span className="text-stone-400">Practice Sections</span> and{" "}
          <span className="text-stone-400">Focus Loops</span>. Select a{" "}
          <span className="text-stone-400">Focus Loop</span>, start{" "}
          <span className="text-stone-400">playback</span>, then slow{" "}
          <span className="text-stone-400">tempo</span> until it feels comfortable.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md border border-stone-700/55 bg-stone-950/70 px-2 py-1 text-[11px] font-medium text-stone-300 transition-colors hover:border-stone-600 hover:bg-stone-900 hover:text-stone-100"
        >
          Got it
        </button>
      </div>
    );
  },
);
