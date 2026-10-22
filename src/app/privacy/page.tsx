import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Privacy Policy | JMD Cart Saharsa",
  description: "How JMD Cart collects, secures, and handles customer data and business billing records.",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await storeService.getStorePageBySlug("privacy");

  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Privacy Policy" },
          ]}
        />

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-outline-variant/15 pb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Data Protection &amp; Confidentiality
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface mt-1">
              Privacy Policy
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Last updated: October 2026 • JMD Cart Customer Data Standards
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
                <h2 className="text-base font-bold text-primary font-serif">1. Information We Collect</h2>
                <p className="text-on-surface-variant">
                  We collect customer names, contact phone numbers, delivery addresses, and optional business details (GSTIN and Trade Names) solely to fulfill orders, generate legal GST invoices, provide delivery updates, and support customer inquiries.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">2. Zero Third-Party Advertising Trackers</h2>
                <p className="text-on-surface-variant">
                  JMD Cart does not sell or share customer contact databases with third-party marketing firms, data brokers, or advertisement networks. We do not load external tracker pixels, ad cookies, or cross-site tracking scripts.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">3. WhatsApp &amp; SMS Communication</h2>
                <p className="text-on-surface-variant">
                  We send transactional order confirmations, dispatch vehicle status, and OTP verification codes to your provided mobile number. You may opt out of promotional broadcast messages at any time by replying STOP on WhatsApp.
                </p>
              </section>

              <section className="space-y-2 pt-4 border-t border-outline-variant/15">
                <h2 className="text-base font-bold text-primary font-serif">4. Data Security</h2>
                <p className="text-on-surface-variant">
                  All customer billing and transaction data is stored on encrypted database infrastructure complying with Indian Information Technology regulations. Access to order history is restricted to authenticated users.
                </p>
              </section>
            </div>
          )}
        </div>
      </main>
    </StoreShell>
  );
}
