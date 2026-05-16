"use client";

import { memo } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceEmptyStateProps = {
  onCreateNewProject: () => void;
  onOpenDemoProject: () => void | Promise<void>;
  onOpenSavedProject: () => void;
  /**
   * When true, saved-project picker is fetching Dexie/cloud listings — control stays visible but disabled.
   */
  savedProjectsBrowseBusy: boolean;
  className?: string;
};

export const WorkspaceEmptyState = memo(function WorkspaceEmptyState(
  props: WorkspaceEmptyStateProps,
) {
  const {
    onCreateNewProject,
    onOpenDemoProject,
    onOpenSavedProject,
    savedProjectsBrowseBusy,
    className,
  } = props;

  return (
    <div
      role="region"
      aria-label="Workspace"
      className={cn(
        "pointer-events-none absolute inset-0 z-[25] flex flex-col items-stretch justify-center overflow-hidden p-5 sm:p-8",
        className,
      )}
    >
      {/* Soft vignette + ambient timeline band — stays behind copy/CTAs */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_42%,rgba(64,58,53,0.14)_0%,transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-[6%] top-[42%] h-[min(22%,180px)] -translate-y-1/2 opacity-[0.09]"
        aria-hidden
      >
        <div className="h-full w-full bg-[linear-gradient(180deg,transparent_0%,rgba(224,210,255,0.12)_42%,transparent_72%)]" />
      </div>
      <div
        className="pointer-events-none absolute left-[10%] right-[10%] top-[calc(50%-min(22%,180px)*0.5)] h-px bg-[linear-gradient(90deg,transparent,rgba(224,210,255,0.14),transparent)] opacity-75"
        aria-hidden
      />
      {/* Fine vertical ticks — evokes transport marks without reading as UI chrome */}
      <div
        className="pointer-events-none absolute inset-x-[12%] top-[calc(50%-min(22%,180px)*0.5)] flex justify-between opacity-[0.06]"
        aria-hidden
      >
        {Array.from({ length: 7 }).map((_, i) => (
          <span
            key={i}
            className="h-2 w-px bg-violet-200/80"
          />
        ))}
      </div>

      <div className="pointer-events-auto relative mx-auto flex w-full max-w-[17.5rem] flex-col items-center gap-7 text-center sm:max-w-[18.25rem]">
        <div className="space-y-2">
          <h2 className="text-[15px] font-light leading-snug tracking-[-0.02em] text-stone-100/95 sm:text-[16px]">
            Waiting for a song
          </h2>
          <p className="mx-auto max-w-[14rem] text-[11px] leading-relaxed text-stone-500/90">
            Import audio, open saved work, or try the demo.
          </p>
          <p className="mx-auto max-w-[14.5rem] text-[10px] leading-relaxed text-stone-600/85">
            After loading, use Project and Practice Section selectors to switch quickly.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <Button
            type="button"
            variant="default"
            className="h-10 w-full rounded-lg text-[12.5px] font-medium shadow-[0_8px_28px_rgba(109,40,217,0.22)]"
            onClick={onCreateNewProject}
          >
            Create New Project
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-lg border-stone-600/40 bg-stone-950/25 text-[12.5px] font-medium text-stone-200/95 hover:border-stone-500/45 hover:bg-stone-900/35"
            onClick={() => void onOpenDemoProject()}
          >
            Open Demo Project
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={savedProjectsBrowseBusy}
            aria-busy={savedProjectsBrowseBusy}
            className="h-9 w-full rounded-lg text-[12px] font-medium text-stone-500 hover:bg-white/[0.04] hover:text-stone-300 disabled:pointer-events-none disabled:opacity-40"
            onClick={onOpenSavedProject}
          >
            Open Saved Project…
          </Button>
        </div>
      </div>
    </div>
  );
});
