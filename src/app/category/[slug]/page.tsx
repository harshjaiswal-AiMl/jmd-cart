import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductCard } from "@/components/store/ProductCard";
import { storeService } from "@/modules/store/store.service";

interface CategoryPageProps {
  params: { slug: string };
  searchParams: {
    sort?: "name_asc" | "price_asc" | "price_desc" | "newest";
    brand?: string;
    inStock?: string;
    page?: string;
  };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const categories = await storeService.getCategories();
  const cat = categories.find((c) => c.slug === params.slug || c.id === params.slug);

  if (!cat) {
    return {
      title: "Category Not Found | JMD Cart",
    };
  }

  const title = `${cat.name} Wholesale & Retail | JMD Cart Saharsa`;
  const description =
    cat.description ||
    `Buy fresh ${cat.name} at genuine mandi rates in Saharsa. Wholesale volume slabs available for kirana stores and bulk buyers.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://jmdcart.com/category/${cat.slug || cat.id}`,
    },
    alternates: {
      canonical: `/category/${cat.slug || cat.id}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = params;
  const categories = await storeService.getCategories();
  const currentCategory = categories.find((c) => c.slug === slug || c.id === slug);

  if (!currentCategory) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = 24;
  const offset = (currentPage - 1) * pageSize;
  const inStockOnly = searchParams.inStock === "1";
  const selectedBrand = searchParams.brand;
  const sort = searchParams.sort || "newest";

  const { products, total } = await storeService.getCatalogue({
    categorySlug: currentCategory.slug || undefined,
    categoryId: !currentCategory.slug ? currentCategory.id : undefined,
    companySlug: selectedBrand || undefined,
    inStockOnly,
    sort,
    limit: pageSize,
    offset,
  });

  const totalPages = Math.ceil(total / pageSize);
  const { companies: brands } = await storeService.getFilterOptions();

  // JSON-LD ItemList Schema
  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${currentCategory.name} - JMD Cart Saharsa`,
    description: currentCategory.description || undefined,
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
            { label: "Categories", href: "/categories" },
            { label: currentCategory.name },
          ]}
        />

        {/* Category Header Banner */}
        <div className="mt-4 mb-6 bg-gradient-to-r from-primary-container to-primary text-on-primary rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
                <span className="material-symbols-outlined text-sm">storefront</span>
                Saharsa Central Mandi Sourced
              </span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif mt-2">
                {currentCategory.name}
              </h1>
              {currentCategory.description && (
                <p className="mt-2 text-on-primary/90 text-sm sm:text-base max-w-2xl leading-relaxed">
                  {currentCategory.description}
                </p>
              )}
            </div>

            <div className="shrink-0 bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/15 text-center">
              <span className="block text-2xl font-bold font-mono">{total}</span>
              <span className="text-xs text-on-primary/80">Available Items</span>
            </div>
          </div>
        </div>

        {/* Main Grid with Sidebar Filter */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block lg:col-span-1 space-y-6">
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm sticky top-24">
              <h2 className="font-bold text-base text-on-surface flex items-center justify-between border-b border-outline-variant/15 pb-3">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">filter_alt</span>
                  Filters
                </span>
                {(selectedBrand || inStockOnly) && (
                  <Link
                    href={`/category/${currentCategory.slug || currentCategory.id}`}
                    className="text-xs text-primary hover:underline font-semibold"
                  >
                    Reset All
                  </Link>
                )}
              </h2>

              {/* In-stock Toggle */}
              <div className="pt-4 pb-4 border-b border-outline-variant/15">
                <label className="flex items-center justify-between cursor-pointer group">
                  <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">
                    In Stock Only
                  </span>
                  <Link
                    href={`/category/${currentCategory.slug || currentCategory.id}?inStock=${
                      inStockOnly ? "0" : "1"
                    }${selectedBrand ? `&brand=${selectedBrand}` : ""}&sort=${sort}`}
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

              {/* Brands Filter */}
              <div className="pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  Brands & Millers
                </h3>
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {brands.map((b) => {
                    const isSelected = selectedBrand === b.name;
                    return (
                      <Link
                        key={b.id}
                        href={`/category/${currentCategory.slug || currentCategory.id}?brand=${
                          isSelected ? "" : encodeURIComponent(b.name)
                        }${inStockOnly ? "&inStock=1" : ""}&sort=${sort}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                          isSelected
                            ? "bg-primary-fixed/20 text-primary font-bold"
                            : "text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <span className="truncate">{b.name}</span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm">check</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Other Categories */}
              <div className="pt-6 border-t border-outline-variant/15 mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                  Other Categories
                </h3>
                <div className="space-y-1">
                  {categories
                    .filter((c) => c.id !== currentCategory.id)
                    .slice(0, 6)
                    .map((other) => (
                      <Link
                        key={other.id}
                        href={`/category/${other.slug || other.id}`}
                        className="block text-sm text-on-surface-variant hover:text-primary py-1 truncate"
                      >
                        {other.name}
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          </aside>

          {/* Product Listing Area */}
          <div className="lg:col-span-3">
            {/* Action Bar (Sort & Mobile filter pill) */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 mb-6 shadow-sm">
              <div className="text-sm text-on-surface-variant">
                Showing <span className="font-bold text-on-surface">{products.length}</span> of{" "}
                <span className="font-bold text-on-surface">{total}</span> items
              </div>

              <div className="flex items-center gap-3">
                <label htmlFor="sort-select" className="text-xs font-bold text-on-surface-variant">
                  Sort:
                </label>
                <form method="GET" className="inline-block">
                  {selectedBrand && <input type="hidden" name="brand" value={selectedBrand} />}
                  {inStockOnly && <input type="hidden" name="inStock" value="1" />}
                  <select
                    id="sort-select"
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

            {/* Product Cards Grid */}
            {products.length === 0 ? (
              <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-sm">
                <span className="material-symbols-outlined text-5xl text-outline">search_off</span>
                <h3 className="mt-4 text-lg font-bold text-on-surface">No Products Match Your Filter</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Try clearing some filters or exploring other categories.
                </p>
                <Link
                  href={`/category/${currentCategory.slug || currentCategory.id}`}
                  className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors"
                >
                  Reset Filters
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
                    href={`/category/${currentCategory.slug || currentCategory.id}?page=${
                      currentPage - 1
                    }${selectedBrand ? `&brand=${selectedBrand}` : ""}${
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
                      href={`/category/${currentCategory.slug || currentCategory.id}?page=${pageNum}${
                        selectedBrand ? `&brand=${selectedBrand}` : ""
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
                    href={`/category/${currentCategory.slug || currentCategory.id}?page=${
                      currentPage + 1
                    }${selectedBrand ? `&brand=${selectedBrand}` : ""}${
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
