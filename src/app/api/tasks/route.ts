import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  mapTask,
  DATABASE_ID,
  CUSTOMERS,
  TASKS,
} from "@/lib/appwrite";
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

  const queries = [
    Query.equal("businessId", businessId),
    Query.orderAsc("due_at"),
    Query.limit(200),
  ];
  if (searchParams.get("open") === "true") queries.push(Query.equal("done", false));

  try {
    const { databases } = createAdminClient();
    const res = await databases.listDocuments(DATABASE_ID, TASKS, queries);
    return Response.json({ tasks: res.documents.map(mapTask) });
  } catch {
    return jsonError("Could not load tasks.", 500);
  }
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

  const { databases } = createAdminClient();

  // If linking to a customer, make sure it belongs to this business.
  let customerId: string | null = null;
  if (body.customerId) {
    try {
      const cust = await databases.getDocument(
        DATABASE_ID,
        CUSTOMERS,
        body.customerId
      );
      if (cust.businessId !== businessId)
        return jsonError("That customer isn't in this business.");
      customerId = cust.$id;
    } catch {
      return jsonError("That customer isn't in this business.");
    }
  }

  try {
    const doc = await databases.createDocument(
      DATABASE_ID,
      TASKS,
      ID.unique(),
      {
        businessId,
        customerId,
        userId,
        title,
        due_at: body.dueAt ?? null,
        done: false,
        created_at: new Date().toISOString(),
      },
      [
        Permission.read(Role.team(businessId)),
        Permission.update(Role.team(businessId)),
        Permission.delete(Role.team(businessId)),
      ]
    );
    return Response.json({ task: mapTask(doc) });
  } catch {
    return jsonError("Could not create task.", 500);
  }
}
