import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { bannerService } from "@/modules/banners/banner.service";
import { diwaliService } from "@/modules/diwali/diwali.service";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { CatalogueClient } from "./catalogue-client";

export default async function StorePage({
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
    page?: string;
  };
}) {
  const session = await auth();

  // Allow public guest browsing without forcing immediate redirect to /login
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { party: true },
      })
    : null;

  const companyId = searchParams?.companyId || searchParams?.company;
  const categoryId = searchParams?.categoryId || searchParams?.category;
  const inStockOnly = searchParams?.inStockOnly === "true" || searchParams?.inStock === "true";
  const currentPage = Math.max(1, parseInt(searchParams?.page || "1", 10) || 1);
  const pageSize = categoryId || searchParams?.q ? 100 : 32;
  const offset = (currentPage - 1) * pageSize;

  const queryParams = {
    q: searchParams?.q,
    companyId,
    categoryId,
    inStockOnly,
    limit: pageSize,
    offset,
    buyerType: user?.buyerType,
    buyerApproved: user?.buyerApproved,
  };

  const [catalogueData, filterOptions, banners, diwaliShowcase, cartData, wishlistProductIds, wishlistCount] = await Promise.all([
    storeService.getCatalogue(queryParams),
    storeService.getFilterOptions(),
    bannerService.getActiveBanners(),
    diwaliService.getDiwaliShowcase({
      buyerType: user?.buyerType,
      buyerApproved: user?.buyerApproved,
    }),
    session?.user?.id
      ? cartService.getCartSummary(session.user.id)
      : Promise.resolve({
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
          lines: [],
        }),
    session?.user?.id
      ? wishlistService.getWishlistProductIds(session.user.id)
      : Promise.resolve([]),
    session?.user?.id
      ? wishlistService.getWishlistCount(session.user.id)
      : Promise.resolve(0),
  ]);

  // Construct initial cart quantities map for in-place steppers on product cards
  const cartQuantities: Record<string, number> = {};
  for (const line of cartData.lines) {
    cartQuantities[line.productId] = line.qty;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body antialiased">
      {/* Verification Notice Banner if logged in and pending verification */}
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

      {/* Full Stitch S1 Storefront Component */}
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
        pagination={{
          currentPage,
          totalPages: Math.max(1, Math.ceil(catalogueData.total / pageSize)),
          totalProducts: catalogueData.total,
          pageSize,
        }}
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
