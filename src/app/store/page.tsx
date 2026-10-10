import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { CatalogueClient } from "./catalogue-client";

export default async function StorePage({
  searchParams,
}: {
  searchParams?: {
    q?: string;
    company?: string;
    category?: string;
    inStock?: string;
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

  const queryParams = {
    q: searchParams?.q,
    companyId: searchParams?.company,
    categoryId: searchParams?.category,
    inStockOnly: searchParams?.inStock === "true",
  };

  const [catalogueData, filterOptions, cartData] = await Promise.all([
    storeService.getCatalogue(queryParams),
    storeService.getFilterOptions(),
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
  ]);

  // Construct initial cart quantities map for in-place steppers on product cards
  const cartQuantities: Record<string, number> = {};
  for (const line of cartData.lines) {
    cartQuantities[line.productId] = line.qty;
  }

  return (
    <div className="min-h-screen bg-[#FEFDF7] text-[#2A1010] font-sans antialiased">
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
        currentSearch={searchParams?.q ?? ""}
        currentCompanyId={searchParams?.company ?? ""}
        currentCategoryId={searchParams?.category ?? ""}
        currentInStockOnly={searchParams?.inStock === "true"}
        initialCartQuantities={cartQuantities}
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
