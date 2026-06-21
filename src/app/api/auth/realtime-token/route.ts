import { createSessionClient } from "@/lib/appwrite";
import { jsonError } from "@/lib/authz";

// Mints a short-lived Appwrite JWT so the browser's Realtime client can
// subscribe to changes on documents the signed-in user is allowed to read.
export async function GET() {
  const session = createSessionClient();
  if (!session) return jsonError("Not signed in.", 401);

  try {
    const { jwt } = await session.account.createJWT();
    return Response.json({
      jwt,
      endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT,
      project: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID,
      databaseId: process.env.APPWRITE_DATABASE_ID ?? "relay",
    });
  } catch {
    return jsonError("Could not create a realtime token.", 500);
  }
}
