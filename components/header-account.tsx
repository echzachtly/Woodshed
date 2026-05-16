"use client";

import { BookOpen, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/auth-provider";
import { WoodshedHowItWorksDialog } from "@/components/woodshed-how-it-works-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeaderAccountProps = {
  /** Compact icon + account menu (mobile practice header). */
  compactMobile?: boolean;
};

/** Fixed menu panel — sits above transport / bottom stacks. */
const MOBILE_ACCOUNT_MENU_Z = 650;

/** Viewport gutter for collision + typical home-indicator band (env padding is extra on scroll body). */
const MOBILE_MENU_EDGE_PAD = 12;
const MOBILE_MENU_GAP = 6;
const MOBILE_MENU_MIN_SCROLL_H = 96;
const MOBILE_MENU_WIDTH_CAP = 288;

type MobileAccountMenuGeom = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeMobileAccountMenuGeom(
  trigger: DOMRect,
  menuScrollHeight: number,
  vv: VisualViewport | null,
): MobileAccountMenuGeom {
  const vTop = vv?.offsetTop ?? 0;
  const vLeft = vv?.offsetLeft ?? 0;
  const vH = vv?.height ?? (typeof window !== "undefined" ? window.innerHeight : 0);
  const vW = vv?.width ?? (typeof window !== "undefined" ? window.innerWidth : 0);

  const topBound = vTop + MOBILE_MENU_EDGE_PAD;
  const bottomBound = vTop + vH - MOBILE_MENU_EDGE_PAD - 8;
  const leftBound = vLeft + MOBILE_MENU_EDGE_PAD;
  const rightBound = vLeft + vW - MOBILE_MENU_EDGE_PAD;

  const menuWidth = Math.min(
    MOBILE_MENU_WIDTH_CAP,
    Math.max(160, rightBound - leftBound),
  );
  let left = trigger.right - menuWidth;
  left = Math.max(leftBound, Math.min(left, rightBound - menuWidth));

  const spaceBelow =
    Math.max(0, bottomBound - trigger.bottom - MOBILE_MENU_GAP);
  const spaceAbove =
    Math.max(0, trigger.top - MOBILE_MENU_GAP - topBound);

  const contentH = Math.max(menuScrollHeight, 1);

  const fitsBelow = contentH <= spaceBelow;
  const fitsAbove = contentH <= spaceAbove;
  /** Prefer flipping up when anchored low and above has more usable room (or below cannot fit content). */
  const preferBelow = fitsBelow || (!fitsAbove && spaceBelow >= spaceAbove);

  let top: number;
  let maxHeight: number;

  if (preferBelow) {
    top = Math.max(topBound, trigger.bottom + MOBILE_MENU_GAP);
    maxHeight = bottomBound - top;
  } else {
    const anchorBottom = trigger.top - MOBILE_MENU_GAP;
    top = Math.max(topBound, anchorBottom - contentH);
    maxHeight = anchorBottom - top;
  }

  maxHeight = Math.min(
    bottomBound - top,
    Math.max(MOBILE_MENU_MIN_SCROLL_H, maxHeight),
  );

  return {
    top,
    left,
    width: menuWidth,
    maxHeight,
  };
}

export function HeaderAccount({ compactMobile = false }: HeaderAccountProps) {
  const { configured, supabase, user, authLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  /** Host for portal — client-only gate. */
  const [mounted, setMounted] = useState(false);
  const [menuGeom, setMenuGeom] = useState<MobileAccountMenuGeom | null>(null);

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);
  const menuScrollWrapRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuGeom(null);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const measureAndPlaceMobileMenu = useCallback(() => {
    if (!(typeof window !== "undefined" && compactMobile && menuOpen)) return;
    const trigger = triggerRef.current;
    const menu = menuScrollWrapRef.current;
    if (!trigger || !menu) return;

    const tr = trigger.getBoundingClientRect();
    const vv = window.visualViewport;
    const geom = computeMobileAccountMenuGeom(
      tr,
      menu.scrollHeight,
      vv ?? null,
    );
    setMenuGeom((prev) => {
      const same =
        prev &&
        Math.abs(prev.top - geom.top) < 0.5 &&
        Math.abs(prev.left - geom.left) < 0.5 &&
        Math.abs(prev.width - geom.width) < 0.5 &&
        Math.abs(prev.maxHeight - geom.maxHeight) < 0.5;
      return same ? prev : geom;
    });
  }, [compactMobile, menuOpen]);

  useLayoutEffect(() => {
    if (!mounted || !(compactMobile && menuOpen)) return undefined;
    measureAndPlaceMobileMenu();
    const ro = new ResizeObserver(() => measureAndPlaceMobileMenu());
    if (menuPanelRef.current) ro.observe(menuPanelRef.current);
    if (triggerRef.current) ro.observe(triggerRef.current);
    if (menuScrollWrapRef.current) ro.observe(menuScrollWrapRef.current);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", measureAndPlaceMobileMenu);
    vv?.addEventListener("scroll", measureAndPlaceMobileMenu);
    window.addEventListener("resize", measureAndPlaceMobileMenu);
    return () => {
      ro.disconnect();
      vv?.removeEventListener("resize", measureAndPlaceMobileMenu);
      vv?.removeEventListener("scroll", measureAndPlaceMobileMenu);
      window.removeEventListener("resize", measureAndPlaceMobileMenu);
    };
  }, [mounted, compactMobile, menuOpen, measureAndPlaceMobileMenu]);

  useEffect(() => {
    if (!menuOpen || !compactMobile) return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuPanelRef.current?.contains(t)) {
        return;
      }
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, compactMobile, closeMenu]);

  /** Mobile: always surface auth affordance; login page explains if env is missing. */
  if (!configured) {
    if (!compactMobile) return null;
    return (
      <>
        <WoodshedHowItWorksDialog open={guideOpen} onOpenChange={setGuideOpen} />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border border-stone-700/40 bg-stone-900/50 text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
            aria-label="How Woodshed Works"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-9 shrink-0 rounded-full border-stone-600/50 bg-stone-900/60 px-3 text-xs font-medium text-stone-200 hover:bg-stone-800 hover:text-stone-50"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </>
    );
  }

  if (authLoading) {
    return (
      <div
        className={cn(
          "shrink-0 animate-pulse rounded-md bg-stone-800/60",
          compactMobile ? "h-8 w-8 rounded-full" : "h-8 w-24",
        )}
        aria-hidden
      />
    );
  }

  if (user?.email) {
    if (compactMobile) {
      const menuMarkup =
        menuOpen &&
        mounted &&
        typeof document !== "undefined" &&
        menuGeom != null
          ? createPortal(
          <div
            ref={menuPanelRef}
            role="menu"
            id="woodshed-mobile-account-menu"
            className="fixed flex flex-col overflow-hidden rounded-xl border border-stone-700/55 bg-stone-950 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
            style={{
              top: menuGeom.top,
              left: menuGeom.left,
              width: menuGeom.width,
              maxHeight: menuGeom.maxHeight,
              zIndex: MOBILE_ACCOUNT_MENU_Z,
            }}
          >
            <div
              ref={menuScrollWrapRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:thin]"
            >
              <p className="break-words px-3 pb-2.5 pt-3 text-[12px] leading-snug text-stone-300">
                {user.email}
              </p>
              <div className="border-t border-stone-800/60 px-2 py-2 pb-[max(12px,env(safe-area-inset-bottom,0px))]">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full touch-manipulation justify-start px-3 text-sm text-stone-300 hover:bg-stone-800/70 hover:text-stone-50"
                  role="menuitem"
                  onClick={() => {
                    setGuideOpen(true);
                    closeMenu();
                  }}
                >
                  <BookOpen
                    className="mr-2 h-3.5 w-3.5 shrink-0 opacity-80"
                    aria-hidden
                  />
                  How Woodshed Works
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-px h-11 w-full touch-manipulation justify-start px-3 text-sm text-stone-300 hover:bg-stone-800/70 hover:text-stone-50"
                  role="menuitem"
                  disabled={signingOut}
                  onClick={() => {
                    if (!supabase) return;
                    setSigningOut(true);
                    closeMenu();
                    void supabase.auth
                      .signOut()
                      .finally(() => {
                        setSigningOut(false);
                        router.refresh();
                      });
                  }}
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
            )
          : null;

      return (
        <div className="relative shrink-0">
          <WoodshedHowItWorksDialog open={guideOpen} onOpenChange={setGuideOpen} />
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full border border-stone-800/80 bg-stone-950/40 text-stone-500 shadow-none hover:border-stone-700/80 hover:bg-stone-900/70 hover:text-stone-200"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls={
              menuOpen ? "woodshed-mobile-account-menu" : undefined
            }
            aria-label="Account menu"
            onClick={() => {
              if (menuOpen) {
                closeMenu();
                return;
              }
              const t = triggerRef.current;
              if (typeof window !== "undefined") {
                if (t && mounted) {
                  const tr = t.getBoundingClientRect();
                  setMenuGeom(
                    computeMobileAccountMenuGeom(
                      tr,
                      MOBILE_MENU_MIN_SCROLL_H * 5,
                      window.visualViewport ?? null,
                    ),
                  );
                } else {
                  const vW =
                    typeof window.visualViewport?.width === "number"
                      ? window.visualViewport.width
                      : window.innerWidth;
                  setMenuGeom({
                    top: MOBILE_MENU_EDGE_PAD + 40,
                    left: MOBILE_MENU_EDGE_PAD,
                    width: Math.min(MOBILE_MENU_WIDTH_CAP, vW - MOBILE_MENU_EDGE_PAD * 2),
                    maxHeight:
                      window.innerHeight * 0.5 - MOBILE_MENU_EDGE_PAD * 2,
                  });
                }
              }
              setMenuOpen(true);
            }}
          >
            <User className="h-4 w-4" strokeWidth={2} />
          </Button>
          {menuMarkup}
        </div>
      );
    }

    return (
      <div className="flex max-w-[min(100%,16rem)] shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span
          className="truncate text-right text-[11px] text-stone-500 sm:max-w-[11rem] sm:text-[12px]"
          title={user.email}
        >
          {user.email}
        </span>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "h-8 shrink-0 px-2.5 text-xs text-stone-400",
            "hover:bg-stone-800/60 hover:text-stone-200",
          )}
          disabled={signingOut}
          onClick={() => {
            if (!supabase) return;
            setSigningOut(true);
            void supabase.auth
              .signOut()
              .finally(() => {
                setSigningOut(false);
                router.refresh();
              });
          }}
        >
          {signingOut ? "…" : "Sign out"}
        </Button>
      </div>
    );
  }

  if (compactMobile) {
    return (
      <>
        <WoodshedHowItWorksDialog open={guideOpen} onOpenChange={setGuideOpen} />
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border border-stone-700/40 bg-stone-900/50 text-stone-400 hover:bg-stone-800/80 hover:text-stone-100"
            aria-label="How Woodshed Works"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-9 shrink-0 rounded-full border-violet-500/30 bg-stone-900/70 px-3 text-xs font-medium text-violet-100 hover:border-violet-400/45 hover:bg-stone-800 hover:text-white"
          >
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <Button
      asChild
      variant="ghost"
      className="h-8 shrink-0 px-3 text-xs text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
    >
      <Link href="/login">Sign in</Link>
    </Button>
  );
}
