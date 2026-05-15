"use client";

import { ChevronDown } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESETS = [100, 90, 75, 50, 25] as const;
const TEMPO_MIN = 25;
const TEMPO_MAX = 150;

export type TempoPillPickerProps = {
  tempoPercent: number;
  onSetPercent: (pct: number) => void;
  /** Widen pill on desktop. */
  className?: string;
  /** Inert when no decoded timeline (empty workspace). */
  disabled?: boolean;
};

export const TempoPillPicker = memo(function TempoPillPicker(
  props: TempoPillPickerProps,
) {
  const { tempoPercent, onSetPercent, className, disabled = false } = props;
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [draft, setDraft] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const labelId = useId();
  const rounded = Math.round(tempoPercent);

  const close = useCallback(() => {
    setOpen(false);
    setCustomMode(false);
    setDraft("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => {
    if (!customMode || !open) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [customMode, open]);

  const applyCustom = () => {
    const n = Number.parseFloat(draft.trim().replace(",", "."));
    if (!Number.isFinite(n)) {
      setCustomMode(false);
      setDraft("");
      return;
    }
    const clamped = Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(n)));
    onSetPercent(clamped);
    setCustomMode(false);
    setDraft("");
    close();
  };

  return (
    <div ref={rootRef} className={cn("relative mx-auto w-full max-w-[10rem]", className)}>
      <button
        type="button"
        id={labelId}
        aria-expanded={open && !disabled}
        aria-haspopup="menu"
        aria-label={
          disabled
            ? "Tempo — available after loading audio"
            : `Tempo ${rounded} percent. Choose a preset or custom.`
        }
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          setCustomMode(false);
          setDraft("");
        }}
        disabled={disabled}
        aria-disabled={disabled}
        className={cn(
          "flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-1.5",
          "border-stone-600/45 bg-gradient-to-b from-stone-900/88 to-stone-950/95 text-stone-200",
          "text-[13px] font-medium tabular-nums shadow-inner shadow-black/20",
          "transition-colors hover:border-stone-500/55 hover:text-stone-50",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400/70",
          open && !disabled && "border-stone-500/60 text-stone-50",
          disabled &&
            "pointer-events-none border-stone-800/55 bg-stone-950/65 text-stone-600 shadow-none",
        )}
      >
        <span>{rounded}%</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-stone-500 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && !disabled ? (
        <div
          role="menu"
          aria-labelledby={labelId}
          className={cn(
            "absolute left-1/2 top-[calc(100%+6px)] z-[100] w-[min(100vw-2rem,14rem)] -translate-x-1/2",
            "rounded-xl border border-stone-700/55 bg-stone-950 py-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)]",
          )}
        >
          {!customMode ? (
            <div className="flex flex-col px-1">
              {PRESETS.map((pct) => (
                <button
                  key={pct}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    rounded === pct
                      ? "bg-violet-500/15 text-violet-100"
                      : "text-stone-300 hover:bg-stone-800/70",
                  )}
                  onClick={() => {
                    onSetPercent(pct);
                    close();
                  }}
                >
                  {pct}%
                </button>
              ))}
              <button
                type="button"
                role="menuitem"
                className="rounded-lg px-3 py-2 text-left text-sm text-stone-400 hover:bg-stone-800/70 hover:text-stone-200"
                onClick={() => {
                  setCustomMode(true);
                  setDraft(String(rounded));
                }}
              >
                Custom…
              </button>
            </div>
          ) : (
            <div className="px-3 py-2">
              <label className="mb-1 block text-[11px] text-stone-500">
                Tempo ({TEMPO_MIN}–{TEMPO_MAX}%)
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCustom();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setCustomMode(false);
                    setDraft("");
                  }
                }}
                className="mb-2 w-full rounded-md border border-stone-700/60 bg-stone-900/80 px-2 py-1.5 font-mono text-sm text-stone-100 outline-none focus-visible:border-violet-500/50"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 flex-1 px-3 py-1 text-xs"
                  onClick={() => {
                    setCustomMode(false);
                    setDraft("");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="h-8 flex-1 px-3 py-1 text-xs"
                  onClick={applyCustom}
                >
                  Apply
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
});
