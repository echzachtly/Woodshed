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
