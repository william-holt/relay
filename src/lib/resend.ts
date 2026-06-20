import { Resend } from "resend";

// Created lazily: the Resend constructor throws on an empty key, so building
// it at module load would break `next build` (and crash unrelated routes) when
// RESEND_API_KEY isn't set. Deferring means email routes fail loudly only when
// actually invoked without a key.
let client: Resend | null = null;

function getClient(): Resend {
  if (client) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("[resend] Missing RESEND_API_KEY — cannot send email.");
  }
  client = new Resend(apiKey);
  return client;
}

export const resend = {
  get emails() {
    return getClient().emails;
  },
} as Pick<Resend, "emails">;

export const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Relay CRM <onboarding@resend.dev>";
