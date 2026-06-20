import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { resend, EMAIL_FROM } from "@/lib/resend";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cleanText, MAX_SHORT, MAX_EMAIL_BODY } from "@/lib/validation";

// Send an email to a customer directly from the app, then log it on the
// customer's timeline so outreach stays in one place.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  // Guard against using the app as an open email relay: cap outbound volume
  // per user. (Best-effort, in-memory — see lib/rate-limit.ts.)
  const limit = rateLimit(`email:${userId}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, business_id, name, email")
    .eq("id", params.id)
    .maybeSingle();

  if (!customer) return jsonError("Customer not found.", 404);
  if (!(await membershipRole(userId, customer.business_id)))
    return jsonError("No access to this customer.", 403);
  if (!customer.email)
    return jsonError("This customer doesn't have an email address yet.");

  const raw = await req.json().catch(() => ({}));
  const subject = cleanText(raw.subject, MAX_SHORT);
  const message = cleanText(raw.message, MAX_EMAIL_BODY);
  if (!subject || !message)
    return jsonError("A subject and message are required.");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0c1322;white-space:pre-wrap">${escapeHtml(
      message
    )}</div>`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: customer.email,
      subject,
      html,
    });
    if (error) {
      console.error("[email] Resend returned error", error);
      return jsonError("Resend could not send this email.", 502);
    }
  } catch (err) {
    console.error("[email] send failed", err);
    return jsonError("Could not send the email.", 502);
  }

  const { data: log } = await supabaseAdmin
    .from("contact_logs")
    .insert({
      customer_id: customer.id,
      business_id: customer.business_id,
      user_id: userId,
      type: "email",
      subject,
      body: message,
    })
    .select("*")
    .single();

  await supabaseAdmin
    .from("customers")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", customer.id);

  return Response.json({ ok: true, log });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
