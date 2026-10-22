import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Brand Directory | JMD Cart — Top FMCG & Kirana Millers",
  description:
    "Direct mill supply from Fortune, Aashirvaad, Dawat, Patanjali, Tata, MDH, Everest and leading FMCG manufacturers across India delivered to your doorstep in Saharsa.",
  openGraph: {
    title: "Brands & Manufacturers Directory | JMD Cart",
    description: "Verified brands, genuine quality grocery and staples direct from source.",
    url: "https://jmdcart.com/brands",
  },
  alternates: {
    canonical: "/brands",
  },
};

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await storeService.getBrands();

  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Brands & Manufacturers" },
          ]}
        />

        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">verified</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
              Direct Mill Brands &amp; Manufacturers
            </h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-3xl">
            100% genuine products with manufacturer batch traceability. No counterfeit stock, zero
            adulteration. Kirana bulk rates direct from authorized depots.
          </p>
        </div>

        {brands.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-outline">domain_disabled</span>
            <h3 className="mt-4 text-lg font-bold text-on-surface">No Brands Listed</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Brand partnerships are being catalogued. Please check back soon.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
            {brands.map((brand) => {
              const href = `/brand/${brand.slug || brand.id}`;
              return (
                <Link
                  key={brand.id}
                  href={href}
                  className="group relative flex flex-col items-center text-center bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/20 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
                >
                  <div className="w-20 h-20 rounded-2xl bg-surface-container-low flex items-center justify-center p-3 mb-4 group-hover:scale-105 transition-transform duration-200">
                    {brand.imageUrl ? (
                      <img
                        src={brand.imageUrl}
                        alt={brand.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-2xl font-black font-serif text-primary">
                        {brand.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>

                  <h2 className="font-bold text-base text-on-surface group-hover:text-primary transition-colors leading-snug">
                    {brand.name}
                  </h2>

                  <span className="mt-2 text-xs font-semibold text-secondary-container bg-secondary-container/10 px-2.5 py-0.5 rounded-full">
                    {brand._count.products} {brand._count.products === 1 ? "Product" : "Products"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </StoreShell>
  );
}
