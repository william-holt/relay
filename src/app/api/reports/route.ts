import { Query } from "node-appwrite";
import {
  createAdminClient,
  mapCustomer,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { STATUS_ORDER, statusMeta } from "@/lib/status";

const PIPELINE_FLOW = [
  "cold_lead",
  "hot_lead",
  "outreach",
  "contacted",
  "in_pipeline",
  "sold",
] as const;

// Analytics for a business: funnel, win rate, weighted forecast, activity.
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  const { databases } = createAdminClient();

  // Pull all customers (paged) for accurate aggregates.
  const customers: ReturnType<typeof mapCustomer>[] = [];
  let cursor: string | undefined;
  for (;;) {
    const q = [Query.equal("businessId", businessId), Query.orderAsc("created_at"), Query.limit(100)];
    if (cursor) q.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DATABASE_ID, CUSTOMERS, q);
    customers.push(...res.documents.map(mapCustomer));
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }

  const count = (s: string) => customers.filter((c) => c.status === s).length;

  // Funnel: how many customers have reached at least each stage. Because the
  // lifecycle is linear, "reached stage N" ≈ count at stages >= N.
  const flowIndex = (s: string) => PIPELINE_FLOW.indexOf(s as never);
  const reachedAtLeast = (idx: number) =>
    customers.filter((c) => {
      const i = flowIndex(c.status);
      return i >= idx && i !== -1;
    }).length;

  const funnel = PIPELINE_FLOW.map((s, i) => {
    const reached = reachedAtLeast(i);
    const prev = i === 0 ? reached : reachedAtLeast(i - 1);
    return {
      status: s,
      label: statusMeta(s).label,
      color: statusMeta(s).color,
      reached,
      conversionFromPrev: prev > 0 ? reached / prev : 0,
    };
  });

  const wonCount = customers.filter((c) => statusMeta(c.status).won).length;
  const lostCount = count("lost");
  const closed = wonCount + lostCount;
  const winRate = closed > 0 ? wonCount / closed : 0;

  // Weighted pipeline forecast: open deals × stage probability.
  const openDeals = customers.filter(
    (c) => !["sold", "recurring", "lost"].includes(c.status)
  );
  const weightedPipeline = openDeals.reduce(
    (sum, c) => sum + Number(c.value ?? 0) * statusMeta(c.status).probability,
    0
  );
  const openPipeline = openDeals.reduce((sum, c) => sum + Number(c.value ?? 0), 0);
  const wonValue = customers
    .filter((c) => statusMeta(c.status).won)
    .reduce((sum, c) => sum + Number(c.value ?? 0), 0);

  const byStatus = STATUS_ORDER.map((s) => ({
    status: s,
    label: statusMeta(s).label,
    color: statusMeta(s).color,
    count: count(s),
  }));

  // Activity: interactions per week for the last 8 weeks.
  let logs: { created_at: string }[] = [];
  try {
    const res = await databases.listDocuments(DATABASE_ID, CONTACT_LOGS, [
      Query.equal("businessId", businessId),
      Query.limit(1000),
    ]);
    logs = res.documents.map((d) => ({ created_at: d.created_at ?? d.$createdAt }));
  } catch {
    logs = [];
  }

  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  const activity = Array.from({ length: 8 }).map((_, idx) => {
    const weeksAgo = 7 - idx;
    const start = now - (weeksAgo + 1) * WEEK;
    const end = now - weeksAgo * WEEK;
    const c = logs.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= start && t < end;
    }).length;
    return { weeksAgo, count: c };
  });

  return Response.json({
    totals: {
      customers: customers.length,
      won: wonCount,
      lost: lostCount,
      winRate,
      openPipeline,
      weightedPipeline,
      wonValue,
    },
    funnel,
    byStatus,
    activity,
  });
}
