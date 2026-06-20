import { ID, Permission, Role } from "node-appwrite";
import {
  createAdminClient,
  mapLog,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { resend, EMAIL_FROM } from "@/lib/resend";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cleanText, MAX_SHORT, MAX_EMAIL_BODY } from "@/lib/validation";

// Send an email to a customer, then log it on their timeline.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  // Guard against using the app as an open email relay.
  const limit = rateLimit(`email:${userId}`, 20, 10 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  const { databases } = createAdminClient();
  let customer;
  try {
    customer = await databases.getDocument(DATABASE_ID, CUSTOMERS, params.id);
  } catch {
    return jsonError("Customer not found.", 404);
  }
  if (!(await membershipRole(userId, customer.businessId)))
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

  const now = new Date().toISOString();
  const log = await databases.createDocument(
    DATABASE_ID,
    CONTACT_LOGS,
    ID.unique(),
    {
      customerId: customer.$id,
      businessId: customer.businessId,
      userId,
      type: "email",
      subject,
      body: message,
      created_at: now,
    },
    [
      Permission.read(Role.team(customer.businessId)),
      Permission.update(Role.team(customer.businessId)),
      Permission.delete(Role.team(customer.businessId)),
    ]
  );

  await databases.updateDocument(DATABASE_ID, CUSTOMERS, customer.$id, {
    updated_at: now,
  });

  return Response.json({ ok: true, log: mapLog(log) });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
