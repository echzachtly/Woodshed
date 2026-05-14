"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type HeaderAccountProps = {
  /** Compact icon + account menu (mobile practice header). */
  compactMobile?: boolean;
};

export function HeaderAccount({ compactMobile = false }: HeaderAccountProps) {
  const { configured, supabase, user, authLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen || !compactMobile) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, compactMobile, closeMenu]);

  if (!configured) {
    return null;
  }

  if (authLoading) {
    return (
      <div
        className={cn(
          "shrink-0 animate-pulse rounded-md bg-stone-800/60",
          compactMobile ? "h-9 w-9 rounded-full" : "h-8 w-24",
        )}
        aria-hidden
      />
    );
  }

  if (user?.email) {
    if (compactMobile) {
      return (
        <div ref={wrapRef} className="relative shrink-0">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full border-stone-700/70 bg-stone-900/80 text-stone-200 hover:bg-stone-800 hover:text-stone-50"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <User className="h-4 w-4" strokeWidth={2} />
          </Button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+6px)] z-[130] min-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-stone-700/55 bg-stone-950 py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
            >
              <p className="break-words px-3 py-2.5 text-[12px] leading-snug text-stone-300">
                {user.email}
              </p>
              <div className="border-t border-stone-800/60 px-2 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-full justify-start px-3 text-sm text-stone-300 hover:bg-stone-800/70 hover:text-stone-50"
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
          ) : null}
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
      <Button
        asChild
        variant="secondary"
        className="h-9 shrink-0 rounded-full border-stone-700/70 bg-stone-900/80 px-3 text-xs font-medium text-stone-200 hover:bg-stone-800 hover:text-stone-50"
      >
        <Link href="/login">Sign in</Link>
      </Button>
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
