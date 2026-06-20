import { supabaseAdmin } from "@/lib/supabase";
import { currentUserId, jsonError } from "@/lib/authz";

// List every business the signed-in user belongs to.
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { data, error } = await supabaseAdmin
    .from("business_members")
    .select("role, businesses(id, name, owner_id, created_at)")
    .eq("user_id", userId);

  if (error) return jsonError("Could not load businesses.", 500);

  const businesses = (data ?? [])
    .map((row: any) => row.businesses && { ...row.businesses, role: row.role })
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  return Response.json({ businesses });
}

// Create a new business and make the creator its owner.
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);

  const { name } = await req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return jsonError("Business name is required.");

  const { data: biz, error } = await supabaseAdmin
    .from("businesses")
    .insert({ name: String(name).trim(), owner_id: userId })
    .select("id, name, owner_id, created_at")
    .single();

  if (error || !biz) return jsonError("Could not create business.", 500);

  await supabaseAdmin
    .from("business_members")
    .insert({ business_id: biz.id, user_id: userId, role: "owner" });

  return Response.json({ business: { ...biz, role: "owner" } });
}
