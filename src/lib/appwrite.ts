import { cookies } from "next/headers";
import {
  Account,
  Client,
  Databases,
  Query,
  Storage,
  Teams,
  Users,
} from "node-appwrite";
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
export const EMAIL_TEMPLATES = "email_templates";
export const ATTACHMENTS = "attachments";
export const BUSINESS_PROFILES = "business_profiles";

// Storage bucket id for customer file attachments.
// Configurable so it can point at an existing bucket on plans that cap buckets.
export const BUCKET_ATTACHMENTS =
  process.env.APPWRITE_ATTACHMENTS_BUCKET ?? "attachments";

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
    get storage() {
      return new Storage(client);
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
    direction: d.direction ?? "outbound",
    subject: d.subject ?? null,
    body: d.body ?? null,
    created_at: d.created_at ?? d.$createdAt,
  };
}

export function mapTemplate(d: Doc) {
  return {
    id: d.$id,
    business_id: d.businessId,
    name: d.name,
    subject: d.subject ?? "",
    body: d.body ?? "",
  };
}

export function mapProfile(d: Doc) {
  return {
    id: d.$id,
    business_id: d.businessId,
    industry: d.industry ?? "",
    description: d.description ?? "",
    value_proposition: d.value_proposition ?? "",
    icp: d.icp ?? "",
    target_titles: d.target_titles ?? "",
    locations: d.locations ?? "",
    website: d.website ?? "",
  };
}

export function mapAttachment(d: Doc) {
  return {
    id: d.$id,
    business_id: d.businessId,
    customer_id: d.customerId,
    file_id: d.fileId,
    name: d.name,
    size: d.size ?? 0,
    mime: d.mime ?? null,
    uploaded_by: d.uploadedBy ?? null,
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

// Delete attachment documents AND their stored files for a set of attachments.
async function deleteAttachmentsWhere(
  databases: Databases,
  storage: Storage,
  queries: string[]
) {
  for (;;) {
    const { documents } = await databases.listDocuments(DATABASE_ID, ATTACHMENTS, [
      ...queries,
      Query.limit(100),
    ]);
    if (documents.length === 0) return;
    await Promise.all(
      documents.map(async (d) => {
        try {
          await storage.deleteFile(BUCKET_ATTACHMENTS, d.fileId);
        } catch {
          // File may already be gone; remove the record regardless.
        }
        await databases.deleteDocument(DATABASE_ID, ATTACHMENTS, d.$id);
      })
    );
    if (documents.length < 100) return;
  }
}

/** Remove a customer's contact logs, tasks, and attachments (incl. files). */
export async function purgeCustomer(
  databases: Databases,
  storage: Storage,
  customerId: string
) {
  await deleteWhere(databases, CONTACT_LOGS, [Query.equal("customerId", customerId)]);
  await deleteWhere(databases, TASKS, [Query.equal("customerId", customerId)]);
  await deleteAttachmentsWhere(databases, storage, [
    Query.equal("customerId", customerId),
  ]);
}

/** Remove all data belonging to a business. */
export async function purgeBusiness(
  databases: Databases,
  storage: Storage,
  businessId: string
) {
  await deleteAttachmentsWhere(databases, storage, [
    Query.equal("businessId", businessId),
  ]);
  await deleteWhere(databases, CONTACT_LOGS, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, TASKS, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, EMAIL_TEMPLATES, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, BUSINESS_PROFILES, [Query.equal("businessId", businessId)]);
  await deleteWhere(databases, CUSTOMERS, [Query.equal("businessId", businessId)]);
}
