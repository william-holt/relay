"use client";

import Link from "next/link";
import { STATUS_LIST } from "@/lib/status";

/**
 * Split layout: a quiet form on the left, and on the right the product's
 * signature — the customer lifecycle rendered as a vertical "heat" ladder.
 */
export function AuthShell({
  children,
  heading,
  sub,
}: {
  children: React.ReactNode;
  heading: string;
  sub?: string;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-sm font-bold text-white">
              R
            </span>
            <span className="text-lg font-semibold tracking-tight text-ink">
              Relay
            </span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {heading}
          </h1>
          {sub && <p className="mt-2 text-sm text-slate-500">{sub}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="absolute inset-0 flex flex-col justify-center px-16">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
            Every relationship, one path
          </p>
          <h2 className="mb-10 max-w-sm text-2xl font-semibold leading-snug text-white">
            Watch a contact warm up from a cold name to recurring revenue.
          </h2>
          <ol className="space-y-3">
            {STATUS_LIST.filter((s) => s.value !== "lost").map((s, i) => (
              <li key={s.value} className="flex items-center gap-4">
                <span className="w-5 text-right text-xs font-medium text-white/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-sm font-medium text-white/85">
                  {s.label}
                </span>
                <span
                  className="ml-auto h-px flex-1 max-w-[120px]"
                  style={{
                    background: `linear-gradient(to right, ${s.color}, transparent)`,
                  }}
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
