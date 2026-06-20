import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  mapLog,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT, MAX_TEXT } from "@/lib/validation";

async function guard(userId: string, customerId: string) {
  const { databases } = createAdminClient();
  let customer;
  try {
    customer = await databases.getDocument(DATABASE_ID, CUSTOMERS, customerId);
  } catch {
    return { error: jsonError("Customer not found.", 404) };
  }
  if (!(await membershipRole(userId, customer.businessId)))
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

  try {
    const { databases } = createAdminClient();
    const res = await databases.listDocuments(DATABASE_ID, CONTACT_LOGS, [
      Query.equal("customerId", params.id),
      Query.orderDesc("created_at"),
      Query.limit(200),
    ]);
    return Response.json({ logs: res.documents.map(mapLog) });
  } catch {
    return jsonError("Could not load activity.", 500);
  }
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

  const now = new Date().toISOString();
  try {
    const { databases } = createAdminClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      CONTACT_LOGS,
      ID.unique(),
      {
        customerId: params.id,
        businessId: customer!.businessId,
        userId,
        type,
        subject,
        body: logBody,
        created_at: now,
      },
      [
        Permission.read(Role.team(customer!.businessId)),
        Permission.update(Role.team(customer!.businessId)),
        Permission.delete(Role.team(customer!.businessId)),
      ]
    );

    // Touch the customer so it rises to the top of recently-active lists.
    await databases.updateDocument(DATABASE_ID, CUSTOMERS, params.id, {
      updated_at: now,
    });

    return Response.json({ log: mapLog(doc) });
  } catch {
    return jsonError("Could not log interaction.", 500);
  }
}
