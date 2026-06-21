"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Download, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, StatusSelect } from "@/components/status";
import { Avatar, Button, Field, Modal, inputClass } from "@/components/ui";
import { STATUS_LIST, type CustomerStatus } from "@/lib/status";
import { formatCurrency } from "@/lib/utils";
import { useRealtime } from "@/lib/use-realtime";
import type { Customer } from "@/types";

const REALTIME_COLLECTIONS = ["customers"];

function CustomersInner() {
  const { current } = useBusiness();
  const params = useSearchParams();
  const initialStatus = params.get("status") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    if (!current) return;
    setLoading(true);
    const url = new URL("/api/customers", window.location.origin);
    url.searchParams.set("businessId", current.id);
    if (q) url.searchParams.set("q", q);
    if (statusFilter) url.searchParams.set("status", statusFilter);
    const res = await fetch(url.toString());
    const { customers } = await res.json();
    setCustomers(customers ?? []);
    setLoading(false);
  }, [current, q, statusFilter]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useRealtime(REALTIME_COLLECTIONS, load);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={current?.name}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                if (current)
                  window.location.href = `/api/customers/export?businessId=${current.id}`;
              }}
              disabled={!current}
            >
              <Download size={16} /> Export
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} disabled={!current}>
              <Upload size={16} /> Import
            </Button>
            <Button onClick={() => setShowAdd(true)} disabled={!current}>
              <Plus size={16} /> Add customer
            </Button>
          </>
        }
      />

      <div className="px-8 py-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, or company"
              className={`${inputClass} pl-9`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm"
          >
            <option value="">All statuses</option>
            {STATUS_LIST.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-card">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm font-medium text-slate-600">
                No customers found
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {q || statusFilter
                  ? "Try clearing your filters."
                  : "Add your first customer to get started."}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Value</th>
                  <th className="px-5 py-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-3"
                      >
                        <Avatar name={c.name} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {c.name}
                          </span>
                          <span className="block truncate text-xs text-slate-400">
                            {c.email ?? "—"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600">
                      {c.company ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3 text-right text-sm tabular-nums text-slate-600">
                      {formatCurrency(c.value)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">
                      {formatDistanceToNow(new Date(c.updated_at), {
                        addSuffix: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddCustomerModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        businessId={current?.id ?? null}
        onAdded={() => {
          setShowAdd(false);
          load();
        }}
      />
      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        businessId={current?.id ?? null}
        onImported={() => {
          setShowImport(false);
          load();
        }}
      />
    </>
  );
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines).
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").trim()));
    return obj;
  });
}

function ImportModal({
  open,
  onClose,
  businessId,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string | null;
  onImported: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length === 0) {
        setError("No data rows found. Include a header row with a 'name' column.");
        return;
      }
      const res = await fetch("/api/customers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, rows }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Import failed.");
        return;
      }
      setResult({ created: json.created ?? 0, skipped: json.skipped ?? 0 });
      if (json.created > 0) onImported();
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import customers from CSV">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Upload a CSV with a header row. Recognized columns:{" "}
          <span className="font-medium text-slate-700">
            name, email, phone, company, title, status, source, value, notes
          </span>
          . Only <span className="font-medium text-slate-700">name</span> is required.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          disabled={busy || !businessId}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-accent-hover"
        />
        {busy && <p className="text-sm text-slate-400">Importing…</p>}
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {result && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Imported {result.created} customer{result.created === 1 ? "" : "s"}
            {result.skipped > 0 ? `, skipped ${result.skipped} invalid row(s)` : ""}.
          </p>
        )}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddCustomerModal({
  open,
  onClose,
  businessId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string | null;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    title: "",
    status: "cold_lead" as CustomerStatus,
    source: "",
    value: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        ...form,
        value: form.value ? Number(form.value) : 0,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      setError(error || "Could not add customer.");
      return;
    }
    setForm({
      name: "",
      email: "",
      phone: "",
      company: "",
      title: "",
      status: "cold_lead",
      source: "",
      value: "",
      notes: "",
    });
    onAdded();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add customer" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
              placeholder="Jordan Rivera"
            />
          </Field>
          <Field label="Company">
            <input
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Title">
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={inputClass}
              placeholder="VP of Operations"
            />
          </Field>
          <Field label="Source">
            <input
              value={form.source}
              onChange={(e) => set("source", e.target.value)}
              className={inputClass}
              placeholder="Referral, website, event…"
            />
          </Field>
          <Field label="Status">
            <div>
              <StatusSelect
                value={form.status}
                onChange={(s) => set("status", s)}
              />
            </div>
          </Field>
          <Field label="Deal value (USD)">
            <input
              type="number"
              min="0"
              value={form.value}
              onChange={(e) => set("value", e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            className={inputClass}
            placeholder="Context, needs, anything worth remembering…"
          />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading…</div>}>
      <CustomersInner />
    </Suspense>
  );
}
