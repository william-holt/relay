"use client";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-canvas/90 px-8 py-5 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
