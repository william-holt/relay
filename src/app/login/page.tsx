"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, inputClass } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("That email and password don't match an account.");
      return;
    }
    router.push(params.get("callbackUrl") ?? "/dashboard");
    router.refresh();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        {params.get("registered") && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Account ready. Sign in to continue.
          </p>
        )}
        <Field label="Email">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@company.com"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-accent hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-slate-500 hover:text-slate-700">
          Create an account
        </Link>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthShell heading="Sign in" sub="Welcome back. Pick up where you left off.">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
