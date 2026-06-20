"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Tag,
  Trash2,
  Send,
  MessageSquarePlus,
  PhoneCall,
  CalendarClock,
  StickyNote,
  ArrowRightLeft,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusSelect } from "@/components/status";
import { Avatar, Button, Field, Modal, inputClass } from "@/components/ui";
import { statusMeta, type CustomerStatus } from "@/lib/status";
import { formatCurrency } from "@/lib/utils";
import type { Customer, ContactLog, LogType } from "@/types";

const LOG_ICONS: Record<LogType, React.ReactNode> = {
  note: <StickyNote size={14} />,
  call: <PhoneCall size={14} />,
  email: <Mail size={14} />,
  meeting: <CalendarClock size={14} />,
  status_change: <ArrowRightLeft size={14} />,
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<ContactLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmail, setShowEmail] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadAll = useCallback(async () => {
    const [cRes, lRes] = await Promise.all([
      fetch(`/api/customers/${id}`),
      fetch(`/api/customers/${id}/logs`),
    ]);
    if (cRes.status === 404 || cRes.status === 403) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const { customer } = await cRes.json();
    const { logs } = await lRes.json();
    setCustomer(customer);
    setLogs(logs ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function updateCustomer(patch: Partial<Customer>) {
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadAll();
  }

  async function remove() {
    if (!confirm("Delete this customer and all their activity? This can't be undone."))
      return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    router.push("/customers");
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-400">Loading…</div>;
  }
  if (notFound || !customer) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">
          This customer doesn&apos;t exist or you don&apos;t have access.{" "}
          <Link href="/customers" className="text-accent hover:underline">
            Back to customers
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={[customer.title, customer.company].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => router.push("/customers")}>
              <ArrowLeft size={16} /> Back
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEmail(true)}
              disabled={!customer.email}
              title={customer.email ? "" : "Add an email address first"}
            >
              <Send size={16} /> Email
            </Button>
            <Button onClick={() => setShowLog(true)}>
              <MessageSquarePlus size={16} /> Log activity
            </Button>
          </>
        }
      />

      <div className="grid gap-6 px-8 py-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex items-center gap-3">
              <Avatar name={customer.name} size={48} />
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-ink">
                  {customer.name}
                </h2>
                <p className="truncate text-sm text-slate-400">
                  {customer.company ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                Status
              </span>
              <StatusSelect
                value={customer.status}
                onChange={(s: CustomerStatus) => updateCustomer({ status: s })}
              />
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <Detail icon={<Mail size={15} />} label="Email">
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-accent hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  "—"
                )}
              </Detail>
              <Detail icon={<Phone size={15} />} label="Phone">
                {customer.phone ?? "—"}
              </Detail>
              <Detail icon={<Building2 size={15} />} label="Title">
                {customer.title ?? "—"}
              </Detail>
              <Detail icon={<Tag size={15} />} label="Source">
                {customer.source ?? "—"}
              </Detail>
            </dl>

            <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-xs font-medium text-slate-400">
                Deal value
              </span>
              <p className="text-lg font-semibold text-ink">
                {formatCurrency(customer.value)}
              </p>
            </div>

            <button
              onClick={remove}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-700"
            >
              <Trash2 size={13} /> Delete customer
            </button>
          </section>

          <EditableNotes
            value={customer.notes ?? ""}
            onSave={(notes) => updateCustomer({ notes })}
          />
        </div>

        {/* Right: timeline */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-slate-100 bg-white shadow-card">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-semibold text-ink">Activity timeline</h2>
            </div>
            {logs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                No activity yet. Log a call, note, or send an email to start the
                timeline.
              </p>
            ) : (
              <ol className="relative px-5 py-5">
                {logs.map((log, i) => {
                  const meta = statusMeta(customer.status);
                  const tint =
                    log.type === "status_change" ? meta.color : "#4f46e5";
                  return (
                    <li key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {i < logs.length - 1 && (
                        <span className="absolute left-[13px] top-7 h-full w-px bg-slate-100" />
                      )}
                      <span
                        className="z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-white"
                        style={{ backgroundColor: tint }}
                      >
                        {LOG_ICONS[log.type]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-ink">
                            {log.subject ?? labelForType(log.type)}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {format(new Date(log.created_at), "MMM d, h:mma")}
                          </span>
                        </div>
                        {log.body && (
                          <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">
                            {log.body}
                          </p>
                        )}
                        <span className="mt-1 inline-block text-[11px] font-medium uppercase tracking-wide text-slate-300">
                          {labelForType(log.type)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </section>
      </div>

      <EmailModal
        open={showEmail}
        onClose={() => setShowEmail(false)}
        customer={customer}
        onSent={() => {
          setShowEmail(false);
          loadAll();
        }}
      />
      <LogModal
        open={showLog}
        onClose={() => setShowLog(false)}
        customerId={customer.id}
        onLogged={() => {
          setShowLog(false);
          loadAll();
        }}
      />
    </>
  );
}

function labelForType(t: LogType) {
  return {
    note: "Note",
    call: "Call",
    email: "Email",
    meeting: "Meeting",
    status_change: "Status change",
  }[t];
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-slate-400">{label}</span>
        <span className="block truncate text-slate-700">{children}</span>
      </span>
    </div>
  );
}

function EditableNotes({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;
  useEffect(() => setDraft(value), [value]);

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
      <h3 className="mb-2 text-sm font-semibold text-ink">Notes</h3>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        className={inputClass}
        placeholder="Anything worth remembering about this relationship…"
      />
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDraft(value)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save notes</Button>
        </div>
      )}
    </section>
  );
}

function EmailModal({
  open,
  onClose,
  customer,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer;
  onSent: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    const res = await fetch(`/api/customers/${customer.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    setSending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      setError(error || "Could not send the email.");
      return;
    }
    setSubject("");
    setMessage("");
    onSent();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Email ${customer.name}`} wide>
      <form onSubmit={send} className="space-y-4">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          To: <span className="font-medium text-slate-700">{customer.email}</span>
        </div>
        <Field label="Subject">
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Message">
          <textarea
            required
            rows={8}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={inputClass}
            placeholder={`Hi ${customer.name.split(" ")[0]},\n\n`}
          />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">
            Sent via Resend and logged to the timeline.
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              <Send size={15} /> {sending ? "Sending…" : "Send email"}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function LogModal({
  open,
  onClose,
  customerId,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  onLogged: () => void;
}) {
  const [type, setType] = useState<LogType>("note");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const types: { value: LogType; label: string; icon: React.ReactNode }[] = [
    { value: "note", label: "Note", icon: <StickyNote size={15} /> },
    { value: "call", label: "Call", icon: <PhoneCall size={15} /> },
    { value: "meeting", label: "Meeting", icon: <CalendarClock size={15} /> },
    { value: "email", label: "Email", icon: <Mail size={15} /> },
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/customers/${customerId}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, subject, body }),
    });
    setSaving(false);
    if (res.ok) {
      setSubject("");
      setBody("");
      setType("note");
      onLogged();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Log activity">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2">
          {types.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium ${
                type === t.value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
        <Field label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
            placeholder="Quick summary"
          />
        </Field>
        <Field label="Details">
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={inputClass}
            placeholder="What happened, next steps…"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Log activity"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
