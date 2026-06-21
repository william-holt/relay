import { ID, Permission, Role } from "node-appwrite";
import { createAdminClient, DATABASE_ID, CUSTOMERS } from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { buildCustomerFields } from "@/lib/validation";

// Bulk-create customers from parsed CSV rows.
// Body: { businessId, rows: Array<Record<string, string>> }
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { businessId, rows } = await req.json().catch(() => ({}));
  if (!businessId) return jsonError("businessId is required.");
  if (!Array.isArray(rows) || rows.length === 0)
    return jsonError("No rows to import.");
  if (rows.length > 1000)
    return jsonError("Please import 1000 rows or fewer at a time.");

  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  const { databases } = createAdminClient();
  const perms = [
    Permission.read(Role.team(businessId)),
    Permission.update(Role.team(businessId)),
    Permission.delete(Role.team(businessId)),
  ];

  let created = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const result = buildCustomerFields(rows[i] ?? {}, false);
    if ("error" in result) {
      errors.push({ row: i + 1, error: result.error });
      continue;
    }
    const f = result.fields;
    const now = new Date().toISOString();
    try {
      await databases.createDocument(
        DATABASE_ID,
        CUSTOMERS,
        ID.unique(),
        {
          businessId,
          name: f.name,
          email: f.email ?? null,
          phone: f.phone ?? null,
          company: f.company ?? null,
          title: f.title ?? null,
          status: f.status ?? "cold_lead",
          source: f.source ?? null,
          value: f.value ?? 0,
          notes: f.notes ?? null,
          created_by: userId,
          created_at: now,
          updated_at: now,
        },
        perms
      );
      created++;
    } catch {
      errors.push({ row: i + 1, error: "Could not save this row." });
    }
  }

  return Response.json({ created, skipped: errors.length, errors: errors.slice(0, 20) });
}
