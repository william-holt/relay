import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/cookies";

// Bounce visitors without a session cookie to /login. The session is fully
// validated in server components / API routes; this is just a fast gate.
export function middleware(req: NextRequest) {
  if (!req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/customers/:path*",
    "/research/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
