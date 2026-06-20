import { createAdminClient } from "@/lib/appwrite";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export async function POST(req: Request) {
  if (!rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000).ok)
    return tooManyRequests(15 * 60);

  const { email } = await req.json().catch(() => ({}));

  // Always respond the same way so we never reveal which emails are registered.
  const genericOk = Response.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });

  if (!email) return genericOk;
  const normalized = String(email).trim().toLowerCase();

  // Appwrite emails the user a link to ${APP_URL}/reset-password with
  // userId + secret appended as query params, and handles token storage/expiry.
  try {
    const { account } = createAdminClient();
    await account.createRecovery(normalized, `${APP_URL}/reset-password`);
  } catch {
    // Swallow (e.g. unknown email / send failure) so we don't leak existence.
  }

  return genericOk;
}
