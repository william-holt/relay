import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  mapCustomer,
  DATABASE_ID,
  CUSTOMERS,
} from "@/lib/appwrite";
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

  const queries = [
    Query.equal("businessId", businessId),
    Query.orderDesc("updated_at"),
    Query.limit(200),
  ];

  const status = searchParams.get("status");
  if (status && isValidStatus(status)) queries.push(Query.equal("status", status));

  const rawQ = searchParams.get("q");
  const q = rawQ ? sanitizeSearch(rawQ) : "";
  if (q) {
    queries.push(
      Query.or([
        Query.search("name", q),
        Query.search("email", q),
        Query.search("company", q),
      ])
    );
  }

  try {
    const { databases } = createAdminClient();
    const res = await databases.listDocuments(DATABASE_ID, CUSTOMERS, queries);
    return Response.json({ customers: res.documents.map(mapCustomer) });
  } catch {
    return jsonError("Could not load customers.", 500);
  }
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

  const now = new Date().toISOString();
  try {
    const { databases } = createAdminClient();
    const doc = await databases.createDocument(
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
      [
        Permission.read(Role.team(businessId)),
        Permission.update(Role.team(businessId)),
        Permission.delete(Role.team(businessId)),
      ]
    );
    return Response.json({ customer: mapCustomer(doc) });
  } catch {
    return jsonError("Could not create customer.", 500);
  }
}
