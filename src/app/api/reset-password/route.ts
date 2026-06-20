import { createAdminClient } from "@/lib/appwrite";
import { jsonError } from "@/lib/authz";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000).ok)
    return tooManyRequests(15 * 60);

  // userId + secret come from the recovery link Appwrite emailed the user.
  const { userId, secret, password } = await req.json().catch(() => ({}));

  if (!userId || !secret || !password)
    return jsonError("Missing reset details.");
  if (String(password).length < 8)
    return jsonError("Password must be at least 8 characters.");

  try {
    const { account } = createAdminClient();
    await account.updateRecovery(
      String(userId),
      String(secret),
      String(password)
    );
  } catch {
    return jsonError("Invalid or expired reset link.", 400);
  }

  return Response.json({ ok: true });
}
