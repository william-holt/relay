import { ID, Permission, Query, Role } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import {
  createAdminClient,
  mapAttachment,
  DATABASE_ID,
  CUSTOMERS,
  ATTACHMENTS,
  BUCKET_ATTACHMENTS,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

async function guard(userId: string, customerId: string) {
  const { databases } = createAdminClient();
  let customer;
  try {
    customer = await databases.getDocument(DATABASE_ID, CUSTOMERS, customerId);
  } catch {
    return { error: jsonError("Customer not found.", 404) };
  }
  if (!(await membershipRole(userId, customer.businessId)))
    return { error: jsonError("No access to this customer.", 403) };
  return { customer };
}

// List a customer's attachments.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { error } = await guard(userId, params.id);
  if (error) return error;

  try {
    const { databases } = createAdminClient();
    const res = await databases.listDocuments(DATABASE_ID, ATTACHMENTS, [
      Query.equal("customerId", params.id),
      Query.orderDesc("created_at"),
      Query.limit(200),
    ]);
    return Response.json({ files: res.documents.map(mapAttachment) });
  } catch {
    return jsonError("Could not load files.", 500);
  }
}

// Upload a file (multipart/form-data, field "file") and attach it to a customer.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { customer, error } = await guard(userId, params.id);
  if (error) return error;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError("No file provided.");
  if (file.size === 0) return jsonError("That file is empty.");
  if (file.size > MAX_FILE_BYTES) return jsonError("Files must be 10 MB or smaller.");

  const businessId = customer!.businessId as string;
  const perms = [
    Permission.read(Role.team(businessId)),
    Permission.delete(Role.team(businessId)),
  ];

  try {
    const { databases, storage } = createAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storage.createFile(
      BUCKET_ATTACHMENTS,
      ID.unique(),
      InputFile.fromBuffer(buffer, file.name),
      perms
    );

    const doc = await databases.createDocument(
      DATABASE_ID,
      ATTACHMENTS,
      ID.unique(),
      {
        businessId,
        customerId: params.id,
        fileId: stored.$id,
        name: file.name,
        size: file.size,
        mime: file.type || null,
        uploadedBy: userId,
        created_at: new Date().toISOString(),
      },
      [
        Permission.read(Role.team(businessId)),
        Permission.update(Role.team(businessId)),
        Permission.delete(Role.team(businessId)),
      ]
    );

    return Response.json({ file: mapAttachment(doc) });
  } catch {
    return jsonError("Could not upload the file.", 500);
  }
}
