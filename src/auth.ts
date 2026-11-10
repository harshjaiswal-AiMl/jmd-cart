import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { authService } from "@/modules/auth/auth.service";
import { ensureRolePermissionsLoaded } from "@/modules/auth/role-matrix.service";

const loginSchema = z.object({
  phone: z.string().min(3, "Mobile number or email is required"),
  password: z.string().min(1, "Password is required"),
});

const nextAuth = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }

        try {
          const user = await authService.authenticateWithCredentials(
            parsed.data.phone,
            parsed.data.password
          );
          return user;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.AUTH_SECRET,
});

export const { handlers, signIn, signOut } = nextAuth;

export const auth: typeof nextAuth.auth = (async (...args: any[]) => {
  const session = await (nextAuth.auth as any)(...args);
  if (session && typeof session === "object" && "user" in session && session.user) {
    try {
      await ensureRolePermissionsLoaded();
    } catch {
      // Fallback safely to static ROLE_PERMISSIONS if DB unavailable
    }
  }
  return session;
}) as typeof nextAuth.auth;
