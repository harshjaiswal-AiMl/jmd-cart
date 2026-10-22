import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductCard } from "@/components/store/ProductCard";
import { storeService } from "@/modules/store/store.service";

interface BrandPageProps {
  params: { slug: string };
  searchParams: {
    sort?: "name_asc" | "price_asc" | "price_desc" | "newest";
    category?: string;
    inStock?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const brands = await storeService.getBrands();
  const brand = brands.find((b) => b.slug === params.slug || b.id === params.slug);

  if (!brand) {
    return {
      title: "Brand Not Found | JMD Cart",
    };
  }

  const title = `${brand.name} Wholesale Products & Prices | JMD Cart Saharsa`;
  const description =
    brand.description ||
    `Shop 100% authentic ${brand.name} grocery products in Saharsa at genuine wholesale mandi rates. Same day dispatch from central warehouse.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://jmdcart.com/brand/${brand.slug || brand.id}`,
    },
    alternates: {
      canonical: `/brand/${brand.slug || brand.id}`,
    },
  };
}

export default async function BrandCatalogPage({ params, searchParams }: BrandPageProps) {
  const { slug } = params;
  const brands = await storeService.getBrands();
  const currentBrand = brands.find((b) => b.slug === slug || b.id === slug);

  if (!currentBrand) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = 24;
  const offset = (currentPage - 1) * pageSize;
  const inStockOnly = searchParams.inStock === "1";
  const selectedCategory = searchParams.category;
  const sort = searchParams.sort || "newest";

  const { products, total } = await storeService.getCatalogue({
    companySlug: currentBrand.slug || undefined,
    companyId: !currentBrand.slug ? currentBrand.id : undefined,
    categorySlug: selectedCategory || undefined,
    inStockOnly,
    sort,
    limit: pageSize,
    offset,
  });

  const totalPages = Math.ceil(total / pageSize);
  const categories = await storeService.getCategories();

  // JSON-LD ItemList
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${currentBrand.name} Products - JMD Cart Saharsa`,
    description: currentBrand.description || undefined,
    numberOfItems: products.length,
    itemListElement: products.map((p, idx) => ({
      "@type": "ListItem",
      position: offset + idx + 1,
      name: p.name,
      url: `https://jmdcart.com/product/${p.slug || p.id}`,
    })),
  };

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Brands", href: "/brands" },
            { label: currentBrand.name },
          ]}
        />

        {/* Brand Header Banner */}
        <div className="mt-4 mb-6 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/20 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-surface-container-low flex items-center justify-center p-4 border border-outline-variant/30 shrink-0">
            {currentBrand.imageUrl ? (
              <img
                src={currentBrand.imageUrl}
                alt={currentBrand.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-3xl font-black font-serif text-primary">
                {currentBrand.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/15 text-on-secondary-container text-xs font-bold uppercase tracking-wider">
              <span className="material-symbols-outlined text-sm">verified</span>
              Authorized Mill Distribution
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface mt-2">
              {currentBrand.name}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant max-w-2xl leading-relaxed">
              {currentBrand.description ||
                "Certified genuine stock with GST invoice input tax credit and bulk kirana slabs."}
            </p>
          </div>

          <div className="bg-primary-fixed/20 px-5 py-4 rounded-xl border border-primary/20 text-center shrink-0">
            <span className="block text-2xl font-bold font-mono text-primary">{total}</span>
            <span className="text-xs text-on-surface-variant font-medium">Available SKUs</span>
          </div>
        </div>

        {/* Main Grid with Categories Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm sticky top-24">
              <h2 className="font-bold text-base text-on-surface flex items-center justify-between border-b border-outline-variant/15 pb-3">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">filter_alt</span>
                  Filters
                </span>
                {(selectedCategory || inStockOnly) && (
                  <Link
                    href={`/brand/${currentBrand.slug || currentBrand.id}`}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Reset
                  </Link>
                )}
              </h2>

              {/* In-Stock Toggle */}
              <div className="pt-4 pb-4 border-b border-outline-variant/15">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">
                    In Stock Only
                  </span>
                  <Link
                    href={`/brand/${currentBrand.slug || currentBrand.id}?inStock=${
                      inStockOnly ? "0" : "1"
                    }${selectedCategory ? `&category=${selectedCategory}` : ""}&sort=${sort}`}
                    className={`w-11 h-6 flex items-center rounded-full p-1 duration-200 cursor-pointer ${
                      inStockOnly ? "bg-primary" : "bg-outline-variant/40"
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ${
                        inStockOnly ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </Link>
                </label>
              </div>

              {/* Category Filter */}
              <div className="pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  Product Category
                </h3>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {categories.map((c) => {
                    const isSelected = selectedCategory === (c.slug || c.id);
                    return (
                      <Link
                        key={c.id}
                        href={`/brand/${currentBrand.slug || currentBrand.id}?category=${
                          isSelected ? "" : c.slug || c.id
                        }${inStockOnly ? "&inStock=1" : ""}&sort=${sort}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? "bg-primary-fixed/20 text-primary font-bold"
                            : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <span className="truncate">{c.name}</span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm">check</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Listing Area */}
          <div className="lg:col-span-3">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 mb-6 shadow-sm">
              <div className="text-sm text-on-surface-variant">
                Showing <span className="font-bold text-on-surface">{products.length}</span> of{" "}
                <span className="font-bold text-on-surface">{total}</span> items
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="brand-sort-select" className="text-xs font-bold text-on-surface-variant">
                  Sort:
                </label>
                <form method="GET" className="inline-block">
                  {selectedCategory && <input type="hidden" name="category" value={selectedCategory} />}
                  {inStockOnly && <input type="hidden" name="inStock" value="1" />}
                  <select
                    id="brand-sort-select"
                    name="sort"
                    defaultValue={sort}
                    // @ts-ignore
                    onChange="this.form.submit()"
                    className="bg-surface-container-low text-on-surface text-sm font-semibold px-3 py-1.5 rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="newest">Newest Arrivals</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="name_asc">Name: A to Z</option>
                  </select>
                </form>
              </div>
            </div>

            {/* Products Grid */}
            {products.length === 0 ? (
              <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-sm">
                <span className="material-symbols-outlined text-5xl text-outline">inventory</span>
                <h3 className="mt-4 text-lg font-bold text-on-surface">No Products Available</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  No products found for the selected filter combination.
                </p>
                <Link
                  href={`/brand/${currentBrand.slug || currentBrand.id}`}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors"
                >
                  Reset Filter
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/brand/${currentBrand.slug || currentBrand.id}?page=${
                      currentPage - 1
                    }${selectedCategory ? `&category=${selectedCategory}` : ""}${
                      inStockOnly ? "&inStock=1" : ""
                    }&sort=${sort}`}
                    className="px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm font-bold hover:bg-surface-container transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Previous
                  </Link>
                )}

                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Link
                      key={pageNum}
                      href={`/brand/${currentBrand.slug || currentBrand.id}?page=${pageNum}${
                        selectedCategory ? `&category=${selectedCategory}` : ""
                      }${inStockOnly ? "&inStock=1" : ""}&sort=${sort}`}
                      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${
                        pageNum === currentPage
                          ? "bg-primary text-on-primary shadow-sm"
                          : "bg-surface-container-low text-on-surface hover:bg-surface-container"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  ))}
                </div>

                {currentPage < totalPages && (
                  <Link
                    href={`/brand/${currentBrand.slug || currentBrand.id}?page=${
                      currentPage + 1
                    }${selectedCategory ? `&category=${selectedCategory}` : ""}${
                      inStockOnly ? "&inStock=1" : ""
                    }&sort=${sort}`}
                    className="px-3.5 py-2 rounded-lg bg-surface-container-low text-on-surface text-sm font-bold hover:bg-surface-container transition-colors flex items-center gap-1"
                  >
                    Next
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
