export const STAFF_ROUTES = [
  "/admin",
  "/godown",
  "/shop",
  "/van",
  "/delivery",
  "/reports",
  "/setup",
  "/management",
];

export function normalizeHost(rawHost?: string | null): string {
  if (!rawHost) return "";
  const trimmed = rawHost.trim().toLowerCase();
  if (trimmed.startsWith("[")) {
    const endBracket = trimmed.indexOf("]");
    return endBracket !== -1 ? trimmed.slice(1, endBracket) : trimmed;
  }
  return trimmed.split(":")[0];
}

export function isStaffRoute(pathname: string): boolean {
  return STAFF_ROUTES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isStaticOrPublicAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/sw.js" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/manifest.json" ||
    pathname === "/offline" ||
    pathname === "/logout" ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/")
  );
}

export interface HostRoutingDecision {
  type: "next" | "404" | "redirect";
  destination?: string;
  status?: number;
}

export function evaluateHostRouting(
  hostHeader: string | null | undefined,
  pathname: string,
  search: string = "",
  env: {
    storefrontHost?: string;
    managementHost?: string;
    appUrl?: string;
  } = {}
): HostRoutingDecision {
  const host = normalizeHost(hostHeader);
  const sfHost = normalizeHost(env.storefrontHost ?? process.env.STOREFRONT_HOST);
  const mgmtHost = normalizeHost(env.managementHost ?? process.env.MANAGEMENT_HOST);
  const appUrl = env.appUrl ?? process.env.APP_URL ?? "http://localhost:3000";

  const DEV_HOSTS = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
  // If neither host is set or host is a local dev host -> all-in-one dev mode
  if ((!sfHost && !mgmtHost) || DEV_HOSTS.includes(host)) {
    return { type: "next" };
  }

  // STOREFRONT Host
  if (sfHost && host === sfHost) {
    if (isStaffRoute(pathname)) {
      return { type: "404", status: 404 };
    }
    return { type: "next" };
  }

  // MANAGEMENT Host
  if (mgmtHost && host === mgmtHost) {
    if (pathname === "/") {
      return { type: "redirect", destination: "/login" };
    }
    if (pathname.startsWith("/store")) {
      let targetUrl: string;
      try {
        const url = new URL(pathname + search, appUrl);
        targetUrl = url.toString();
      } catch {
        targetUrl = `${appUrl}${pathname}${search}`;
      }
      return { type: "redirect", destination: targetUrl };
    }
    return { type: "next" };
  }

  return { type: "next" };
}
