import { STATUS_ORDER, type CustomerStatus } from "./status";

// Shared input limits + validators. Every write path runs through these so we
// don't trust client-supplied shapes, values, or lengths.

export const MAX_SHORT = 200; // names, subjects, titles, companies, phones
export const MAX_TEXT = 5_000; // notes, log bodies
export const MAX_EMAIL_BODY = 25_000; // outbound email message

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(v: unknown): v is string {
  return typeof v === "string" && EMAIL_RE.test(v.trim());
}

export function isValidStatus(s: unknown): s is CustomerStatus {
  return typeof s === "string" && (STATUS_ORDER as string[]).includes(s);
}

/** Trim, drop empties to null, and cap length. */
export function cleanText(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

/**
 * Coerce a deal value to a non-negative number inside the numeric(12,2) range.
 * Returns null when the input can't be a valid value.
 */
export function coerceValue(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 9_999_999_999) return null;
  return Math.round(n * 100) / 100;
}

/**
 * Strip PostgREST filter metacharacters from a free-text search term so it
 * can't break out of / alter the `.or(...)` filter expression.
 */
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*\\]/g, " ").trim().slice(0, 100);
}

export interface CustomerFields {
  name?: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  title?: string | null;
  source?: string | null;
  notes?: string | null;
  status?: CustomerStatus;
  value?: number;
}

/**
 * Build a validated set of customer columns from a request body.
 * `partial` = true for PATCH (only provided keys are touched); false for POST
 * (name is required).
 */
export function buildCustomerFields(
  body: Record<string, unknown>,
  partial: boolean
): { fields: CustomerFields } | { error: string } {
  const out: CustomerFields = {};

  if (!partial || "name" in body) {
    const name = cleanText(body.name, MAX_SHORT);
    if (!name) return { error: "Customer name is required." };
    out.name = name;
  }

  if ("email" in body) {
    if (body.email === null || body.email === "") out.email = null;
    else if (!isValidEmail(body.email))
      return { error: "Enter a valid email address." };
    else out.email = String(body.email).trim().toLowerCase();
  }

  if ("phone" in body) out.phone = cleanText(body.phone, MAX_SHORT);
  if ("company" in body) out.company = cleanText(body.company, MAX_SHORT);
  if ("title" in body) out.title = cleanText(body.title, MAX_SHORT);
  if ("source" in body) out.source = cleanText(body.source, MAX_SHORT);
  if ("notes" in body) out.notes = cleanText(body.notes, MAX_TEXT);

  if ("status" in body) {
    if (!isValidStatus(body.status))
      return { error: "Unknown customer status." };
    out.status = body.status;
  }

  if ("value" in body) {
    const v = coerceValue(body.value);
    if (v === null)
      return { error: "Deal value must be a non-negative number." };
    out.value = v;
  }

  return { fields: out };
}
