import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { canAccessRoute } from "@/modules/auth/permissions";
import { UserRole } from "@prisma/client";

const { auth } = NextAuth(authConfig);

export function getDefaultDashboard(role?: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return "/admin";
    case UserRole.GODOWN:
      return "/godown";
    case UserRole.SHOP:
      return "/shop";
    case UserRole.SALESPERSON:
      return "/van";
    case UserRole.DELIVERY:
      return "/delivery";
    case UserRole.ACCOUNTS:
      return "/accounts";
    case UserRole.CUSTOMER:
      return "/store";
    default:
      return "/login";
  }
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  // Static files and internal routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Public login page
  if (pathname === "/login") {
    if (isLoggedIn && user?.role) {
      return NextResponse.redirect(new URL(getDefaultDashboard(user.role), req.url));
    }
    return NextResponse.next();
  }

  // Not logged in -> redirect to login with callbackUrl
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Mandatory password change check
  if (user?.mustChangePassword && pathname !== "/change-password") {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  // Check RBAC permission for route
  if (user?.role && !canAccessRoute(user.role, pathname)) {
    return new NextResponse("Forbidden: Access Denied", { status: 403 });
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"],
};
