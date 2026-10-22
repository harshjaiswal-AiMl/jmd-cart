import type { Metadata } from "next";
import Link from "next/link";
import { storeService } from "@/modules/store/store.service";
import { StoreShell } from "@/components/store/StoreShell";
import { TrustRegionalStrip } from "@/components/store/TrustRegionalStrip";
import { ProductCard } from "@/components/store/ProductCard";

export const metadata: Metadata = {
  title: "JMD Cart — Saharsa Grocery & Bulk Wholesale | 30-Min Fast Delivery",
  description:
    "Direct wholesale & retail groceries in Saharsa town. Daily staples, mustard oils, authentic spices & snacks. Free delivery above ₹2,000, 100% GST invoice ready.",
  alternates: {
    canonical: "https://jmdcart.com",
  },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [
    featuredCatalogue,
    categories,
    brands,
    settings,
  ] = await Promise.all([
    storeService.getCatalogue({ limit: 12 }),
    storeService.getCategories({ featured: true }),
    storeService.getBrands({ featured: true }),
    storeService.getStorefrontSettings(),
  ]);

  const products = featuredCatalogue.products;

  return (
    <StoreShell>
      {/* 1. Trust & Regional Guarantee Strip */}
      <TrustRegionalStrip />

      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 space-y-8 mt-6">
        {/* 2. Hero Section with Regional Commercial Visual & Split Bento */}
        <section className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Main Commercial Billboard */}
            <div className="lg:col-span-8 bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high p-6 lg:p-10 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-12 -top-12 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full font-label-sm text-xs uppercase tracking-wider mb-4 shadow-xs">
                  <span className="material-symbols-outlined text-[14px]">storefront</span>
                  B2B Wholesale &amp; Retail Portal • Saharsa Hub
                </div>
                <h1 className="font-headline text-3xl sm:text-4xl lg:text-5xl text-primary font-bold tracking-tight mb-3 leading-tight">
                  Stock Up for Your Shop &amp; Kitchen
                </h1>
                <p className="font-body text-sm sm:text-base text-on-surface-variant mb-6 leading-relaxed">
                  Direct distributor wholesale pricing on daily essentials, verified regional pulses, mustard oils, and commercial master cartons. Rapid town dispatch across Saharsa.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/categories"
                    className="bg-primary hover:bg-primary-container text-on-primary font-label-lg text-sm font-bold px-6 py-3 rounded-lg shadow-sm transition-all flex items-center gap-2 active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
                    Shop Groceries
                  </Link>
                  <Link
                    href="/wholesale"
                    className="bg-surface-container-low hover:bg-secondary-fixed text-secondary font-label-lg text-sm font-bold px-6 py-3 rounded-lg shadow-xs transition-all flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">warehouse</span>
                    Explore Wholesale Slabs
                  </Link>
                </div>
              </div>

              {/* Metric highlights */}
              <div className="relative z-10 pt-6 mt-6 border-t border-surface-container-high grid grid-cols-3 gap-3">
                <div className="bg-surface-container-low/70 p-3 rounded-lg">
                  <span className="font-headline text-lg sm:text-xl text-primary font-bold block">
                    1,800+
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Active Godown SKUs
                  </span>
                </div>
                <div className="bg-surface-container-low/70 p-3 rounded-lg">
                  <span className="font-headline text-lg sm:text-xl text-secondary font-bold block">
                    100%
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Genuine FMCG Staples
                  </span>
                </div>
                <div className="bg-surface-container-low/70 p-3 rounded-lg">
                  <span className="font-headline text-lg sm:text-xl text-tertiary font-bold block">
                    30 Mins
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Ward 1 to 40 Express
                  </span>
                </div>
              </div>
            </div>

            {/* Secondary Promo Bento Cards */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Daily Mandi Rates Box */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container-high flex flex-col justify-between flex-1 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">
                      trending_down
                    </span>
                    <span className="font-bold text-sm text-on-surface">
                      Saharsa Mandi Price Slabs
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed font-bold text-[11px] rounded">
                    Live Rates
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                    <span className="font-medium text-on-surface">Chana Dal (Desi) 30kg</span>
                    <span className="font-bold text-primary">₹72/kg</span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                    <span className="font-medium text-on-surface">Katarni Rice Premium 25kg</span>
                    <span className="font-bold text-primary">₹64/kg</span>
                  </div>
                  <div className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg text-xs">
                    <span className="font-medium text-on-surface">Kachi Ghani Mustard 15L</span>
                    <span className="font-bold text-primary">₹2,040</span>
                  </div>
                </div>
                <Link
                  className="mt-3 inline-flex items-center justify-center gap-1.5 w-full py-2 bg-surface-container text-primary font-bold text-xs rounded-lg hover:bg-primary hover:text-on-primary transition-colors"
                  href="/wholesale"
                >
                  View All Bulk Wholesale Sacks
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>

              {/* Commercial Logistics Banner */}
              <div className="bg-primary-container text-on-primary rounded-2xl p-5 shadow-xs flex items-center justify-between">
                <div className="space-y-1">
                  <span className="font-bold text-[11px] text-primary-fixed-dim uppercase tracking-wider block">
                    Commercial Bulk Logistics
                  </span>
                  <h4 className="font-headline text-base font-bold">Pick-Up or E-Rickshaw Drop</h4>
                  <p className="text-xs text-primary-fixed opacity-90">
                    Free loading at Station Road Hub
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0 shadow-inner">
                  <span className="material-symbols-outlined text-[24px]">electric_rickshaw</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Featured Categories Rail */}
        {categories.length > 0 && (
          <section className="w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-headline text-xl sm:text-2xl font-bold text-on-surface">
                  Shop by Aisle &amp; Category
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Authentic packaged staples, spices, edible oils &amp; daily kirana
                </p>
              </div>
              <Link
                href="/categories"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>View All</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {categories.slice(0, 6).map((cat) => (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug || cat.id}`}
                  className="bg-surface-container-lowest p-3.5 rounded-xl border border-surface-container-high hover:border-primary/40 hover:shadow-sm transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/5 text-primary flex items-center justify-center mb-2 group-hover:bg-primary group-hover:text-on-primary transition-colors">
                    <span className="material-symbols-outlined text-[24px]">category</span>
                  </div>
                  <h3 className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    {cat.name}
                  </h3>
                  <span className="text-[11px] text-outline mt-0.5">
                    {cat._count.products} Products
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 4. Products Shelf (Frequent Picks & Staples) */}
        <section className="w-full">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-headline text-xl sm:text-2xl font-bold text-on-surface">
                Frequent Kirana Picks &amp; Best Sellers
              </h2>
              <p className="text-xs text-on-surface-variant">
                Live available inventory ready for same-day dispatch
              </p>
            </div>
            <Link
              href="/categories"
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              <span>Explore Catalog</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>

          {products.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-8 text-center border border-surface-container-high">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">inventory_2</span>
              <p className="text-sm font-semibold text-on-surface">Warehouse stock synchronization in progress</p>
              <p className="text-xs text-on-surface-variant mt-1">Please check back shortly or browse by category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* 5. Direct FMCG Brand Shelves */}
        {brands.length > 0 && (
          <section className="w-full bg-surface-container-lowest rounded-2xl p-6 border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">
                  Verified FMCG Manufacturer Brands
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Direct manufacturer sourcing guarantees 100% genuine products
                </p>
              </div>
              <Link
                href="/brands"
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <span>All Brands</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {brands.slice(0, 8).map((b) => (
                <Link
                  key={b.id}
                  href={`/brand/${b.slug || b.id}`}
                  className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container hover:shadow-xs transition-all flex flex-col items-center text-center group"
                >
                  <span className="material-symbols-outlined text-secondary text-[26px] mb-1">
                    verified
                  </span>
                  <span className="font-bold text-xs text-on-surface group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                  <span className="text-[10px] text-outline">
                    {b._count.products} SKUs
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 6. Saharsa Local Fulfillment & WhatsApp Fast Support Section */}
        <section className="w-full pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* WhatsApp Direct Desk */}
            <div className="md:col-span-7 bg-tertiary-container text-on-tertiary rounded-2xl p-6 lg:p-8 shadow-xs flex flex-col justify-between relative overflow-hidden">
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-tertiary text-on-tertiary rounded-full font-label-sm text-xs mb-3">
                  <span className="material-symbols-outlined text-[16px] text-tertiary-fixed">chat</span>
                  Saharsa Local Desk • Rapid Response
                </div>
                <h3 className="font-headline text-2xl lg:text-3xl font-bold mb-2">
                  Order by WhatsApp or Call Us
                </h3>
                <p className="text-sm text-surface-container-highest opacity-90 max-w-lg mb-6 leading-relaxed">
                  Simply send a photo of your handwritten grocery list or kirana replenishment requirement. Our station road team will prepare your invoice and load your order immediately.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    className="bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-fixed-dim px-5 py-3 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-sm"
                    href={`https://wa.me/${settings.whatsappNumber}?text=Namaste%20JMD%20Cart,%20here%20is%20my%20grocery%20order:`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="material-symbols-outlined text-[20px]">chat</span>
                    Send Grocery List on WhatsApp
                  </a>
                  <a
                    className="bg-tertiary text-on-tertiary hover:bg-tertiary/80 px-4 py-3 rounded-lg font-bold text-sm transition-colors flex items-center gap-2"
                    href={`tel:${settings.phone.replace(/\s+/g, "")}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    {settings.phone}
                  </a>
                </div>
              </div>
              <div className="relative z-10 mt-6 pt-4 border-t border-tertiary flex flex-wrap items-center gap-4 text-xs text-on-tertiary-container">
                <span>⚡ Average list response: Under 5 mins</span>
                <span>•</span>
                <span>Bilingual Support (Hindi &amp; Maithili)</span>
              </div>
            </div>

            {/* Station Road Hub Timings & Dispatch Card */}
            <div className="md:col-span-5 bg-surface-container-lowest text-on-surface rounded-2xl p-6 shadow-xs border border-surface-container-high flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-primary font-bold mb-3">
                  <span className="material-symbols-outlined text-[22px]">warehouse</span>
                  <h4 className="font-headline text-base">Saharsa Hub &amp; Dispatch Desk</h4>
                </div>
                <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                  {settings.address}. Self-pickup loading and home delivery staging.
                </p>
                <div className="space-y-2.5 bg-surface-container-low p-3.5 rounded-xl mb-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Fulfillment Desk:</span>
                    <span className="font-bold text-on-surface">{settings.operatingHours}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Morning Town Dispatch:</span>
                    <span className="font-bold text-primary">Slot 1: 10:30 AM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">Evening Town Dispatch:</span>
                    <span className="font-bold text-primary">Slot 2: 6:00 PM</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-on-surface-variant">GST Billing Desk:</span>
                    <span className="font-bold text-tertiary">Active till 8:30 PM</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between text-outline text-xs pt-2">
                <span>GSTIN: {settings.gstin}</span>
                <span className="text-secondary font-bold">Fast Kosi Delivery</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </StoreShell>
  );
}
