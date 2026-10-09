import { auth } from "@/auth";
import { redirect } from "next/navigation";
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

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  const queryParams = {
    q: searchParams?.q,
    companyId: searchParams?.company,
    categoryId: searchParams?.category,
    inStockOnly: searchParams?.inStock === "true",
  };

  const [catalogueData, filterOptions, cartData] = await Promise.all([
    storeService.getCatalogue(queryParams),
    storeService.getFilterOptions(),
    cartService.getCartSummary(session.user.id),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/store" className="text-2xl font-black text-blue-600 tracking-tight">
              JMD CART
            </Link>
            <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-200">
              Saharsa Storefront
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="text-right hidden sm:block">
              <div className="font-semibold text-slate-900">{user?.name}</div>
              <div className="text-xs text-slate-500 font-mono">
                {user?.party?.name ? `${user.party.name} • ` : ""}
                {user?.phone}
              </div>
            </div>

            <Link
              href="/store/cart"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>🛒 Cart</span>
              {cartData.totalPieces > 0 && (
                <span className="bg-white text-blue-700 text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                  {cartData.totalPieces}
                </span>
              )}
            </Link>

            <Link
              href="/api/auth/signout"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Log out
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Verification Status Banner if pending */}
        {!user?.phoneVerifiedAt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-600 text-xl font-bold">ℹ️</span>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">Phone Verification Pending</h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {user?.verificationMode === "admin"
                  ? "Your account is active for ordering! Our Saharsa dispatch team will confirm your shop address on your first delivery call."
                  : "Please verify your mobile number to enjoy express delivery."}
              </p>
            </div>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-800 rounded-2xl p-6 md:p-8 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold">Welcome, {user?.name}!</h1>
            <p className="mt-2 text-blue-100 text-sm max-w-xl">
              Wholesale and retail FMCG distribution in Saharsa. Live dynamic slab pricing: buy more pieces/cartons to unlock deeper discounts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs self-start md:self-auto">
            <span className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-sm">
              Role: {user?.role}
            </span>
            <span className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 backdrop-blur-sm">
              Status: {user?.phoneVerifiedAt ? "✓ Verified" : "Pending First Call"}
            </span>
          </div>
        </div>

        {/* Product Catalogue & Filter Grid */}
        <CatalogueClient
          initialProducts={catalogueData.products}
          companies={filterOptions.companies}
          categories={filterOptions.categories}
          currentSearch={searchParams?.q ?? ""}
          currentCompanyId={searchParams?.company ?? ""}
          currentCategoryId={searchParams?.category ?? ""}
          currentInStockOnly={searchParams?.inStock === "true"}
        />
      </main>
    </div>
  );
}
