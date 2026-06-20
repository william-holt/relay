import crypto from "crypto";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { jsonError } from "@/lib/authz";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const BCRYPT_ROUNDS = 12;

export async function POST(req: Request) {
  const limit = rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { token, email, password } = await req.json().catch(() => ({}));

  if (!token || !email || !password)
    return jsonError("Missing token, email, or password.");
  if (String(password).length < 8)
    return jsonError("Password must be at least 8 characters.");

  const normalized = String(email).trim().toLowerCase();

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (!user) return jsonError("Invalid or expired reset link.", 400);

  const tokenHash = crypto.createHash("sha256").update(String(token)).digest("hex");

  const { data: record } = await supabaseAdmin
    .from("password_reset_tokens")
    .select("id, expires_at, used_at")
    .eq("user_id", user.id)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!record) return jsonError("Invalid or expired reset link.", 400);
  if (record.used_at) return jsonError("This reset link has already been used.", 400);
  if (new Date(record.expires_at).getTime() < Date.now())
    return jsonError("This reset link has expired.", 400);

  const password_hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

  await supabaseAdmin
    .from("users")
    .update({ password_hash })
    .eq("id", user.id);

  // Burn this token and any other outstanding ones for the user.
  await supabaseAdmin
    .from("password_reset_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("used_at", null);

  return Response.json({ ok: true });
}
