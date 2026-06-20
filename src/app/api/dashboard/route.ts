import { Query } from "node-appwrite";
import {
  createAdminClient,
  mapCustomer,
  DATABASE_ID,
  CUSTOMERS,
  TASKS,
} from "@/lib/appwrite";
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

  const { databases } = createAdminClient();

  let rows;
  try {
    const res = await databases.listDocuments(DATABASE_ID, CUSTOMERS, [
      Query.equal("businessId", businessId),
      Query.limit(1000),
    ]);
    rows = res.documents.map(mapCustomer);
  } catch {
    return jsonError("Could not load dashboard.", 500);
  }

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

  const recent = [...rows]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 6);

  // Tasks due soon, with the customer's name attached for display.
  let tasks: {
    id: string;
    title: string;
    due_at: string | null;
    customer_id: string | null;
    customers: { name: string } | null;
  }[] = [];
  try {
    const res = await databases.listDocuments(DATABASE_ID, TASKS, [
      Query.equal("businessId", businessId),
      Query.equal("done", false),
      Query.orderAsc("due_at"),
      Query.limit(6),
    ]);
    const nameById = new Map(rows.map((r) => [r.id, r.name]));
    tasks = res.documents.map((d) => ({
      id: d.$id,
      title: d.title,
      due_at: d.due_at ?? null,
      customer_id: d.customerId ?? null,
      customers: d.customerId && nameById.has(d.customerId)
        ? { name: nameById.get(d.customerId)! }
        : null,
    }));
  } catch {
    tasks = [];
  }

  return Response.json({
    totals: {
      customers: rows.length,
      activeLeads,
      pipelineValue,
      wonValue,
    },
    byStatus,
    recent,
    tasks,
  });
}
