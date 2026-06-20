import { ID } from "node-appwrite";
import { createSessionClient } from "@/lib/appwrite";
import { currentUser, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT } from "@/lib/validation";

// List every business (Team) the signed-in user belongs to.
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError("Not signed in.", 401);

  const session = createSessionClient();
  if (!session) return jsonError("Not signed in.", 401);

  let teamList;
  try {
    teamList = await session.teams.list();
  } catch {
    return jsonError("Could not load businesses.", 500);
  }

  const businesses = await Promise.all(
    teamList.teams.map(async (t) => ({
      id: t.$id,
      name: t.name,
      owner_id: "",
      role: (await membershipRole(user.id, t.$id)) ?? "member",
      created_at: t.$createdAt,
    }))
  );

  businesses.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return Response.json({ businesses });
}

// Create a new business (Team); the creator becomes its owner.
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return jsonError("Not signed in.", 401);

  const session = createSessionClient();
  if (!session) return jsonError("Not signed in.", 401);

  const { name } = await req.json().catch(() => ({}));
  const clean = cleanText(name, MAX_SHORT);
  if (!clean) return jsonError("Business name is required.");

  try {
    const team = await session.teams.create(ID.unique(), clean, ["owner"]);
    return Response.json({
      business: {
        id: team.$id,
        name: team.name,
        owner_id: user.id,
        role: "owner",
        created_at: team.$createdAt,
      },
    });
  } catch {
    return jsonError("Could not create business.", 500);
  }
}
