import { withAuth } from "next-auth/middleware";

// Bounce unauthenticated visitors to our custom /login page.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/dashboard/:path*", "/customers/:path*", "/settings/:path*"],
};
