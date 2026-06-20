import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { buildCustomerFields, isValidStatus, sanitizeSearch } from "@/lib/validation";

// List customers for a business (?businessId=...&q=...&status=...).
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");

  if (!(await membershipRole(userId, businessId)))
    return jsonError("You don't have access to this business.", 403);

  let query = supabaseAdmin
    .from("customers")
    .select("*")
    .eq("business_id", businessId)
    .order("updated_at", { ascending: false });

  const status = searchParams.get("status");
  if (status && isValidStatus(status)) query = query.eq("status", status);

  const rawQ = searchParams.get("q");
  const q = rawQ ? sanitizeSearch(rawQ) : "";
  if (q) {
    const term = `%${q}%`;
    query = query.or(
      `name.ilike.${term},email.ilike.${term},company.ilike.${term}`
    );
  }

  const { data, error } = await query;
  if (error) return jsonError("Could not load customers.", 500);
  return Response.json({ customers: data ?? [] });
}

// Create a customer.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const body = await req.json().catch(() => ({}));
  const { businessId } = body;

  if (!businessId) return jsonError("businessId is required.");

  const result = buildCustomerFields(body, false);
  if ("error" in result) return jsonError(result.error);
  const f = result.fields;

  if (!(await membershipRole(userId, businessId)))
    return jsonError("You don't have access to this business.", 403);

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      business_id: businessId,
      name: f.name!,
      email: f.email ?? null,
      phone: f.phone ?? null,
      company: f.company ?? null,
      title: f.title ?? null,
      status: f.status ?? "cold_lead",
      source: f.source ?? null,
      value: f.value ?? 0,
      notes: f.notes ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error) return jsonError("Could not create customer.", 500);
  return Response.json({ customer: data });
}
