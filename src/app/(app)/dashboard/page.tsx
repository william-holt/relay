"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { Users, Flame, TrendingUp, CircleDollarSign } from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status";
import { Avatar } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  totals: {
    customers: number;
    activeLeads: number;
    pipelineValue: number;
    wonValue: number;
  };
  byStatus: { status: string; label: string; color: string; count: number }[];
  recent: {
    id: string;
    name: string;
    status: string;
    company: string | null;
    updated_at: string;
  }[];
  tasks: {
    id: string;
    title: string;
    due_at: string | null;
    customers?: { name: string } | null;
  }[];
}

export default function DashboardPage() {
  const { current, loading: bizLoading } = useBusiness();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    fetch(`/api/dashboard?businessId=${current.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [current]);

  const maxCount = Math.max(1, ...(data?.byStatus.map((s) => s.count) ?? [1]));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={current ? current.name : "Select a business"}
      />

      <div className="px-8 py-6">
        {bizLoading || loading || !data ? (
          <SkeletonGrid />
        ) : (
          <div className="space-y-6">
            {/* Metric cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                icon={<Users size={18} />}
                label="Total customers"
                value={data.totals.customers.toString()}
              />
              <Metric
                icon={<Flame size={18} />}
                label="Active leads"
                value={data.totals.activeLeads.toString()}
                tint="#f59e0b"
              />
              <Metric
                icon={<TrendingUp size={18} />}
                label="Open pipeline"
                value={formatCurrency(data.totals.pipelineValue)}
                tint="#6366f1"
              />
              <Metric
                icon={<CircleDollarSign size={18} />}
                label="Won revenue"
                value={formatCurrency(data.totals.wonValue)}
                tint="#10b981"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Pipeline breakdown */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card lg:col-span-2">
                <h2 className="text-sm font-semibold text-ink">
                  Pipeline by status
                </h2>
                <div className="mt-4 space-y-3">
                  {data.byStatus.map((s) => (
                    <Link
                      key={s.status}
                      href={`/customers?status=${s.status}`}
                      className="group flex items-center gap-3"
                    >
                      <span className="w-24 shrink-0 text-xs font-medium text-slate-500 group-hover:text-slate-700">
                        {s.label}
                      </span>
                      <span className="h-7 flex-1 overflow-hidden rounded-md bg-slate-50">
                        <span
                          className="flex h-full items-center rounded-md px-2 text-[11px] font-semibold text-white transition-all"
                          style={{
                            width: `${Math.max((s.count / maxCount) * 100, s.count ? 8 : 0)}%`,
                            backgroundColor: s.color,
                          }}
                        >
                          {s.count > 0 && s.count}
                        </span>
                      </span>
                      <span className="w-6 text-right text-xs font-medium text-slate-400">
                        {s.count}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>

              {/* Follow-up tasks */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
                <h2 className="text-sm font-semibold text-ink">Follow-ups</h2>
                {data.tasks.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">
                    No open follow-ups. Add one from a customer&apos;s profile.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {data.tasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-2.5">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        <span className="min-w-0">
                          <span className="block text-sm text-slate-700">
                            {t.title}
                          </span>
                          <span className="text-xs text-slate-400">
                            {t.customers?.name ? `${t.customers.name} · ` : ""}
                            {t.due_at
                              ? `due ${format(new Date(t.due_at), "MMM d")}`
                              : "no due date"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Recently active */}
            <section className="rounded-xl border border-slate-100 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h2 className="text-sm font-semibold text-ink">
                  Recently active
                </h2>
                <Link
                  href="/customers"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  View all customers
                </Link>
              </div>
              {data.recent.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-400">
                  No customers yet. Add your first one from the Customers tab.
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {data.recent.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                      >
                        <Avatar name={c.name} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {c.name}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {c.company ?? "—"}
                          </span>
                        </span>
                        <StatusBadge status={c.status} />
                        <span className="hidden w-28 text-right text-xs text-slate-400 sm:block">
                          {formatDistanceToNow(new Date(c.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({
  icon,
  label,
  value,
  tint = "#4f46e5",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{ backgroundColor: `${tint}1a`, color: tint }}
        >
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-28 animate-pulse rounded-xl border border-slate-100 bg-white"
        />
      ))}
    </div>
  );
}
