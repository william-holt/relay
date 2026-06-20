import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { supabaseAdmin } from "./supabase";

/** Returns the current user id, or null if not signed in. */
export async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

/**
 * Confirms the signed-in user belongs to a business.
 * Returns the member role ('owner' | 'member') or null if not a member.
 */
export async function membershipRole(
  userId: string,
  businessId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("business_members")
    .select("role")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  return data?.role ?? null;
}

/** Small helper for consistent JSON errors in route handlers. */
export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
