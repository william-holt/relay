// Provision the Appwrite database, collections, attributes, and indexes.
//
//   npm run appwrite:setup
//
// Idempotent: anything that already exists is skipped (409s are ignored), so
// it's safe to re-run after editing. Requires a project API key with the
// `databases.write` scope (plus the auth/teams scopes used elsewhere).
//
// This replaces the old supabase/schema.sql. Collections use document-level
// security (each document is scoped to its business's Team); the API key used
// by the app's routes bypasses those permissions and enforces access in code.

import { readFileSync } from "node:fs";
import {
  Client,
  Databases,
  Storage,
  Query,
  DatabasesIndexType,
  OrderBy,
} from "node-appwrite";

// --- Load env from .env.local (if not already set) --------------------------
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let val = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
} catch {
  /* fall back to ambient env */
}

const ENDPOINT =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const PROJECT = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
// Reassigned by resolveDatabase() if we adopt an existing database.
let DB_ID = process.env.APPWRITE_DATABASE_ID ?? "relay";

if (!PROJECT || !API_KEY) {
  console.error(
    "✖ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY.\n" +
      "  Copy .env.example to .env.local and fill them in first."
  );
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const db = new Databases(client);
const storage = new Storage(client);
let BUCKET_ATTACHMENTS = process.env.APPWRITE_ATTACHMENTS_BUCKET ?? "attachments";

const STATUSES = [
  "cold_lead",
  "hot_lead",
  "outreach",
  "contacted",
  "in_pipeline",
  "sold",
  "recurring",
  "lost",
];
const LOG_TYPES = ["note", "call", "email", "meeting", "status_change"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Run a creation call, ignoring "already exists" (409) so re-runs are safe.
async function ensure(label, fn) {
  try {
    await fn();
    console.log(`  + ${label}`);
  } catch (err) {
    if (err?.code === 409) {
      console.log(`  · ${label} (exists)`);
    } else {
      console.error(`  ✖ ${label}: ${err?.message ?? err}`);
      throw err;
    }
  }
}

// Indexes need their attributes to be "available"; retry briefly.
async function ensureIndex(collectionId, key, type, attributes, orders) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      await db.createIndex(DB_ID, collectionId, key, type, attributes, orders);
      console.log(`  + index ${collectionId}.${key}`);
      return;
    } catch (err) {
      if (err?.code === 409) {
        console.log(`  · index ${collectionId}.${key} (exists)`);
        return;
      }
      // Attribute not ready yet — wait and retry.
      await sleep(1500);
    }
  }
  console.error(`  ✖ index ${collectionId}.${key}: gave up waiting`);
}

// Resolve which database to use. Appwrite's free plan allows only one database,
// so if we can't create ours we adopt an existing one instead of failing.
async function resolveDatabase() {
  const wanted = DB_ID;

  // 1. Already there? Use it.
  try {
    await db.get(wanted);
    console.log(`  · database ${wanted} (exists)`);
    return;
  } catch (err) {
    if (err?.code !== 404) {
      // Not a "missing" error — fall through and let create surface details.
    }
  }

  // 2. Try to create it.
  try {
    await db.create(wanted, "Relay");
    console.log(`  + database ${wanted}`);
    return;
  } catch (err) {
    // 3. Couldn't create (e.g. plan database limit). Adopt an existing one.
    let existing = [];
    try {
      existing = (await db.list()).databases;
    } catch {
      /* ignore */
    }

    if (existing.length === 1) {
      DB_ID = existing[0].$id;
      console.log(`  · couldn't create "${wanted}" — ${err?.message ?? err}`);
      console.log(`  → using existing database "${DB_ID}" (${existing[0].name})`);
      console.log(
        `\n  ⚠  Add this to .env.local so the app uses the same database:\n       APPWRITE_DATABASE_ID=${DB_ID}\n`
      );
      return;
    }

    if (existing.length > 1) {
      console.error(
        `  ✖ Couldn't create "${wanted}" and your project has multiple databases.\n` +
          `    Set APPWRITE_DATABASE_ID in .env.local to one of:\n` +
          existing.map((d) => `       ${d.$id}  (${d.name})`).join("\n")
      );
    }
    throw err;
  }
}

// Drop a collection ONLY if it exists and has no documents, so corrected
// attribute definitions can be re-applied. Never deletes a collection with data.
async function resetEmptyCollection(collectionId) {
  let exists = true;
  try {
    await db.getCollection(DB_ID, collectionId);
  } catch (err) {
    if (err?.code === 404) exists = false;
  }
  if (!exists) return;

  let empty = true;
  try {
    const docs = await db.listDocuments(DB_ID, collectionId, [Query.limit(1)]);
    empty = (docs.total ?? docs.documents.length) === 0;
  } catch {
    empty = true; // attributes may be broken — treat as resettable
  }

  if (!empty) {
    console.log(
      `  ⚠ ${collectionId} already has data — leaving it untouched. If you hit ` +
        `attribute errors, recreate it manually with larger text fields.`
    );
    return;
  }

  console.log(`  · resetting empty ${collectionId} to apply corrected schema`);
  await db.deleteCollection(DB_ID, collectionId);
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    try {
      await db.getCollection(DB_ID, collectionId);
    } catch (err) {
      if (err?.code === 404) return;
    }
  }
}

async function main() {
  console.log(`→ Database`);
  await resolveDatabase();

  // --- customers ---
  console.log("→ Collection customers");
  await ensure("collection customers", () =>
    db.createCollection(DB_ID, "customers", "Customers", undefined, true)
  );
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "customers", "businessId", 64, true));
  await ensure("attr name", () => db.createStringAttribute(DB_ID, "customers", "name", 256, true));
  await ensure("attr email", () => db.createStringAttribute(DB_ID, "customers", "email", 320, false));
  await ensure("attr phone", () => db.createStringAttribute(DB_ID, "customers", "phone", 64, false));
  await ensure("attr company", () => db.createStringAttribute(DB_ID, "customers", "company", 256, false));
  await ensure("attr title", () => db.createStringAttribute(DB_ID, "customers", "title", 256, false));
  await ensure("attr status", () => db.createEnumAttribute(DB_ID, "customers", "status", STATUSES, false, "cold_lead"));
  await ensure("attr source", () => db.createStringAttribute(DB_ID, "customers", "source", 128, false));
  await ensure("attr value", () => db.createFloatAttribute(DB_ID, "customers", "value", false, 0, undefined, 0));
  await ensure("attr notes", () => db.createStringAttribute(DB_ID, "customers", "notes", 5000, false));
  await ensure("attr created_by", () => db.createStringAttribute(DB_ID, "customers", "created_by", 64, false));
  await ensure("attr created_at", () => db.createDatetimeAttribute(DB_ID, "customers", "created_at", false));
  await ensure("attr updated_at", () => db.createDatetimeAttribute(DB_ID, "customers", "updated_at", false));
  await sleep(2000);
  await ensureIndex("customers", "idx_business", DatabasesIndexType.Key, ["businessId"]);
  await ensureIndex("customers", "idx_business_status", DatabasesIndexType.Key, ["businessId", "status"]);
  await ensureIndex("customers", "idx_updated", DatabasesIndexType.Key, ["updated_at"], [OrderBy.Desc]);
  await ensureIndex("customers", "search_name", DatabasesIndexType.Fulltext, ["name"]);
  await ensureIndex("customers", "search_email", DatabasesIndexType.Fulltext, ["email"]);
  await ensureIndex("customers", "search_company", DatabasesIndexType.Fulltext, ["company"]);

  // --- contact_logs ---
  console.log("→ Collection contact_logs");
  await ensure("collection contact_logs", () =>
    db.createCollection(DB_ID, "contact_logs", "Contact logs", undefined, true)
  );
  await ensure("attr customerId", () => db.createStringAttribute(DB_ID, "contact_logs", "customerId", 64, true));
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "contact_logs", "businessId", 64, true));
  await ensure("attr userId", () => db.createStringAttribute(DB_ID, "contact_logs", "userId", 64, false));
  await ensure("attr type", () => db.createEnumAttribute(DB_ID, "contact_logs", "type", LOG_TYPES, false, "note"));
  await ensure("attr direction", () => db.createEnumAttribute(DB_ID, "contact_logs", "direction", ["outbound", "inbound"], false, "outbound"));
  await ensure("attr subject", () => db.createStringAttribute(DB_ID, "contact_logs", "subject", 256, false));
  await ensure("attr body", () => db.createStringAttribute(DB_ID, "contact_logs", "body", 5000, false));
  await ensure("attr created_at", () => db.createDatetimeAttribute(DB_ID, "contact_logs", "created_at", false));
  await sleep(2000);
  await ensureIndex("contact_logs", "idx_customer_created", DatabasesIndexType.Key, ["customerId", "created_at"], [OrderBy.Asc, OrderBy.Desc]);
  await ensureIndex("contact_logs", "idx_business", DatabasesIndexType.Key, ["businessId"]);

  // --- tasks ---
  console.log("→ Collection tasks");
  await ensure("collection tasks", () =>
    db.createCollection(DB_ID, "tasks", "Tasks", undefined, true)
  );
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "tasks", "businessId", 64, true));
  await ensure("attr customerId", () => db.createStringAttribute(DB_ID, "tasks", "customerId", 64, false));
  await ensure("attr userId", () => db.createStringAttribute(DB_ID, "tasks", "userId", 64, false));
  await ensure("attr title", () => db.createStringAttribute(DB_ID, "tasks", "title", 256, true));
  await ensure("attr due_at", () => db.createDatetimeAttribute(DB_ID, "tasks", "due_at", false));
  await ensure("attr done", () => db.createBooleanAttribute(DB_ID, "tasks", "done", false, false));
  await ensure("attr created_at", () => db.createDatetimeAttribute(DB_ID, "tasks", "created_at", false));
  await sleep(2000);
  await ensureIndex("tasks", "idx_business_done_due", DatabasesIndexType.Key, ["businessId", "done", "due_at"], [OrderBy.Asc, OrderBy.Asc, OrderBy.Asc]);

  // --- email_templates ---
  console.log("→ Collection email_templates");
  await ensure("collection email_templates", () =>
    db.createCollection(DB_ID, "email_templates", "Email templates", undefined, true)
  );
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "email_templates", "businessId", 64, true));
  await ensure("attr name", () => db.createStringAttribute(DB_ID, "email_templates", "name", 256, true));
  await ensure("attr subject", () => db.createStringAttribute(DB_ID, "email_templates", "subject", 256, false));
  await ensure("attr body", () => db.createStringAttribute(DB_ID, "email_templates", "body", 25000, false));
  await sleep(2000);
  await ensureIndex("email_templates", "idx_business", DatabasesIndexType.Key, ["businessId"]);

  // --- attachments ---
  console.log("→ Collection attachments");
  await ensure("collection attachments", () =>
    db.createCollection(DB_ID, "attachments", "Attachments", undefined, true)
  );
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "attachments", "businessId", 64, true));
  await ensure("attr customerId", () => db.createStringAttribute(DB_ID, "attachments", "customerId", 64, true));
  await ensure("attr fileId", () => db.createStringAttribute(DB_ID, "attachments", "fileId", 64, true));
  await ensure("attr name", () => db.createStringAttribute(DB_ID, "attachments", "name", 512, true));
  await ensure("attr size", () => db.createIntegerAttribute(DB_ID, "attachments", "size", false, 0));
  await ensure("attr mime", () => db.createStringAttribute(DB_ID, "attachments", "mime", 256, false));
  await ensure("attr uploadedBy", () => db.createStringAttribute(DB_ID, "attachments", "uploadedBy", 64, false));
  await ensure("attr created_at", () => db.createDatetimeAttribute(DB_ID, "attachments", "created_at", false));
  await sleep(2000);
  await ensureIndex("attachments", "idx_customer", DatabasesIndexType.Key, ["customerId"]);
  await ensureIndex("attachments", "idx_business", DatabasesIndexType.Key, ["businessId"]);

  // --- business_profiles ---
  console.log("→ Collection business_profiles");
  await resetEmptyCollection("business_profiles");
  await ensure("collection business_profiles", () =>
    db.createCollection(DB_ID, "business_profiles", "Business profiles", undefined, true)
  );
  await ensure("attr businessId", () => db.createStringAttribute(DB_ID, "business_profiles", "businessId", 64, true));
  await ensure("attr industry", () => db.createStringAttribute(DB_ID, "business_profiles", "industry", 200, false));
  // Long free-text fields use sizes > 16383 so Appwrite stores them as TEXT
  // (off-row) instead of VARCHAR — otherwise the combined VARCHAR width exceeds
  // the per-row size limit.
  await ensure("attr description", () => db.createStringAttribute(DB_ID, "business_profiles", "description", 20000, false));
  await ensure("attr value_proposition", () => db.createStringAttribute(DB_ID, "business_profiles", "value_proposition", 20000, false));
  await ensure("attr icp", () => db.createStringAttribute(DB_ID, "business_profiles", "icp", 20000, false));
  await ensure("attr target_titles", () => db.createStringAttribute(DB_ID, "business_profiles", "target_titles", 200, false));
  await ensure("attr locations", () => db.createStringAttribute(DB_ID, "business_profiles", "locations", 200, false));
  await ensure("attr website", () => db.createStringAttribute(DB_ID, "business_profiles", "website", 300, false));
  await sleep(2000);
  await ensureIndex("business_profiles", "idx_business", DatabasesIndexType.Key, ["businessId"]);

  // --- storage bucket for attachments (optional: file attachments feature) ---
  console.log("→ Storage bucket");
  await resolveBucket();

  console.log("\n✓ Appwrite schema ready.\n");
}

// Get-or-create the attachments bucket. On plans that cap buckets, adopt an
// existing one instead of failing — the rest of the schema is already done, and
// attachments are an optional feature.
async function resolveBucket() {
  const wanted = BUCKET_ATTACHMENTS;

  try {
    await storage.getBucket(wanted);
    console.log(`  · bucket ${wanted} (exists)`);
    return;
  } catch (err) {
    if (err?.code !== 404) {
      /* fall through to create */
    }
  }

  try {
    await storage.createBucket(
      wanted,
      "Attachments",
      undefined,
      true, // fileSecurity — per-file permissions apply
      true, // enabled
      10 * 1024 * 1024 // 10 MB max file size
    );
    console.log(`  + bucket ${wanted}`);
    return;
  } catch (err) {
    let existing = [];
    try {
      existing = (await storage.listBuckets()).buckets;
    } catch {
      /* ignore */
    }

    if (existing.length === 1) {
      BUCKET_ATTACHMENTS = existing[0].$id;
      console.log(`  · couldn't create "${wanted}" — ${err?.message ?? err}`);
      console.log(`  → using existing bucket "${BUCKET_ATTACHMENTS}" (${existing[0].name})`);
      console.log(
        `\n  ⚠  Add this to .env.local so file uploads use that bucket:\n       APPWRITE_ATTACHMENTS_BUCKET=${BUCKET_ATTACHMENTS}\n`
      );
      return;
    }

    if (existing.length > 1) {
      console.log(
        `  ⚠ Couldn't create "${wanted}" and your project has multiple buckets.\n` +
          `    Set APPWRITE_ATTACHMENTS_BUCKET in .env.local to one of (or skip file attachments):\n` +
          existing.map((b) => `       ${b.$id}  (${b.name})`).join("\n")
      );
      return;
    }

    // No bucket available and can't create one — attachments just won't work.
    console.log(
      `  ⚠ Couldn't create a storage bucket (${err?.message ?? err}).\n` +
        `    File attachments will be disabled until a bucket exists. Everything else is ready.`
    );
  }
}

main().catch((err) => {
  console.error("✖ Setup failed:", err?.message ?? err);
  process.exit(1);
});
