import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { WishlistPageClient } from "@/components/store/WishlistPageClient";

export const metadata: Metadata = {
  title: "My Wishlist & Saved Items | JMD Cart Saharsa",
  description: "View saved grocery items, watch for mandi price drops, and add quickly to your shopping basket.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WishlistPage() {
  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Saved Items & Wishlist" },
          ]}
        />

        <div className="mt-4 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
            Saved Items &amp; Wishlist
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Keep track of your regular grocery restocks and favorite brands for fast 1-click cart addition.
          </p>
        </div>

        <WishlistPageClient />
      </main>
    </StoreShell>
  );
}
