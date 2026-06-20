import { Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "./appwrite";

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
}

/** Returns the signed-in user, or null. */
export async function currentUser(): Promise<CurrentUser | null> {
  const session = createSessionClient();
  if (!session) return null;
  try {
    const u = await session.account.get();
    return { id: u.$id, email: u.email, name: u.name || null };
  } catch {
    return null;
  }
}

/** Returns the current user id, or null if not signed in. */
export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

/**
 * Confirms the user belongs to a business (Appwrite Team) and returns their
 * role ('owner' | 'member'), or null if they're not a confirmed member.
 */
export async function membershipRole(
  userId: string,
  businessId: string
): Promise<string | null> {
  try {
    const { teams } = createAdminClient();
    const res = await teams.listMemberships(businessId, [
      Query.equal("userId", userId),
      Query.limit(1),
    ]);
    const m = res.memberships[0];
    if (!m || !m.confirm) return null;
    return m.roles.includes("owner") ? "owner" : "member";
  } catch {
    return null;
  }
}

/** Small helper for consistent JSON errors in route handlers. */
export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
