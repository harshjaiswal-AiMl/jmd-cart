import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { WholesaleTableClient } from "@/components/store/WholesaleTableClient";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "B2B Wholesale Hub & Kirana Slabs | JMD Cart Saharsa",
  description:
    "Direct mill supply for kirana stores, caterers, hotels, and institutions across Saharsa and Kosi division. Carton and bora tiered wholesale pricing with 100% GST input tax credit.",
  openGraph: {
    title: "JMD Cart Wholesale & Kirana Mandi Hub",
    description: "Volume tier slabs, direct warehouse dock loading, and fast delivery in Saharsa.",
    url: "https://jmdcart.com/wholesale",
  },
  alternates: {
    canonical: "/wholesale",
  },
};

export const dynamic = "force-dynamic";

export default async function WholesalePage() {
  const { products } = await storeService.getCatalogue({
    limit: 100,
    inStockOnly: false,
    sort: "newest",
  });

  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "B2B Wholesale Hub" },
          ]}
        />

        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-container via-primary to-[#380712] text-on-primary p-6 sm:p-10 lg:p-12 shadow-lg">
          <div className="max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-bold uppercase tracking-wider text-secondary-container">
              <span className="material-symbols-outlined text-sm">handshake</span>
              Official B2B Grocery Mandi Platform
            </span>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-serif leading-tight">
              Direct Mill Supply for Saharsa Kirana Stores &amp; Caterers
            </h1>

            <p className="text-sm sm:text-base text-on-primary/90 leading-relaxed max-w-2xl">
              Zero middlemen. Buy master cartons, 15L oil tins, 25kg/50kg rice and atta boras directly from our central warehouse stock at wholesale mandi rates.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/wholesale-enquiry"
                className="px-6 py-3 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-sm shadow-md hover:bg-secondary-container/90 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">badge</span>
                Apply for Retailer Credit Account
              </Link>

              <a
                href="https://wa.me/919934200000?text=Hi%20JMD%20Cart,%20I%20want%20to%20place%20a%20bulk%20wholesale%20order"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-xl bg-white/10 text-on-primary border border-white/20 font-bold text-sm hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg text-green-300">chat</span>
                WhatsApp Mandi Desk
              </a>
            </div>
          </div>
        </div>

        {/* 4 Wholesale Benefit Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">factory</span>
            </div>
            <h2 className="font-bold text-base text-on-surface">Direct Miller Supply</h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Direct dispatches from Adani, KRBL, ITC and local certified pulse millers with no intermediary commissions.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">layers</span>
            </div>
            <h2 className="font-bold text-base text-on-surface">Volume Tier Slabs</h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Transparent volume discounts for carton lots and master sacks. Save up to 14% on kirana restocks.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </div>
            <h2 className="font-bold text-base text-on-surface">100% GST Invoices</h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Full GST input tax credit (ITC) on all wholesale dispatches with your business GSTIN clearly printed.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm">
            <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center mb-3">
              <span className="material-symbols-outlined text-2xl">local_shipping</span>
            </div>
            <h2 className="font-bold text-base text-on-surface">Dock Dispatch in 2 Hrs</h2>
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
              Ready for immediate dock loading from Purab Bazar warehouse, or delivered by our logistics fleet.
            </p>
          </div>
        </div>

        {/* Live Wholesale Stock Ledger & Slab Pricing Table */}
        <WholesaleTableClient products={products} />

        {/* Retailer Enrolment Banner */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h3 className="text-xl font-bold font-serif text-on-surface">
              Run a Grocery Shop, Kirana or Halwai Counter in Saharsa?
            </h3>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Get enrolled as a verified wholesale party to unlock exclusive Price A &amp; B lists, scheduled credit delivery, and priority morning truck dispatches.
            </p>
          </div>

          <Link
            href="/wholesale-enquiry"
            className="shrink-0 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
          >
            Become an Authorized Retailer →
          </Link>
        </div>
      </main>
    </StoreShell>
  );
}
