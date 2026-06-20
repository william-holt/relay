import { cookies } from "next/headers";
import { createSessionClient } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/cookies";

export async function POST() {
  const session = createSessionClient();
  if (session) {
    try {
      await session.account.deleteSession("current");
    } catch {
      // Session may already be invalid; clearing the cookie is enough.
    }
  }
  cookies().delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
