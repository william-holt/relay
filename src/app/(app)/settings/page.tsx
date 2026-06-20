"use client";

import { useState } from "react";
import { Check, Plus, Trash2, Pencil } from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { PageHeader } from "@/components/page-header";
import { Button, Field, inputClass } from "@/components/ui";

export default function SettingsPage() {
  const { businesses, currentId, setCurrentId, refresh } = useBusiness();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

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
      </div>
    </>
  );
}
