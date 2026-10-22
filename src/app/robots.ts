import { MetadataRoute } from "next";
import { headers } from "next/headers";

export default function robots(): MetadataRoute.Robots {
  const headersList = headers();
  const host = headersList.get("host") || "";
  const mgmtHost = process.env.MANAGEMENT_HOST || "";

  const isManagement =
    mgmtHost && (host === mgmtHost || host.startsWith("management."));

  if (isManagement) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/godown", "/shop", "/van", "/delivery"],
      },
    ],
    sitemap: `${process.env.APP_URL || "https://jmdcart.com"}/sitemap.xml`,
  };
}
