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
import { markDesktopFocusLoopCreatedByUser } from "@/lib/onboarding/desktop-milestones";
import type { PhraseSegment } from "@/lib/loop-engine";
import {
  enterFocusLoopStructuralEdit,
  enterPracticeSectionStructuralEdit,
  isStructuralPracticeMode,
} from "@/lib/woodshed-enter-region-edit";
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

export type DesktopInspectorPanelProps = {
  /**
   * Immersive practice chrome — inspector body hidden; metadata sections collapsed.
   */
  practiceFocusLayout?: boolean;
  /** User explicitly expands inspector / dismisses practice-focus shell (e.g. parent clears zen). */
  onDismissPracticeFocusLayout?: () => void;
  /** Focus chip hover linkage to synthetic timeline regions. */
  onFocusChipHover?: (segmentId: string | null) => void;
  /** Incoming hover from the timeline (paired with {@link onFocusChipHover}). */
  timelineHoverSegmentId?: string | null;
};

export const DesktopInspectorPanel = memo(function DesktopInspectorPanel(
  props: DesktopInspectorPanelProps,
) {
  const practiceFocusLayout = Boolean(props.practiceFocusLayout);
  const onDismissPracticeFocusLayout = props.onDismissPracticeFocusLayout;
  const onFocusChipHover = props.onFocusChipHover;
  const timelineHoverSegmentId = props.timelineHoverSegmentId ?? null;

  const [expanded, setExpanded] = useState(true);
  const [notesOpen, setNotesOpen] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  /** Local pointer hover — paired with timeline via {@link timelineHoverSegmentId}. */
  const [focusChipPointerHover, setFocusChipPointerHover] = useState<
    string | null
  >(null);

  const effectiveExpanded = expanded && !practiceFocusLayout;

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

  const commitUserAddedFocusSegment = useCallback(() => {
    if (!activeLoop || activeLoop.end <= activeLoop.start) return;
    addSegment(activeLoop.id);
    markDesktopFocusLoopCreatedByUser();
  }, [activeLoop, addSegment]);

  useEffect(() => {
    if (!inspectorFocusRequestId) return;
    onDismissPracticeFocusLayout?.();
    persistExpanded(true);
    persistAdvancedOpen(true);
  }, [
    inspectorFocusRequestId,
    persistExpanded,
    persistAdvancedOpen,
    onDismissPracticeFocusLayout,
  ]);

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
  /** Double-click rename on Focus Loop chips (collapsed + expanded). */
  const [focusChipRenameSegmentId, setFocusChipRenameSegmentId] = useState<
    string | null
  >(null);
  const [focusChipRenameDraft, setFocusChipRenameDraft] = useState("");
  const focusChipRenameInputRef = useRef<HTMLInputElement>(null);
  const skipFocusChipBlurCommitRef = useRef(false);

  const zenScrollRef = useRef<HTMLDivElement>(null);
  const [zenShowAdd, setZenShowAdd] = useState(true);

  useEffect(() => {
    setPhraseRenameOpen(false);
    setFocusChipRenameSegmentId(null);
    setZenShowAdd(true);
  }, [activeLoop?.id]);

  useEffect(() => {
    if (!phraseRenameOpen) return;
    const t = window.setTimeout(() => phraseRenameInputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [phraseRenameOpen]);

  const beginFocusChipRename = useCallback(
    (seg: PhraseSegment) => {
      if (!activeLoop) return;
      skipFocusChipBlurCommitRef.current = false;
      setPhraseRenameOpen(false);
      selectSegment(activeLoop.id, seg.id);
      setFocusChipRenameDraft(seg.name);
      setFocusChipRenameSegmentId(seg.id);
    },
    [activeLoop, selectSegment],
  );

  const cancelFocusChipRename = useCallback(() => {
    skipFocusChipBlurCommitRef.current = true;
    if (!activeLoop || !focusChipRenameSegmentId) {
      setFocusChipRenameSegmentId(null);
      return;
    }
    const seg = activeLoop.segments?.find((s) => s.id === focusChipRenameSegmentId);
    setFocusChipRenameDraft(seg?.name ?? "");
    setFocusChipRenameSegmentId(null);
  }, [activeLoop, focusChipRenameSegmentId]);

  const commitFocusChipRename = useCallback(() => {
    if (skipFocusChipBlurCommitRef.current) {
      skipFocusChipBlurCommitRef.current = false;
      return;
    }
    if (!activeLoop || !focusChipRenameSegmentId) {
      setFocusChipRenameSegmentId(null);
      return;
    }
    const seg = activeLoop.segments?.find((s) => s.id === focusChipRenameSegmentId);
    const t = focusChipRenameDraft.trim();
    if (seg && t && t !== seg.name) {
      updateSegment(activeLoop.id, seg.id, { name: t });
    }
    setFocusChipRenameSegmentId(null);
  }, [
    activeLoop,
    focusChipRenameDraft,
    focusChipRenameSegmentId,
    updateSegment,
  ]);

  /** When the edited segment disappears (deleted elsewhere), bail out. */
  useEffect(() => {
    if (!focusChipRenameSegmentId || !activeLoop?.segments?.length) {
      return;
    }
    if (
      !activeLoop.segments.some((s) => s.id === focusChipRenameSegmentId)
    ) {
      setFocusChipRenameSegmentId(null);
    }
  }, [activeLoop?.segments, focusChipRenameSegmentId]);

  useLayoutEffect(() => {
    if (!focusChipRenameSegmentId) return;
    const id = window.requestAnimationFrame(() => {
      const el = focusChipRenameInputRef.current;
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch {
        /* ignore selection edge cases */
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [focusChipRenameSegmentId, effectiveExpanded]);

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
    if (effectiveExpanded || !activeLoop) return;
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
  }, [
    effectiveExpanded,
    activeLoop?.id,
    focusRegionRows,
    activeSegmentId,
    zenShowAdd,
  ]);

  const chipLinkHoverActive = useCallback((segmentId: string) => {
    const fromPointer = focusChipPointerHover === segmentId;
    const fromTimeline =
      timelineHoverSegmentId !== null && timelineHoverSegmentId === segmentId;
    return fromPointer || fromTimeline;
  }, [focusChipPointerHover, timelineHoverSegmentId]);

  const zenFocusPillClass = (selected: boolean, hoveredFromChip: boolean) =>
    cn(
      "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-[border-color,background-color,box-shadow,color] duration-200",
      selected
        ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-50 shadow-[inset_0_0_0_1px_rgba(167,243,208,0.28),0_0_16px_rgba(16,185,129,0.09)]"
        : hoveredFromChip
          ? "border-emerald-400/28 bg-emerald-950/55 text-emerald-100/92"
          : "border-stone-600/75 bg-stone-950/45 text-stone-400 hover:border-emerald-500/25 hover:bg-stone-900/55 hover:text-stone-100",
    );

  const phraseContextRow =
    duration && activeLoop ? (
      <div className="flex shrink-0 items-center gap-1 border-b border-stone-900/38 bg-[#060504]/95 px-2 py-1 sm:px-2.5">
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
              title={
                isStructuralPracticeMode()
                  ? "Double-click to edit phrase on waveform"
                  : "Double-click to rename phrase"
              }
              className="flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full border border-stone-700/60 bg-stone-950/55 py-1.5 pl-3 pr-2.5 text-left transition-colors hover:border-stone-600 hover:bg-stone-900/55"
              onDoubleClick={(e) => {
                e.preventDefault();
                if (!activeLoop) return;
                if (isStructuralPracticeMode()) {
                  enterPracticeSectionStructuralEdit(activeLoop.id);
                  return;
                }
                if (practiceFocusLayout) {
                  onDismissPracticeFocusLayout?.();
                }
                setFocusChipRenameSegmentId(null);
                setPhraseRenameOpen(true);
              }}
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
          aria-expanded={effectiveExpanded}
          aria-label={
            effectiveExpanded ? "Minimize inspector" : "Expand inspector"
          }
          title={effectiveExpanded ? "Minimize inspector" : "Expand inspector"}
          onClick={() => {
            if (effectiveExpanded) persistExpanded(false);
            else {
              if (practiceFocusLayout) {
                onDismissPracticeFocusLayout?.();
              }
              persistExpanded(true);
            }
          }}
        >
          {effectiveExpanded ? (
            <ChevronDown className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronUp className="h-4 w-4" aria-hidden />
          )}
        </Button>
      </div>
    ) : null;

  const collapsedFocusPills =
    duration && activeLoop && !effectiveExpanded ? (
      <div
        ref={zenScrollRef}
        className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-stone-900/32 bg-[#060504]/95 px-2 py-1 sm:px-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Focus regions"
      >
        {focusRegionRows.map((seg) =>
          focusChipRenameSegmentId === seg.id ? (
            <input
              key={seg.id}
              ref={focusChipRenameInputRef}
              role="listitem"
              aria-label={`Rename Focus Loop "${seg.name}"`}
              type="text"
              value={focusChipRenameDraft}
              onChange={(e) => setFocusChipRenameDraft(e.target.value)}
              onBlur={commitFocusChipRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitFocusChipRename();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelFocusChipRename();
                }
              }}
              className={cn(
                zenFocusPillClass(
                  seg.id === activeSegmentId,
                  chipLinkHoverActive(seg.id) &&
                    seg.id !== activeSegmentId,
                ),
                "h-[26px] min-w-[5.5rem] max-w-[12rem] bg-stone-950/95 font-sans outline-none placeholder:text-stone-600 focus-visible:ring-2 focus-visible:ring-emerald-500/40",
              )}
              placeholder="Focus Loop name"
            />
          ) : (
            <button
              key={seg.id}
              type="button"
              role="listitem"
              data-zen-focus-pill
              title={
                isStructuralPracticeMode()
                  ? "Double-click to edit Focus Loop on waveform"
                  : "Double-click to rename Focus Loop"
              }
              onClick={() => selectSegment(activeLoop.id, seg.id)}
              onPointerEnter={() => {
                setFocusChipPointerHover(seg.id);
                onFocusChipHover?.(seg.id);
              }}
              onPointerLeave={() => {
                setFocusChipPointerHover(null);
                onFocusChipHover?.(null);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                if (isStructuralPracticeMode()) {
                  enterFocusLoopStructuralEdit(activeLoop.id, seg.id);
                } else {
                  beginFocusChipRename(seg);
                }
              }}
              className={zenFocusPillClass(
                seg.id === activeSegmentId,
                chipLinkHoverActive(seg.id) &&
                  seg.id !== activeSegmentId,
              )}
            >
              {seg.name}
            </button>
          ),
        )}
        {zenShowAdd ? (
          <button
            type="button"
            data-zen-add
            onClick={commitUserAddedFocusSegment}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-dashed border-stone-600/65 px-2 py-0.5 text-[11px] font-medium text-stone-500 transition-colors hover:border-emerald-500/35 hover:bg-stone-900/45 hover:text-emerald-100/85"
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
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-2.5 pt-1.5">
        {activeSegment && !phraseRenameOpen ? (
          <p className="-mt-1 shrink-0 text-[10px] text-stone-600">
            Editing focus:{" "}
            <span className="text-stone-400">{activeSegment.name}</span>
          </p>
        ) : null}

        {/* Focus regions — primary inspector content */}
        <div className="flex min-h-[4.75rem] flex-1 flex-col rounded-lg border border-stone-800/42 bg-gradient-to-b from-stone-900/28 to-stone-950/55 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-stone-200">
              Focus regions
            </p>
            <span className="font-mono text-[10px] text-stone-500">
              {focusRegionRows.length} total
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-[2.5rem] flex-1 flex-wrap content-start items-center gap-1.5 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {focusRegionRows.map((seg) =>
                focusChipRenameSegmentId === seg.id ? (
                  <input
                    key={seg.id}
                    ref={focusChipRenameInputRef}
                    aria-label={`Rename Focus Loop "${seg.name}"`}
                    type="text"
                    value={focusChipRenameDraft}
                    onChange={(e) => setFocusChipRenameDraft(e.target.value)}
                    onBlur={commitFocusChipRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitFocusChipRename();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        cancelFocusChipRename();
                      }
                    }}
                    className={cn(
                      "h-9 shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-emerald-500/35",
                      seg.id === activeSegmentId
                        ? "border-emerald-400/45 bg-emerald-500/20 text-emerald-50 placeholder:text-emerald-200/55"
                        : "border-stone-600/80 bg-stone-950/95 text-stone-200 placeholder:text-stone-600",
                    )}
                    placeholder="Focus Loop name"
                  />
                ) : (
                  <button
                    key={seg.id}
                    type="button"
                    title={
                      isStructuralPracticeMode()
                        ? "Double-click to edit Focus Loop on waveform"
                        : "Double-click to rename Focus Loop"
                    }
                    onClick={() => selectSegment(activeLoop.id, seg.id)}
                    onPointerEnter={() => {
                      setFocusChipPointerHover(seg.id);
                      onFocusChipHover?.(seg.id);
                    }}
                    onPointerLeave={() => {
                      setFocusChipPointerHover(null);
                      onFocusChipHover?.(null);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      if (isStructuralPracticeMode()) {
                        enterFocusLoopStructuralEdit(activeLoop.id, seg.id);
                      } else {
                        beginFocusChipRename(seg);
                      }
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-[border-color,background-color,box-shadow,color] duration-200",
                      seg.id === activeSegmentId
                        ? "border-emerald-400/45 bg-emerald-500/18 text-emerald-50 shadow-[inset_0_0_0_1px_rgba(167,243,208,0.22),0_0_14px_rgba(16,185,129,0.07)]"
                        : chipLinkHoverActive(seg.id)
                          ? "border-emerald-400/28 bg-emerald-950/45 text-emerald-100/90"
                          : "border-stone-600/75 bg-stone-950/45 text-stone-300 hover:border-emerald-500/22 hover:bg-stone-900/65 hover:text-stone-100",
                    )}
                  >
                    {seg.name}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={commitUserAddedFocusSegment}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 border-dashed border-stone-600/70 px-3.5 py-1.5 text-[13px] font-medium text-stone-400 transition-colors hover:border-emerald-500/35 hover:bg-stone-900/38 hover:text-emerald-50/92"
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
        <div className="rounded-md border border-stone-900/45 bg-stone-950/20">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left"
            onClick={() => {
              const next = !notesOpen;
              if (next) onDismissPracticeFocusLayout?.();
              persistNotesOpen(next);
            }}
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
        <div className="rounded-md border border-stone-900/45 bg-stone-950/[0.07]">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-1.5 text-left"
            onClick={() => {
              const next = !advancedOpen;
              if (next) onDismissPracticeFocusLayout?.();
              persistAdvancedOpen(next);
            }}
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
        "flex min-w-0 flex-col border-t border-stone-900/55 bg-[#050403]/88 text-stone-300 transition-[border-color,background-color,opacity] duration-300",
        effectiveExpanded ? "min-h-0 flex-1" : "shrink-0",
        practiceFocusLayout && "border-stone-900/40 opacity-[0.98]",
      )}
      aria-label="Inspector"
    >
      {phraseContextRow}
      {collapsedFocusPills}
      {!effectiveExpanded && !phraseContextRow ? (
        <div className="flex items-center justify-between gap-2 border-b border-stone-900/32 px-2.5 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-600">
            Session
          </span>
          <Button
            type="button"
            variant="ghost"
            className="h-8 gap-1 px-2 text-[11px] text-stone-500 hover:text-stone-300"
            aria-expanded={effectiveExpanded}
            onClick={() => {
              if (practiceFocusLayout) {
                onDismissPracticeFocusLayout?.();
              }
              persistExpanded(true);
            }}
          >
            Expand
            <ChevronUp className="h-3.5 w-3.5 opacity-70" aria-hidden />
          </Button>
        </div>
      ) : null}
      {effectiveExpanded ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {expandedBody}
        </div>
      ) : null}
    </aside>
  );
});
