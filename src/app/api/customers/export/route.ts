import { Query } from "node-appwrite";
import { createAdminClient, mapCustomer, DATABASE_ID, CUSTOMERS } from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";

const COLUMNS = [
  "name",
  "email",
  "phone",
  "company",
  "title",
  "status",
  "source",
  "value",
  "notes",
  "created_at",
  "updated_at",
] as const;

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Quote if it contains a comma, quote, or newline; escape embedded quotes.
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Download all customers for a business as CSV (?businessId=...).
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  const { databases } = createAdminClient();
  const rows: ReturnType<typeof mapCustomer>[] = [];
  let cursor: string | undefined;
  // Page through everything so export isn't capped.
  for (;;) {
    const queries = [
      Query.equal("businessId", businessId),
      Query.orderAsc("created_at"),
      Query.limit(100),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(DATABASE_ID, CUSTOMERS, queries);
    rows.push(...res.documents.map(mapCustomer));
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }

  const header = COLUMNS.join(",");
  const lines = rows.map((r) =>
    COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(",")
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="customers-${businessId}.csv"`,
    },
  });
}
