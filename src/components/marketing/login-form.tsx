"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // "reset" mode covers both first-time daie (promoted with no password set —
  // see scripts/promote-roster-production.mjs) and anyone who forgot theirs.
  // Firebase allows requesting a reset for an email with no password yet;
  // the link lets them set one for the first time.
  const [mode, setMode] = useState<"signin" | "reset">("signin");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleResetSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Deliberately silent — same generic confirmation whether or not the
      // email exists, so this can't be used to check who has an account.
    } finally {
      setResetLoading(false);
      setResetSent(true);
    }
  }

  if (mode === "reset") {
    return (
      <form onSubmit={handleResetSubmit} className="w-full max-w-sm space-y-5">
        <div className="space-y-1">
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">
            {resetSent ? "Check your email" : "Set or reset your password"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {resetSent
              ? "If an account exists for that email, a link to set your password is on its way."
              : "Enter the email your admin registered for you — first time signing in or forgot your password, same link."}
          </p>
        </div>

        {!resetSent && (
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@kausargroup.my"
            />
          </div>
        )}

        {!resetSent && (
          <Button type="submit" className="w-full" size="lg" disabled={resetLoading}>
            {resetLoading ? "Sending…" : "Send reset link"}
          </Button>
        )}

        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setResetSent(false);
          }}
          className="text-sm font-medium text-primary hover:underline"
        >
          &larr; Back to sign in
        </button>
      </form>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();

      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!response.ok) throw new Error("Could not start session.");

      const next = searchParams.get("next") || "/";
      router.push(next);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign in failed.";
      setError(
        message.includes("invalid-credential") || message.includes("user-not-found") || message.includes("wrong-password")
          ? "Incorrect email or password."
          : message.includes("user-disabled")
            ? "This account has been deactivated. Contact your admin."
            : "Sign in failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
      <div className="space-y-1">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Sign in</h2>
        <p className="text-sm text-muted-foreground">Use the email and password your admin gave you.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@kausargroup.my"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => setMode("reset")}
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
