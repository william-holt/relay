import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { isValidEmail } from "@/lib/validation";

// List the members of a business (any member can view).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if (!(await membershipRole(userId, params.id)))
    return jsonError("No access to this business.", 403);

  const { data, error } = await supabaseAdmin
    .from("business_members")
    .select("role, created_at, users(id, name, email)")
    .eq("business_id", params.id);

  if (error) return jsonError("Could not load members.", 500);

  const members = (data ?? [])
    .map((row: any) => row.users && { ...row.users, role: row.role, joinedAt: row.created_at })
    .filter(Boolean);

  return Response.json({ members });
}

// Add an existing registered user to a business as a member (owner only).
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if ((await membershipRole(userId, params.id)) !== "owner")
    return jsonError("Only the owner can add members.", 403);

  const { email, role } = await req.json().catch(() => ({}));
  if (!isValidEmail(email)) return jsonError("Enter a valid email address.");
  const memberRole = role === "owner" ? "owner" : "member";
  const normalized = String(email).trim().toLowerCase();

  const { data: user } = await supabaseAdmin
    .from("users")
    .select("id, name, email")
    .eq("email", normalized)
    .maybeSingle();

  // Don't reveal whether an email is registered; ask them to sign up first.
  if (!user)
    return jsonError(
      "No Relay account exists for that email. Ask them to sign up first."
    );

  const { error } = await supabaseAdmin
    .from("business_members")
    .upsert(
      { business_id: params.id, user_id: user.id, role: memberRole },
      { onConflict: "business_id,user_id" }
    );

  if (error) return jsonError("Could not add member.", 500);
  return Response.json({ member: { ...user, role: memberRole } });
}

// Remove a member from a business (owner only).
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if ((await membershipRole(userId, params.id)) !== "owner")
    return jsonError("Only the owner can remove members.", 403);

  const { searchParams } = new URL(req.url);
  const targetUserId = searchParams.get("userId");
  if (!targetUserId) return jsonError("userId is required.");

  // Never strip the business owner of their own membership.
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (biz?.owner_id === targetUserId)
    return jsonError("The business owner can't be removed.");

  const { error } = await supabaseAdmin
    .from("business_members")
    .delete()
    .eq("business_id", params.id)
    .eq("user_id", targetUserId);

  if (error) return jsonError("Could not remove member.", 500);
  return Response.json({ ok: true });
}
