import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Terms & Conditions | JMD Cart Saharsa",
  description: "User terms, commercial kirana buying agreements, and billing policies of JMD Cart.",
  alternates: { canonical: "/terms" },
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const page = await storeService.getStorePageBySlug("terms");

  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Terms & Conditions" },
          ]}
        />

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-outline-variant/15 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Legal Agreement
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface mt-1">
              Terms &amp; Conditions
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Effective Date: October 2026 • JMD Cart Commercial Distribution Agreement
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
                <h2 className="text-base font-bold text-primary font-serif">1. Commercial Mandi &amp; Retail Framework</h2>
                <p className="text-on-surface-variant">
                  JMD Cart operates as an integrated grocery procurement superstore and authorized wholesale FMCG distributor located in Saharsa, Bihar. By placing orders through this web platform, customers and commercial kirana partners agree to comply with our delivery, pricing, and inspection terms.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">2. Tiered Pricing &amp; Buyer Approvals</h2>
                <p className="text-on-surface-variant">
                  Standard consumer pricing (Price C) is accessible to all unregistered and retail visitors. Special wholesale volume slabs (Price A and Price B) are reserved for verified commercial kirana partners, caterers, and institutions upon verification of their business details and GSTIN registration.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">3. Payment Terms &amp; Invoicing</h2>
                <p className="text-on-surface-variant">
                  Orders must be settled in full via Cash on Delivery (COD) or UPI on Delivery at the time of truck arrival, unless an authorized Credit Party account has been explicitly granted by the management with formal credit terms. All orders are issued computer-generated GST invoices with HSN classifications.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">4. Jurisdiction</h2>
                <p className="text-on-surface-variant">
                  All disputes and commercial claims arising under transactions executed with JMD Cart are subject to the exclusive jurisdiction of the competent courts of Saharsa, Bihar.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
    </StoreShell>
  );
}
