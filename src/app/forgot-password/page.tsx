"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, inputClass } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <AuthShell
      heading="Reset your password"
      sub="We'll email you a link to choose a new one."
    >
      {sent ? (
        <div className="rounded-lg bg-accent-soft px-4 py-4 text-sm text-slate-700">
          If an account exists for <strong>{email}</strong>, a reset link is on
          its way. The link expires in an hour.
          <div className="mt-4">
            <Link href="/login" className="text-accent hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@company.com"
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
          <p className="mt-5 text-sm text-slate-500">
            Remembered it?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
