import { cookies } from "next/headers";
import { Account, Client, Databases, Query, Teams, Users } from "node-appwrite";
import { SESSION_COOKIE } from "./cookies";

/**
 * Appwrite server clients.
 *
 * - `createAdminClient()` is authenticated with the project API key. It bypasses
 *   document permissions (like the old Supabase service role), so every route
 *   that uses it must enforce authorization itself (session + Team membership).
 * - `createSessionClient()` acts as the signed-in user via their session cookie.
 *
 * A fresh `Client` is built per call — Appwrite clients must never be shared
 * between requests.
 */

const ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

// Database + collection ids (created by scripts/appwrite-setup.mjs).
export const DATABASE_ID = process.env.APPWRITE_DATABASE_ID ?? "relay";
export const CUSTOMERS = "customers";
export const CONTACT_LOGS = "contact_logs";
export const TASKS = "tasks";

function base() {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
}

export function createAdminClient() {
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!apiKey) throw new Error("[appwrite] Missing APPWRITE_API_KEY");
  const client = base().setKey(apiKey);
  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get teams() {
      return new Teams(client);
    },
    get users() {
      return new Users(client);
    },
  };
}

export function sessionClientFromSecret(secret: string) {
  const client = base().setSession(secret);
  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get teams() {
      return new Teams(client);
    },
  };
}

/** Session client built from the request cookie, or null if not signed in. */
export function createSessionClient() {
  const secret = cookies().get(SESSION_COOKIE)?.value;
  if (!secret) return null;
  return sessionClientFromSecret(secret);
}

// --- Document → API response mappers (keep the snake_case shapes the UI uses) ---

type Doc = Record<string, any>;

export function mapCustomer(d: Doc) {
  return {
    id: d.$id,
    business_id: d.businessId,
    name: d.name,
    email: d.email ?? null,
    phone: d.phone ?? null,
    company: d.company ?? null,
    title: d.title ?? null,
    status: d.status,
    source: d.source ?? null,
    value: typeof d.value === "number" ? d.value : Number(d.value ?? 0),
    notes: d.notes ?? null,
    created_by: d.created_by ?? null,
    created_at: d.created_at ?? d.$createdAt,
    updated_at: d.updated_at ?? d.$updatedAt,
  };
}

export function mapLog(d: Doc) {
  return {
    id: d.$id,
    customer_id: d.customerId,
    business_id: d.businessId,
    user_id: d.userId ?? null,
    type: d.type,
    subject: d.subject ?? null,
    body: d.body ?? null,
    created_at: d.created_at ?? d.$createdAt,
  };
}

export function mapTask(d: Doc) {
  return {
    id: d.$id,
    business_id: d.businessId,
    customer_id: d.customerId ?? null,
    user_id: d.userId ?? null,
    title: d.title,
    due_at: d.due_at ?? null,
    done: !!d.done,
    created_at: d.created_at ?? d.$createdAt,
  };
}

// --- Cascade deletes (Appwrite has no foreign-key cascade) -------------------

async function deleteWhere(
  databases: Databases,
  collectionId: string,
  queries: string[]
) {
  for (;;) {
    const { documents } = await databases.listDocuments(
      DATABASE_ID,
      collectionId,
      [...queries, Query.limit(100)]
    );
    if (documents.length === 0) return;
    await Promise.all(
      documents.map((d) =>
        databases.deleteDocument(DATABASE_ID, collectionId, d.$id)
      )
    );
    if (documents.length < 100) return;
  }
}

/** Remove a customer's contact logs and tasks. */
export async function purgeCustomer(databases: Databases, customerId: string) {
  await deleteWhere(databases, CONTACT_LOGS, [Query.equal("customerId", customerId)]);
  await deleteWhere(databases, TASKS, [Query.equal("customerId", customerId)]);
}

/** Remove every customer, contact log, and task belonging to a business. */
export async function purgeBusiness(databases: Databases, businessId: string) {
  await deleteWhere(databases, CONTACT_LOGS, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, TASKS, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, CUSTOMERS, [Query.equal("businessId", businessId)]);
}
