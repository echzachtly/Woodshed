"use client";

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PhraseSegment } from "@/lib/loop-engine";
import { useWoodshedStore } from "@/store/woodshed-store";

const STORAGE_EXPANDED = "woodshed-desktop-inspector-open";
const STORAGE_NOTES_OPEN = "woodshed-inspector-notes-open";
const STORAGE_ADVANCED_OPEN = "woodshed-inspector-advanced-open";

function readBoolSession(key: string, defaultOpen: boolean): boolean {
  try {
    const v = sessionStorage.getItem(key);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* private mode */
  }
  return defaultOpen;
}

function writeBoolSession(key: string, open: boolean) {
  try {
    sessionStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function formatPhraseTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const DesktopInspectorPanel = memo(function DesktopInspectorPanel() {
  const [expanded, setExpanded] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    setExpanded(readBoolSession(STORAGE_EXPANDED, true));
    setNotesOpen(readBoolSession(STORAGE_NOTES_OPEN, true));
    setAdvancedOpen(readBoolSession(STORAGE_ADVANCED_OPEN, false));
  }, []);

  const persistExpanded = useCallback((next: boolean) => {
    setExpanded(next);
    writeBoolSession(STORAGE_EXPANDED, next);
  }, []);

  const persistNotesOpen = useCallback((next: boolean) => {
    setNotesOpen(next);
    writeBoolSession(STORAGE_NOTES_OPEN, next);
  }, []);

  const persistAdvancedOpen = useCallback((next: boolean) => {
    setAdvancedOpen(next);
    writeBoolSession(STORAGE_ADVANCED_OPEN, next);
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
    updateLoopBounds,
    setActiveSegmentId,
    selectSegment,
    renameLoop,
    setLoopNotes,
    addSegment,
    updateSegment,
    removeSegment,
    addLoopCandidate,
    focusRegionWaveformEditUnlockedById,
    phraseWaveformEditUnlockedById,
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
        updateLoopBounds: s.updateLoopBounds,
        setActiveSegmentId: s.setActiveSegmentId,
        selectSegment: s.selectSegment,
        renameLoop: s.renameLoop,
        setLoopNotes: s.setLoopNotes,
        addSegment: s.addSegment,
        updateSegment: s.updateSegment,
        removeSegment: s.removeSegment,
        addLoopCandidate: s.addLoopCandidate,
        focusRegionWaveformEditUnlockedById: s.focusRegionWaveformEditUnlockedById,
        phraseWaveformEditUnlockedById: s.phraseWaveformEditUnlockedById,
      };
    }),
  );

  useEffect(() => {
    if (!inspectorFocusRequestId) return;
    persistExpanded(true);
    persistAdvancedOpen(true);
  }, [inspectorFocusRequestId, persistExpanded, persistAdvancedOpen]);

  useEffect(() => {
    if (!inspectorFocusRequestId || !advancedOpen || !activeSegment) return;
    const t = window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>(
          "[data-woodshed-focus-region-name-input]",
        )
        ?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [inspectorFocusRequestId, advancedOpen, activeSegment]);

  const [phraseNameDraft, setPhraseNameDraft] = useState("");
  const [phraseNotesDraft, setPhraseNotesDraft] = useState("");
  const [phraseStartDraft, setPhraseStartDraft] = useState("");
  const [phraseEndDraft, setPhraseEndDraft] = useState("");
  const [segNameDraft, setSegNameDraft] = useState("");
  const [segNotesDraft, setSegNotesDraft] = useState("");
  const [segStartDraft, setSegStartDraft] = useState("");
  const [segEndDraft, setSegEndDraft] = useState("");

  useEffect(() => {
    if (!activeLoop) {
      setPhraseNameDraft("");
      setPhraseNotesDraft("");
      setPhraseStartDraft("");
      setPhraseEndDraft("");
      return;
    }
    setPhraseNameDraft(activeLoop.name);
    setPhraseNotesDraft(activeLoop.notes ?? "");
    setPhraseStartDraft(activeLoop.start.toFixed(2));
    setPhraseEndDraft(activeLoop.end.toFixed(2));
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

  const focusRegionRows = useMemo(() => {
    const segs = activeLoop?.segments ?? [];
    return [...segs].sort((a, b) => a.startTime - b.startTime);
  }, [activeLoop?.segments]);

  const phraseSpanSec =
    activeLoop && activeLoop.end > activeLoop.start
      ? Math.round((activeLoop.end - activeLoop.start) * 10) / 10
      : 0;

  const focusRegionWaveformUnlocked = Boolean(
    activeSegment &&
      focusRegionWaveformEditUnlockedById[activeSegment.id],
  );

  const phraseWaveformUnlocked = Boolean(
    activeLoop && phraseWaveformEditUnlockedById[activeLoop.id],
  );

  const activePhraseIndex = useMemo(() => {
    if (!activeLoopId) return -1;
    return loops.findIndex((l) => l.id === activeLoopId);
  }, [loops, activeLoopId]);

  const canPrevPhrase = activePhraseIndex > 0;
  const canNextPhrase =
    activePhraseIndex >= 0 && activePhraseIndex < loops.length - 1;

  const goPrevPhrase = useCallback(() => {
    if (!canPrevPhrase) return;
    const id = loops[activePhraseIndex - 1]?.id;
    if (id) selectLoop(id);
  }, [canPrevPhrase, loops, activePhraseIndex, selectLoop]);

  const goNextPhrase = useCallback(() => {
    if (!canNextPhrase) return;
    const id = loops[activePhraseIndex + 1]?.id;
    if (id) selectLoop(id);
  }, [canNextPhrase, loops, activePhraseIndex, selectLoop]);

  const [phraseRenameOpen, setPhraseRenameOpen] = useState(false);
  const phraseRenameInputRef = useRef<HTMLInputElement>(null);
  const zenScrollRef = useRef<HTMLDivElement>(null);
  const [zenShowAdd, setZenShowAdd] = useState(true);

  useEffect(() => {
    setPhraseRenameOpen(false);
    setZenShowAdd(true);
  }, [activeLoop?.id]);

  useEffect(() => {
    if (!phraseRenameOpen) return;
    const t = window.setTimeout(() => phraseRenameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [phraseRenameOpen]);

  const commitPhraseRename = useCallback(() => {
    if (!activeLoop) return;
    const t = phraseNameDraft.trim();
    if (t && t !== activeLoop.name) {
      renameLoop(activeLoop.id, t);
    } else {
      setPhraseNameDraft(activeLoop.name);
    }
    setPhraseRenameOpen(false);
  }, [activeLoop, phraseNameDraft, renameLoop]);

  useLayoutEffect(() => {
    if (expanded || !activeLoop) return;
    const el = zenScrollRef.current;
    if (!el) return;

    const ZEN_ADD_RESERVE_PX = 52;

    const measure = () => {
      if (zenShowAdd) {
        if (el.scrollWidth > el.clientWidth + 2) {
          setZenShowAdd(false);
        }
      } else if (el.scrollWidth + ZEN_ADD_RESERVE_PX <= el.clientWidth + 2) {
        setZenShowAdd(true);
      }
    };

    measure();
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, activeLoop?.id, focusRegionRows, activeSegmentId, zenShowAdd]);

  const zenFocusPillClass = (selected: boolean) =>
    cn(
      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all",
      selected
        ? "border-amber-400/55 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
        : "border-stone-600/75 bg-stone-950/45 text-stone-400 hover:border-stone-500 hover:bg-stone-900/55 hover:text-stone-200",
    );

  const phraseContextRow =
    duration && activeLoop ? (
      <div className="flex shrink-0 items-center gap-1 border-b border-stone-800/40 bg-[#060504]/98 px-2 py-1.5 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-stone-500 hover:text-stone-200 disabled:opacity-30"
          disabled={!canPrevPhrase}
          aria-label="Previous phrase"
          onClick={goPrevPhrase}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          {phraseRenameOpen ? (
            <input
              ref={phraseRenameInputRef}
              value={phraseNameDraft}
              onChange={(e) => setPhraseNameDraft(e.target.value)}
              onBlur={commitPhraseRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitPhraseRename();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setPhraseNameDraft(activeLoop.name);
                  setPhraseRenameOpen(false);
                }
              }}
              className="h-8 w-full min-w-0 rounded-full border border-amber-500/35 bg-stone-950/80 px-3 font-medium text-[13px] text-stone-100 outline-none ring-1 ring-amber-500/20 focus-visible:ring-amber-500/40"
              placeholder="Phrase name"
              aria-label="Rename phrase"
            />
          ) : (
            <button
              type="button"
              title="Double-click to rename phrase"
              className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full border border-stone-700/60 bg-stone-950/55 py-1.5 pl-3 pr-2.5 text-left transition-colors hover:border-stone-600 hover:bg-stone-900/55"
              onDoubleClick={() => setPhraseRenameOpen(true)}
            >
              <span className="min-w-0 truncate text-[13px] font-semibold tracking-tight text-stone-100">
                {activeLoop.name}
              </span>
              <span className="shrink-0 text-stone-600" aria-hidden>
                ·
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-stone-400">
                {formatPhraseTime(activeLoop.start)} →{" "}
                {formatPhraseTime(activeLoop.end)}
              </span>
              <span className="shrink-0 text-stone-600" aria-hidden>
                ·
              </span>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-stone-500">
                {phraseSpanSec}s
              </span>
            </button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-stone-500 hover:text-stone-200 disabled:opacity-30"
          disabled={!canNextPhrase}
          aria-label="Next phrase"
          onClick={goNextPhrase}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-stone-500 hover:bg-stone-900/60 hover:text-stone-200"
          aria-expanded={expanded}
          aria-label={expanded ? "Minimize inspector" : "Expand inspector"}
          title={expanded ? "Minimize inspector" : "Expand inspector"}
          onClick={() => persistExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    ) : null;

  const collapsedFocusPills =
    duration && activeLoop && !expanded ? (
      <div
        ref={zenScrollRef}
        className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-stone-800/30 bg-[#060504]/98 px-2 py-1.5 sm:px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Focus regions"
      >
        {focusRegionRows.map((seg) => (
          <button
            key={seg.id}
            type="button"
            role="listitem"
            data-zen-focus-pill
            onClick={() => selectSegment(activeLoop.id, seg.id)}
            className={zenFocusPillClass(seg.id === activeSegmentId)}
          >
            {seg.name}
          </button>
        ))}
        {zenShowAdd ? (
          <button
            type="button"
            data-zen-add
            onClick={() => addSegment(activeLoop.id)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-stone-600/75 px-2 py-1 text-[11px] font-medium text-stone-500 transition-colors hover:border-amber-500/35 hover:bg-stone-900/45 hover:text-amber-100/90"
          >
            <Plus className="h-3 w-3" aria-hidden />
            + Add
          </button>
        ) : null}
      </div>
    ) : null;

  const emptyNoAudio =
    !duration ? (
      <div className="space-y-2 px-3 py-3 text-[12px] leading-relaxed text-stone-400">
        <p className="text-stone-300">Import audio to author phrases.</p>
        <p className="text-[11px] text-stone-500">
          <kbd className="rounded border border-stone-800 bg-stone-900/80 px-1 font-mono text-[10px]">
            A
          </kbd>{" "}
          new phrase ·{" "}
          <kbd className="rounded border border-stone-800 bg-stone-900/80 px-1 font-mono text-[10px]">
            Space
          </kbd>{" "}
          play · use the transport for practice controls.
        </p>
      </div>
    ) : null;

  const emptyNoPhrase =
    duration && (!activeLoopId || !activeLoop) ? (
      <div className="space-y-4 px-3 py-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-600">
            Session
          </p>
          <p className="mt-1 truncate text-[14px] font-medium text-stone-100">
            {projectName}
          </p>
          <p className="mt-0.5 text-[12px] text-stone-500">
            {loops.length} phrase{loops.length === 1 ? "" : "s"}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-stone-600">
            Open
          </p>
          <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
            {loops.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] text-stone-400 transition-colors hover:bg-stone-900/70 hover:text-stone-200"
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
          className="w-full rounded-lg border border-dashed border-stone-700/60 py-2 text-[12px] text-stone-500 transition-colors hover:border-stone-600 hover:bg-stone-900/50 hover:text-stone-300"
          onClick={() => addLoopCandidate()}
        >
          + New phrase
        </button>
      </div>
    ) : null;

  const activePhraseBody =
    duration && activeLoop ? (
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 pt-2">
        {activeSegment && !phraseRenameOpen ? (
          <p className="-mt-1 shrink-0 text-[10px] text-stone-600">
            Editing focus:{" "}
            <span className="text-stone-400">{activeSegment.name}</span>
          </p>
        ) : null}

        {/* Focus regions — primary inspector content */}
        <div className="flex min-h-[5.5rem] flex-1 flex-col rounded-xl border border-stone-700/55 bg-gradient-to-b from-stone-900/35 to-stone-950/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">
              Focus regions
            </p>
            <span className="font-mono text-[10px] text-stone-500">
              {focusRegionRows.length} total
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-[2.75rem] flex-1 flex-wrap content-start items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {focusRegionRows.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => selectSegment(activeLoop.id, seg.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition-all",
                    seg.id === activeSegmentId
                      ? "border-amber-400/55 bg-amber-500/20 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
                      : "border-stone-600/80 bg-stone-950/50 text-stone-300 hover:border-amber-500/25 hover:bg-stone-900/70 hover:text-stone-100",
                  )}
                >
                  {seg.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addSegment(activeLoop.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-dashed border-stone-600/80 px-4 py-2 text-[13px] font-medium text-stone-400 transition-colors hover:border-amber-500/35 hover:bg-stone-900/40 hover:text-amber-100/90"
              >
                <Plus className="h-4 w-4" aria-hidden />
                + Add
              </button>
            </div>
            {activeSegment ? (
              <button
                type="button"
                className="shrink-0 self-start text-[11px] font-medium text-stone-500 underline-offset-2 hover:text-stone-300 hover:underline"
                onClick={() => setActiveSegmentId(null)}
              >
                Back to phrase
              </button>
            ) : null}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-stone-800/40 bg-stone-950/25">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left"
            onClick={() => persistNotesOpen(!notesOpen)}
            aria-expanded={notesOpen}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              Notes
            </span>
            {notesOpen ? (
              <ChevronUp className="h-4 w-4 text-stone-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-stone-500" />
            )}
          </button>
          {notesOpen ? (
            <div className="border-t border-stone-800/35 px-3 pb-3 pt-1">
              <p className="mb-2 text-[11px] text-stone-500">
                {activeSegment
                  ? `Focus Notes: ${activeSegment.name}`
                  : "Phrase Notes"}
              </p>
              <textarea
                value={activeSegment ? segNotesDraft : phraseNotesDraft}
                onChange={(e) =>
                  activeSegment
                    ? setSegNotesDraft(e.target.value)
                    : setPhraseNotesDraft(e.target.value)
                }
                onBlur={() => {
                  if (activeSegment) {
                    if (segNotesDraft !== activeSegment.notes) {
                      updateSegment(activeLoop.id, activeSegment.id, {
                        notes: segNotesDraft,
                      });
                    }
                  } else if (phraseNotesDraft !== (activeLoop.notes ?? "")) {
                    setLoopNotes(activeLoop.id, phraseNotesDraft);
                  }
                }}
                rows={3}
                placeholder={
                  activeSegment
                    ? "Practice notes for this focus…"
                    : "Fingerings, goals, reminders…"
                }
                className="w-full resize-none rounded-md border border-stone-800/55 bg-[#080706]/90 px-3 py-2.5 text-[13px] leading-relaxed text-stone-200 outline-none placeholder:text-stone-600 focus-visible:ring-1 focus-visible:ring-amber-500/25"
              />
            </div>
          ) : null}
        </div>

        {/* Advanced */}
        <div className="rounded-lg border border-stone-800/40 bg-stone-950/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left"
            onClick={() => persistAdvancedOpen(!advancedOpen)}
            aria-expanded={advancedOpen}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Advanced
            </span>
            {advancedOpen ? (
              <ChevronUp className="h-4 w-4 text-stone-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-stone-500" />
            )}
          </button>
          {advancedOpen ? (
            <div className="space-y-3 border-t border-stone-800/35 px-3 pb-3 pt-2">
              {activeSegment ? (
                <>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-stone-600">
                      Focus name
                    </label>
                    <input
                      value={segNameDraft}
                      onChange={(e) => setSegNameDraft(e.target.value)}
                      onBlur={() => {
                        const t = segNameDraft.trim();
                        if (t && t !== activeSegment.name) {
                          updateSegment(activeLoop.id, activeSegment.id, {
                            name: t,
                          });
                        }
                      }}
                      data-woodshed-focus-region-name-input
                      className="w-full rounded-md border border-stone-800/60 bg-stone-950/50 px-2 py-1.5 text-[13px] text-stone-100 outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35"
                      placeholder="Focus region name"
                      aria-label="Focus region name"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-600">
                        Start (s)
                      </span>
                      <input
                        inputMode="decimal"
                        value={segStartDraft}
                        readOnly={!focusRegionWaveformUnlocked}
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
                        className={cn(
                          "rounded-md border border-stone-800/60 bg-stone-950/50 px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35",
                          !focusRegionWaveformUnlocked &&
                            "cursor-not-allowed opacity-55",
                        )}
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-600">
                        End (s)
                      </span>
                      <input
                        inputMode="decimal"
                        value={segEndDraft}
                        readOnly={!focusRegionWaveformUnlocked}
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
                        className={cn(
                          "rounded-md border border-stone-800/60 bg-stone-950/50 px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35",
                          !focusRegionWaveformUnlocked &&
                            "cursor-not-allowed opacity-55",
                        )}
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start px-0 text-[12px] text-red-400/85 hover:bg-transparent hover:text-red-300"
                    onClick={() => {
                      const ok = window.confirm(
                        `Remove focus region “${activeSegment.name}”?`,
                      );
                      if (ok) removeSegment(activeLoop.id, activeSegment.id);
                    }}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden />
                    Remove focus region
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-600">
                        Phrase start (s)
                      </span>
                      <input
                        inputMode="decimal"
                        value={phraseStartDraft}
                        readOnly={!phraseWaveformUnlocked}
                        onChange={(e) => setPhraseStartDraft(e.target.value)}
                        onBlur={() => {
                          const v = Number.parseFloat(phraseStartDraft);
                          if (Number.isFinite(v) && activeLoop) {
                            updateLoopBounds(
                              activeLoop.id,
                              v,
                              activeLoop.end,
                            );
                          } else {
                            setPhraseStartDraft(activeLoop.start.toFixed(2));
                          }
                        }}
                        className={cn(
                          "rounded-md border border-stone-800/60 bg-stone-950/50 px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35",
                          !phraseWaveformUnlocked &&
                            "cursor-not-allowed opacity-55",
                        )}
                      />
                    </label>
                    <label className="flex flex-1 flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-stone-600">
                        Phrase end (s)
                      </span>
                      <input
                        inputMode="decimal"
                        value={phraseEndDraft}
                        readOnly={!phraseWaveformUnlocked}
                        onChange={(e) => setPhraseEndDraft(e.target.value)}
                        onBlur={() => {
                          const v = Number.parseFloat(phraseEndDraft);
                          if (Number.isFinite(v) && activeLoop) {
                            updateLoopBounds(
                              activeLoop.id,
                              activeLoop.start,
                              v,
                            );
                          } else {
                            setPhraseEndDraft(activeLoop.end.toFixed(2));
                          }
                        }}
                        className={cn(
                          "rounded-md border border-stone-800/60 bg-stone-950/50 px-2 py-1.5 font-mono text-[12px] outline-none focus-visible:ring-1 focus-visible:ring-violet-500/35",
                          !phraseWaveformUnlocked &&
                            "cursor-not-allowed opacity-55",
                        )}
                      />
                    </label>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    ) : null;

  const expandedBody = (
    <>
      {emptyNoAudio}
      {emptyNoPhrase}
      {activePhraseBody}
    </>
  );

  return (
    <aside
      className={cn(
        "flex min-w-0 flex-col border-t border-stone-800/50 bg-[#050403]/96 text-stone-300",
        expanded ? "min-h-0 flex-1" : "shrink-0",
      )}
      aria-label="Inspector"
    >
      {phraseContextRow}
      {collapsedFocusPills}
      {!expanded && !phraseContextRow ? (
        <div className="flex items-center justify-between gap-2 border-b border-stone-800/35 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
            Session
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 px-2 text-[11px] text-stone-500 hover:text-stone-300"
            aria-expanded={expanded}
            onClick={() => persistExpanded(true)}
          >
            Expand
            <ChevronUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Button>
        </div>
      ) : null}
      {expanded ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {expandedBody}
        </div>
      ) : null}
    </aside>
  );
});
