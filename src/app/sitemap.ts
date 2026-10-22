import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_URL || "https://jmdcart.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/store`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/store/wholesale`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    // Fetch all active products, categories, and companies
    const [products, categories, companies] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { active: true },
        select: { id: true, updatedAt: true },
      }),
      prisma.company.findMany({
        where: { active: true },
        select: { id: true, updatedAt: true },
      }),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${baseUrl}/store?category=${cat.id}`,
      lastModified: cat.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const companyRoutes: MetadataRoute.Sitemap = companies.map((com) => ({
      url: `${baseUrl}/store?company=${com.id}`,
      lastModified: com.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.map((prod) => ({
      url: `${baseUrl}/store/products/${prod.id}`,
      lastModified: prod.updatedAt,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...staticRoutes, ...categoryRoutes, ...companyRoutes, ...productRoutes];
  } catch (err) {
    console.warn("[sitemap] Failed to fetch database records for sitemap, returning static routes:", err);
    return staticRoutes;
  }
}
