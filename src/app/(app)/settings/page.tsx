"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Plus, Trash2, Pencil, Users2, Mail, Building2 } from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { Button, Field, Modal, inputClass } from "@/components/ui";
import type { EmailTemplate, BusinessProfile } from "@/types";

export default function SettingsPage() {
  const { businesses, current, currentId, setCurrentId, refresh } = useBusiness();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [membersFor, setMembersFor] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/businesses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setCreating(false);
    if (res.ok) {
      const { business } = await res.json();
      setNewName("");
      await refresh();
      if (business?.id) setCurrentId(business.id);
    }
  }

  async function rename(id: string) {
    await fetch(`/api/businesses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    setEditingId(null);
    refresh();
  }

  async function remove(id: string) {
    if (
      !confirm(
        "Delete this business and every customer and interaction in it? This can't be undone."
      )
    )
      return;
    await fetch(`/api/businesses/${id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your businesses and switch between them."
      />

      <div className="max-w-2xl px-8 py-6">
        {/* Create */}
        <section className="rounded-xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-ink">Create a business</h2>
          <p className="mt-1 text-sm text-slate-500">
            Each business has its own customers, pipeline, and activity. Switch
            any time from the sidebar.
          </p>
          <form onSubmit={create} className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <Field label="Business name">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className={inputClass}
                  placeholder="Acme Consulting"
                />
              </Field>
            </div>
            <Button type="submit" disabled={creating || !newName.trim()}>
              <Plus size={16} /> {creating ? "Creating…" : "Create"}
            </Button>
          </form>
        </section>

        {/* List */}
        <section className="mt-6 rounded-xl border border-slate-100 bg-white shadow-card">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Your businesses</h2>
          </div>
          <ul className="divide-y divide-slate-50">
            {businesses.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-3 px-5 py-4"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
                  {b.name.slice(0, 1).toUpperCase()}
                </span>

                {editingId === b.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && rename(b.id)}
                    className={`${inputClass} flex-1`}
                  />
                ) : (
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-ink">
                      {b.name}
                    </span>
                    <span className="block text-xs text-slate-400 capitalize">
                      {b.role ?? "owner"}
                    </span>
                  </span>
                )}

                {currentId === b.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                    <Check size={12} /> Current
                  </span>
                )}

                <div className="flex items-center gap-1">
                  {currentId !== b.id && (
                    <Button
                      variant="ghost"
                      onClick={() => setCurrentId(b.id)}
                    >
                      Switch
                    </Button>
                  )}
                  {b.role === "owner" && (
                    <button
                      onClick={() => setMembersFor(b.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Members"
                      title="Manage members"
                    >
                      <Users2 size={15} />
                    </button>
                  )}
                  {editingId === b.id ? (
                    <Button onClick={() => rename(b.id)}>Save</Button>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(b.id);
                        setEditName(b.name);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Rename"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => remove(b.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Business profile (powers AI research + messaging) */}
        {current && <ProfileSection businessId={current.id} businessName={current.name} />}

        {/* Email templates (current business) */}
        {current && <TemplatesSection businessId={current.id} businessName={current.name} />}
      </div>

      <MembersModal
        businessId={membersFor}
        onClose={() => setMembersFor(null)}
      />
    </>
  );
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  confirmed: boolean;
}

function MembersModal({
  businessId,
  onClose,
}: {
  businessId: string | null;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const res = await fetch(`/api/businesses/${businessId}/members`);
    const json = await res.json().catch(() => ({}));
    setMembers(json.members ?? []);
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    if (businessId) load();
  }, [businessId, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!businessId || !email.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch(`/api/businesses/${businessId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      setError(error || "Could not add member.");
      return;
    }
    setEmail("");
    load();
  }

  async function remove(userId: string) {
    if (!businessId) return;
    await fetch(`/api/businesses/${businessId}/members?userId=${userId}`, {
      method: "DELETE",
    });
    load();
  }

  return (
    <Modal open={!!businessId} onClose={onClose} title="Team members">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Add an existing Relay user by email to give them access to this
          business. They must already have an account.
        </p>
        <form onSubmit={add} className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="teammate@company.com"
              />
            </Field>
          </div>
          <Button type="submit" disabled={busy || !email.trim()}>
            <Plus size={15} /> Add
          </Button>
        </form>
        {error && <p className="text-sm text-rose-600">{error}</p>}

        <ul className="divide-y divide-slate-50 rounded-lg border border-slate-100">
          {loading ? (
            <li className="px-4 py-3 text-sm text-slate-400">Loading…</li>
          ) : members.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-400">No members yet.</li>
          ) : (
            members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {m.name ?? m.email}
                  </span>
                  <span className="block truncate text-xs text-slate-400">
                    {m.email} · {m.role}
                    {m.confirmed ? "" : " · pending"}
                  </span>
                </span>
                {m.role !== "owner" && (
                  <button
                    onClick={() => remove(m.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </Modal>
  );
}

const EMPTY_PROFILE: BusinessProfile = {
  business_id: "",
  industry: "",
  description: "",
  value_proposition: "",
  icp: "",
  target_titles: "",
  locations: "",
  website: "",
};

function ProfileSection({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const [form, setForm] = useState<BusinessProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSaved(false);
    fetch(`/api/businesses/${businessId}/profile`)
      .then((r) => r.json())
      .then((j) => setForm({ ...EMPTY_PROFILE, ...(j.profile ?? {}) }))
      .finally(() => setLoading(false));
  }, [businessId]);

  function set<K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/businesses/${businessId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-100 bg-white shadow-card">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Building2 size={15} /> Business profile
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          Describe {businessName} so AI research and message drafting are tailored to you.
        </p>
      </div>
      {loading ? (
        <p className="px-5 py-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-4 px-5 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Industry">
              <input
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                className={inputClass}
                placeholder="e.g. Commercial landscaping"
              />
            </Field>
            <Field label="Website">
              <input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                className={inputClass}
                placeholder="https://…"
              />
            </Field>
          </div>
          <Field label="What you do">
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={inputClass}
              placeholder="A short description of your product or service."
            />
          </Field>
          <Field label="Value proposition">
            <textarea
              rows={2}
              value={form.value_proposition}
              onChange={(e) => set("value_proposition", e.target.value)}
              className={inputClass}
              placeholder="Why customers choose you."
            />
          </Field>
          <Field label="Ideal customer profile" hint="The kind of business you want to sell to.">
            <textarea
              rows={2}
              value={form.icp}
              onChange={(e) => set("icp", e.target.value)}
              className={inputClass}
              placeholder="e.g. Property managers of 5+ commercial buildings in the Southeast US."
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Decision-maker titles">
              <input
                value={form.target_titles}
                onChange={(e) => set("target_titles", e.target.value)}
                className={inputClass}
                placeholder="Owner, Facilities Manager…"
              />
            </Field>
            <Field label="Geographic focus">
              <input
                value={form.locations}
                onChange={(e) => set("locations", e.target.value)}
                className={inputClass}
                placeholder="Atlanta, GA"
              />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-emerald-600">Saved.</span>}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function TemplatesSection({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [editing, setEditing] = useState<EmailTemplate | "new" | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/templates?businessId=${businessId}`);
    const json = await res.json().catch(() => ({}));
    setTemplates(json.templates ?? []);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section className="mt-6 rounded-xl border border-slate-100 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Mail size={15} /> Email templates
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Reusable email drafts for {businessName}.
          </p>
        </div>
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus size={15} /> New template
        </Button>
      </div>
      <ul className="divide-y divide-slate-50">
        {templates.length === 0 ? (
          <li className="px-5 py-4 text-sm text-slate-400">
            No templates yet. Create one to reuse when emailing customers.
          </li>
        ) : (
          templates.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {t.name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {t.subject || "—"}
                </span>
              </span>
              <button
                onClick={() => setEditing(t)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => remove(t.id)}
                className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))
        )}
      </ul>

      {editing && (
        <TemplateModal
          businessId={businessId}
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function TemplateModal({
  businessId,
  template,
  onClose,
  onSaved,
}: {
  businessId: string;
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(
      template ? `/api/templates/${template.id}` : "/api/templates",
      {
        method: template ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, name, subject, body }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "" }));
      setError(error || "Could not save template.");
      return;
    }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={template ? "Edit template" : "New template"} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Template name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Intro outreach"
          />
        </Field>
        <Field label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Body">
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={inputClass}
            placeholder={"Hi {first name},\n\n…"}
          />
        </Field>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
