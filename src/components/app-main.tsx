"use client";

import { useBusiness } from "@/components/business-context";

export function AppMain({ children }: { children: React.ReactNode }) {
  const { loading, businesses } = useBusiness();

  if (!loading && businesses.length === 0) return <EmptyWorkspace />;
  return <>{children}</>;
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
