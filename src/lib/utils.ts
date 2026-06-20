export function formatCurrency(value: number | null | undefined): string {
  const n = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Deterministic-ish avatar tint from a string. */
export function tintFromString(s: string): string {
  const palette = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function classNames(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}
