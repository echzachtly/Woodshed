"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhraseSegment } from "@/lib/loop-engine";
import { useWoodshedStore } from "@/store/woodshed-store";

const STORAGE_KEY = "woodshed-desktop-inspector-open";

function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const DesktopInspectorPanel = memo(function DesktopInspectorPanel() {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v === "0") setExpanded(false);
    } catch {
      /* private mode */
    }
  }, []);

  const persistExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const {
    duration,
    projectName,
    loops,
    activeLoopId,
    activeLoop,
    activeSegmentId,
    activeSegment,
    inspectorFocusRequestId,
    selectLoop,
    setActiveSegmentId,
    selectSegment,
    renameLoop,
    setLoopNotes,
    addSegment,
    updateSegment,
    removeSegment,
    addLoopCandidate,
  } = useWoodshedStore(
    useShallow((s) => {
      const activeLoop =
        s.activeLoopId != null
          ? s.loops.find((l) => l.id === s.activeLoopId)
          : undefined;
      let activeSegment: PhraseSegment | undefined;
      if (activeLoop?.segments && s.activeSegmentId) {
        activeSegment = activeLoop.segments.find(
          (x) => x.id === s.activeSegmentId,
        );
      }
      return {
        duration: s.duration,
        projectName: s.projectName,
        loops: s.loops,
        activeLoopId: s.activeLoopId,
        activeLoop,
        activeSegmentId: s.activeSegmentId,
        activeSegment,
        inspectorFocusRequestId: s.inspectorFocusRequestId,
        selectLoop: s.selectLoop,
        setActiveSegmentId: s.setActiveSegmentId,
        selectSegment: s.selectSegment,
        renameLoop: s.renameLoop,
        setLoopNotes: s.setLoopNotes,
        addSegment: s.addSegment,
        updateSegment: s.updateSegment,
        removeSegment: s.removeSegment,
        addLoopCandidate: s.addLoopCandidate,
      };
    }),
  );

  useEffect(() => {
    if (!inspectorFocusRequestId) return;
    persistExpanded(true);
    const id = requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>(
          "[data-woodshed-focus-region-name-input]",
        )
        ?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [inspectorFocusRequestId, persistExpanded]);

  const [phraseNameDraft, setPhraseNameDraft] = useState("");
  const [phraseNotesDraft, setPhraseNotesDraft] = useState("");
  const [segNameDraft, setSegNameDraft] = useState("");
  const [segNotesDraft, setSegNotesDraft] = useState("");
  const [segStartDraft, setSegStartDraft] = useState("");
  const [segEndDraft, setSegEndDraft] = useState("");

  useEffect(() => {
    if (!activeLoop) {
      setPhraseNameDraft("");
      setPhraseNotesDraft("");
      return;
    }
    setPhraseNameDraft(activeLoop.name);
    setPhraseNotesDraft(activeLoop.notes ?? "");
  }, [activeLoop]);

  useEffect(() => {
    if (!activeSegment) {
      setSegNameDraft("");
      setSegNotesDraft("");
      setSegStartDraft("");
      setSegEndDraft("");
      return;
    }
    setSegNameDraft(activeSegment.name);
    setSegNotesDraft(activeSegment.notes);
    setSegStartDraft(activeSegment.startTime.toFixed(2));
    setSegEndDraft(activeSegment.endTime.toFixed(2));
  }, [activeSegment]);

  const focusRegionRows = useMemo(
    () => activeLoop?.segments ?? [],
    [activeLoop?.segments],
  );

  const phraseSpanSec =
    activeLoop && activeLoop.end > activeLoop.start
      ? Math.round((activeLoop.end - activeLoop.start) * 10) / 10
      : 0;

  const body = (() => {
    if (!duration) {
      return (
        <div className="space-y-1.5 text-[12px] leading-snug text-stone-400">
          <p className="text-stone-300">Import audio to author phrases.</p>
          <p className="text-[11px] text-stone-500">
            <kbd className="rounded border border-stone-800 bg-stone-900/80 px-1 font-mono text-[10px]">
              A
            </kbd>{" "}
            new phrase ·{" "}
            <kbd className="rounded border border-stone-800 bg-stone-900/80 px-1 font-mono text-[10px]">
              Space
            </kbd>{" "}
            play · transport for loop & tempo.
          </p>
        </div>
      );
    }

    if (!activeLoopId || !activeLoop) {
      return (
        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600">
              Session
            </p>
            <p className="mt-0.5 truncate text-[13px] font-medium text-stone-200">
              {projectName}
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500">
              {loops.length} phrase{loops.length === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-stone-600">
              Open
            </p>
            <ul className="mt-1 max-h-36 space-y-px overflow-y-auto">
              {loops.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[12px] text-stone-400 hover:bg-stone-900/70 hover:text-stone-200"
                    onClick={() => selectLoop(l.id)}
                  >
                    <span className="truncate">{l.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-stone-600">
                      {formatPhraseTime(l.start)}–{formatPhraseTime(l.end)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="w-full rounded border border-dashed border-stone-700/50 py-1.5 text-[11px] text-stone-500 transition-colors hover:border-stone-600 hover:bg-stone-900/40 hover:text-stone-300"
            onClick={() => addLoopCandidate()}
          >
            + New phrase
          </button>
        </div>
      );
    }

    if (activeSegmentId && activeSegment && activeLoop) {
      return (
        <div className="space-y-2.5">
          <button
            type="button"
            className="text-[10px] font-medium text-violet-300/85 hover:text-violet-200"
            onClick={() => setActiveSegmentId(null)}
          >
            ← Back to phrase
          </button>
          <div>
            <input
              value={segNameDraft}
              onChange={(e) => setSegNameDraft(e.target.value)}
              onBlur={() => {
                const t = segNameDraft.trim();
                if (t && t !== activeSegment.name) {
                  updateSegment(activeLoop.id, activeSegment.id, { name: t });
                }
              }}
              data-woodshed-focus-region-name-input
              className="w-full border-0 border-b border-stone-800/70 bg-transparent py-0.5 text-[13px] font-medium text-stone-100 outline-none placeholder:text-stone-600 focus-visible:border-violet-500/40"
              placeholder="Focus region name"
              aria-label="Focus region name"
            />
            <p className="mt-1 text-[10px] text-stone-600">
              Focus regions stay inside this phrase. Use the transport loop to
              cycle modes — Focus Loop uses this region when selected, otherwise
              your last-used region in the phrase.
            </p>
          </div>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-stone-600">
                Start s
              </span>
              <input
                inputMode="decimal"
                value={segStartDraft}
                onChange={(e) => setSegStartDraft(e.target.value)}
                onBlur={() => {
                  const v = Number.parseFloat(segStartDraft);
                  if (Number.isFinite(v)) {
                    updateSegment(activeLoop.id, activeSegment.id, {
                      startTime: v,
                    });
                  } else {
                    setSegStartDraft(activeSegment.startTime.toFixed(2));
                  }
                }}
                className="rounded border border-stone-800/60 bg-stone-950/50 px-1.5 py-1 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/40"
              />
            </label>
            <label className="flex flex-1 flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-stone-600">
                End s
              </span>
              <input
                inputMode="decimal"
                value={segEndDraft}
                onChange={(e) => setSegEndDraft(e.target.value)}
                onBlur={() => {
                  const v = Number.parseFloat(segEndDraft);
                  if (Number.isFinite(v)) {
                    updateSegment(activeLoop.id, activeSegment.id, {
                      endTime: v,
                    });
                  } else {
                    setSegEndDraft(activeSegment.endTime.toFixed(2));
                  }
                }}
                className="rounded border border-stone-800/60 bg-stone-950/50 px-1.5 py-1 font-mono text-[11px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/40"
              />
            </label>
          </div>
          <label className="block">
            <span className="sr-only">Notes</span>
            <textarea
              value={segNotesDraft}
              onChange={(e) => setSegNotesDraft(e.target.value)}
              onBlur={() => {
                if (segNotesDraft !== activeSegment.notes) {
                  updateSegment(activeLoop.id, activeSegment.id, {
                    notes: segNotesDraft,
                  });
                }
              }}
              rows={2}
              placeholder="Notes…"
              className="w-full resize-none rounded border border-stone-800/50 bg-stone-950/40 px-2 py-1.5 text-[11px] text-stone-300 outline-none placeholder:text-stone-600 focus-visible:ring-1 focus-visible:ring-violet-500/35"
            />
          </label>
          <button
            type="button"
            className="text-[11px] text-red-400/80 hover:text-red-300"
            onClick={() => removeSegment(activeLoop.id, activeSegment.id)}
          >
            <Trash2
              className="mr-1 inline h-3 w-3 align-text-bottom opacity-80"
              aria-hidden
            />
            Remove focus region
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <input
            value={phraseNameDraft}
            onChange={(e) => setPhraseNameDraft(e.target.value)}
            onBlur={() => {
              const t = phraseNameDraft.trim();
              if (t && activeLoop && t !== activeLoop.name) {
                renameLoop(activeLoop.id, t);
              }
            }}
            className="w-full border-0 border-b border-stone-800/60 bg-transparent py-0.5 text-[14px] font-semibold tracking-tight text-stone-50 outline-none focus-visible:border-violet-500/45"
            placeholder="Phrase title"
            aria-label="Phrase title"
          />
          <p className="mt-1 font-mono text-[11px] text-stone-500">
            {formatPhraseTime(activeLoop.start)} → {formatPhraseTime(activeLoop.end)}
            <span className="text-stone-600"> · </span>
            {phraseSpanSec}s
          </p>
        </div>

        <label className="block">
          <span className="mb-0.5 block text-[9px] font-medium uppercase tracking-[0.18em] text-stone-600">
            Notes
          </span>
          <textarea
            value={phraseNotesDraft}
            onChange={(e) => setPhraseNotesDraft(e.target.value)}
            onBlur={() => {
              if (activeLoop && phraseNotesDraft !== (activeLoop.notes ?? "")) {
                setLoopNotes(activeLoop.id, phraseNotesDraft);
              }
            }}
            rows={2}
            placeholder="Fingerings, goals, reminders…"
            className="w-full resize-none rounded border border-stone-800/45 bg-stone-950/35 px-2 py-1.5 text-[11px] leading-snug text-stone-300 outline-none placeholder:text-stone-600 focus-visible:ring-1 focus-visible:ring-violet-500/35"
          />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-stone-600">
              Focus regions
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-stone-500 hover:text-violet-200/90"
              onClick={() => addSegment(activeLoop.id)}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add
            </button>
          </div>
          {focusRegionRows.length === 0 ? (
            <p className="text-[11px] leading-snug text-stone-600">
              Isolate a hard moment inside this phrase — subtle on the wave,
              then cycle the transport loop to{" "}
              <span className="text-stone-500">Focus Loop</span>.
            </p>
          ) : (
            <ul className="space-y-px">
              {focusRegionRows.map((seg) => (
                <li key={seg.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-[11px]",
                      seg.id === activeSegmentId
                        ? "bg-stone-800/60 text-stone-100"
                        : "text-stone-500 hover:bg-stone-900/55 hover:text-stone-300",
                    )}
                    onClick={() => selectSegment(activeLoop.id, seg.id)}
                  >
                    <span className="truncate">{seg.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-stone-600">
                      {seg.startTime.toFixed(1)}–{seg.endTime.toFixed(1)}s
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  })();

  return (
    <aside
      className="flex shrink-0 flex-col border-t border-stone-800/50 bg-[#050403]/95 text-stone-300"
      aria-label="Inspector"
    >
      <div className="flex items-center justify-between gap-2 border-b border-stone-800/35 px-2.5 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-stone-600">
          Inspector
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-7 gap-0.5 px-1.5 text-[10px] text-stone-500 hover:text-stone-300"
          aria-expanded={expanded}
          onClick={() => persistExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <span>Hide</span>
              <ChevronDown className="h-3 w-3 opacity-70" aria-hidden />
            </>
          ) : (
            <>
              <span>Show</span>
              <ChevronUp className="h-3 w-3 opacity-70" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {expanded ? (
        <div className="max-h-[min(28vh,16rem)] overflow-y-auto px-2.5 py-2">
          {body}
        </div>
      ) : null}
    </aside>
  );
});
