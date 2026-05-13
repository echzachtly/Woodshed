"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeaderAccount() {
  const { configured, supabase, user, authLoading } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  if (!configured) {
    return null;
  }

  if (authLoading) {
    return (
      <div
        className="h-8 w-24 shrink-0 animate-pulse rounded-md bg-stone-800/60"
        aria-hidden
      />
    );
  }

  if (user?.email) {
    return (
      <div className="flex max-w-[min(100%,14rem)] shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span
          className="truncate text-right text-[11px] text-stone-400 sm:max-w-[10rem] sm:text-xs"
          title={user.email}
        >
          {user.email}
        </span>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-8 shrink-0 border-stone-700/80 px-2.5 text-xs text-stone-200",
            "hover:bg-stone-800/80",
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
          {signingOut ? "…" : "Log out"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      asChild
      variant="secondary"
      className="h-8 shrink-0 border-stone-700/80 px-3 text-xs"
    >
      <Link href="/login">Log in</Link>
    </Button>
  );
}
