"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { useBusiness } from "@/components/business-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const { loading, businesses } = useBusiness();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="h-screen flex-1 overflow-y-auto scrollbar-thin">
        {!loading && businesses.length === 0 ? (
          <EmptyWorkspace />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

function EmptyWorkspace() {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold text-ink">No businesses yet</h2>
        <p className="mt-2 text-sm text-slate-500">
          Create your first business to start adding customers. You can switch
          between businesses any time from the sidebar.
        </p>
        <a
          href="/settings"
          className="mt-5 inline-flex rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Create a business
        </a>
      </div>
    </div>
  );
}
