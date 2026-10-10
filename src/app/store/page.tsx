import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { CatalogueClient } from "./catalogue-client";
import Link from "next/link";

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
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      {/* Quick-Commerce Top Header (Deep Navy & Primary Teal) */}
      <header className="bg-[#12355B] text-white sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top row: Brand + Location Chip + Account */}
          <div className="h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link href="/store" className="flex items-center gap-1.5 group">
                <span className="text-2xl font-black tracking-tight text-white group-hover:text-teal-300 transition-colors">
                  JMD CART
                </span>
                <span className="text-[10px] uppercase font-bold bg-[#1B998B] text-white px-2 py-0.5 rounded-full tracking-wider">
                  B2B Express
                </span>
              </Link>

              {/* Delivery Area Chip */}
              <div className="hidden sm:flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/15 text-xs text-white/90 backdrop-blur-sm transition-colors">
                <span className="text-teal-300">📍</span>
                <span className="font-semibold text-white">Delivering to Saharsa Town</span>
                <span className="text-white/60 text-[11px]">• Free delivery above ₹2,000</span>
              </div>
            </div>

            {/* User & Cart Controls */}
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <div className="text-right hidden md:block">
                    <div className="text-xs font-semibold text-white truncate max-w-[150px]">
                      {user.party?.name || user.name}
                    </div>
                    <div className="text-[10px] text-teal-300 font-mono">
                      {user.role} {user.party?.creditLimitPaise ? `• Limit: ₹${(user.party.creditLimitPaise / 100).toLocaleString("en-IN")}` : ""}
                    </div>
                  </div>

                  <Link
                    href="/store/orders"
                    className="text-xs font-medium px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white transition-colors"
                  >
                    📦 Orders
                  </Link>

                  <Link
                    href="/logout"
                    className="text-xs font-medium px-2.5 py-1.5 text-white/70 hover:text-white transition-colors"
                    title="Logout"
                  >
                    Logout
                  </Link>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login?callbackUrl=/store"
                    className="text-xs font-semibold px-3 py-1.5 bg-[#1B998B] hover:bg-teal-600 text-white rounded-lg transition-colors shadow-sm"
                  >
                    Login / Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-xs font-medium px-3 py-1.5 border border-white/30 hover:bg-white/10 text-white rounded-lg transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}

              {/* Top Cart Icon Pill */}
              <Link
                href="/store/cart"
                className="flex items-center gap-2 px-3.5 py-2 bg-[#1B998B] hover:bg-teal-600 text-white rounded-xl text-xs font-bold shadow transition-transform active:scale-95"
              >
                <span>🛒 Cart</span>
                {cartData.totalPieces > 0 ? (
                  <span className="bg-white text-[#12355B] text-[11px] font-black px-2 py-0.5 rounded-full">
                    {cartData.totalPieces} pcs
                  </span>
                ) : (
                  <span className="text-teal-100 text-[11px]">0</span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Trust & Guarantee Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm text-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-base text-teal-600 font-bold">⚡</span>
            <div>
              <div className="font-bold text-slate-900">Same-Day Town Delivery</div>
              <div className="text-[10px] text-slate-500">Direct van routes across Saharsa</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base text-teal-600 font-bold">🛡️</span>
            <div>
              <div className="font-bold text-slate-900">100% Genuine Stock</div>
              <div className="text-[10px] text-slate-500">Direct distributor purchase</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base text-teal-600 font-bold">🏷️</span>
            <div>
              <div className="font-bold text-slate-900">Live Wholesale Slabs</div>
              <div className="text-[10px] text-slate-500">Buy cartons, save more</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base text-teal-600 font-bold">📑</span>
            <div>
              <div className="font-bold text-slate-900">GST Invoice with ITC</div>
              <div className="text-[10px] text-slate-500">100% tax compliant bill</div>
            </div>
          </div>
        </div>

        {/* Verification Alert Banner if logged in and not verified */}
        {user && !user.phoneVerifiedAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-600 text-xl font-bold">ℹ️</span>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Account Pending First Call Verification</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                You can browse and add items to cart! Our dispatch team will verify your shop address on first order placement.
              </p>
            </div>
          </div>
        )}

        {/* Product Catalogue & Fast 1-Tap Interaction Grid */}
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
          cartSummary={{
            totalPieces: cartData.totalPieces,
            itemsCount: cartData.itemsCount,
            totalPaise: cartData.totalPaise,
            savingsPaise: cartData.subtotalPaise - cartData.totalPaise,
          }}
        />
      </main>
    </div>
  );
}
