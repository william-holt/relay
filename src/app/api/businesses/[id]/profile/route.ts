import { ID, Permission, Query, Role } from "node-appwrite";
import {
  createAdminClient,
  mapProfile,
  DATABASE_ID,
  BUSINESS_PROFILES,
} from "@/lib/appwrite";
import { currentUserId, membershipRole, jsonError } from "@/lib/authz";
import { cleanText, MAX_SHORT, MAX_TEXT } from "@/lib/validation";

async function findProfile(businessId: string) {
  const { databases } = createAdminClient();
  const res = await databases.listDocuments(DATABASE_ID, BUSINESS_PROFILES, [
    Query.equal("businessId", businessId),
    Query.limit(1),
  ]);
  return res.documents[0] ?? null;
}

// Get the business profile (used to tailor AI research + messaging).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if (!(await membershipRole(userId, params.id)))
    return jsonError("No access to this business.", 403);

  try {
    const doc = await findProfile(params.id);
    return Response.json({
      profile: doc
        ? mapProfile(doc)
        : {
            business_id: params.id,
            industry: "",
            description: "",
            value_proposition: "",
            icp: "",
            target_titles: "",
            locations: "",
            website: "",
          },
    });
  } catch {
    return jsonError("Could not load the business profile.", 500);
  }
}

// Create or update the business profile.
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const userId = await currentUserId();
  if (!userId) return jsonError("Not signed in.", 401);
  if (!(await membershipRole(userId, params.id)))
    return jsonError("No access to this business.", 403);

  const body = await req.json().catch(() => ({}));
  const data = {
    businessId: params.id,
    industry: cleanText(body.industry, MAX_SHORT) ?? "",
    description: cleanText(body.description, MAX_TEXT) ?? "",
    value_proposition: cleanText(body.value_proposition, MAX_TEXT) ?? "",
    icp: cleanText(body.icp, MAX_TEXT) ?? "",
    target_titles: cleanText(body.target_titles, MAX_SHORT) ?? "",
    locations: cleanText(body.locations, MAX_SHORT) ?? "",
    website: cleanText(body.website, MAX_SHORT) ?? "",
  };

  try {
    const { databases } = createAdminClient();
    const existing = await findProfile(params.id);
    const doc = existing
      ? await databases.updateDocument(
          DATABASE_ID,
          BUSINESS_PROFILES,
          existing.$id,
          data
        )
      : await databases.createDocument(
          DATABASE_ID,
          BUSINESS_PROFILES,
          ID.unique(),
          data,
          [
            Permission.read(Role.team(params.id)),
            Permission.update(Role.team(params.id)),
            Permission.delete(Role.team(params.id)),
          ]
        );
    return Response.json({ profile: mapProfile(doc) });
  } catch {
    return jsonError("Could not save the business profile.", 500);
  }
}
