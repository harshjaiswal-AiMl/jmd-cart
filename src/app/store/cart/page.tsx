import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { CartViewClient } from "./cart-view-client";
import Link from "next/link";

export default async function CartPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  const [cart, deliveryZones] = await Promise.all([
    cartService.getCartSummary(session.user.id),
    deliveryService.getDeliveryZones(),
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
              Shopping Cart
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/store"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Back to Catalogue
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CartViewClient
          cart={cart}
          deliveryZones={deliveryZones}
          userPhone={user?.phone}
          userName={user?.name}
        />
      </main>
    </div>
  );
}
