import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ProductCard } from "@/components/store/ProductCard";
import { ProductDetailClient } from "@/components/store/ProductDetailClient";
import { storeService } from "@/modules/store/store.service";

interface ProductPageProps {
  params: { slug: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const product = await storeService.getProductBySlug(params.slug);

  if (!product) {
    return {
      title: "Product Not Found | JMD Cart",
    };
  }

  const priceFormatted = `₹${((product.unitPricePaise ?? product.mrpPaise) / 100).toFixed(0)}`;
  const title = product.metaTitle || `${product.name} at ${priceFormatted} | JMD Cart Saharsa`;
  const description =
    product.metaDescription ||
    `Buy ${product.name} at wholesale mandi rate ${priceFormatted} in Saharsa, Bihar. Genuine mill dispatch, bulk slabs for kirana, same-day delivery.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://jmdcart.com/product/${product.slug || product.id}`,
      images: product.imageUrl ? [{ url: product.imageUrl, alt: product.name }] : [],
    },
    alternates: {
      canonical: `/product/${product.slug || product.id}`,
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = params;
  const product = await storeService.getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await storeService.getRelatedProducts(product.id, product.categoryId, 4);

  const unitPrice = (product.unitPricePaise ?? product.mrpPaise) / 100;

  // JSON-LD Product & Offer Schema
  const productJsonLd: any = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.name,
    image: product.imageUrl ? [product.imageUrl] : [],
    description: product.description || `${product.name} available at JMD Cart Saharsa`,
    sku: product.shortCode,
    brand: product.companyName
      ? {
          "@type": "Brand",
          name: product.companyName,
        }
      : undefined,
    offers: {
      "@type": "Offer",
      url: `https://jmdcart.com/product/${product.slug || product.id}`,
      priceCurrency: "INR",
      price: unitPrice.toFixed(2),
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      itemCondition: "https://schema.org/NewCondition",
      availability: product.isAvailable
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: "JMD Cart Saharsa",
      },
    },
  };

  // Only emit aggregateRating if REAL approved reviews exist
  if (product.reviewCount && product.reviewCount > 0 && product.averageRating) {
    productJsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.averageRating.toString(),
      reviewCount: product.reviewCount.toString(),
    };
  }

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            ...(product.categoryName
              ? [
                  {
                    label: product.categoryName,
                    href: `/category/${product.categorySlug || product.categoryId}`,
                  },
                ]
              : []),
            { label: product.name },
          ]}
        />

        {/* Product Detail Interactive Island */}
        <div className="mt-4">
          <ProductDetailClient product={product} />
        </div>

        {/* Related Products Rail */}
        {relatedProducts.length > 0 && (
          <section className="mt-16 pt-10 border-t border-outline-variant/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Frequently Bought Together
                </span>
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-on-surface mt-1">
                  Related Grocery &amp; Staples
                </h2>
              </div>
              {product.categorySlug && (
                <Link
                  href={`/category/${product.categorySlug}`}
                  className="text-xs sm:text-sm font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View All in Category
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </StoreShell>
  );
}
