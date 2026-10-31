import { NextRequest, NextResponse } from "next/server";
import { normalizeHost } from "@/lib/host-routing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = normalizeHost(req.headers.get("host"));
  const isMgmt =
    host.startsWith("management") ||
    host.includes("admin") ||
    host.includes("idms") ||
    req.nextUrl.searchParams.get("app") === "mgmt";

  if (isMgmt) {
    return NextResponse.json(
      {
        name: "JMD Management",
        short_name: "JMD Management",
        description: "JMD Cart FMCG Management, Billing & Operations Portal",
        start_url: "/admin",
        id: "/admin",
        display: "standalone",
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#0f172a",
        categories: ["business", "productivity", "management"],
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/manifest+json; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      }
    );
  }

  // Storefront: jmdcart.com
  return NextResponse.json(
    {
      name: "JMD CART",
      short_name: "JMD CART",
      description: "JMD Cart — Online Grocery, Spices & Wholesale FMCG Delivery Saharsa",
      start_url: "/",
      id: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#ffffff",
      theme_color: "#7a2433",
      categories: ["shopping", "food", "lifestyle"],
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icons/icon-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
