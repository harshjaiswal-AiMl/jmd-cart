import { UserRole } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    phone: string;
    role: UserRole;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      phone: string;
      role: UserRole;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    phone?: string;
    mustChangePassword?: boolean;
  }
}
