"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthPageShell } from "@/components/auth-page-shell";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuthError } from "@/lib/auth/format-auth-error";

export default function LoginPage() {
  const router = useRouter();
  const { configured, supabase, user, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!configured) {
    return (
      <AuthPageShell
        title="Log in"
        subtitle="Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment."
      >
        <Button asChild variant="secondary" className="w-full border-stone-700">
          <Link href="/">Return home</Link>
        </Button>
      </AuthPageShell>
    );
  }

  if (!authLoading && user) {
    return (
      <AuthPageShell title="You’re signed in" subtitle={user.email ?? undefined}>
        <Button
          type="button"
          className="w-full"
          onClick={() => router.push("/")}
        >
          Open Woodshed
        </Button>
      </AuthPageShell>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!supabase) return;
    setSubmitting(true);
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signError) {
      setError(formatAuthError(signError));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthPageShell
      title="Log in"
      subtitle="Use the email and password for your Woodshed account."
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="border-stone-800/80 bg-stone-950/80"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="border-stone-800/80 bg-stone-950/80"
          />
        </div>
        {error ? (
          <p
            className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200/95"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <p className="text-center text-sm text-stone-500">
        No account?{" "}
        <Link
          href="/signup"
          className="text-violet-300/90 underline-offset-4 hover:text-violet-200 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </AuthPageShell>
  );
}
