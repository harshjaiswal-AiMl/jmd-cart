import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Shipping & Return Policy | JMD Cart Saharsa",
  description: "Official delivery, dispatch inspection and return guidelines for retail and wholesale grocery orders.",
  alternates: { canonical: "/shipping-policy" },
};

export const dynamic = "force-dynamic";

export default async function ShippingPolicyPage() {
  const page = await storeService.getStorePageBySlug("shipping-policy");

  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Shipping & Return Policy" },
          ]}
        />

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-outline-variant/15 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Terms of Fulfillment
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface mt-1">
              Shipping &amp; Return Policy
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Last updated: October 2026 • Saharsa Central Warehouse Dispatch Terms
            </p>
          </div>

          {page?.body && typeof page.body === "string" ? (
            <div
              className="prose prose-slate max-w-none text-on-surface text-sm sm:text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: page.body }}
            />
          ) : (
            <div className="space-y-6 text-xs sm:text-sm text-on-surface leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-base font-bold text-primary font-serif">1. Dispatch &amp; Delivery Timelines</h2>
                <p className="text-on-surface-variant">
                  All local retail orders within Saharsa town are dispatched via electric tempos within 30 minutes to 2 hours of confirmation. Bulk wholesale orders (carton and bora lots) are dispatched same day or next morning depending on vehicle availability.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">2. Mandatory Counter Inspection</h2>
                <p className="text-on-surface-variant">
                  Due to the nature of food grains, edible oils, and packaged staples, customers and retail store owners must physically verify seal integrity, carton counts, and expiry dates at the time of delivery before accepting the handover.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">3. Business Rule: No Market Return Policy</h2>
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/20 text-on-surface-variant space-y-1">
                  <p className="font-semibold text-on-surface">
                    Per our wholesale commercial distribution terms, JMD Cart operates under a strict <strong>No Market Return</strong> policy once goods are accepted and signed for.
                  </p>
                  <p>
                    Returns or replacements are only honored at the moment of delivery if physical carton damage, leaking oil tin, or incorrect item dispatch is detected in the presence of the delivery driver. Once delivery is accepted, claims for shelf-unsold goods or market-expiry returns cannot be entertained.
                  </p>
                </div>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">4. Cancellation Policy</h2>
                <p className="text-on-surface-variant">
                  Orders may be cancelled free of charge prior to warehouse packaging and vehicle dispatch by calling the Mandi Helpline at +91 6278 223400. Once the delivery vehicle has departed the dock, orders cannot be cancelled mid-transit.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
    </StoreShell>
  );
}
