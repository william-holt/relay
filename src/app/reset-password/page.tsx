"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, inputClass } from "@/components/ui";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  // Appwrite appends userId + secret to the recovery link.
  const userId = params.get("userId") ?? "";
  const secret = params.get("secret") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const invalid = !userId || !secret;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, secret, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      setError(error || "Could not reset your password.");
      return;
    }
    router.push("/login?registered=1");
  }

  if (invalid) {
    return (
      <p className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
        This reset link is missing information. Request a new one from the{" "}
        <Link href="/forgot-password" className="underline">
          forgot password
        </Link>{" "}
        page.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="New password" hint="At least 8 characters.">
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label="Confirm new password">
        <input
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </Field>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Updating…" : "Set new password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell heading="Choose a new password">
      <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
