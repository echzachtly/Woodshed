"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PhraseSegment, PracticeLoop } from "@/lib/loop-engine";
import { cn } from "@/lib/utils";
import { useWoodshedStore } from "@/store/woodshed-store";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusLoopDisplayLabel(seg: PhraseSegment, index: number): string {
  const n = seg.name?.trim();
  if (n) return n;
  return `Target ${index + 1}`;
}

export type MobileEditActionsSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Same resolver as Focus chips (from workspace), so actions match the highlighted chip.
   * Nullable when no Focus Loop is in scope.
   */
  focusTargetSegmentId: string | null;
  /** Demo project: hide structural edit actions (M1/M2). */
  isDemoProject?: boolean;
};

export const MobileEditActionsSheet = memo(function MobileEditActionsSheet(
  props: MobileEditActionsSheetProps,
) {
  const { isOpen, onClose, focusTargetSegmentId, isDemoProject = false } = props;
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    loops,
    activeLoopId,
    duration,
    renameLoop,
    removeLoop,
    updateSegment,
    removeSegment,
  } = useWoodshedStore(
    useShallow((s) => ({
      loops: s.loops,
      activeLoopId: s.activeLoopId,
      duration: s.duration,
      renameLoop: s.renameLoop,
      removeLoop: s.removeLoop,
      updateSegment: s.updateSegment,
      removeSegment: s.removeSegment,
    })),
  );

  const activeLoop: PracticeLoop | undefined = activeLoopId
    ? loops.find((l) => l.id === activeLoopId)
    : undefined;

  const focusSegment: PhraseSegment | undefined =
    activeLoop?.segments && focusTargetSegmentId
      ? activeLoop.segments.find((x) => x.id === focusTargetSegmentId)
      : undefined;

  const focusSegmentIndex =
    activeLoop?.segments && focusSegment
      ? activeLoop.segments.findIndex((x) => x.id === focusSegment.id)
      : -1;

  const [subPanel, setSubPanel] = useState<"main" | "addPhrase">("main");
  const [addSectionName, setAddSectionName] = useState("");
  const [addPlacement, setAddPlacement] = useState<"playhead" | "append">(
    "playhead",
  );
  const [phraseDraft, setPhraseDraft] = useState("");
  const [segmentDraft, setSegmentDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<"phrase" | "segment" | null>(
    null,
  );

  const canRemovePhrase = loops.length > 1;
  const phraseLabel =
    activeLoop?.name?.trim() || "Practice Section";

  const syncDraftsFromStore = useCallback(() => {
    if (!activeLoop) {
      setPhraseDraft("");
      setSegmentDraft("");
      return;
    }
    setPhraseDraft(activeLoop.name ?? "");
    if (focusSegment) {
      setSegmentDraft(focusSegment.name ?? "");
    } else {
      setSegmentDraft("");
    }
  }, [activeLoop, focusSegment]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPendingDelete(null);
      setSubPanel("main");
      setAddSectionName("");
      setAddPlacement("playhead");
      return;
    }
    syncDraftsFromStore();
  }, [isOpen, syncDraftsFromStore, activeLoopId, focusTargetSegmentId]);

  const getFocusables = useCallback(() => {
    const root = sheetRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    );
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (pendingDelete) {
          setPendingDelete(null);
          return;
        }
        if (subPanel === "addPhrase") {
          setSubPanel("main");
          return;
        }
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const list = getFocusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (!first || !last) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    window.requestAnimationFrame(() => {
      closeBtnRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, onClose, getFocusables, pendingDelete, subPanel]);

  const applyPhraseRename = () => {
    if (!activeLoopId || !activeLoop) return;
    const next = phraseDraft.trim();
    if (!next || next === (activeLoop.name ?? "").trim()) return;
    renameLoop(activeLoopId, next);
  };

  const applySegmentRename = () => {
    if (!activeLoopId || !focusSegment) return;
    const next = segmentDraft.trim();
    const prev = (focusSegment.name ?? "").trim();
    if (!next || next === prev) return;
    updateSegment(activeLoopId, focusSegment.id, { name: next });
  };

  const confirmRemovePhrase = () => {
    if (!activeLoopId || !canRemovePhrase) return;
    removeLoop(activeLoopId);
    setPendingDelete(null);
    onClose();
  };

  const confirmRemoveSegment = () => {
    if (!activeLoopId || !focusSegment) return;
    removeSegment(activeLoopId, focusSegment.id);
    setPendingDelete(null);
    onClose();
  };

  const handleAddPracticeSection = () => {
    const st = useWoodshedStore.getState();
    if (!st.duration) return;
    const defaultName = `Section ${st.loops.length + 1}`;
    const name = addSectionName.trim() || defaultName;
    if (addPlacement === "playhead") {
      st.addLoopAround(st.currentTime, 4, name);
    } else {
      st.addLoopCandidate(name);
    }
    setSubPanel("main");
    setAddSectionName("");
    onClose();
  };

  if (!mounted) return null;

  const showFocusSection = Boolean(activeLoop?.segments?.length);
  const needsChipSelection =
    showFocusSection && focusTargetSegmentId == null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            key="edit-actions-backdrop"
            className="fixed inset-0 z-[129] bg-black/55 backdrop-blur-[2px] min-[769px]:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
            onClick={() => {
              setPendingDelete(null);
              onClose();
            }}
          />
          <motion.div
            key="woodshed-edit-actions-sheet"
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[130] flex max-h-[min(82dvh,680px)] flex-col min-[769px]:hidden",
              "rounded-t-2xl border border-stone-700/50 border-b-0 bg-stone-950 shadow-[0_-12px_48px_rgba(0,0,0,0.55)]",
              "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1",
            )}
            initial={{ y: "105%" }}
            animate={{ y: 0 }}
            exit={{ y: "105%" }}
            transition={{ type: "spring", damping: 32, stiffness: 380 }}
          >
            <div className="flex shrink-0 flex-col items-center px-4 pb-2 pt-2">
              <div
                className="mb-2 h-1 w-10 shrink-0 rounded-full bg-stone-600/80"
                aria-hidden
              />
              <div className="flex w-full items-start justify-between gap-2">
                {subPanel === "addPhrase" ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-10 shrink-0 gap-1 px-2 text-stone-300 hover:bg-stone-800/80 hover:text-stone-50"
                      aria-label="Back to edit actions"
                      onClick={() => {
                        setPendingDelete(null);
                        setSubPanel("main");
                      }}
                    >
                      <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                      <span className="text-[13px] font-medium">Back</span>
                    </Button>
                    <div className="min-w-0 flex-1">
                      <h2
                        id={titleId}
                        className="text-[12px] font-semibold uppercase tracking-[0.2em] text-stone-400"
                      >
                        New Practice Section
                      </h2>
                      <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                        Optional name, then drag the section edges on the
                        waveform to refine.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <h2
                      id={titleId}
                      className="text-[12px] font-semibold uppercase tracking-[0.2em] text-stone-400"
                    >
                      Edit actions
                    </h2>
                    <p className="mt-0.5 text-[12px] leading-snug text-stone-500">
                      Manage sections and Focus Loops. Practice Section timing
                      can be refined on the waveform while Edit Mode is on.
                      Focus Loops stay chip-driven here.
                    </p>
                  </div>
                )}
                <Button
                  ref={closeBtnRef}
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
                  aria-label="Close"
                  onClick={() => {
                    setPendingDelete(null);
                    onClose();
                  }}
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain px-4 pb-6 [-webkit-overflow-scrolling:touch]">
              {subPanel === "addPhrase" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="mobile-add-section-name"
                      className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
                    >
                      Name (optional)
                    </label>
                    <Input
                      id="mobile-add-section-name"
                      value={addSectionName}
                      onChange={(e) => setAddSectionName(e.target.value)}
                      placeholder={`Section ${loops.length + 1}`}
                      className="border-stone-700/60 bg-stone-950/80 text-[15px] text-stone-100 placeholder:text-stone-600"
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      Placement
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setAddPlacement("playhead")}
                        className={cn(
                          "min-h-[48px] rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium leading-snug transition-colors touch-manipulation",
                          addPlacement === "playhead"
                            ? "border-violet-500/50 bg-violet-500/12 text-violet-50"
                            : "border-stone-700/55 bg-stone-900/40 text-stone-300 hover:border-stone-600/70",
                        )}
                        aria-pressed={addPlacement === "playhead"}
                      >
                        Center on playhead
                        <span className="mt-0.5 block text-[11px] font-normal text-stone-500">
                          Uses ~8 seconds centered on the current position.
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddPlacement("append")}
                        className={cn(
                          "min-h-[48px] rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium leading-snug transition-colors touch-manipulation",
                          addPlacement === "append"
                            ? "border-violet-500/50 bg-violet-500/12 text-violet-50"
                            : "border-stone-700/55 bg-stone-900/40 text-stone-300 hover:border-stone-600/70",
                        )}
                        aria-pressed={addPlacement === "append"}
                      >
                        Place after current section
                        <span className="mt-0.5 block text-[11px] font-normal text-stone-500">
                          Adds a new span beyond the active Practice Section when
                          possible.
                        </span>
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-12 w-full text-[14px] font-semibold"
                    disabled={duration <= 0}
                    onClick={handleAddPracticeSection}
                  >
                    Create & select
                  </Button>
                </div>
              ) : (
                <>
                  {!isDemoProject && duration > 0 ? (
                    <section className="rounded-xl border border-violet-900/35 bg-violet-950/25 px-3 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200/90">
                        Structure
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-stone-400">
                        Add another Practice Section, then drag its orange edges
                        on the waveform.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="mt-3 h-11 w-full"
                        onClick={() => setSubPanel("addPhrase")}
                      >
                        Add Practice Section
                      </Button>
                    </section>
                  ) : null}

                  {!duration ? (
                    <p className="py-6 text-center text-[13px] text-stone-500">
                      Load a project with audio to edit structure.
                    </p>
                  ) : !activeLoop ? (
                    <p className="py-4 text-center text-[13px] leading-snug text-stone-500">
                      No active Practice Section. Use{" "}
                      <span className="font-medium text-stone-400">
                        Add Practice Section
                      </span>{" "}
                      above when available.
                    </p>
                  ) : (
                    <>
                      {/* Practice Section */}
                      <section
                        className="space-y-3 rounded-xl border border-stone-800/60 bg-stone-900/35 px-3 py-3"
                        aria-labelledby="mobile-edit-phrase-heading"
                      >
                        <h3
                          id="mobile-edit-phrase-heading"
                          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
                        >
                          Practice Section
                        </h3>
                        <Input
                          value={phraseDraft}
                          onChange={(e) => setPhraseDraft(e.target.value)}
                          placeholder="Section name"
                          aria-label="Practice Section name"
                          className="border-stone-700/60 bg-stone-950/80 text-[15px] text-stone-100 placeholder:text-stone-600"
                          autoComplete="off"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              applyPhraseRename();
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-11 min-w-[5.5rem]"
                            onClick={applyPhraseRename}
                          >
                            Save name
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="min-h-11 border-red-900/40 text-red-200/95 hover:bg-red-950/40 hover:text-red-50"
                            disabled={!canRemovePhrase}
                            title={
                              !canRemovePhrase
                                ? "Cannot remove the only Practice Section in a project."
                                : "Remove this Practice Section"
                            }
                            onClick={() => setPendingDelete("phrase")}
                          >
                            Delete…
                          </Button>
                        </div>
                        {!canRemovePhrase ? (
                          <p className="text-[11px] leading-snug text-stone-500">
                            This is the only Practice Section. Delete is
                            disabled to keep your project structure intact.
                          </p>
                        ) : null}
                      </section>

                      {/* Focus Loop */}
                      <section
                        className="space-y-3 rounded-xl border border-stone-800/60 bg-stone-900/35 px-3 py-3"
                        aria-labelledby="mobile-edit-segment-heading"
                      >
                        <h3
                          id="mobile-edit-segment-heading"
                          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500"
                        >
                          Focus Loop
                        </h3>
                        {!showFocusSection ? (
                          <p className="text-[12px] leading-snug text-stone-500">
                            No Focus Loops in this section yet. Create them on
                            desktop for now.
                          </p>
                        ) : needsChipSelection ? (
                          <p className="text-[12px] leading-snug text-stone-500">
                            Tap a Focus chip above to choose which Focus Loop to
                            rename or delete.
                          </p>
                        ) : focusSegment && focusSegmentIndex >= 0 ? (
                          <>
                            <p className="text-[12px] text-stone-400">
                              Editing{" "}
                              <span className="font-medium text-stone-200">
                                {focusLoopDisplayLabel(
                                  focusSegment,
                                  focusSegmentIndex,
                                )}
                              </span>
                            </p>
                            <Input
                              value={segmentDraft}
                              onChange={(e) => setSegmentDraft(e.target.value)}
                              placeholder="Focus Loop name"
                              aria-label="Focus Loop name"
                              className="border-stone-700/60 bg-stone-950/80 text-[15px] text-stone-100 placeholder:text-stone-600"
                              autoComplete="off"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  applySegmentRename();
                                }
                              }}
                            />
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                className="min-h-11 min-w-[5.5rem]"
                                onClick={applySegmentRename}
                              >
                                Save name
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 border-red-900/40 text-red-200/95 hover:bg-red-950/40 hover:text-red-50"
                                onClick={() => setPendingDelete("segment")}
                              >
                                Delete…
                              </Button>
                            </div>
                          </>
                        ) : (
                          <p className="text-[12px] leading-snug text-stone-500">
                            Focus Loop data is unavailable.
                          </p>
                        )}
                      </section>

                      {pendingDelete ? (
                        <div
                          className="rounded-xl border border-red-900/45 bg-red-950/25 px-3 py-3"
                          role="alert"
                        >
                          <p className="text-[13px] font-medium text-red-100/95">
                            {pendingDelete === "phrase"
                              ? `Delete "${phraseLabel}"? Playback scope may change. This cannot be undone.`
                              : focusSegment
                                ? `Delete Focus Loop "${focusLoopDisplayLabel(focusSegment, Math.max(0, focusSegmentIndex))}"? This cannot be undone.`
                                : "Delete this Focus Loop? This cannot be undone."}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              className="min-h-11"
                              onClick={() => setPendingDelete(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="min-h-11 bg-red-700 text-white hover:bg-red-600"
                              onClick={
                                pendingDelete === "phrase"
                                  ? confirmRemovePhrase
                                  : confirmRemoveSegment
                              }
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
});
