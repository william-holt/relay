// Seed Appwrite with realistic sample data for local development.
//
//   npm run seed     (run `npm run appwrite:setup` first to create the schema)
//
// Idempotent: it deletes the seed users + teams (and their documents) by fixed
// ids, then recreates everything. Only touches the seed records, so data you
// created by hand is left alone. Requires an API key with users/teams/databases
// scopes. Refuses to run with NODE_ENV=production unless you pass --force.
//
// Login after seeding:  dana@relay.test / password123   (or sam@relay.test)

import { readFileSync } from "node:fs";
import {
  Client,
  Databases,
  Teams,
  Users,
  Permission,
  Role,
  Query,
  ID,
} from "node-appwrite";

// --- Load env from .env.local (if not already set) --------------------------
try {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of raw.split("\n")) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
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
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

if (!PROJECT || !API_KEY) {
  console.error(
    "✖ Missing NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY.\n" +
      "  Copy .env.example to .env.local and fill them in first."
  );
  process.exit(1);
}
if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
  console.error("✖ Refusing to seed with NODE_ENV=production (use --force).");
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const users = new Users(client);
const teams = new Teams(client);
const databases = new Databases(client);

const PASSWORD = "password123";
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000).toISOString();
const perms = (teamId) => [
  Permission.read(Role.team(teamId)),
  Permission.update(Role.team(teamId)),
  Permission.delete(Role.team(teamId)),
];

// --- Identities (fixed ids so cleanup is deterministic) ---------------------
const DANA = { id: "seed_dana", name: "Dana Reyes", email: "dana@relay.test" };
const SAM = { id: "seed_sam", name: "Sam Okafor", email: "sam@relay.test" };
const ACME = { id: "seed_acme", name: "Acme Consulting", owner: DANA };
const BLOOM = { id: "seed_bloom", name: "Bloom Studio", owner: DANA };
const OKAFOR = { id: "seed_okafor", name: "Okafor Legal", owner: SAM };
const TEAMS = [ACME, BLOOM, OKAFOR];
const USERS = [DANA, SAM];

// --- Customer dataset -------------------------------------------------------
// [team, status, name, opts] — opts may include logs[] and tasks[].
const customers = [
  [ACME, "recurring", "Priya Nair", {
    company: "Northwind Retail", title: "VP Operations", email: "priya@northwind.example",
    phone: "+1 (415) 555-0142", source: "Referral", value: 48000,
    notes: "Renewed annual retainer. Champion internally — keep close.",
    createdDaysAgo: 240, updatedDaysAgo: 3,
    logs: [
      { type: "email", subject: "Q3 renewal confirmed", body: "Signed for another 12 months.", daysAgo: 3 },
      { type: "call", subject: "Quarterly check-in", body: "Happy with delivery cadence.", daysAgo: 30 },
      { type: "status_change", subject: "Status changed to Recurring", body: "Moved from Sold to Recurring.", daysAgo: 200 },
    ],
    tasks: [{ title: "Send Q3 success summary", due: daysFromNow(4) }],
  }],
  [ACME, "sold", "Marcus Bell", {
    company: "Bell & Co", title: "Founder", email: "marcus@bellco.example",
    phone: "+1 (212) 555-0190", source: "Inbound", value: 22000,
    notes: "Closed the onboarding package. Upsell analytics next quarter.",
    createdDaysAgo: 90, updatedDaysAgo: 8,
    logs: [
      { type: "status_change", subject: "Status changed to Sold", body: "Moved from In pipeline to Sold.", daysAgo: 8 },
      { type: "meeting", subject: "Contract walkthrough", body: "Reviewed SOW and timeline.", daysAgo: 12 },
    ],
    tasks: [{ title: "Kickoff onboarding call", due: daysFromNow(2) }],
  }],
  [ACME, "in_pipeline", "Lena Hart", {
    company: "Harvest Foods", title: "Head of Growth", email: "lena@harvest.example",
    phone: "+1 (503) 555-0133", source: "Conference", value: 31000,
    notes: "Proposal sent. Decision expected end of month.",
    createdDaysAgo: 45, updatedDaysAgo: 2,
    logs: [
      { type: "email", subject: "Proposal sent", body: "Attached the scoped proposal and pricing.", daysAgo: 2 },
      { type: "meeting", subject: "Discovery call", body: "Mapped requirements; budget aligned.", daysAgo: 9 },
    ],
    tasks: [
      { title: "Follow up on proposal", due: daysFromNow(3) },
      { title: "Loop in legal for MSA", due: daysFromNow(9) },
    ],
  }],
  [ACME, "contacted", "Diego Romero", {
    company: "Cobalt Labs", title: "CTO", email: "diego@cobalt.example",
    source: "Referral", value: 18000, notes: "Interested but waiting on budget approval.",
    createdDaysAgo: 30, updatedDaysAgo: 6,
    logs: [{ type: "call", subject: "Intro call", body: "Walked through use cases.", daysAgo: 6 }],
    tasks: [{ title: "Re-engage in two weeks", due: daysFromNow(11) }],
  }],
  [ACME, "outreach", "Aisha Khan", {
    company: "Meridian Health", title: "Director of IT", email: "aisha@meridian.example",
    source: "LinkedIn", value: 26000, notes: "Sent first outreach. No reply yet.",
    createdDaysAgo: 14, updatedDaysAgo: 7,
    logs: [{ type: "email", subject: "Intro outreach", body: "Shared a relevant case study.", daysAgo: 7 }],
    tasks: [{ title: "Second touch if no reply", due: daysFromNow(1) }],
  }],
  [ACME, "hot_lead", "Tom Becker", {
    company: "Becker Manufacturing", title: "COO", email: "tom@beckermfg.example",
    phone: "+1 (312) 555-0177", source: "Webinar", value: 40000,
    notes: "Reached out after the webinar — wants a demo asap.",
    createdDaysAgo: 5, updatedDaysAgo: 1,
    logs: [{ type: "note", subject: "Requested demo", body: "Asked for availability this week.", daysAgo: 1 }],
    tasks: [{ title: "Schedule product demo", due: daysFromNow(0) }],
  }],
  [ACME, "cold_lead", "Grace Liu", {
    company: "Pinnacle Realty", title: "Operations Manager", email: "grace@pinnacle.example",
    source: "List import", value: 0, createdDaysAgo: 3, updatedDaysAgo: 3,
  }],
  [ACME, "lost", "Owen Wright", {
    company: "Drift Apparel", title: "Founder", email: "owen@drift.example",
    source: "Inbound", value: 12000, notes: "Went with a competitor on price. Revisit next year.",
    createdDaysAgo: 120, updatedDaysAgo: 40,
    logs: [{ type: "status_change", subject: "Status changed to Lost", body: "Moved from Contacted to Lost.", daysAgo: 40 }],
  }],
  [ACME, "contacted", "Nadia Osei", {
    company: "Solstice Travel", title: "Marketing Lead", email: "nadia@solstice.example",
    source: "Referral", value: 15000, createdDaysAgo: 22, updatedDaysAgo: 10, createdBy: SAM,
    logs: [{ type: "call", subject: "Needs analysis", body: "Discussed seasonal campaign needs.", by: SAM, daysAgo: 10 }],
  }],

  [BLOOM, "in_pipeline", "Harriet Vance", {
    company: "Vance Interiors", title: "Principal", email: "harriet@vance.example",
    source: "Instagram", value: 9000, notes: "Brand refresh project. Sent mood boards.",
    createdDaysAgo: 25, updatedDaysAgo: 4,
    logs: [{ type: "email", subject: "Mood boards shared", body: "Three directions to choose from.", daysAgo: 4 }],
    tasks: [{ title: "Review board feedback", due: daysFromNow(5) }],
  }],
  [BLOOM, "sold", "Felix Moreau", {
    company: "Café Lumière", title: "Owner", email: "felix@lumiere.example",
    source: "Walk-in", value: 4500, notes: "Logo + menu design delivered.",
    createdDaysAgo: 70, updatedDaysAgo: 15,
    logs: [{ type: "status_change", subject: "Status changed to Sold", body: "Moved from In pipeline to Sold.", daysAgo: 15 }],
  }],
  [BLOOM, "hot_lead", "Iris Yamada", {
    company: "Yamada Ceramics", title: "Artist", email: "iris@yamada.example",
    source: "Referral", value: 6000, createdDaysAgo: 8, updatedDaysAgo: 2,
    tasks: [{ title: "Send packaging quote", due: daysFromNow(2) }],
  }],
  [BLOOM, "cold_lead", "Victor Reyes", {
    company: "Reyes Fitness", source: "List import", value: 0, createdDaysAgo: 6, updatedDaysAgo: 6,
  }],

  [OKAFOR, "recurring", "Beacon Ventures", {
    company: "Beacon Ventures", title: "General Counsel", email: "legal@beacon.example",
    source: "Referral", value: 60000, notes: "Ongoing retainer for portfolio company contracts.",
    createdDaysAgo: 300, updatedDaysAgo: 5,
    logs: [{ type: "meeting", subject: "Monthly review", body: "Reviewed three new vendor MSAs.", daysAgo: 5 }],
    tasks: [{ title: "Draft updated NDA template", due: daysFromNow(6) }],
  }],
  [OKAFOR, "in_pipeline", "Karen Doyle", {
    company: "Doyle & Sons", title: "Operations", email: "karen@doyle.example",
    source: "Inbound", value: 14000, notes: "Trademark filing engagement under review.",
    createdDaysAgo: 18, updatedDaysAgo: 3,
    logs: [{ type: "email", subject: "Engagement letter sent", body: "Awaiting signature.", daysAgo: 3 }],
    tasks: [{ title: "Chase engagement letter", due: daysFromNow(-1) }],
  }],
  [OKAFOR, "contacted", "Mateo Cruz", {
    company: "Cruz Logistics", source: "LinkedIn", value: 8000, createdDaysAgo: 12, updatedDaysAgo: 8,
  }],
];

// --- Cleanup ----------------------------------------------------------------
async function purgeTeam(teamId) {
  for (const coll of ["contact_logs", "tasks", "customers"]) {
    try {
      let docs;
      do {
        docs = (
          await databases.listDocuments(DB_ID, coll, [
            Query.equal("businessId", teamId),
            Query.limit(100),
          ])
        ).documents;
        await Promise.all(docs.map((d) => databases.deleteDocument(DB_ID, coll, d.$id)));
      } while (docs.length === 100);
    } catch {
      /* collection may not exist yet */
    }
  }
  try {
    await teams.delete(teamId);
  } catch {
    /* team may not exist */
  }
}

async function main() {
  console.log("→ Clearing existing seed data…");
  for (const t of TEAMS) await purgeTeam(t.id);
  for (const u of USERS) {
    try {
      await users.delete(u.id);
    } catch {
      /* user may not exist */
    }
  }

  console.log("→ Creating users…");
  for (const u of USERS) {
    await users.create(u.id, u.email, undefined, PASSWORD, u.name);
  }

  console.log("→ Creating businesses (teams) + memberships…");
  for (const t of TEAMS) {
    await teams.create(t.id, t.name);
    await teams.createMembership(t.id, ["owner"], undefined, t.owner.id, undefined, `${APP_URL}/dashboard`);
  }
  // Dana invited Sam to collaborate on Acme.
  await teams.createMembership(ACME.id, ["member"], undefined, SAM.id, undefined, `${APP_URL}/dashboard`);

  console.log(`→ Creating ${customers.length} customers (+ logs & tasks)…`);
  let logCount = 0;
  let taskCount = 0;
  for (const [team, status, name, opts = {}] of customers) {
    const createdBy = opts.createdBy ?? team.owner;
    const created_at = daysAgo(opts.createdDaysAgo ?? 60);
    const updated_at = daysAgo(opts.updatedDaysAgo ?? 20);

    const customer = await databases.createDocument(
      DB_ID,
      "customers",
      ID.unique(),
      {
        businessId: team.id,
        name,
        email: opts.email ?? null,
        phone: opts.phone ?? null,
        company: opts.company ?? null,
        title: opts.title ?? null,
        status,
        source: opts.source ?? null,
        value: opts.value ?? 0,
        notes: opts.notes ?? null,
        created_by: createdBy.id,
        created_at,
        updated_at,
      },
      perms(team.id)
    );

    for (const l of opts.logs ?? []) {
      await databases.createDocument(
        DB_ID,
        "contact_logs",
        ID.unique(),
        {
          customerId: customer.$id,
          businessId: team.id,
          userId: (l.by ?? createdBy).id,
          type: l.type,
          subject: l.subject ?? null,
          body: l.body ?? null,
          created_at: daysAgo(l.daysAgo ?? 5),
        },
        perms(team.id)
      );
      logCount++;
    }

    for (const tk of opts.tasks ?? []) {
      await databases.createDocument(
        DB_ID,
        "tasks",
        ID.unique(),
        {
          businessId: team.id,
          customerId: customer.$id,
          userId: (tk.by ?? createdBy).id,
          title: tk.title,
          due_at: tk.due ?? null,
          done: tk.done ?? false,
          created_at: daysAgo(tk.createdDaysAgo ?? 10),
        },
        perms(team.id)
      );
      taskCount++;
    }
  }

  console.log(`  ${customers.length} customers, ${logCount} logs, ${taskCount} tasks.`);
  console.log("\n✓ Seed complete.\n");
  console.log("  Log in at http://localhost:3000/login with:");
  console.log("    dana@relay.test / password123   (owns Acme Consulting + Bloom Studio)");
  console.log("    sam@relay.test  / password123   (owns Okafor Legal, member of Acme)\n");
}

main().catch((err) => {
  console.error("✖ Seed failed:", err?.message ?? err);
  process.exit(1);
});
