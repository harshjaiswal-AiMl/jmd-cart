import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { canAccessRoute, getDefaultDashboard } from "@/modules/auth/permissions";
import {
  evaluateHostRouting,
  isStaticOrPublicAsset,
  STAFF_ROUTES,
  normalizeHost,
  isStaffRoute,
  isStorefrontPublicPath,
} from "@/lib/host-routing";
import { resolveStorefrontRedirect } from "@/lib/store-redirects";

const { auth } = NextAuth(authConfig);

export {
  getDefaultDashboard,
  STAFF_ROUTES,
  normalizeHost,
  isStaffRoute,
  evaluateHostRouting,
  isStaticOrPublicAsset,
};

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host") || "";
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;

  // Static files, PWA assets and internal health/auth endpoints bypass restrictions
  if (isStaticOrPublicAsset(pathname)) {
    return NextResponse.next();
  }

  // Host-based routing evaluation
  const decision = evaluateHostRouting(host, pathname, search);
  if (decision.type === "404") {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (decision.type === "redirect" && decision.destination) {
    return NextResponse.redirect(new URL(decision.destination, req.url));
  }

  // 301-redirect legacy /store URLs to clean canonical URLs
  if (pathname.startsWith("/store")) {
    const redirect = resolveStorefrontRedirect(pathname, req.nextUrl.searchParams);
    if (redirect) {
      return NextResponse.redirect(new URL(redirect.destination, req.url), 301);
    }
    return NextResponse.next();
  }

  // Public storefront customer browsing, cart, checkout, CMS pages, and management hub
  if (isStorefrontPublicPath(pathname) || pathname === "/management" || pathname.startsWith("/api/store")) {
    return NextResponse.next();
  }

  // Public landing, setup, login, register, and phone verification pages
  if (
    pathname === "/" ||
    pathname === "/setup" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/verify-phone"
  ) {
    if (isLoggedIn && user?.role && pathname === "/register") {
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
    const dashboard = getDefaultDashboard(user.role);
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>403 - Access Denied | IDMS Saharsa</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
        .card { background: white; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); max-width: 28rem; width: 100%; padding: 2rem; border: 1px solid #e2e8f0; text-align: center; }
        .icon { width: 4rem; height: 4rem; background: #fee2e2; color: #dc2626; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 1.75rem; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; color: #0f172a; }
        p { font-size: 0.925rem; color: #64748b; line-height: 1.5; margin-bottom: 1.25rem; }
        .badge { background: #eff6ff; color: #2563eb; padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-weight: 600; font-size: 0.85rem; border: 1px solid #bfdbfe; }
        .route { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-family: monospace; font-size: 0.85rem; color: #334155; }
        .actions { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
        .btn-primary { background: #2563eb; color: white; text-decoration: none; padding: 0.75rem 1rem; border-radius: 0.5rem; font-weight: 500; font-size: 0.95rem; transition: background 0.2s; display: block; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-secondary { background: #f1f5f9; color: #334155; text-decoration: none; padding: 0.75rem 1rem; border-radius: 0.5rem; font-weight: 500; font-size: 0.95rem; border: 1px solid #cbd5e1; transition: background 0.2s; display: block; }
        .btn-secondary:hover { background: #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">🚫</div>
        <h1>Access Denied (403)</h1>
        <p>
          Aap abhi <span class="badge">${user.role}</span> account se logged in hain.<br>
          Is route (<span class="route">${pathname}</span>) ko open karne ke liye permissions nahi hain.
        </p>
        <div class="actions">
          <a href="${dashboard}" class="btn-primary">
            Apne Dashboard Par Jayein (${user.role})
          </a>
          <a href="/logout" class="btn-secondary">
            Logout Karke Super Admin / Owner Account Se Login Karein
          </a>
        </div>
      </div>
    </body>
    </html>`;
    return new NextResponse(html, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/health|_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:woff|woff2|png|jpg|jpeg|gif|svg|webp|ico)).*)",
  ],
};
