import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { canAccessRoute, getDefaultDashboard } from "@/modules/auth/permissions";

const { auth } = NextAuth(authConfig);

export { getDefaultDashboard };

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  // Static files, PWA assets and internal routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/offline" ||
    pathname.startsWith("/icons/")
  ) {
    return NextResponse.next();
  }

  // Public landing, login, register, and phone verification pages
  if (pathname === "/" || pathname === "/login" || pathname === "/register" || pathname === "/verify-phone") {
    if (isLoggedIn && user?.role) {
      if (pathname === "/login" || pathname === "/register") {
        return NextResponse.redirect(new URL(getDefaultDashboard(user.role), req.url));
      }
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
