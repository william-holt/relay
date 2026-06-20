import { Query } from "node-appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { isValidEmail } from "@/lib/validation";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

// List the members of a business (any member can view).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if (!(await membershipRole(userId, params.id)))
    return jsonError("No access to this business.", 403);

  try {
    const { teams } = createAdminClient();
    const res = await teams.listMemberships(params.id);
    const members = res.memberships.map((m) => ({
      id: m.userId,
      membershipId: m.$id,
      name: m.userName || null,
      email: m.userEmail,
      role: m.roles.includes("owner") ? "owner" : "member",
      confirmed: m.confirm,
      joinedAt: m.joined,
    }));
    return Response.json({ members });
  } catch {
    return jsonError("Could not load members.", 500);
  }
}

// Add an existing registered user to a business (owner only).
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

  try {
    const { users, teams } = createAdminClient();
    const found = await users.list([Query.equal("email", normalized), Query.limit(1)]);
    const user = found.users[0];
    if (!user)
      return jsonError(
        "No Relay account exists for that email. Ask them to sign up first."
      );

    const membership = await teams.createMembership(
      params.id,
      [memberRole],
      undefined,
      user.$id,
      undefined,
      `${APP_URL}/dashboard`
    );

    return Response.json({
      member: {
        id: user.$id,
        membershipId: membership.$id,
        name: user.name || null,
        email: user.email,
        role: memberRole,
      },
    });
  } catch {
    return jsonError("Could not add member.", 500);
  }
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
  if (targetUserId === userId)
    return jsonError("You can't remove yourself from a business you own.");

  try {
    const { teams } = createAdminClient();
    const res = await teams.listMemberships(params.id, [
      Query.equal("userId", targetUserId),
      Query.limit(1),
    ]);
    const membership = res.memberships[0];
    if (!membership) return jsonError("That person isn't a member.", 404);

    await teams.deleteMembership(params.id, membership.$id);
    return Response.json({ ok: true });
  } catch {
    return jsonError("Could not remove member.", 500);
  }
}
