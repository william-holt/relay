import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  mapTemplate,
  DATABASE_ID,
  EMAIL_TEMPLATES,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT, MAX_EMAIL_BODY } from "@/lib/validation";

// List email templates for a business (?businessId=...).
export async function GET(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  try {
    const { databases } = createAdminClient();
    const res = await databases.listDocuments(DATABASE_ID, EMAIL_TEMPLATES, [
      Query.equal("businessId", businessId),
      Query.orderAsc("name"),
      Query.limit(200),
    ]);
    return Response.json({ templates: res.documents.map(mapTemplate) });
  } catch {
    return jsonError("Could not load templates.", 500);
  }
}

// Create an email template.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const body = await req.json().catch(() => ({}));
  const { businessId } = body;
  if (!businessId) return jsonError("businessId is required.");
  if (!(await membershipRole(userId, businessId)))
    return jsonError("No access to this business.", 403);

  const name = cleanText(body.name, MAX_SHORT);
  const subject = cleanText(body.subject, MAX_SHORT);
  const templateBody = cleanText(body.body, MAX_EMAIL_BODY);
  if (!name) return jsonError("Template name is required.");
  if (!subject && !templateBody)
    return jsonError("Add a subject or body to the template.");

  try {
    const { databases } = createAdminClient();
    const doc = await databases.createDocument(
      DATABASE_ID,
      EMAIL_TEMPLATES,
      ID.unique(),
      { businessId, name, subject: subject ?? "", body: templateBody ?? "" },
      [
        Permission.read(Role.team(businessId)),
        Permission.update(Role.team(businessId)),
        Permission.delete(Role.team(businessId)),
      ]
    );
    return Response.json({ template: mapTemplate(doc) });
  } catch {
    return jsonError("Could not create template.", 500);
  }
}
