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
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/brands`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/wholesale`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/serviceability`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faqs`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/wholesale-enquiry`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/shipping-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  try {
    const [products, categories, companies, pages] = await Promise.all([
      prisma.product.findMany({
        where: { active: true },
        select: { id: true, slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.category.findMany({
        where: { active: true },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.company.findMany({
        where: { active: true },
        select: { id: true, slug: true, updatedAt: true },
      }),
      prisma.storePage.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = categories.map((cat) => ({
      url: `${baseUrl}/category/${cat.slug || cat.id}`,
      lastModified: cat.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const brandRoutes: MetadataRoute.Sitemap = companies.map((com) => ({
      url: `${baseUrl}/brand/${com.slug || com.id}`,
      lastModified: com.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

    const productRoutes: MetadataRoute.Sitemap = products.map((prod) => ({
      url: `${baseUrl}/product/${prod.slug || prod.id}`,
      lastModified: prod.updatedAt,
      changeFrequency: "daily",
      priority: 0.8,
    }));

    const customPageRoutes: MetadataRoute.Sitemap = pages.map((page) => ({
      url: `${baseUrl}/page/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [
      ...staticRoutes,
      ...categoryRoutes,
      ...brandRoutes,
      ...productRoutes,
      ...customPageRoutes,
    ];
  } catch (err) {
    console.warn("[sitemap] Failed to fetch database records for sitemap, returning static routes:", err);
    return staticRoutes;
  }
}
