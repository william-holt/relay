"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  ChevronsUpDown,
  Plus,
  Check,
  LogOut,
} from "lucide-react";
import { useBusiness } from "@/components/business-context";
import { classNames } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarUser {
  name: string | null;
  email: string;
}

export function Sidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const { businesses, current, setCurrentId } = useBusiness();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col bg-ink text-white">
      <div className="px-4 pt-5">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 pb-4">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-sm font-bold text-ink">
            R
          </span>
          <span className="text-base font-semibold tracking-tight">Relay</span>
        </Link>

        {/* Business switcher */}
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
          >
            <span className="grid h-6 w-6 place-items-center rounded bg-accent text-xs font-bold">
              {(current?.name ?? "·").slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {current?.name ?? "No business"}
              </span>
              <span className="block text-[11px] text-white/40">
                {businesses.length} workspace{businesses.length === 1 ? "" : "s"}
              </span>
            </span>
            <ChevronsUpDown size={15} className="text-white/40" />
          </button>

          {open && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-ink-700 shadow-pop">
              <div className="max-h-64 overflow-y-auto py-1">
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      setCurrentId(b.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                  >
                    <span className="flex-1 truncate">{b.name}</span>
                    {current?.id === b.id && (
                      <Check size={15} className="text-accent" />
                    )}
                  </button>
                ))}
              </div>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5"
              >
                <Plus size={15} /> New business
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-0.5 px-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={classNames(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
                active
                  ? "bg-white/10 text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon size={17} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {user.name ?? user.email}
            </span>
            <span className="block truncate text-[11px] text-white/40">
              {user.email}
            </span>
          </span>
          <button
            onClick={logout}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
