import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/appwrite";
import { SESSION_COOKIE } from "@/lib/cookies";
import { jsonError } from "@/lib/authz";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`login-ip:${ip}`, 50, 15 * 60_000).ok)
    return tooManyRequests(15 * 60);

  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password)
    return jsonError("Email and password are required.");

  const normalized = String(email).trim().toLowerCase();
  if (!rateLimit(`login:${normalized}`, 10, 15 * 60_000).ok)
    return tooManyRequests(15 * 60);

  try {
    const { account } = createAdminClient();
    const session = await account.createEmailPasswordSession(
      normalized,
      String(password)
    );
    cookies().set(SESSION_COOKIE, session.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expire),
    });
    return Response.json({ ok: true });
  } catch {
    return jsonError("That email and password don't match an account.", 401);
  }
}
