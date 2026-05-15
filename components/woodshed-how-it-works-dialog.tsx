"use client";

import {
  Cloud,
  Focus,
  Gauge,
  MousePointer2,
  Smartphone,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type WoodshedHowItWorksDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type GuideSection = {
  title: string;
  body: string;
  icon: ReactNode;
};

const sections: GuideSection[] = [
  {
    title: "Create a Profile",
    body: "Create a profile to save your practice library to the cloud and sync projects across devices.",
    icon: <Cloud className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    title: "Upload a Song",
    body: "Import audio and start building practice material from the waveform.",
    icon: <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    title: "Create Phrases",
    body: "Hold Shift and drag on the waveform to capture phrases directly from the music.",
    icon: <MousePointer2 className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    title: "Create Focus Loops",
    body: "With a phrase active, Shift + drag inside it to isolate a difficult section.",
    icon: <Focus className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    title: "Practice",
    body: "Use Loop Phrase, Focus Loop, Restart, and Practice speed in the transport bar to drill efficiently.",
    icon: <Gauge className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
  {
    title: "Mobile Practice",
    body: "Desktop is for creating practice material. Mobile is for focused repetition practice. Add Woodshed to your home screen for the best phone experience.",
    icon: <Smartphone className="h-4 w-4" strokeWidth={2} aria-hidden />,
  },
];

export function WoodshedHowItWorksDialog({
  open,
  onOpenChange,
}: WoodshedHowItWorksDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getFocusables = useCallback(() => {
    const root = panelRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el.getClientRects().length > 0,
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
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
  }, [open, close, getFocusables]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-6"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Close guide"
        onClick={close}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[1] flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-700/55",
          "bg-gradient-to-b from-stone-950 to-[#080706] shadow-[0_24px_64px_rgba(0,0,0,0.65)]",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-800/60 px-4 pb-3 pt-3">
          <div className="min-w-0 pt-0.5">
            <h2
              id={titleId}
              className="text-[15px] font-semibold tracking-tight text-stone-100"
            >
              How Woodshed Works
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-stone-500">
              A quick path from audio to repetition practice.
            </p>
          </div>
          <Button
            ref={closeBtnRef}
            type="button"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
            onClick={close}
          >
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <ol className="space-y-5">
            {sections.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <div
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-950/35 text-violet-200/95"
                  aria-hidden
                >
                  {s.icon}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                    {i + 1}. {s.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-stone-300/95">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>,
    document.body,
  );
}
