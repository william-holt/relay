import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, EMAIL_FROM } from "@/lib/resend";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

const TOKEN_TTL_MINUTES = 60;

export async function POST(req: Request) {
  const limit = rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { email } = await req.json().catch(() => ({}));

  // Always respond 200 with the same message so we never reveal which
  // emails are registered.
  const genericOk = Response.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });

  if (!email) return genericOk;
  const normalized = String(email).trim().toLowerCase();

  // Opportunistically prune expired tokens so the table doesn't grow forever.
  await supabaseAdmin
    .from("password_reset_tokens")
    .delete()
    .lt("expires_at", new Date().toISOString());

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, email, name")
    .eq("email", normalized)
    .maybeSingle();

  if (!user) return genericOk;

  // Create a single-use token; store only its hash.
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000).toISOString();

  await supabaseAdmin
    .from("password_reset_tokens")
    .insert({ user_id: user.id, token_hash: tokenHash, expires_at: expiresAt });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(
    normalized
  )}`;

  try {
    await resend.emails.send({
      from: EMAIL_FROM,
      to: normalized,
      subject: "Reset your Relay password",
      html: resetEmailHtml(user.name ?? "there", resetUrl),
    });
  } catch (err) {
    console.error("[forgot-password] Resend error", err);
    // Still return generic OK — don't leak send failures to enumerate users.
  }

  return genericOk;
}

function resetEmailHtml(name: string, url: string) {
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0c1322">
    <div style="font-weight:700;font-size:18px;letter-spacing:-0.01em;margin-bottom:24px">Relay</div>
    <p style="font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},</p>
    <p style="font-size:15px;line-height:1.6">We received a request to reset your password. Click the button below to choose a new one. This link expires in ${TOKEN_TTL_MINUTES} minutes.</p>
    <p style="margin:28px 0">
      <a href="${url}" style="background:#4f46e5;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px;display:inline-block">Reset password</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#64748b">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px;word-break:break-all">${url}</p>
  </div>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
