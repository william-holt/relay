import { Webhook } from "svix";
import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  DATABASE_ID,
  CUSTOMERS,
  CONTACT_LOGS,
} from "@/lib/appwrite";
import { cleanText, MAX_SHORT, MAX_TEXT } from "@/lib/validation";

// Receives inbound emails forwarded by Resend and appends them to the timeline
// of any customer whose email matches the sender. Verified with Svix (the
// signing scheme Resend uses) — set RESEND_WEBHOOK_SECRET to the endpoint's
// secret from the Resend dashboard.
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[inbound] RESEND_WEBHOOK_SECRET is not set");
    return new Response("Webhook not configured.", { status: 500 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: any;
  try {
    event = new Webhook(secret).verify(payload, headers);
  } catch {
    return new Response("Invalid signature.", { status: 401 });
  }

  const data = event?.data ?? {};
  const fromRaw: string = data.from ?? data.sender ?? "";
  const match = String(fromRaw).match(/[^\s<>"]+@[^\s<>"]+/);
  const sender = match ? match[0].toLowerCase() : "";
  if (!sender) return Response.json({ ok: true, matched: 0 });

  const subject = cleanText(data.subject, MAX_SHORT);
  const text = cleanText(data.text ?? data.body ?? data.html, MAX_TEXT);

  const { databases } = createAdminClient();
  const res = await databases.listDocuments(DATABASE_ID, CUSTOMERS, [
    Query.equal("email", sender),
    Query.limit(25),
  ]);

  const now = new Date().toISOString();
  await Promise.all(
    res.documents.map(async (c) => {
      await databases.createDocument(
        DATABASE_ID,
        CONTACT_LOGS,
        ID.unique(),
        {
          customerId: c.$id,
          businessId: c.businessId,
          userId: null,
          type: "email",
          direction: "inbound",
          subject: subject ?? "(no subject)",
          body: text,
          created_at: now,
        },
        [
          Permission.read(Role.team(c.businessId)),
          Permission.update(Role.team(c.businessId)),
          Permission.delete(Role.team(c.businessId)),
        ]
      );
      await databases.updateDocument(DATABASE_ID, CUSTOMERS, c.$id, {
        updated_at: now,
      });
    })
  );

  return Response.json({ ok: true, matched: res.documents.length });
}
