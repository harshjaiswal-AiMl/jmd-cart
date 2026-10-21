"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface StoreHeaderProps {
  cartCount?: number;
  cartTotalRupees?: number;
  currentSearch?: string;
  activeCategory?: string;
  categories?: Array<{ id: string; name: string }>;
  userName?: string;
  isLoggedIn?: boolean;
}

export function StoreHeader({
  cartCount = 0,
  cartTotalRupees = 0,
  currentSearch = "",
  activeCategory = "",
  categories = [],
  userName = "",
  isLoggedIn = false,
}: StoreHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (searchValue.trim()) {
      params.set("q", searchValue.trim());
    } else {
      params.delete("q");
    }
    router.push(`/store?${params.toString()}`);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(92,12,30,0.06)] border-b border-surface-container-high/60">
      {/* 1. Top Regional Guarantee & Helpline Strip */}
      <div className="w-full bg-primary-container text-on-primary py-1 px-4 lg:px-8">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between font-label-sm text-xs tracking-wide">
          <div className="flex items-center gap-3">
            <span className="font-semibold flex items-center gap-1">
              <span>⚡</span> 30-Min Delivery in Saharsa Town
            </span>
            <span className="opacity-40">•</span>
            <span>Free delivery above ₹2,000</span>
            <span className="hidden md:inline opacity-40">•</span>
            <span className="hidden md:inline">100% Genuine Wholesale Staples</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1 text-secondary-fixed font-bold">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              GST Invoices Ready
            </span>
            <span className="hidden sm:inline opacity-40">•</span>
            <a
              href="tel:+916278223400"
              className="hover:text-primary-fixed-dim transition-colors flex items-center gap-1 font-semibold"
            >
              <span className="material-symbols-outlined text-[13px]">call</span>
              Helpline: +91 6278 223400
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="h-20 max-w-[1280px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* Logo & Town Location */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 group">
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD Cart Logo"
              className="h-10 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-headline text-2xl tracking-tight text-primary font-bold">
              JMD<span className="text-secondary">Cart</span>
            </span>
          </Link>

          {/* Location Chip */}
          <div className="hidden xl:flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/30 text-left">
            <span className="material-symbols-outlined text-secondary text-[20px]">location_on</span>
            <div>
              <div className="font-bold text-xs text-on-surface leading-tight">Saharsa Town</div>
              <div className="text-[11px] text-on-surface-variant leading-tight">Slot: Today, 6:00 PM</div>
            </div>
          </div>
        </div>

        {/* Global Live Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex-1 max-w-2xl px-2">
          <div className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search rice, atta, biscuits, mustard oil, spices..."
              className="w-full h-11 pl-11 pr-24 bg-surface-container-low border border-outline-variant/60 rounded-lg text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors shadow-2xs"
            />
            <button
              type="submit"
              className="absolute right-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md hover:bg-primary-container transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        {/* Action Controls */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Wholesale Hub CTA */}
          <Link
            href="/store/wholesale"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold text-xs shadow-2xs hover:bg-secondary-fixed-dim transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            Wholesale & Bulk Hub
          </Link>

          {/* Account Button */}
          {isLoggedIn ? (
            <Link
              href="/store/orders"
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                {userName ? userName.slice(0, 2).toUpperCase() : "U"}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-[10px] text-outline leading-tight font-medium">Namaste</div>
                <div className="text-xs font-bold text-on-surface leading-tight truncate max-w-[90px]">
                  {userName || "My Account"}
                </div>
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-xs font-bold text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Shopping Bag Button */}
          <Link
            href="/store/checkout"
            className="flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-3.5 py-2 rounded-lg font-bold text-xs transition-colors shadow-xs"
          >
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            <span className="hidden md:inline font-bold">
              ₹{cartTotalRupees.toLocaleString("en-IN")}
            </span>
            <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded-full text-[11px] font-black">
              {cartCount}
            </span>
          </Link>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-on-surface hover:bg-surface-container-low rounded-lg"
            aria-label="Toggle Navigation Menu"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {/* 3. Category Sub-Navigation Bar */}
      <div className="w-full bg-surface-container-lowest border-t border-surface-container-high/60">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 flex items-center justify-between overflow-hidden">
          <nav className="flex items-center gap-6 overflow-x-auto py-2.5 scrollbar-none text-xs">
            <Link
              href="/store"
              className={`whitespace-nowrap transition-colors font-bold pb-0.5 ${
                !activeCategory
                  ? "text-primary border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              All Categories
            </Link>
            {categories.slice(0, 7).map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <Link
                  key={cat.id}
                  href={`/store?categoryId=${cat.id}`}
                  className={`whitespace-nowrap transition-colors font-semibold pb-0.5 ${
                    isActive
                      ? "text-primary font-bold border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
            <Link
              href="/store/wholesale"
              className="text-secondary hover:text-secondary font-bold whitespace-nowrap flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">percent</span>
              Wholesale Slabs
            </Link>
          </nav>
          <div className="hidden xl:flex items-center gap-1 text-[11px] font-bold text-tertiary bg-tertiary-fixed/30 px-2.5 py-1 rounded">
            <span className="material-symbols-outlined text-[14px]">local_shipping</span>
            Express 30 Mins in Saharsa Ward 1-20
          </div>
        </div>
      </div>

      {/* 4. Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-surface-container-lowest border-t border-surface-container-high p-4 space-y-3 shadow-lg">
          <div className="flex items-center gap-2 p-2 bg-surface-container-low rounded-lg text-xs">
            <span className="material-symbols-outlined text-secondary text-[18px]">location_on</span>
            <div>
              <div className="font-bold text-on-surface">Delivering to Saharsa Town</div>
              <div className="text-on-surface-variant text-[11px]">Next slot: Today, 6:00 PM</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <Link
              href="/store"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">category</span>
              All Groceries
            </Link>
            <Link
              href="/store/wholesale"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg bg-secondary-fixed/40 text-on-secondary-fixed hover:bg-secondary-fixed flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary">storefront</span>
              Wholesale Hub
            </Link>
            <Link
              href="/store/orders"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary">receipt_long</span>
              Track Orders
            </Link>
            <a
              href="tel:+916278223400"
              className="p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">call</span>
              Helpline
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
