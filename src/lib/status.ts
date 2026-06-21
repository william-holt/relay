// Single source of truth for the customer lifecycle.
// The order here defines pipeline progression and the "temperature" gradient
// used throughout the UI (cool -> warm -> won).

export type CustomerStatus =
  | "cold_lead"
  | "hot_lead"
  | "outreach"
  | "contacted"
  | "in_pipeline"
  | "sold"
  | "recurring"
  | "lost";

export interface StatusMeta {
  value: CustomerStatus;
  label: string;
  /** Base hex used for dots, bars, and badge accents. */
  color: string;
  /** Whether this status counts as an active deal in the pipeline. */
  pipeline: boolean;
  /** Whether this status counts as won revenue. */
  won: boolean;
  /** Rough close probability (0–1), used for the weighted pipeline forecast. */
  probability: number;
}

export const STATUS_ORDER: CustomerStatus[] = [
  "cold_lead",
  "hot_lead",
  "outreach",
  "contacted",
  "in_pipeline",
  "sold",
  "recurring",
  "lost",
];

export const STATUS_META: Record<CustomerStatus, StatusMeta> = {
  cold_lead: { value: "cold_lead", label: "Cold lead", color: "#64748b", pipeline: false, won: false, probability: 0.05 },
  hot_lead: { value: "hot_lead", label: "Hot lead", color: "#f59e0b", pipeline: false, won: false, probability: 0.2 },
  outreach: { value: "outreach", label: "Outreach", color: "#0ea5e9", pipeline: true, won: false, probability: 0.35 },
  contacted: { value: "contacted", label: "Contacted", color: "#8b5cf6", pipeline: true, won: false, probability: 0.5 },
  in_pipeline: { value: "in_pipeline", label: "In pipeline", color: "#6366f1", pipeline: true, won: false, probability: 0.7 },
  sold: { value: "sold", label: "Sold", color: "#10b981", pipeline: false, won: true, probability: 1 },
  recurring: { value: "recurring", label: "Recurring", color: "#0d9488", pipeline: false, won: true, probability: 1 },
  lost: { value: "lost", label: "Lost", color: "#9ca3af", pipeline: false, won: false, probability: 0 },
};

export const STATUS_LIST: StatusMeta[] = STATUS_ORDER.map((s) => STATUS_META[s]);

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status as CustomerStatus] ?? STATUS_META.cold_lead;
}

/** The "next step" suggestion for a customer, used on the dashboard. */
export function nextStatus(status: CustomerStatus): CustomerStatus | null {
  const linear: CustomerStatus[] = [
    "cold_lead",
    "hot_lead",
    "outreach",
    "contacted",
    "in_pipeline",
    "sold",
    "recurring",
  ];
  const i = linear.indexOf(status);
  if (i === -1 || i === linear.length - 1) return null;
  return linear[i + 1];
}
