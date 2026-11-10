import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { bannerService } from "@/modules/banners/banner.service";
import { diwaliService } from "@/modules/diwali/diwali.service";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { CatalogueClient } from "@/app/store/catalogue-client";
import { unstable_cache } from "next/cache";

const getCachedAnonymousHomeData = unstable_cache(
  async () => {
    const [catalogueData, filterOptions, banners, diwaliShowcase] = await Promise.all([
      storeService.getCatalogue({ limit: 20 }),
      storeService.getFilterOptions(),
      bannerService.getActiveBanners(),
      diwaliService.getDiwaliShowcase({}),
    ]);
    return { catalogueData, filterOptions, banners, diwaliShowcase };
  },
  ["anonymous-store-home-v3"],
  { revalidate: 60, tags: ["catalogue", "banners", "diwali"] }
);

export const dynamic = "force-dynamic";

/**
 * Main Homepage (`/` on jmdcart.com):
 * Serves the Customer, Retailer & Wholesaler Ecommerce Storefront directly,
 * linked live to Godown inventory (loose + openable cartons).
 * Backend management (Warehouse, Godown, Billing, Van, Delivery) runs on
 * `management.jmdcart.com` (and `/management`).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    company?: string;
    companyId?: string;
    category?: string;
    categoryId?: string;
    inStock?: string;
    inStockOnly?: string;
  };
}) {
  const session = await auth();

  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { party: true },
      })
    : null;

  const companyId = searchParams?.companyId || searchParams?.company;
  const categoryId = searchParams?.categoryId || searchParams?.category;
  const inStockOnly = searchParams?.inStockOnly === "true" || searchParams?.inStock === "true";

  const queryParams = {
    q: searchParams?.q,
    companyId,
    categoryId,
    inStockOnly,
    limit: categoryId || searchParams?.q ? 100 : 32,
  };

  const isAnonymousDefault =
    !session?.user?.id &&
    !searchParams?.q &&
    !companyId &&
    !categoryId &&
    !inStockOnly;

  let catalogueData;
  let filterOptions;
  let banners;
  let diwaliShowcase;
  let cartData = {
    id: "",
    userId: "",
    totalPieces: 0,
    itemsCount: 0,
    buyerTag: "CUSTOMER" as const,
    subtotalPaise: 0,
    lineDiscountPaise: 0,
    taxablePaise: 0,
    totalTaxPaise: 0,
    roundOffPaise: 0,
    totalPaise: 0,
    lines: [] as Array<{ productId: string; qty: number }>,
  };
  let wishlistProductIds: string[] = [];
  let wishlistCount = 0;

  if (isAnonymousDefault) {
    const cached = await getCachedAnonymousHomeData();
    catalogueData = cached.catalogueData;
    filterOptions = cached.filterOptions;
    banners = cached.banners;
    diwaliShowcase = cached.diwaliShowcase;
  } else {
    const [cData, fOptions, bData, dShowcase, cSummary, wIds, wCount] = await Promise.all([
      storeService.getCatalogue(queryParams),
      storeService.getFilterOptions(),
      bannerService.getActiveBanners(),
      diwaliService.getDiwaliShowcase({
        buyerType: user?.buyerType,
        buyerApproved: user?.buyerApproved,
      }),
      session?.user?.id
        ? cartService.getCartSummary(session.user.id)
        : Promise.resolve(cartData),
      session?.user?.id
        ? wishlistService.getWishlistProductIds(session.user.id)
        : Promise.resolve([]),
      session?.user?.id
        ? wishlistService.getWishlistCount(session.user.id)
        : Promise.resolve(0),
    ]);
    catalogueData = cData;
    filterOptions = fOptions;
    banners = bData;
    diwaliShowcase = dShowcase;
    cartData = cSummary as any;
    wishlistProductIds = wIds;
    wishlistCount = wCount;
  }

  const cartQuantities: Record<string, number> = {};
  for (const line of cartData.lines) {
    cartQuantities[line.productId] = line.qty;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body antialiased">
      {user && !user.phoneVerifiedAt && (
        <div className="bg-[#FFF1D6] border-b border-[#FDAF18]/50 py-2.5 px-4 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[#790E11] font-semibold">
              <span>ℹ️</span>
              <span>Account pending dispatch team verification. You can browse and place your order!</span>
            </div>
          </div>
        </div>
      )}

      <CatalogueClient
        initialProducts={catalogueData.products}
        companies={filterOptions.companies}
        categories={filterOptions.categories}
        banners={banners}
        diwaliShowcase={diwaliShowcase}
        currentSearch={searchParams?.q ?? ""}
        currentCompanyId={companyId ?? ""}
        currentCategoryId={categoryId ?? ""}
        currentInStockOnly={inStockOnly}
        initialCartQuantities={cartQuantities}
        initialWishlistProductIds={wishlistProductIds}
        initialWishlistCount={wishlistCount}
        isLoggedIn={!!user}
        userName={user?.party?.name || user?.name || ""}
        userRole={user?.role || ""}
        cartSummary={{
          totalPieces: cartData.totalPieces,
          itemsCount: cartData.itemsCount,
          totalPaise: cartData.totalPaise,
          savingsPaise: cartData.subtotalPaise - cartData.totalPaise,
        }}
      />
    </div>
  );
}
