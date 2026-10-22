import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CartPageClient } from "@/components/store/CartPageClient";

export const metadata: Metadata = {
  title: "Shopping Basket | JMD Cart Saharsa",
  description: "Review items in your cart, calculate wholesale slab savings, and proceed to checkout with same-day express delivery.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartPage() {
  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shopping Basket" },
          ]}
        />

        <div className="mt-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            Your Shopping Basket
          </h1>
        </div>

        <CartPageClient />
      </main>
    </StoreShell>
  );
}
