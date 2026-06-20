import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase";
import { rateLimit } from "./rate-limit";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();

        // Throttle credential attempts per email + per client IP to slow down
        // brute-force / credential-stuffing. (Best-effort, in-memory.)
        const xff =
          (req?.headers?.["x-forwarded-for"] as string | undefined) ?? "";
        const ip = xff.split(",")[0]?.trim() || "unknown";
        if (!rateLimit(`login:${email}`, 10, 15 * 60_000).ok) return null;
        if (!rateLimit(`login-ip:${ip}`, 50, 15 * 60_000).ok) return null;

        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select("id, email, name, password_hash")
          .eq("email", email)
          .maybeSingle();

        if (error || !user) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? null };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
