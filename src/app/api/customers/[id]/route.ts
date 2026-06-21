import { ID, Permission, Role } from "node-appwrite";
import {
  createAdminClient,
  mapCustomer,
  purgeCustomer,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { statusMeta } from "@/lib/status";
import { buildCustomerFields } from "@/lib/validation";

async function loadCustomerForUser(userId: string, customerId: string) {
  const { databases } = createAdminClient();
  let customer;
  try {
    customer = await databases.getDocument(DATABASE_ID, CUSTOMERS, customerId);
  } catch {
    return { error: jsonError("Customer not found.", 404) };
  }
  if (!(await membershipRole(userId, customer.businessId)))
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
  return Response.json({ customer: mapCustomer(customer!) });
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

  const { databases } = createAdminClient();
  let doc;
  try {
    doc = await databases.updateDocument(DATABASE_ID, CUSTOMERS, params.id, {
      ...update,
      updated_at: new Date().toISOString(),
    });
  } catch {
    return jsonError("Could not update customer.", 500);
  }

  // Record status transitions on the customer's timeline automatically.
  if (statusChanged) {
    try {
      await databases.createDocument(
        DATABASE_ID,
        CONTACT_LOGS,
        ID.unique(),
        {
          customerId: params.id,
          businessId: customer!.businessId,
          userId,
          type: "status_change",
          subject: `Status changed to ${statusMeta(String(update.status)).label}`,
          body: `Moved from ${statusMeta(customer!.status).label} to ${statusMeta(
            String(update.status)
          ).label}.`,
          created_at: new Date().toISOString(),
        },
        [
          Permission.read(Role.team(customer!.businessId)),
          Permission.update(Role.team(customer!.businessId)),
          Permission.delete(Role.team(customer!.businessId)),
        ]
      );
    } catch {
      // Non-fatal: the customer update already succeeded.
    }
  }

  return Response.json({ customer: mapCustomer(doc) });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadCustomerForUser(userId, params.id);
  if (error) return error;

  try {
    const { databases, storage } = createAdminClient();
    await purgeCustomer(databases, storage, params.id);
    await databases.deleteDocument(DATABASE_ID, CUSTOMERS, params.id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not delete customer.", 500);
  }
}
