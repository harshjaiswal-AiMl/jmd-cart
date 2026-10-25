import type { Metadata } from "next";
import { Inter, Epilogue } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const epilogue = Epilogue({
  subsets: ["latin"],
  variable: "--font-epilogue",
  display: "swap",
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jmdcart.com"),
  title: {
    default: "JMD Cart — Saharsa Grocery & Bulk Wholesale | 30-Min Fast Delivery",
    template: "%s | JMD Cart Saharsa",
  },
  description:
    "Direct wholesale & retail groceries in Saharsa town. 1,800+ products including Aashirvaad, MDH, Fortune, Dawat, Bikaji, Saloni mustard oil, pulses & spices. Free delivery above ₹2,000, 100% GST invoice ready.",
  keywords: [
    "JMD Cart",
    "Saharsa Grocery",
    "Saharsa Wholesale",
    "Grocery delivery Saharsa",
    "MDH Masala Saharsa",
    "Mustard oil Saharsa",
    "Rice and Atta Saharsa",
    "Kirana wholesale Saharsa",
    "FMCG distributor Saharsa",
    "Online ration Saharsa",
    "Bihar grocery store",
  ],
  authors: [{ name: "JMD Cart Saharsa" }],
  creator: "JMD Cart",
  publisher: "JMD Cart",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://jmdcart.com",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://jmdcart.com",
    siteName: "JMD Cart",
    title: "JMD Cart — Saharsa Grocery & Bulk Wholesale",
    description:
      "Direct distributor prices on daily staples, spices, edible oils & packaged foods in Saharsa. Rapid 30-minute delivery in town.",
    images: [
      {
        url: "/brand/jmd-cart-logo.png",
        width: 1200,
        height: 630,
        alt: "JMD Cart Saharsa Logo & Storefront",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "JMD Cart — Saharsa Grocery & Bulk Wholesale",
    description: "Wholesale & retail grocery delivery in Saharsa town. 100% Genuine, GST invoice ready.",
    images: ["/brand/jmd-cart-logo.png"],
  },
};

const jsonLdOrganization = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://jmdcart.com/#organization",
      name: "JMD Cart",
      url: "https://jmdcart.com",
      logo: "https://jmdcart.com/brand/jmd-cart-logo.png",
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+91-6278-223400",
          contactType: "customer service",
          areaServed: "IN",
          availableLanguage: ["Hindi", "English"],
        },
      ],
      address: {
        "@type": "PostalAddress",
        streetAddress: "Station Road, Purab Bazar",
        addressLocality: "Saharsa",
        addressRegion: "Bihar",
        postalCode: "852201",
        addressCountry: "IN",
      },
    },
    {
      "@type": "WebSite",
      "@id": "https://jmdcart.com/#website",
      url: "https://jmdcart.com",
      name: "JMD Cart",
      publisher: { "@id": "https://jmdcart.com/#organization" },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://jmdcart.com/store?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${epilogue.variable} light`}>
      <head>
        <link
          rel="preload"
          href="/fonts/material-symbols-outlined.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }}
        />
      </head>
      <body className="min-h-screen bg-surface font-body text-on-surface antialiased">
        {children}
      </body>
    </html>
  );
}
