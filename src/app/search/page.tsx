import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductCard } from "@/components/store/ProductCard";
import { storeService } from "@/modules/store/store.service";

interface SearchPageProps {
  searchParams: {
    q?: string;
    category?: string;
    brand?: string;
    inStock?: string;
    sort?: "name_asc" | "price_asc" | "price_desc" | "newest";
    page?: string;
  };
}

export function generateMetadata({ searchParams }: SearchPageProps): Metadata {
  const query = searchParams.q?.trim() || "";
  const title = query
    ? `Search: "${query}" | JMD Cart Saharsa`
    : "Search Grocery Products | JMD Cart";
  return {
    title,
    description: `Search wholesale and retail grocery prices in Saharsa for ${query || "daily mandi staples"}.`,
    robots: {
      index: false, // Search result pages shouldn't bloat Google index
      follow: true,
    },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = searchParams.q?.trim() || "";
  const currentPage = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const pageSize = 24;
  const offset = (currentPage - 1) * pageSize;
  const inStockOnly = searchParams.inStock === "1";
  const sort = searchParams.sort || "newest";

  const { products, total } = await storeService.getCatalogue({
    q: query || undefined,
    inStockOnly,
    sort,
    limit: pageSize,
    offset,
  });

  const totalPages = Math.ceil(total / pageSize);
  const popularKeywords = ["Atta", "Basmati Rice", "Mustard Oil", "Chana Dal", "Sugar", "Spices", "Refined Oil"];

  return (
    <StoreShell>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: query ? `Search: "${query}"` : "Search" },
          ]}
        />

        {/* Search Header */}
        <div className="mt-4 mb-8 bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-outline-variant/20 shadow-sm">
          <form method="GET" action="/search" className="max-w-2xl">
            <label htmlFor="search-input" className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              Search Grocery &amp; Staples
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-outline text-xl pointer-events-none">
                search
              </span>
              <input
                id="search-input"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search by product name, brand (Fortune, Aashirvaad), weight..."
                className="w-full bg-surface-container-low text-on-surface pl-11 pr-28 py-3 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-surface-container-lowest font-medium text-sm sm:text-base"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
              >
                Search
              </button>
            </div>
          </form>

          {/* Quick keywords pill bar */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-on-surface-variant font-semibold">Popular:</span>
            {popularKeywords.map((kw) => (
              <Link
                key={kw}
                href={`/search?q=${encodeURIComponent(kw)}`}
                className="text-xs px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface hover:bg-primary hover:text-on-primary transition-colors font-medium border border-outline-variant/20"
              >
                {kw}
              </Link>
            ))}
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-on-surface">
              {query ? (
                <>
                  Results for &ldquo;<span className="text-primary">{query}</span>&rdquo;
                </>
              ) : (
                "All Products"
              )}
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Found <span className="font-bold text-on-surface">{total}</span> matching items in Saharsa central stock
            </p>
          </div>

          {total > 0 && (
            <div className="flex items-center gap-3">
              <label htmlFor="search-sort-select" className="text-xs font-bold text-on-surface-variant">
                Sort:
              </label>
              <form method="GET" className="inline-block">
                <input type="hidden" name="q" value={query} />
                {inStockOnly && <input type="hidden" name="inStock" value="1" />}
                <select
                  id="search-sort-select"
                  name="sort"
                  defaultValue={sort}
                  // @ts-ignore
                  onChange="this.form.submit()"
                  className="bg-surface-container-lowest text-on-surface text-sm font-semibold px-3 py-1.5 rounded-lg border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-sm"
                >
                  <option value="newest">Newest Arrivals</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </form>
            </div>
          )}
        </div>

        {/* Results Grid */}
        {products.length === 0 ? (
          <div className="text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-8 shadow-sm">
            <span className="material-symbols-outlined text-6xl text-outline">search_off</span>
            <h2 className="mt-4 text-lg font-bold text-on-surface">No Products Found for &ldquo;{query}&rdquo;</h2>
            <p className="mt-1 text-sm text-on-surface-variant max-w-md mx-auto">
              Please double check the spelling, try broader terms like &quot;rice&quot; or &quot;oil&quot;, or browse our categories.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/categories"
                className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors"
              >
                Browse All Categories
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link
                href={`/search?q=${encodeURIComponent(query)}&page=${currentPage - 1}${
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
                  href={`/search?q=${encodeURIComponent(query)}&page=${pageNum}${
                    inStockOnly ? "&inStock=1" : ""
                  }&sort=${sort}`}
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
                href={`/search?q=${encodeURIComponent(query)}&page=${currentPage + 1}${
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
      </main>
    </StoreShell>
  );
}
