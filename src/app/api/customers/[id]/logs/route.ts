import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT, MAX_TEXT } from "@/lib/validation";

async function guard(userId: string, customerId: string) {
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, business_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: jsonError("Customer not found.", 404) };
  if (!(await membershipRole(userId, customer.business_id)))
    return { error: jsonError("No access to this customer.", 403) };
  return { customer };
}

// List the interaction timeline for a customer.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await guard(userId, params.id);
  if (error) return error;

  const { data, error: qErr } = await supabaseAdmin
    .from("contact_logs")
    .select("*")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false });

  if (qErr) return jsonError("Could not load activity.", 500);
  return Response.json({ logs: data ?? [] });
}

// Log a new interaction (note / call / meeting / email).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { customer, error } = await guard(userId, params.id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const allowed = ["note", "call", "email", "meeting", "status_change"];
  const type = allowed.includes(body.type) ? body.type : "note";

  const subject = cleanText(body.subject, MAX_SHORT);
  const logBody = cleanText(body.body, MAX_TEXT);
  if (!subject && !logBody)
    return jsonError("Add a subject or some details to log this interaction.");

  const { data, error: insErr } = await supabaseAdmin
    .from("contact_logs")
    .insert({
      customer_id: params.id,
      business_id: customer!.business_id,
      user_id: userId,
      type,
      subject,
      body: logBody,
    })
    .select("*")
    .single();

  if (insErr) return jsonError("Could not log interaction.", 500);

  // Touch the customer so it rises to the top of recently-active lists.
  await supabaseAdmin
    .from("customers")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", params.id);

  return Response.json({ log: data });
}
