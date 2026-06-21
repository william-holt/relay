"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Globe,
  Mail,
  Phone,
  UserPlus,
  Check,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { Button, Field, inputClass } from "@/components/ui";
import type { Prospect } from "@/types";

const CONF_COLOR: Record<string, string> = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#94a3b8",
};

export default function ResearchPage() {
  const { current } = useBusiness();
  const [count, setCount] = useState("5");
  const [criteria, setCriteria] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [prospects, setProspects] = useState<Prospect[] | null>(null);
  const [disclaimer, setDisclaimer] = useState("");
  const [added, setAdded] = useState<Record<number, boolean>>({});

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setLoading(true);
    setError("");
    setProspects(null);
    setAdded({});
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: current.id,
          count: Number(count) || 5,
          criteria,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Research failed. Please try again.");
        return;
      }
      setProspects(json.prospects ?? []);
      setDisclaimer(json.disclaimer ?? "");
    } finally {
      setLoading(false);
    }
  }

  async function addAsCustomer(p: Prospect, idx: number) {
    if (!current) return;
    const noteParts = [
      p.why_fit && `Why a fit: ${p.why_fit}`,
      p.notes && `Notes: ${p.notes}`,
      p.source_urls.length && `Sources:\n${p.source_urls.join("\n")}`,
      `(Added from AI research — verify all details before outreach.)`,
    ].filter(Boolean);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: current.id,
        name: p.owner_name || p.company,
        company: p.company,
        title: p.owner_title ?? "",
        email: p.email ?? "",
        phone: p.phone ?? "",
        source: "AI research",
        status: "cold_lead",
        notes: noteParts.join("\n\n"),
      }),
    });
    if (res.ok) setAdded((a) => ({ ...a, [idx]: true }));
  }

  return (
    <>
      <PageHeader
        title="Prospect research"
        subtitle={current ? current.name : "Select a business"}
      />
      <div className="px-8 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <form
            onSubmit={run}
            className="rounded-xl border border-slate-100 bg-white p-5 shadow-card"
          >
            <p className="mb-4 text-sm text-slate-500">
              Finds potential clients tailored to your{" "}
              <Link href="/settings" className="text-accent hover:underline">
                business profile
              </Link>{" "}
              by searching the public web, and attempts to surface publicly listed
              owner and contact details.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-28">
                <Field label="How many">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="min-w-[220px] flex-1">
                <Field label="Extra criteria (optional)">
                  <input
                    value={criteria}
                    onChange={(e) => setCriteria(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. recently funded, 10–50 employees, near Atlanta"
                  />
                </Field>
              </div>
              <Button type="submit" disabled={loading || !current}>
                <Sparkles size={16} /> {loading ? "Researching…" : "Find prospects"}
              </Button>
            </div>
          </form>

          {loading && (
            <div className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-500 shadow-card">
              Searching the web and compiling prospects — this can take up to a
              minute.
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {prospects && (
            <>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{disclaimer}</span>
              </div>

              {prospects.length === 0 ? (
                <p className="rounded-xl border border-slate-100 bg-white p-8 text-center text-sm text-slate-400 shadow-card">
                  No prospects found. Try refining your business profile or criteria.
                </p>
              ) : (
                <div className="space-y-3">
                  {prospects.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-slate-100 bg-white p-5 shadow-card"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                            {p.company}
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase text-white"
                              style={{ backgroundColor: CONF_COLOR[p.confidence] }}
                            >
                              {p.confidence}
                            </span>
                          </h3>
                          {(p.owner_name || p.owner_title) && (
                            <p className="mt-0.5 text-sm text-slate-600">
                              {p.owner_name}
                              {p.owner_title ? ` · ${p.owner_title}` : ""}
                            </p>
                          )}
                        </div>
                        {added[i] ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                            <Check size={13} /> Added
                          </span>
                        ) : (
                          <Button variant="outline" onClick={() => addAsCustomer(p, i)}>
                            <UserPlus size={15} /> Add as customer
                          </Button>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-600">{p.why_fit}</p>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                        {p.website && (
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-accent hover:underline"
                          >
                            <Globe size={14} /> Website
                          </a>
                        )}
                        {p.email && (
                          <a
                            href={`mailto:${p.email}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-accent"
                          >
                            <Mail size={14} /> {p.email}
                          </a>
                        )}
                        {p.phone && (
                          <a
                            href={`tel:${p.phone}`}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-accent"
                          >
                            <Phone size={14} /> {p.phone}
                          </a>
                        )}
                      </div>

                      {p.source_urls.length > 0 && (
                        <div className="mt-3 border-t border-slate-50 pt-2.5">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Sources
                          </span>
                          <ul className="mt-1 space-y-0.5">
                            {p.source_urls.map((u, j) => (
                              <li key={j}>
                                <a
                                  href={u}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-accent"
                                >
                                  <ExternalLink size={11} />
                                  <span className="truncate">{u}</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
