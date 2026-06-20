import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { STATUS_ORDER, statusMeta } from "@/lib/status";

// Aggregate metrics for a business dashboard (?businessId=...).
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  const { data: customers, error } = await supabaseAdmin
    .from("customers")
    .select("id, name, status, value, updated_at, company")
    .eq("business_id", businessId);

  if (error) return jsonError("Could not load dashboard.", 500);

  const rows = customers ?? [];

  // Counts per status, in lifecycle order.
  const byStatus = STATUS_ORDER.map((s) => ({
    status: s,
    label: statusMeta(s).label,
    color: statusMeta(s).color,
    count: rows.filter((r) => r.status === s).length,
  }));

  const pipelineValue = rows
    .filter((r) => statusMeta(r.status).pipeline)
    .reduce((sum, r) => sum + Number(r.value ?? 0), 0);

  const wonValue = rows
    .filter((r) => statusMeta(r.status).won)
    .reduce((sum, r) => sum + Number(r.value ?? 0), 0);

  const activeLeads = rows.filter(
    (r) => !["sold", "recurring", "lost"].includes(r.status)
  ).length;

  // Recently updated customers for the activity panel.
  const recent = [...rows]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 6);

  // Tasks due soon.
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("id, title, due_at, customer_id, customers(name)")
    .eq("business_id", businessId)
    .eq("done", false)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(6);

  return Response.json({
    totals: {
      customers: rows.length,
      activeLeads,
      pipelineValue,
      wonValue,
    },
    byStatus,
    recent,
    tasks: tasks ?? [],
  });
}
