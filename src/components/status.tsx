"use client";

import { statusMeta, STATUS_LIST, type CustomerStatus } from "@/lib/status";

export function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1a`, color: meta.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      {meta.label}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: meta.color }}
      title={meta.label}
    />
  );
}

export function StatusSelect({
  value,
  onChange,
  disabled,
}: {
  value: CustomerStatus;
  onChange: (s: CustomerStatus) => void;
  disabled?: boolean;
}) {
  const meta = statusMeta(value);
  return (
    <div className="relative inline-flex items-center">
      <span
        className="pointer-events-none absolute left-3 h-2 w-2 rounded-full"
        style={{ backgroundColor: meta.color }}
      />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as CustomerStatus)}
        className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-8 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 disabled:opacity-60"
      >
        {STATUS_LIST.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );
}
