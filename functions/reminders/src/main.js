import { Client, Databases, Teams, Query } from "node-appwrite";
import { Resend } from "resend";

// Scheduled digest: for every business (Team), email each confirmed member a
// summary of open follow-ups that are due soon/overdue plus deals that have
// gone quiet. Intended to run on a daily CRON schedule (e.g. "0 13 * * *").

const DB_ID = process.env.APPWRITE_DATABASE_ID || "relay";
const STALE_DAYS = 14;
const DUE_WINDOW_DAYS = 2;
const CLOSED = ["sold", "recurring", "lost"];

export default async ({ req, res, log, error }) => {
  const endpoint =
    process.env.APPWRITE_FUNCTION_API_ENDPOINT ||
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const project =
    process.env.APPWRITE_FUNCTION_PROJECT_ID ||
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  // Appwrite injects a per-execution dynamic key; fall back to a stored key.
  const apiKey = req.headers["x-appwrite-key"] || process.env.APPWRITE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Relay CRM <onboarding@resend.dev>";
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!apiKey || !resendKey) {
    error("Missing API key or RESEND_API_KEY.");
    return res.json({ ok: false, error: "Not configured" }, 500);
  }

  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey);
  const databases = new Databases(client);
  const teams = new Teams(client);
  const resend = new Resend(resendKey);

  const now = Date.now();
  const dueThreshold = new Date(now + DUE_WINDOW_DAYS * 86_400_000).toISOString();
  const staleCutoff = now - STALE_DAYS * 86_400_000;

  // Page through all businesses.
  const allTeams = [];
  let cursor;
  for (;;) {
    const q = [Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const r = await teams.list(q);
    allTeams.push(...r.teams);
    if (r.teams.length < 100) break;
    cursor = r.teams[r.teams.length - 1].$id;
  }

  let sent = 0;
  for (const team of allTeams) {
    const tasks = (
      await databases.listDocuments(DB_ID, "tasks", [
        Query.equal("businessId", team.$id),
        Query.equal("done", false),
        Query.lessThanEqual("due_at", dueThreshold),
        Query.orderAsc("due_at"),
        Query.limit(50),
      ])
    ).documents;

    const customers = (
      await databases.listDocuments(DB_ID, "customers", [
        Query.equal("businessId", team.$id),
        Query.limit(200),
      ])
    ).documents;
    const stale = customers
      .filter(
        (c) =>
          !CLOSED.includes(c.status) &&
          new Date(c.updated_at || c.$updatedAt).getTime() < staleCutoff
      )
      .slice(0, 10);

    if (tasks.length === 0 && stale.length === 0) continue;

    const members = (
      await teams.listMemberships(team.$id, [Query.limit(50)])
    ).memberships.filter((m) => m.confirm && m.userEmail);
    if (members.length === 0) continue;

    const html = buildHtml(team.name, tasks, stale, appUrl, now);
    const subject = `Relay — your ${team.name} follow-ups`;
    for (const m of members) {
      try {
        await resend.emails.send({ from, to: m.userEmail, subject, html });
        sent++;
      } catch (e) {
        error(`send failed for ${m.userEmail}: ${e.message}`);
      }
    }
  }

  log(`Sent ${sent} digest email(s) across ${allTeams.length} business(es).`);
  return res.json({ ok: true, sent, businesses: allTeams.length });
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
  );
}

function buildHtml(businessName, tasks, stale, appUrl, now) {
  const overdue = tasks.filter((t) => new Date(t.due_at).getTime() < now);
  const dueSoon = tasks.filter((t) => new Date(t.due_at).getTime() >= now);

  const taskItem = (t) =>
    `<li style="margin:4px 0">${esc(t.title)} <span style="color:#94a3b8">— due ${esc(
      new Date(t.due_at).toLocaleDateString()
    )}</span></li>`;
  const customerItem = (c) =>
    `<li style="margin:4px 0"><a href="${appUrl}/customers/${c.$id}" style="color:#4f46e5;text-decoration:none">${esc(
      c.name
    )}</a>${c.company ? ` <span style="color:#94a3b8">· ${esc(c.company)}</span>` : ""}</li>`;

  const section = (title, items) =>
    items.length
      ? `<h3 style="font-size:14px;margin:20px 0 6px">${title}</h3><ul style="padding-left:18px;margin:0;font-size:14px;color:#0c1322">${items.join(
          ""
        )}</ul>`
      : "";

  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0c1322">
    <div style="font-weight:700;font-size:18px;margin-bottom:4px">Relay</div>
    <p style="font-size:14px;color:#64748b;margin:0 0 8px">Daily follow-ups for <strong>${esc(
      businessName
    )}</strong></p>
    ${section("⏰ Overdue", overdue.map(taskItem))}
    ${section("📅 Due soon", dueSoon.map(taskItem))}
    ${section("💤 Going quiet (no activity in 14+ days)", stale.map(customerItem))}
    <p style="margin-top:24px"><a href="${appUrl}/dashboard" style="background:#4f46e5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px;display:inline-block">Open dashboard</a></p>
  </div>`;
}
