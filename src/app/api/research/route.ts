import { Query } from "node-appwrite";
import {
  createAdminClient,
  mapProfile,
  DATABASE_ID,
  BUSINESS_PROFILES,
} from "@/lib/appwrite";
import { getAnthropic, MODEL, extractJson } from "@/lib/anthropic";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { cleanText, MAX_TEXT } from "@/lib/validation";
import type { Prospect } from "@/types";

const DISCLAIMER =
  "AI-generated from public web sources and may be inaccurate or out of date. " +
  "Verify every contact detail before outreach, use only publicly listed business " +
  "contact info, and follow applicable laws (CAN-SPAM, GDPR, Do-Not-Call).";

const SYSTEM = `You are a B2B sales-research assistant. Using the web_search tool, find REAL, currently-operating businesses that are strong potential clients for the company described by the user, tailored to its industry, value proposition, and ideal customer profile.

For each prospect:
- Identify the company and, where possible, its owner or a key decision-maker matching the target titles.
- Find PUBLICLY AVAILABLE business contact information (company phone, business email) from sources such as the company website, reputable business directories, and public business/LLC registration records (e.g. Secretary of State business registries).
- Record the source URLs you actually used.
- Set "confidence" to how sure you are the prospect fits AND the contact info is correct.

Rules:
- NEVER invent company names, people, emails, phone numbers, or source URLs. If you can't find something, use null and lower the confidence.
- Only return publicly available business contact information. Do not attempt to find private/personal data.
- Prefer quality and accuracy over hitting the requested count.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{"prospects":[{"company":"","website":null,"why_fit":"","owner_name":null,"owner_title":null,"phone":null,"email":null,"source_urls":[],"confidence":"low|medium|high","notes":null}]}`;

function normalize(p: Record<string, unknown>): Prospect {
  const conf = String(p.confidence ?? "low").toLowerCase();
  return {
    company: String(p.company ?? "").slice(0, 200),
    website: p.website ? String(p.website).slice(0, 300) : null,
    why_fit: String(p.why_fit ?? "").slice(0, 1000),
    owner_name: p.owner_name ? String(p.owner_name).slice(0, 200) : null,
    owner_title: p.owner_title ? String(p.owner_title).slice(0, 200) : null,
    phone: p.phone ? String(p.phone).slice(0, 64) : null,
    email: p.email ? String(p.email).slice(0, 320) : null,
    source_urls: Array.isArray(p.source_urls)
      ? p.source_urls.slice(0, 8).map((u) => String(u).slice(0, 500))
      : [],
    confidence: conf === "high" ? "high" : conf === "medium" ? "medium" : "low",
    notes: p.notes ? String(p.notes).slice(0, 1000) : null,
  };
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const body = await req.json().catch(() => ({}));
  const businessId = body.businessId;
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  // Research runs are expensive — cap them.
  const limit = rateLimit(`research:${businessId}`, 10, 60 * 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

  // Load the profile so results are tailored to the researching business.
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(DATABASE_ID, BUSINESS_PROFILES, [
    Query.equal("businessId", businessId),
    Query.limit(1),
  ]);
  const profile = res.documents[0] ? mapProfile(res.documents[0]) : null;
  if (!profile || (!profile.description && !profile.industry && !profile.icp))
    return jsonError(
      "Add your business profile (industry, what you do, and ideal customer) in Settings first so research can be tailored to you.",
      400
    );

  const count = Math.min(Math.max(Number(body.count) || 5, 1), 10);
  const criteria = cleanText(body.criteria, MAX_TEXT);

  const userPrompt = [
    `Find ${count} potential client businesses for this company:`,
    ``,
    `Industry: ${profile.industry || "(unspecified)"}`,
    `What we do: ${profile.description || "(unspecified)"}`,
    `Value proposition: ${profile.value_proposition || "(unspecified)"}`,
    `Ideal customer profile: ${profile.icp || "(unspecified)"}`,
    `Decision-maker titles to target: ${profile.target_titles || "(any)"}`,
    `Geographic focus: ${profile.locations || "(any)"}`,
    criteria ? `\nAdditional criteria from the user: ${criteria}` : "",
  ].join("\n");

  let text = "";
  let stopReason: string | null = null;
  try {
    const client = getAnthropic();
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [{ role: "user", content: userPrompt }],
    });
    const msg = await stream.finalMessage();
    stopReason = msg.stop_reason;
    for (const block of msg.content) {
      if (block.type === "text") text += block.text;
    }
  } catch (err) {
    console.error("[research] Anthropic error", err);
    return jsonError("Research failed. Please try again.", 502);
  }

  const parsed = extractJson<{ prospects?: unknown[] } | unknown[]>(text);
  const rawList = Array.isArray(parsed)
    ? parsed
    : (parsed?.prospects as unknown[] | undefined) ?? [];

  if (!rawList.length && stopReason === "pause_turn")
    return jsonError("Research is taking longer than expected. Try again.", 504);

  const prospects = rawList
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map(normalize)
    .filter((p) => p.company);

  return Response.json({ prospects, disclaimer: DISCLAIMER });
}
