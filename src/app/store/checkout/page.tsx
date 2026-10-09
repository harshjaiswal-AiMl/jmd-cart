import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cartService } from "@/modules/cart/cart.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { CheckoutClient } from "./checkout-client";
import Link from "next/link";

export default async function CheckoutPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/store/checkout");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { party: true },
  });

  const [cart, deliveryZones] = await Promise.all([
    cartService.getCartSummary(session.user.id),
    deliveryService.getDeliveryZones(),
  ]);

  if (!cart || cart.itemsCount === 0) {
    redirect("/store/cart");
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
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-semibold border border-emerald-200">
              Secure Checkout
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/store/cart"
              className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            >
              ← Back to Cart
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CheckoutClient
          cart={cart}
          deliveryZones={deliveryZones}
          userPhone={user?.phone}
          userName={user?.name}
          userAddress={user?.party?.address || ""}
        />
      </main>
    </div>
  );
}
