import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "About Us | JMD Cart — Saharsa's Grocery & Wholesale Superstore",
  description:
    "Learn about JMD Cart's journey in bringing direct-from-milli pricing, transparent wholesale tiers, and ultra-reliable grocery distribution to Saharsa and the Kosi division.",
  openGraph: {
    title: "About JMD Cart Saharsa",
    description: "Wholesale and retail grocery infrastructure in Saharsa, Bihar.",
    url: "https://jmdcart.com/about",
  },
  alternates: {
    canonical: "/about",
  },
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const page = await storeService.getStorePageBySlug("about");
  const settings = await storeService.getStorefrontSettings();

  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "About JMD Cart" },
          ]}
        />

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-outline-variant/15 pb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Our Story &amp; Purpose
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold font-serif text-on-surface mt-1">
              About JMD Cart
            </h1>
            <p className="text-sm sm:text-base text-on-surface-variant mt-2 leading-relaxed">
              Empowering Saharsa families, kirana shopkeepers, and caterers with direct mandi grocery procurement, transparent carton-level slab pricing, and reliable doorstep logistics.
            </p>
          </div>

          {page?.body && typeof page.body === "string" ? (
            <div
              className="prose prose-slate max-w-none text-on-surface text-sm sm:text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: page.body }}
            />
          ) : (
            <div className="space-y-6 text-sm sm:text-base text-on-surface leading-relaxed">
              <section className="space-y-3">
                <h2 className="text-xl font-bold font-serif text-primary">
                  The Saharsa Mandi Challenge
                </h2>
                <p className="text-on-surface-variant">
                  For decades, local kirana merchants and household shoppers across Saharsa, Simri Bakhtiarpur, and Supaul had to navigate opaque pricing, fragmented middlemen commissions, and inconsistent quality in staple commodities like mustard oil, flour, rice, and pulses.
                </p>
                <p className="text-on-surface-variant">
                  JMD Cart was founded to bridge this gap by establishing a modernized direct-procurement supply line with India&apos;s leading agro-millers and authentic regional commodity markets.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-outline-variant/15">
                <h2 className="text-xl font-bold font-serif text-primary">
                  Our Central Godown Infrastructure
                </h2>
                <p className="text-on-surface-variant">
                  Operating out of our central facility at <strong>{settings.address}</strong>, we maintain temperature-controlled dry storage for moisture-sensitive spices, grains, and cold-pressed oils. Our electric tempo and van delivery fleet enables fast dispatches across Saharsa Nagar Nigam within hours of order placement.
                </p>
              </section>

              <section className="space-y-3 pt-4 border-t border-outline-variant/15">
                <h2 className="text-xl font-bold font-serif text-primary">
                  Wholesale Slabs &amp; 100% Tax Invoices
                </h2>
                <p className="text-on-surface-variant">
                  Every order placed through JMD Cart is backed by automated GST e-invoicing, ensuring eligible commercial buyers can claim 100% input tax credit (ITC). Our transparent volume tier slabs reward bulk purchases without requiring complex credit haggling.
                </p>
              </section>
            </div>
          )}

          <div className="pt-6 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-on-surface-variant">
              FSSAI Reg: <strong className="font-mono text-on-surface">{settings.fssai}</strong> • GSTIN:{" "}
              <strong className="font-mono text-on-surface">{settings.gstin}</strong>
            </div>

            <Link
              href="/contact"
              className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shadow-sm"
            >
              Contact Our Team →
            </Link>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
