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
const DB_ID = process.env.APPWRITE_DATABASE_ID ?? "relay";

if (!PROJECT || !API_KEY) {
  console.error(
    "✖ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY.\n" +
      "  Copy .env.example to .env.local and fill them in first."
  );
  process.exit(1);
}

const db = new Databases(
  new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY)
);

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

async function main() {
  console.log(`→ Database "${DB_ID}"`);
  await ensure(`database ${DB_ID}`, () => db.create(DB_ID, "Relay"));

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

  console.log("\n✓ Appwrite schema ready.\n");
}

main().catch((err) => {
  console.error("✖ Setup failed:", err?.message ?? err);
  process.exit(1);
});
