import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT } from "@/lib/validation";

// List follow-up tasks for a business (?businessId=...&open=true).
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  let query = supabaseAdmin
    .from("tasks")
    .select("*, customers(name)")
    .eq("business_id", businessId)
    .order("due_at", { ascending: true, nullsFirst: false });

  if (searchParams.get("open") === "true") query = query.eq("done", false);

  const { data, error } = await query;
  if (error) return jsonError("Could not load tasks.", 500);
  return Response.json({ tasks: data ?? [] });
}

// Create a follow-up task.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const body = await req.json().catch(() => ({}));
  const { businessId } = body;
  if (!businessId) return jsonError("businessId is required.");

  const title = cleanText(body.title, MAX_SHORT);
  if (!title) return jsonError("Task title is required.");

  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  // If linking to a customer, make sure it belongs to this business so a task
  // can't reference a customer in another tenant.
  let customerId: string | null = null;
  if (body.customerId) {
    const { data: cust } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", body.customerId)
      .eq("business_id", businessId)
      .maybeSingle();
    if (!cust) return jsonError("That customer isn't in this business.");
    customerId = cust.id;
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      business_id: businessId,
      customer_id: customerId,
      user_id: userId,
      title,
      due_at: body.dueAt ?? null,
    })
    .select("*")
    .single();

  if (error) return jsonError("Could not create task.", 500);
  return Response.json({ task: data });
}
