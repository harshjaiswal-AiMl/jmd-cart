import { NextRequest } from "next/server";
import { MobileAuthService } from "./mobile-auth.service";
import { prisma } from "@/lib/prisma";

export async function getMobileAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  const payload = MobileAuthService.verifyAccessToken(token);
  if (!payload) {
    return null;
  }

  // Fetch fresh user from DB to ensure still active and permissions current
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || !user.active) {
    return null;
  }

  return MobileAuthService.sanitizeUser(user);
}
