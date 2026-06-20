import { cookies } from "next/headers";
import { AppwriteException, ID } from "node-appwrite";
import { createAdminClient, sessionClientFromSecret } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/cookies";
import { jsonError } from "@/lib/authz";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";
import { isValidEmail, cleanText, MAX_SHORT } from "@/lib/validation";

export async function POST(req: Request) {
  if (!rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000).ok)
    return tooManyRequests(60 * 60);

  const { name, email, password } = await req.json().catch(() => ({}));

  if (!email || !password) return jsonError("Email and password are required.");
  if (!isValidEmail(email)) return jsonError("Enter a valid email address.");
  if (String(password).length < 8)
    return jsonError("Password must be at least 8 characters.");

  const normalized = String(email).trim().toLowerCase();
  const cleanName = cleanText(name, MAX_SHORT);

  const admin = createAdminClient();

  // 1. Create the Appwrite account.
  try {
    await admin.account.create(
      ID.unique(),
      normalized,
      String(password),
      cleanName ?? undefined
    );
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 409)
      return jsonError("An account with that email already exists.");
    return jsonError("Could not create account.", 500);
  }

  // 2. Sign them in (so we can act as them) and set the session cookie.
  let secret: string;
  try {
    const session = await admin.account.createEmailPasswordSession(
      normalized,
      String(password)
    );
    secret = session.secret;
    cookies().set(SESSION_COOKIE, secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expire),
    });
  } catch {
    // Account exists but sign-in failed — let them log in manually.
    return Response.json({ ok: true });
  }

  // 3. Bootstrap a first business (Team) owned by the new user. Creating the
  //    team as the user makes them its owner automatically.
  try {
    const asUser = sessionClientFromSecret(secret);
    const bizName = cleanName ? `${cleanName}'s workspace` : "My business";
    await asUser.teams.create(ID.unique(), bizName, ["owner"]);
  } catch {
    // Non-fatal: they can create a business from Settings.
  }

  return Response.json({ ok: true });
}
