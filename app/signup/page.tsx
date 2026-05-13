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

export default function SignupPage() {
  const router = useRouter();
  const { configured, supabase, user, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!configured) {
    return (
      <AuthPageShell
        title="Sign up"
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
    setInfo(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!supabase) return;
    setSubmitting(true);
    const { data, error: signError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signError) {
      setError(formatAuthError(signError));
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setInfo(
      "Check your email to confirm your account, then log in. If confirmations are disabled in Supabase, try logging in now.",
    );
  }

  return (
    <AuthPageShell
      title="Sign up"
      subtitle="Create a Woodshed account with email and password."
    >
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-2">
          <Label htmlFor="signup-email">Email</Label>
          <Input
            id="signup-email"
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
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="border-stone-800/80 bg-stone-950/80"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-confirm">Confirm password</Label>
          <Input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
        {info ? (
          <p
            className="rounded-md border border-violet-900/40 bg-violet-950/35 px-3 py-2 text-sm text-violet-100/95"
            role="status"
          >
            {info}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
      <p className="text-center text-sm text-stone-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-violet-300/90 underline-offset-4 hover:text-violet-200 hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthPageShell>
  );
}
