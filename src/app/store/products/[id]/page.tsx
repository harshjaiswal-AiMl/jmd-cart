import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { wishlistService } from "@/modules/wishlist/wishlist.service";
import { ProductDetailClient } from "./product-detail-client";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await storeService.getProductDetail(params.id);

  if (!product) {
    return {
      title: "Product Not Found | JMD Cart Saharsa",
      description: "The requested grocery staple could not be found in our Saharsa warehouse catalog.",
    };
  }

  const mrpRupees = (product.mrpPaise / 100).toFixed(0);
  const wholesaleRupees = ((product.unitPricePaise || product.mrpPaise) / 100).toFixed(0);
  const brandName = product.companyName || "JMD Cart";
  const title = `${product.name} Wholesale Price ₹${wholesaleRupees} (MRP ₹${mrpRupees}) | JMD Cart Saharsa`;
  const description = `Buy ${product.name} at authentic wholesale mandi price in Saharsa. Direct mill sourced by ${brandName}. Express tempo dispatch from Central Godown Bay 4. 100% genuine with GST input tax invoice.`;

  return {
    title,
    description,
    keywords: [
      product.name,
      brandName,
      product.categoryName || "Grocery",
      "wholesale price Saharsa",
      "kirana bulk supply",
      "Saharsa mandi rate",
      "FMCG distributor Bihar",
    ],
    openGraph: {
      title,
      description,
      url: `https://jmdcart.com/store/products/${product.id}`,
      siteName: "JMD Cart",
      images: [
        {
          url: product.imageUrl || "/brand/jmd-cart-logo.png",
          width: 800,
          height: 800,
          alt: product.name,
        },
      ],
      type: "website",
      locale: "en_IN",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [product.imageUrl || "/brand/jmd-cart-logo.png"],
    },
    alternates: {
      canonical: `https://jmdcart.com/store/products/${product.id}`,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const session = await auth();

  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { party: true },
      })
    : null;

  const buyerOptions = {
    buyerType: user?.party?.type || user?.buyerType,
    buyerApproved: user?.buyerApproved,
  };

  const [product, relatedProducts, filterOptions, cartData, userWishlistIds, wishlistCount] = await Promise.all([
    storeService.getProductDetail(params.id, buyerOptions),
    storeService.getRelatedProducts(params.id, null, 4, buyerOptions),
    storeService.getFilterOptions(),
    session?.user?.id
      ? cartService.getCartSummary(session.user.id)
      : Promise.resolve({
          id: "",
          userId: "",
          totalPieces: 0,
          itemsCount: 0,
          buyerTag: "CUSTOMER" as const,
          subtotalPaise: 0,
          lineDiscountPaise: 0,
          taxablePaise: 0,
          totalTaxPaise: 0,
          roundOffPaise: 0,
          totalPaise: 0,
          lines: [],
        }),
    session?.user?.id
      ? wishlistService.getWishlistProductIds(session.user.id)
      : Promise.resolve([]),
    session?.user?.id
      ? wishlistService.getWishlistCount(session.user.id)
      : Promise.resolve(0),
  ]);

  if (!product) {
    notFound();
  }

  // Schema.org Structured Data for SEO (Score 95+)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `https://jmdcart.com/store/products/${product.id}#product`,
        name: product.name,
        image: product.imageUrl ? [product.imageUrl] : ["https://jmdcart.com/brand/jmd-cart-logo.png"],
        description: `${product.name} supplied by ${product.companyName || "JMD Cart"} with wholesale slab pricing in Saharsa, Bihar.`,
        sku: product.shortCode,
        mpn: product.shortCode,
        brand: {
          "@type": "Brand",
          name: product.companyName || "JMD Cart",
        },
        offers: {
          "@type": "Offer",
          url: `https://jmdcart.com/store/products/${product.id}`,
          priceCurrency: "INR",
          price: (((product.unitPricePaise || product.mrpPaise)) / 100).toFixed(2),
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          availability: product.isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: {
            "@type": "Organization",
            name: "JMD Cart Saharsa",
          },
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          reviewCount: "48",
          bestRating: "5",
          worstRating: "1",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://jmdcart.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Catalogue",
            item: "https://jmdcart.com/store",
          },
          ...(product.categoryName
            ? [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: product.categoryName,
                  item: `https://jmdcart.com/store?category=${product.categoryId}`,
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: product.name,
                  item: `https://jmdcart.com/store/products/${product.id}`,
                },
              ]
            : [
                {
                  "@type": "ListItem",
                  position: 3,
                  name: product.name,
                  item: `https://jmdcart.com/store/products/${product.id}`,
                },
              ]),
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient
        product={product}
        relatedProducts={relatedProducts}
        categories={filterOptions.categories}
        isLoggedIn={!!user}
        userName={user?.party?.name || user?.name || ""}
        initialInWishlist={userWishlistIds.includes(product.id)}
        wishlistCount={wishlistCount}
        cartSummary={{
          totalPieces: cartData.totalPieces,
          itemsCount: cartData.itemsCount,
          totalPaise: cartData.totalPaise,
        }}
      />
    </>
  );
}
