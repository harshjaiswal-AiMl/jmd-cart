import Link from "next/link";
import Image from "next/image";

interface StoreFooterProps {
  phone?: string;
  whatsapp?: string;
  address?: string;
  gstin?: string;
  fssai?: string;
  operatingHours?: string;
}

export function StoreFooter({
  phone = "+91 6278 223400",
  whatsapp = "916278223400",
  address = "Station Road, Near Purab Bazar Crossing, Saharsa, Bihar - 852201",
  gstin = "10AABCC1234D1Z2",
  fssai = "10422000000123",
  operatingHours = "7:00 AM – 9:00 PM (Everyday)",
}: StoreFooterProps) {
  return (
    <footer className="w-full bg-surface-container-low border-t border-surface-container-high mt-16 text-on-surface">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-10">
          {/* Column 1: Brand & Regional Depot Info (spans 2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                width={36}
                height={36}
                className="h-8 w-auto object-contain"
              />
              <span className="font-headline-md text-headline-md text-primary font-bold">
                JMD<span className="text-secondary">Cart</span>
              </span>
            </Link>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">
              Serving families, kiranas, and commercial bulk buyers across Saharsa town and the Kosi region with authentic staples, farm-direct grains, and guaranteed pricing slabs.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                className="inline-flex items-center gap-2 bg-tertiary-container hover:bg-tertiary text-on-tertiary px-4 py-2 rounded-lg font-label-md text-label-md transition-colors shadow-sm"
                href={`https://wa.me/${whatsapp}?text=Namaste%20JMD%20Cart,%20I%20want%20to%20place%20an%20order`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                WhatsApp Order / Support
              </a>
              <a
                className="inline-flex items-center gap-2 bg-surface-container hover:bg-surface-container-high text-on-surface px-3 py-2 rounded-lg font-label-md text-label-md transition-colors"
                href={`tel:${phone.replace(/\s+/g, "")}`}
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
                {phone}
              </a>
            </div>
          </div>

          {/* Column 2: Direct Catalog */}
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface font-bold mb-3">
              Direct Catalog
            </div>
            <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant text-sm">
              <li>
                <Link className="hover:text-primary transition-colors" href="/categories">
                  All Groceries &amp; Staples
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/category/staples-atta">
                  Atta, Rice &amp; Dal
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/category/oil-ghee">
                  Mustard &amp; Refined Oils
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/category/spices-masala">
                  Authentic Regional Masale
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/brands">
                  Direct FMCG Brands
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/wholesale">
                  Bulk 25kg &amp; 50kg Sacks
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: B2B & Wholesale */}
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface font-bold mb-3">
              B2B &amp; Wholesale
            </div>
            <ul className="space-y-2 font-body-md text-body-md text-on-surface-variant text-sm">
              <li>
                <Link className="hover:text-primary transition-colors" href="/wholesale">
                  Kirana Partner Program
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/wholesale-enquiry">
                  Become a Retail Partner
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/wholesale">
                  Volume Discount Tiers
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/account">
                  GST Billing Profile
                </Link>
              </li>
              <li>
                <Link className="hover:text-primary transition-colors" href="/serviceability">
                  Delivery &amp; Service Area
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Saharsa Hub Info & Compliance */}
          <div>
            <div className="font-headline-sm text-headline-sm text-on-surface font-bold mb-3">
              Saharsa Hub Info
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">
              {address}
            </p>
            <div className="space-y-1.5 font-body-sm text-body-sm text-on-surface-variant text-xs">
              <p>
                <span className="font-bold text-on-surface">Fulfillment Hours:</span> {operatingHours}
              </p>
              <p>
                <span className="font-bold text-on-surface">GSTIN:</span> {gstin}
              </p>
              <p>
                <span className="font-bold text-on-surface">FSSAI Lic:</span> {fssai}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center gap-2 text-xs font-bold text-tertiary">
              <span className="material-symbols-outlined text-[16px]">verified</span>
              100% Genuine Regional FMCG
            </div>
          </div>
        </div>

        {/* Bottom Legal & Policy Strip */}
        <div className="border-t border-surface-container-high pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant font-body-sm text-body-sm text-xs">
          <div>
            © {new Date().getFullYear()} JMD Cart (jmdcart.com). Saharsa, Bihar. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link className="hover:text-primary transition-colors" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="hover:text-primary transition-colors" href="/terms">
              Terms of Wholesale
            </Link>
            <Link className="hover:text-primary transition-colors" href="/shipping-policy">
              Shipping &amp; Returns Policy
            </Link>
            <Link className="hover:text-primary transition-colors" href="/faqs">
              FAQs &amp; Help
            </Link>
            <Link className="hover:text-primary transition-colors" href="/contact">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
