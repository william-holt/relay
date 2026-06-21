import {
  createAdminClient,
  DATABASE_ID,
  ATTACHMENTS,
  BUCKET_ATTACHMENTS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";

async function loadAttachment(userId: string, attachmentId: string) {
  const { databases } = createAdminClient();
  let att;
  try {
    att = await databases.getDocument(DATABASE_ID, ATTACHMENTS, attachmentId);
  } catch {
    return { error: jsonError("File not found.", 404) };
  }
  if (!(await membershipRole(userId, att.businessId)))
    return { error: jsonError("No access to this file.", 403) };
  return { att };
}

// Stream a file's contents through our authenticated route.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { att, error } = await loadAttachment(userId, params.id);
  if (error) return error;

  try {
    const { storage } = createAdminClient();
    const bytes = await storage.getFileView(BUCKET_ATTACHMENTS, att!.fileId);
    return new Response(bytes, {
      headers: {
        "Content-Type": att!.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(att!.name)}"`,
      },
    });
  } catch {
    return jsonError("Could not load the file.", 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { att, error } = await loadAttachment(userId, params.id);
  if (error) return error;

  try {
    const { databases, storage } = createAdminClient();
    try {
      await storage.deleteFile(BUCKET_ATTACHMENTS, att!.fileId);
    } catch {
      // File already gone — still remove the record.
    }
    await databases.deleteDocument(DATABASE_ID, ATTACHMENTS, params.id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not delete the file.", 500);
  }
}
