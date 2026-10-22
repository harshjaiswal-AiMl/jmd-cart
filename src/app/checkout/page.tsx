import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { CheckoutPageClient } from "@/components/store/CheckoutPageClient";

export const metadata: Metadata = {
  title: "Checkout & Delivery | JMD Cart Saharsa",
  description: "Secure checkout for wholesale and retail grocery dispatch across Saharsa. Cash / UPI on delivery.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Cart", href: "/cart" },
            { label: "Checkout" },
          ]}
        />

        <div className="mt-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            Express Checkout
          </h1>
        </div>

        <CheckoutPageClient />
      </main>
    </StoreShell>
  );
}
