import {
  createAdminClient,
  mapTemplate,
  DATABASE_ID,
  EMAIL_TEMPLATES,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT, MAX_EMAIL_BODY } from "@/lib/validation";

async function loadTemplate(userId: string, templateId: string) {
  const { databases } = createAdminClient();
  let tpl;
  try {
    tpl = await databases.getDocument(DATABASE_ID, EMAIL_TEMPLATES, templateId);
  } catch {
    return { error: jsonError("Template not found.", 404) };
  }
  if (!(await membershipRole(userId, tpl.businessId)))
    return { error: jsonError("No access to this template.", 403) };
  return { tpl };
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadTemplate(userId, params.id);
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if ("name" in body) {
    const name = cleanText(body.name, MAX_SHORT);
    if (!name) return jsonError("Template name can't be empty.");
    update.name = name;
  }
  if ("subject" in body) update.subject = cleanText(body.subject, MAX_SHORT) ?? "";
  if ("body" in body) update.body = cleanText(body.body, MAX_EMAIL_BODY) ?? "";

  try {
    const { databases } = createAdminClient();
    const doc = await databases.updateDocument(
      DATABASE_ID,
      EMAIL_TEMPLATES,
      params.id,
      update
    );
    return Response.json({ template: mapTemplate(doc) });
  } catch {
    return jsonError("Could not update template.", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await loadTemplate(userId, params.id);
  if (error) return error;

  try {
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, EMAIL_TEMPLATES, params.id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not delete template.", 500);
  }
}
