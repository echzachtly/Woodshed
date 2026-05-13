"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export type AuthContextValue = {
  configured: boolean;
  supabase: SupabaseClient | null;
  user: User | null;
  /** True until the first session read finishes (skipped when Supabase env is missing). */
  authLoading: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = useMemo(() => isSupabaseConfigured(), []);
  const [supabase] = useState<SupabaseClient | null>(() =>
    configured ? createBrowserSupabaseClient() : null,
  );
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(Boolean(configured));

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      setUser(null);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
  }, [supabase]);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      await refreshUser();
      if (!cancelled) {
        setAuthLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      supabase,
      user,
      authLoading,
      refreshUser,
    }),
    [configured, supabase, user, authLoading, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
