import Link from "next/link";

export function StoreFooter() {
  return (
    <footer className="w-full bg-surface-container-low border-t border-surface-container-high/80 mt-16 pt-14 pb-8 text-on-surface">
      <div className="max-w-[1280px] mx-auto px-4 lg:px-8 space-y-12">
        {/* Top 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Regional Depot Info */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                className="h-9 w-auto object-contain"
              />
              <span className="font-headline text-2xl tracking-tight text-primary font-bold">
                JMD<span className="text-secondary">Cart</span>
              </span>
            </Link>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Saharsa&apos;s trusted quick commerce and bulk grocery depot. Supplying households, kiranas, hotels, and caterers with 100% genuine products directly from FMCG manufacturers.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-container-lowest rounded-full border border-outline-variant/40 text-[11px] font-bold text-tertiary">
              <span className="material-symbols-outlined text-[14px]">local_shipping</span>
              Express Delivery Across All 40 Wards
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">
              Quick Links
            </h4>
            <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
              <li>
                <Link href="/store" className="hover:text-primary transition-colors">
                  All Groceries & Staples
                </Link>
              </li>
              <li>
                <Link href="/store/wholesale" className="hover:text-primary transition-colors flex items-center gap-1">
                  <span>B2B Wholesale Hub</span>
                  <span className="text-[10px] bg-secondary-fixed text-on-secondary-fixed px-1.5 py-0.2 rounded font-bold">Bulk</span>
                </Link>
              </li>
              <li>
                <Link href="/store/orders" className="hover:text-primary transition-colors">
                  Track Your Order
                </Link>
              </li>
              <li>
                <Link href="/store/checkout" className="hover:text-primary transition-colors">
                  Review Shopping Cart
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary transition-colors">
                  Customer Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Top FMCG Categories */}
          <div className="space-y-3">
            <h4 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">
              Top Categories
            </h4>
            <ul className="space-y-2 text-xs text-on-surface-variant font-medium">
              <li>
                <Link href="/store?categoryId=Rice%20%26%20Aata" className="hover:text-primary transition-colors">
                  Aashirvaad & Regional Atta
                </Link>
              </li>
              <li>
                <Link href="/store?categoryId=Spices%20%26%20Masala" className="hover:text-primary transition-colors">
                  MDH Authentic Spices & Masala
                </Link>
              </li>
              <li>
                <Link href="/store?categoryId=Ghee%20%26%20Oils" className="hover:text-primary transition-colors">
                  Saloni Kacchi Ghani Mustard Oil
                </Link>
              </li>
              <li>
                <Link href="/store?categoryId=Biscuit%20%26%20Snacks" className="hover:text-primary transition-colors">
                  Bikaji Namkeen & Sweets
                </Link>
              </li>
              <li>
                <Link href="/store?categoryId=Personal%20Care" className="hover:text-primary transition-colors">
                  Himalaya & Denver Grooming
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Saharsa Depot Contact & Invoicing */}
          <div className="space-y-3">
            <h4 className="font-headline text-sm font-bold text-primary tracking-wide uppercase">
              Saharsa Depot & Support
            </h4>
            <div className="space-y-2 text-xs text-on-surface-variant">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary shrink-0 mt-0.5">location_on</span>
                <span>Station Road, Purab Bazar, Saharsa, Bihar — 852201</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary shrink-0">call</span>
                <a href="tel:+916278223400" className="hover:underline font-bold text-on-surface">+91 6278 223400</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">mail</span>
                <a href="mailto:support@jmdcart.com" className="hover:underline">support@jmdcart.com</a>
              </div>
              <div className="pt-2">
                <div className="text-[11px] font-bold text-on-surface flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-tertiary">receipt_long</span>
                  100% Verified GST Invoicing
                </div>
                <div className="text-[10px] text-outline mt-0.5">Valid for Input Tax Credit (ITC) claim</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Strip: Payment Badges & Copyright */}
        <div className="pt-8 border-t border-surface-container-high/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-on-surface">Payment Options:</span>
            <span className="px-2 py-0.5 bg-surface-container-lowest border border-outline-variant/40 rounded text-[11px] font-bold">UPI / QR</span>
            <span className="px-2 py-0.5 bg-surface-container-lowest border border-outline-variant/40 rounded text-[11px] font-bold">Cash on Delivery</span>
            <span className="px-2 py-0.5 bg-surface-container-lowest border border-outline-variant/40 rounded text-[11px] font-bold">RuPay / Cards</span>
            <span className="px-2 py-0.5 bg-surface-container-lowest border border-outline-variant/40 rounded text-[11px] font-bold">Merchant Khata</span>
          </div>
          <div className="text-center sm:text-right">
            <p>© {new Date().getFullYear()} JMD Cart Saharsa. All rights reserved.</p>
            <p className="text-[11px] text-outline mt-0.5">Built for speed, reliability & genuine FMCG supplies.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
