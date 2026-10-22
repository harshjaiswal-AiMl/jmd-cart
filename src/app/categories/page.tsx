import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "All Categories | JMD Cart — Saharsa Central Wholesale Grocery",
  description:
    "Explore our complete wholesale & retail grocery catalog. Daily fresh pulses, edible oils, spices, flour, basmati rice and kirana staples direct from Saharsa mandi.",
  openGraph: {
    title: "All Grocery Categories | JMD Cart",
    description: "Browse staples, spices, edible oils, grains, and wholesale supplies in Saharsa.",
    url: "https://jmdcart.com/categories",
  },
  alternates: {
    canonical: "/categories",
  },
};

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await storeService.getCategories();

  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "All Categories" },
          ]}
        />

        <div className="mt-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">category</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
              All Grocery Categories
            </h1>
          </div>
          <p className="mt-2 text-sm sm:text-base text-on-surface-variant max-w-3xl">
            Sourced directly from certified millers and regional mandis. Transparent wholesale tiered
            pricing for Saharsa families, kirana stores, caterers, and institutions.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-outline">inventory_2</span>
            <h3 className="mt-4 text-lg font-bold text-on-surface">No Categories Found</h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              Categories are being updated by the godown team. Please check back shortly.
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
            {categories.map((cat) => {
              const href = `/category/${cat.slug || cat.id}`;
              return (
                <Link
                  key={cat.id}
                  href={href}
                  className="group relative flex flex-col justify-between bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200"
                >
                  <div>
                    <div className="w-14 h-14 rounded-xl bg-primary-fixed/20 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors duration-200 mb-4">
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-10 h-10 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-2xl">shopping_basket</span>
                      )}
                    </div>
                    <h2 className="font-bold text-base sm:text-lg text-on-surface group-hover:text-primary transition-colors leading-snug">
                      {cat.name}
                    </h2>
                    {cat.description && (
                      <p className="mt-1.5 text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                        {cat.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between">
                    <span className="text-xs font-semibold text-secondary-container bg-secondary-container/10 px-2 py-0.5 rounded-full">
                      {cat._count.products} {cat._count.products === 1 ? "Product" : "Products"}
                    </span>
                    <span className="material-symbols-outlined text-outline text-lg group-hover:text-primary group-hover:translate-x-1 transition-all">
                      arrow_forward
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </StoreShell>
  );
}
