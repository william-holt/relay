import { createAdminClient, purgeBusiness } from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT } from "@/lib/validation";

// Rename a business (owner only).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const role = await membershipRole(userId, params.id);
  if (role !== "owner")
    return jsonError("Only the owner can edit this business.", 403);

  const { name } = await req.json().catch(() => ({}));
  const clean = cleanText(name, MAX_SHORT);
  if (!clean) return jsonError("Business name is required.");

  try {
    const { teams } = createAdminClient();
    const team = await teams.updateName(params.id, clean);
    return Response.json({
      business: {
        id: team.$id,
        name: team.name,
        owner_id: "",
        role,
        created_at: team.$createdAt,
      },
    });
  } catch {
    return jsonError("Could not update business.", 500);
  }
}

// Delete a business and all of its data (owner only).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const role = await membershipRole(userId, params.id);
  if (role !== "owner")
    return jsonError("Only the owner can delete this business.", 403);

  try {
    const { teams, databases } = createAdminClient();
    // No FK cascade in Appwrite — remove the business's documents first.
    await purgeBusiness(databases, params.id);
    await teams.delete(params.id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not delete business.", 500);
  }
}
