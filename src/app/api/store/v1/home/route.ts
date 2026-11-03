import { NextRequest, NextResponse } from "next/server";
import { storeService } from "@/modules/store/store.service";
import { bannerService } from "@/modules/banners/banner.service";
import { getMobileAuthUser } from "@/modules/mobile/mobile-auth.middleware";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  const user = await getMobileAuthUser(req);
  const buyerType = user?.buyerApproved ? user.buyerType : "CUSTOMER";
  const buyerApproved = Boolean(user?.buyerApproved);

  const [catalogueRes, filterOptions, banners] = await Promise.all([
    storeService.getCatalogue({
      limit: 20,
      buyerType,
      buyerApproved,
    }),
    storeService.getFilterOptions(),
    bannerService.getActiveBanners().catch(() => []),
  ]);

  const homeData = {
    announcement: "Flat ₹50 OFF on first app order! Use code JMDFIRST | Free delivery on orders above ₹499",
    banners: (banners || []).map((b: any) => ({
      id: b.id,
      title: b.title || "Special Offer",
      imageUrl: b.imageUrl,
      linkUrl: b.linkUrl || null,
    })),
    categories: filterOptions.categories.map((c: any) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl || null,
      productCount: c.productCount || 0,
    })),
    popularBrands: filterOptions.companies.slice(0, 10).map((comp: any) => ({
      id: comp.id,
      name: comp.name,
      productCount: comp.productCount || 0,
    })),
    featuredProducts: catalogueRes.products.slice(0, 12),
  };

  const bodyStr = JSON.stringify(homeData);
  const etag = `"${crypto.createHash("md5").update(bodyStr).digest("hex")}"`;

  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(bodyStr, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
      "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
    },
  });
}
