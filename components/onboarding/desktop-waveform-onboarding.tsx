"use client";

import { memo } from "react";

import { cn } from "@/lib/utils";

export const DesktopShiftFocusGuidanceStripe = memo(
  function DesktopShiftFocusGuidanceStripe() {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[20] flex justify-center px-4 pb-3 pt-16 sm:px-6 sm:pb-4"
        aria-live="polite"
      >
        <div className="absolute inset-x-0 bottom-0 top-10 bg-gradient-to-t from-[#060504]/95 via-[#080605]/45 to-transparent" />
        <p
          className={cn(
            "relative max-w-xl text-center text-[11px] leading-relaxed text-stone-500 opacity-90 sm:text-[12px]",
          )}
        >
          Hold{" "}
          <kbd className="rounded border border-stone-700/80 bg-stone-950/85 px-[0.35em] font-mono text-[10px] text-stone-400 sm:text-[11px]">
            Shift
          </kbd>
          {" — "}
          drag on the waveform inside the&nbsp;
          <span className="text-stone-400">Practice&nbsp;Section</span>
          {" to mark a "}
          <span className="text-stone-400">Focus&nbsp;Loop</span>.
        </p>
      </div>
    );
  },
);

export const DesktopPostFocusLoopHintStripe = memo(
  function DesktopPostFocusLoopHintStripe() {
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[21] flex justify-center px-4 pb-3 pt-12 sm:px-6 sm:pb-4"
        aria-live="polite"
      >
        <div className="absolute inset-x-0 bottom-0 top-10 bg-gradient-to-t from-emerald-950/15 via-transparent to-transparent" />
        <p
          className={cn(
            "relative max-w-md text-center text-[11px] leading-relaxed text-stone-500 opacity-90 sm:text-[12px]",
          )}
        >
          Drag the loop edges to trim —{" "}
          <span className="text-stone-400">rename from the inspector below</span>
          .
        </p>
      </div>
    );
  },
);
