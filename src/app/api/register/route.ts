import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { jsonError } from "@/lib/authz";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";
import { isValidEmail, cleanText, MAX_SHORT } from "@/lib/validation";

const BCRYPT_ROUNDS = 12;

export async function POST(req: Request) {
  const limit = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { name, email, password } = await req.json().catch(() => ({}));

  if (!email || !password) return jsonError("Email and password are required.");
  if (!isValidEmail(email)) return jsonError("Enter a valid email address.");
  if (String(password).length < 8)
    return jsonError("Password must be at least 8 characters.");

  const normalized = String(email).trim().toLowerCase();
  const cleanName = cleanText(name, MAX_SHORT);

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();

  if (existing) return jsonError("An account with that email already exists.");

  const password_hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .insert({ name: cleanName, email: normalized, password_hash })
    .select("id, email, name")
    .single();

  if (error || !user) return jsonError("Could not create account.", 500);

  // Bootstrap a first business so the user lands somewhere useful.
  const bizName = cleanName ? `${cleanName}'s workspace` : "My business";
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .insert({ name: bizName, owner_id: user.id })
    .select("id")
    .single();

  if (biz) {
    await supabaseAdmin
      .from("business_members")
      .insert({ business_id: biz.id, user_id: user.id, role: "owner" });
  }

  return Response.json({ ok: true });
}
