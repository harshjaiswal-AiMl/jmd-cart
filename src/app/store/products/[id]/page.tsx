import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { storeService } from "@/modules/store/store.service";
import { ProductDetailClient } from "./product-detail-client";
import Link from "next/link";

export default async function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const product = await storeService.getProductDetail(params.id);

  if (!product) {
    notFound();
  }

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

          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/store/cart"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <span>🛒 View Cart</span>
            </Link>
            <Link
              href="/store"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← All Products
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ProductDetailClient product={product} />
      </main>
    </div>
  );
}
