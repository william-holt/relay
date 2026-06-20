import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";

// Rename a business (owner only).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const role = await membershipRole(userId, params.id);
  if (role !== "owner") return jsonError("Only the owner can edit this business.", 403);

  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return jsonError("Business name is required.");

  const { data, error } = await supabaseAdmin
    .from("businesses")
    .update({ name: String(name).trim() })
    .eq("id", params.id)
    .select("id, name, owner_id, created_at")
    .single();

  if (error) return jsonError("Could not update business.", 500);
  return Response.json({ business: { ...data, role } });
}

// Delete a business (owner only).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const role = await membershipRole(userId, params.id);
  if (role !== "owner") return jsonError("Only the owner can delete this business.", 403);

  const { error } = await supabaseAdmin.from("businesses").delete().eq("id", params.id);
  if (error) return jsonError("Could not delete business.", 500);
  return Response.json({ ok: true });
}
