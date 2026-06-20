import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { statusMeta } from "@/lib/status";
import { buildCustomerFields } from "@/lib/validation";

async function loadCustomerForUser(userId: string, customerId: string) {
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: jsonError("Customer not found.", 404) };
  if (!(await membershipRole(userId, customer.business_id)))
    return { error: jsonError("You don't have access to this customer.", 403) };
  return { customer };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { customer, error } = await loadCustomerForUser(userId, params.id);
  if (error) return error;
  return Response.json({ customer });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { customer, error } = await loadCustomerForUser(userId, params.id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const result = buildCustomerFields(body, true);
  if ("error" in result) return jsonError(result.error);
  const update = result.fields as Record<string, unknown>;

  const statusChanged =
    "status" in update && update.status !== customer!.status;

  const { data, error: updErr } = await supabaseAdmin
    .from("customers")
    .update(update)
    .eq("id", params.id)
    .select("*")
    .single();

  if (updErr) return jsonError("Could not update customer.", 500);

  // Record status transitions on the customer's timeline automatically.
  if (statusChanged) {
    await supabaseAdmin.from("contact_logs").insert({
      customer_id: params.id,
      business_id: customer!.business_id,
      user_id: userId,
      type: "status_change",
      subject: `Status changed to ${statusMeta(String(update.status)).label}`,
      body: `Moved from ${statusMeta(customer!.status).label} to ${statusMeta(
        String(update.status)
      ).label}.`,
    });
  }

  return Response.json({ customer: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadCustomerForUser(userId, params.id);
  if (error) return error;

  const { error: delErr } = await supabaseAdmin
    .from("customers")
    .delete()
    .eq("id", params.id);
  if (delErr) return jsonError("Could not delete customer.", 500);
  return Response.json({ ok: true });
}
