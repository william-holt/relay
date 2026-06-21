import { Query } from "node-appwrite";
import {
  createAdminClient,
  mapProfile,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
  BUSINESS_PROFILES,
} from "@/lib/appwrite";
import { getAnthropic, MODEL, extractJson } from "@/lib/anthropic";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cleanText, MAX_SHORT, MAX_EMAIL_BODY } from "@/lib/validation";
import { statusMeta } from "@/lib/status";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const limit = rateLimit(`assist:${userId}`, 40, 10 * 60_000);
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

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "improve" ? "improve" : "draft";
  const draft = cleanText(body.draft, MAX_EMAIL_BODY);
  const instructions = cleanText(body.instructions, MAX_SHORT);
  if (mode === "improve" && !draft)
    return jsonError("Provide a draft to improve.");

  // Sender context (business profile) + recent interaction history.
  const profRes = await databases.listDocuments(DATABASE_ID, BUSINESS_PROFILES, [
    Query.equal("businessId", customer.businessId),
    Query.limit(1),
  ]);
  const profile = profRes.documents[0] ? mapProfile(profRes.documents[0]) : null;

  const logsRes = await databases.listDocuments(DATABASE_ID, CONTACT_LOGS, [
    Query.equal("customerId", params.id),
    Query.orderDesc("created_at"),
    Query.limit(5),
  ]);
  const history = logsRes.documents
    .reverse()
    .map((l) => `- [${l.type}${l.direction === "inbound" ? " in" : ""}] ${l.subject ?? ""}${l.body ? `: ${l.body}` : ""}`)
    .join("\n");

  const system =
    "You write concise, warm, professional B2B sales emails for the sender described below. " +
    "Match the sender's value proposition and the customer's lifecycle stage. Avoid clichés and spammy language. " +
    "Keep it skimmable and specific. Respond with ONLY a JSON object {\"subject\": \"\", \"message\": \"\"} and no other text.";

  const sender = profile
    ? `Sender business — industry: ${profile.industry || "n/a"}; what they do: ${profile.description || "n/a"}; value proposition: ${profile.value_proposition || "n/a"}.`
    : "Sender business profile not provided.";

  const recipient =
    `Recipient — name: ${customer.name}; company: ${customer.company ?? "n/a"}; ` +
    `title: ${customer.title ?? "n/a"}; lifecycle stage: ${statusMeta(customer.status).label}.` +
    (customer.notes ? `\nNotes about them: ${customer.notes}` : "");

  const task =
    mode === "improve"
      ? `Improve this draft email while keeping its intent:\n\n${draft}`
      : `Write a new outreach email appropriate for this customer's lifecycle stage.`;

  const userPrompt = [
    sender,
    "",
    recipient,
    history ? `\nRecent interactions (oldest first):\n${history}` : "",
    instructions ? `\nExtra instructions: ${instructions}` : "",
    "",
    task,
  ].join("\n");

  let text = "";
  try {
    const client = getAnthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userPrompt }],
    });
    for (const block of msg.content) {
      if (block.type === "text") text += block.text;
    }
  } catch (err) {
    console.error("[message-assist] Anthropic error", err);
    return jsonError("Could not generate a message. Please try again.", 502);
  }

  const parsed = extractJson<{ subject?: string; message?: string }>(text);
  if (!parsed || (!parsed.subject && !parsed.message))
    return jsonError("Could not generate a usable message. Please try again.", 502);

  return Response.json({
    subject: String(parsed.subject ?? "").slice(0, 200),
    message: String(parsed.message ?? "").slice(0, MAX_EMAIL_BODY),
  });
}
