"use client";

import { Link as LinkIcon, Upload } from "lucide-react";
import { memo } from "react";

import type { CloudProjectSummary } from "@/lib/cloud-projects/client";
import { cloudSessionPickerValue } from "@/lib/cloud-projects/constants";
import type { StoredProjectMeta } from "@/lib/project-db";
import { cn } from "@/lib/utils";

export type ProjectPickerListProps = {
  sessionSelectValue: string;
  demoProjectId: string;
  demoProjectLabel: string;
  userProjects: StoredProjectMeta[];
  cloudProjects: CloudProjectSummary[];
  showCloudSessions: boolean;
  onPickProject: (id: string) => void;
  /** When set, renders the “Open audio file…” row (mobile sheet + desktop menu). */
  onOpenAudioFile?: () => void;
  /** Feature-flagged YouTube import from parent. */
  showYoutubeImport?: boolean;
  onPasteYoutubeLink?: () => void;
  /** Optional class on the root `<ul>`. */
  listClassName?: string;
};

/**
 * Shared project list (example, open file, this device, cloud) for mobile sheet
 * and desktop dropdown — same rows and selection chrome.
 */
export const ProjectPickerList = memo(function ProjectPickerList(
  props: ProjectPickerListProps,
) {
  const {
    sessionSelectValue,
    demoProjectId,
    demoProjectLabel,
    userProjects,
    cloudProjects,
    showCloudSessions,
    onPickProject,
    onOpenAudioFile,
    showYoutubeImport = false,
    onPasteYoutubeLink,
    listClassName,
  } = props;

  return (
    <ul
      className={cn(
        "max-h-[min(60vh,420px)] space-y-2 overflow-y-auto overscroll-y-contain px-1 py-1 [-webkit-overflow-scrolling:touch]",
        listClassName,
      )}
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
          onClick={() => onPickProject(demoProjectId)}
          className={cn(
            "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors touch-manipulation",
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
          <span className="min-w-0 flex-1 truncate font-medium leading-snug">
            {demoProjectLabel}
          </span>
        </button>
      </li>

      {onOpenAudioFile ? (
        <>
          <li className="px-1 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Open
            </p>
          </li>
          <li className="min-w-0">
            <button
              type="button"
              onClick={onOpenAudioFile}
              className={cn(
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors touch-manipulation",
                "text-stone-400 hover:bg-stone-800/50 hover:text-stone-200 active:bg-stone-800/70",
              )}
              aria-label="Open audio file from your device"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700/40 bg-stone-800/40 text-stone-500"
                aria-hidden
              >
                <Upload className="h-3 w-3" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 font-medium leading-snug">
                Open audio file…
              </span>
            </button>
          </li>
          {showYoutubeImport && onPasteYoutubeLink ? (
            <li className="min-w-0">
              <button
                type="button"
                onClick={onPasteYoutubeLink}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors touch-manipulation",
                  "text-stone-400 hover:bg-stone-800/50 hover:text-stone-200 active:bg-stone-800/70",
                )}
                aria-label="Paste a YouTube link for a new session"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stone-700/40 bg-stone-800/40 text-stone-500"
                  aria-hidden
                >
                  <LinkIcon className="h-3 w-3" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug">
                  Paste YouTube link…
                </span>
              </button>
            </li>
          ) : null}
        </>
      ) : null}

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
                onClick={() => onPickProject(p.id)}
                className={cn(
                  "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors touch-manipulation",
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
                <span className="min-w-0 flex-1 truncate font-medium leading-snug">
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
                    onClick={() => onPickProject(v)}
                    className={cn(
                      "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors touch-manipulation",
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
                    <span className="min-w-0 flex-1 truncate font-medium leading-snug">
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
  );
});
