"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Trophy, Activity, CircleDollarSign } from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/utils";

interface ReportData {
  totals: {
    customers: number;
    won: number;
    lost: number;
    winRate: number;
    openPipeline: number;
    weightedPipeline: number;
    wonValue: number;
  };
  funnel: {
    status: string;
    label: string;
    color: string;
    reached: number;
    conversionFromPrev: number;
  }[];
  activity: { weeksAgo: number; count: number }[];
}

export default function ReportsPage() {
  const { current, loading: bizLoading } = useBusiness();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    fetch(`/api/reports?businessId=${current.id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [current]);

  const maxReached = Math.max(1, ...(data?.funnel.map((f) => f.reached) ?? [1]));
  const maxActivity = Math.max(1, ...(data?.activity.map((a) => a.count) ?? [1]));
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle={current ? current.name : "Select a business"}
      />
      <div className="px-8 py-6">
        {bizLoading || loading || !data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-100 bg-white" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Metric icon={<Trophy size={18} />} label="Win rate" value={pct(data.totals.winRate)} tint="#10b981" />
              <Metric icon={<CircleDollarSign size={18} />} label="Weighted pipeline" value={formatCurrency(data.totals.weightedPipeline)} tint="#6366f1" />
              <Metric icon={<TrendingUp size={18} />} label="Open pipeline" value={formatCurrency(data.totals.openPipeline)} tint="#0ea5e9" />
              <Metric icon={<Trophy size={18} />} label="Won revenue" value={formatCurrency(data.totals.wonValue)} tint="#0d9488" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Funnel */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
                <h2 className="text-sm font-semibold text-ink">Conversion funnel</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Customers that reached each stage, and conversion from the prior stage.
                </p>
                <div className="mt-4 space-y-3">
                  {data.funnel.map((f, i) => (
                    <div key={f.status} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-xs font-medium text-slate-500">
                        {f.label}
                      </span>
                      <span className="h-7 flex-1 overflow-hidden rounded-md bg-slate-50">
                        <span
                          className="flex h-full items-center rounded-md px-2 text-[11px] font-semibold text-white"
                          style={{
                            width: `${Math.max((f.reached / maxReached) * 100, f.reached ? 8 : 0)}%`,
                            backgroundColor: f.color,
                          }}
                        >
                          {f.reached > 0 && f.reached}
                        </span>
                      </span>
                      <span className="w-12 text-right text-xs font-medium text-slate-400">
                        {i === 0 ? "—" : pct(f.conversionFromPrev)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Activity */}
              <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <Activity size={15} /> Activity (last 8 weeks)
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Logged interactions per week.
                </p>
                <div className="mt-6 flex h-40 items-end gap-2">
                  {data.activity.map((a) => (
                    <div key={a.weeksAgo} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-slate-400">
                        {a.count > 0 ? a.count : ""}
                      </span>
                      <span
                        className="w-full rounded-t bg-accent/80"
                        style={{ height: `${(a.count / maxActivity) * 100}%`, minHeight: a.count ? 4 : 0 }}
                      />
                      <span className="text-[10px] text-slate-300">
                        {a.weeksAgo === 0 ? "now" : `-${a.weeksAgo}w`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
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
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: `${tint}1a`, color: tint }}>
          {icon}
        </span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
