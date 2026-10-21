import { auth } from "@/auth";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { storeService } from "@/modules/store/store.service";
import { cartService } from "@/modules/cart/cart.service";
import { WholesaleClient } from "./wholesale-client";

export const metadata: Metadata = {
  title: "JMD Cart Wholesale & Bulk Hub — Saharsa Kirana Mandi Pricing",
  description:
    "Direct manufacturer and mill pricing for Saharsa Kirana retail stores, halwais, caterers, and tea stalls. 100% GST input tax credit, free tempo delivery above ₹5,000, and 15-day merchant khata terms.",
  keywords: [
    "Saharsa wholesale grocery",
    "Bihar FMCG bulk mandi",
    "kirana bulk store Saharsa",
    "hotel supply wholesale Bihar",
    "grain and oil wholesale distributor",
    "JMD Cart B2B hub",
  ],
  openGraph: {
    title: "Wholesale & Bulk FMCG Hub | JMD Cart Saharsa",
    description:
      "Exclusive volume slabs and bulk reorder matrix for commercial retailers across Saharsa, Bihar.",
    url: "https://jmdcart.com/store/wholesale",
    siteName: "JMD Cart",
    images: [{ url: "/brand/jmd-cart-logo.png", width: 800, height: 800, alt: "JMD Cart Wholesale Hub" }],
  },
  alternates: {
    canonical: "https://jmdcart.com/store/wholesale",
  },
};

export default async function WholesalePage() {
  const session = await auth();

  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { party: true },
      })
    : null;

  const [catalogueData, filterOptions, cartData] = await Promise.all([
    storeService.getCatalogue({
      buyerType: user?.buyerType || user?.party?.type || "WHOLESALER",
      buyerApproved: user?.buyerApproved || false,
      limit: 100,
    }),
    storeService.getFilterOptions(),
    session?.user?.id
      ? cartService.getCartSummary(session.user.id)
      : Promise.resolve({
          id: "",
          userId: "",
          totalPieces: 0,
          itemsCount: 0,
          buyerTag: "WHOLESALER" as const,
          subtotalPaise: 0,
          lineDiscountPaise: 0,
          taxablePaise: 0,
          totalTaxPaise: 0,
          roundOffPaise: 0,
          totalPaise: 0,
          lines: [],
        }),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "JMD Cart Wholesale & Bulk Hub Saharsa",
    description: "B2B grocery distributor and mandi pricing portal for commercial stores in Saharsa.",
    publisher: {
      "@type": "Organization",
      name: "JMD Cart",
      url: "https://jmdcart.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <WholesaleClient
        products={catalogueData.products}
        categories={filterOptions.categories}
        isLoggedIn={!!user}
        userName={user?.party?.name || user?.name || ""}
        cartSummary={{
          totalPieces: cartData.totalPieces,
          itemsCount: cartData.itemsCount,
          totalPaise: cartData.totalPaise,
          savingsPaise: cartData.subtotalPaise - cartData.totalPaise,
        }}
      />
    </>
  );
}
