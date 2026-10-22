"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface StoreHeaderProps {
  cartCount?: number;
  cartTotalRupees?: number;
  currentSearch?: string;
  activeCategory?: string;
  categories?: Array<{ id: string; name: string; slug?: string | null }>;
  userName?: string;
  isLoggedIn?: boolean;
  announcementText?: string;
  phone?: string;
}

export function StoreHeader({
  cartCount = 0,
  cartTotalRupees = 0,
  currentSearch = "",
  activeCategory = "",
  categories = [],
  userName = "",
  isLoggedIn = false,
  announcementText,
  phone = "+91 6278 223400",
}: StoreHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    products: Array<{ id: string; name: string; slug?: string | null; imageUrl?: string | null; mrpPaise?: number | null; priceCPaise?: number | null }>;
    categories: Array<{ id: string; name: string; slug?: string | null }>;
    brands: Array<{ id: string; name: string; slug?: string | null }>;
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [serviceabilityModalOpen, setServiceabilityModalOpen] = useState(false);
  const [pincodeInput, setPincodeInput] = useState("");
  const [pincodeStatus, setPincodeStatus] = useState<{ checked: boolean; serviceable?: boolean; message?: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync search input with URL
  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  // Global Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        setMobileMenuOpen(false);
        setServiceabilityModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search suggestions lookup
  useEffect(() => {
    const term = searchValue.trim();
    if (term.length < 2) {
      setSuggestions(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/store/v1/search?q=${encodeURIComponent(term)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data) {
            setSuggestions(json.data);
            setShowSuggestions(true);
          }
        }
      } catch {
        // silent fail
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const term = searchValue.trim();
    if (term) {
      router.push(`/search?q=${encodeURIComponent(term)}`);
    } else {
      router.push(`/search`);
    }
  };

  const checkPincode = async (e: React.FormEvent) => {
    e.preventDefault();
    const pin = pincodeInput.trim();
    if (!pin) return;

    try {
      const res = await fetch(`/api/store/v1/serviceability?pincode=${encodeURIComponent(pin)}`);
      const json = await res.json();
      if (json.ok && json.data) {
        if (json.data.serviceable) {
          setPincodeStatus({
            checked: true,
            serviceable: true,
            message: `Delivery available in Saharsa Town within ~${json.data.estimatedDeliveryHours} hours!`,
          });
        } else {
          setPincodeStatus({
            checked: true,
            serviceable: false,
            message: "We currently deliver within Saharsa municipal & outstation limits. Please contact our helpline for bulk orders.",
          });
        }
      }
    } catch {
      setPincodeStatus({ checked: true, serviceable: false, message: "Could not verify pincode. Please try again." });
    }
  };

  const defaultAnnouncement =
    announcementText ||
    "⚡ 30-Min Delivery in Saharsa Town • Free delivery above ₹2,000 • 100% Genuine Wholesale Staples";

  return (
    <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(122,36,51,0.06)]">
      {/* 1. Top Announcement Bar */}
      <div className="w-full bg-primary-container text-on-primary py-1 px-4 lg:px-8">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between font-label-sm text-label-sm tracking-wide">
          <div className="flex items-center gap-space-md text-xs">
            <span>{defaultAnnouncement}</span>
          </div>
          <div className="flex items-center gap-space-md text-xs">
            <span className="hidden sm:flex items-center gap-1 font-label-sm text-secondary-fixed">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              GST Invoices Ready
            </span>
            <span className="hidden sm:inline opacity-40">•</span>
            <a
              className="hover:text-primary-fixed-dim transition-colors flex items-center gap-1"
              href={`tel:${phone.replace(/\s+/g, "")}`}
            >
              <span className="material-symbols-outlined text-[13px]">call</span>
              Helpline: {phone}
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Navigation Bar */}
      <div className="h-20 max-w-[1280px] mx-auto px-4 lg:px-8 flex items-center justify-between gap-space-md">
        {/* Mobile menu button & Brand */}
        <div className="flex items-center gap-space-sm sm:gap-space-lg flex-shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open categories and navigation menu"
            className="p-2 -ml-2 rounded-lg text-on-surface hover:bg-surface-container lg:hidden"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>

          <Link className="flex items-center gap-space-sm" href="/">
            <Image
              alt="JMD Cart Logo"
              src="/brand/jmd-cart-logo.png"
              width={36}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
            <span className="font-headline-md text-headline-md tracking-tight text-primary font-bold">
              JMD<span className="text-secondary">Cart</span>
            </span>
          </Link>

          {/* Location Chip */}
          <button
            type="button"
            onClick={() => setServiceabilityModalOpen(true)}
            className="hidden xl:flex items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded-lg text-left hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-secondary text-[20px]">location_on</span>
            <div>
              <div className="font-label-sm text-label-sm text-on-surface font-bold leading-tight">
                Saharsa Town
              </div>
              <div className="font-body-sm text-body-sm text-on-surface-variant leading-tight">
                Slot: Today, 6:00 PM
              </div>
            </div>
          </button>
        </div>

        {/* Search Bar with live suggestions */}
        <div ref={searchContainerRef} className="flex-1 max-w-2xl px-space-sm relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-space-md text-outline text-[20px] pointer-events-none">
              search
            </span>
            <input
              ref={searchInputRef}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => {
                if (suggestions) setShowSuggestions(true);
              }}
              className="w-full h-11 pl-11 pr-20 bg-surface-container-low border border-outline-variant/60 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
              placeholder="Search rice, atta, biscuits, mustard oil, spices..."
              type="search"
              aria-label="Search products, brands and categories"
            />
            <span className="absolute right-space-sm hidden sm:inline-block px-1.5 py-0.5 bg-surface-container rounded font-label-sm text-label-sm text-outline-variant pointer-events-none">
              Ctrl K
            </span>
          </form>

          {/* Live Suggestions Dropdown */}
          {showSuggestions && suggestions && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/60 overflow-hidden z-50">
              {suggestions.products.length === 0 &&
              suggestions.categories.length === 0 &&
              suggestions.brands.length === 0 ? (
                <div className="p-4 text-center text-sm text-on-surface-variant">
                  No matching products found. Try another search term.
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-container-high">
                  {/* Products */}
                  {suggestions.products.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1 font-label-sm text-[11px] font-bold text-outline uppercase tracking-wider">
                        Products
                      </div>
                      {suggestions.products.map((p) => (
                        <Link
                          key={p.id}
                          href={`/product/${p.slug || p.id}`}
                          onClick={() => setShowSuggestions(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface-container-low transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {p.imageUrl ? (
                              <Image
                                src={p.imageUrl}
                                alt={p.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-surface-container flex items-center justify-center text-outline">
                                <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                              </div>
                            )}
                            <span className="text-sm font-medium text-on-surface truncate">
                              {p.name}
                            </span>
                          </div>
                          {p.priceCPaise && (
                            <span className="text-sm font-bold text-primary flex-shrink-0 ml-2">
                              ₹{(p.priceCPaise / 100).toFixed(0)}
                            </span>
                          )}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Categories */}
                  {suggestions.categories.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1 font-label-sm text-[11px] font-bold text-outline uppercase tracking-wider">
                        Categories
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-3 py-1">
                        {suggestions.categories.map((c) => (
                          <Link
                            key={c.id}
                            href={`/category/${c.slug || c.id}`}
                            onClick={() => setShowSuggestions(false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container-low hover:bg-surface-container rounded-lg text-xs font-semibold text-on-surface"
                          >
                            <span className="material-symbols-outlined text-[14px] text-primary">category</span>
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Brands */}
                  {suggestions.brands.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-1 font-label-sm text-[11px] font-bold text-outline uppercase tracking-wider">
                        Brands
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-3 py-1">
                        {suggestions.brands.map((b) => (
                          <Link
                            key={b.id}
                            href={`/brand/${b.slug || b.id}`}
                            onClick={() => setShowSuggestions(false)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-container-low hover:bg-surface-container rounded-lg text-xs font-semibold text-on-surface"
                          >
                            <span className="material-symbols-outlined text-[14px] text-secondary">verified</span>
                            {b.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-space-md flex-shrink-0">
          <Link
            className="hidden sm:inline-flex items-center gap-1 px-space-md py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md shadow-sm hover:bg-secondary-fixed-dim transition-colors"
            href="/wholesale"
          >
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            Wholesale &amp; Bulk Hub
          </Link>

          {/* Account */}
          <Link
            className="flex items-center gap-space-xs px-space-sm py-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface"
            href={isLoggedIn ? "/account" : "/login"}
          >
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">person</span>
            </div>
            <div className="hidden lg:block text-left">
              <div className="font-label-sm text-label-sm text-outline leading-tight">
                {isLoggedIn ? (userName ? `Namaste, ${userName.split(" ")[0]}` : "Namaste") : "Sign In"}
              </div>
              <div className="font-label-md text-label-md font-bold text-on-surface leading-tight">
                My Account
              </div>
            </div>
          </Link>

          {/* Cart Button */}
          <Link
            className="flex items-center gap-space-sm bg-primary hover:bg-primary-container text-on-primary px-space-md py-2.5 rounded-lg font-label-lg text-label-lg transition-colors shadow-sm"
            href="/cart"
            aria-label={`Shopping cart with ${cartCount} items`}
          >
            <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
            {cartTotalRupees > 0 && (
              <span className="hidden md:inline font-price-md text-price-md">
                ₹{cartTotalRupees.toLocaleString("en-IN")}
              </span>
            )}
            <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold min-w-[20px] text-center">
              {cartCount}
            </span>
          </Link>
        </div>
      </div>

      {/* 3. Category Horizontal Navigation Strip */}
      <div className="w-full bg-surface-container-lowest border-t border-surface-container-high hidden md:block">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 flex items-center justify-between">
          <nav className="flex items-center gap-space-lg overflow-x-auto py-2.5 text-sm" aria-label="Product categories">
            <Link
              href="/categories"
              className={`whitespace-nowrap transition-colors ${
                !activeCategory
                  ? "text-primary font-bold border-b-2 border-primary"
                  : "text-on-surface-variant hover:text-on-surface font-label-md"
              }`}
            >
              All Categories
            </Link>
            {categories.slice(0, 7).map((cat) => {
              const isCatActive = activeCategory === cat.slug || activeCategory === cat.id;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug || cat.id}`}
                  className={`whitespace-nowrap font-label-md text-label-md transition-colors ${
                    isCatActive
                      ? "text-primary font-bold border-b-2 border-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
            <Link
              href="/wholesale"
              className="text-secondary font-bold hover:underline whitespace-nowrap font-label-md text-label-md transition-colors flex items-center gap-1"
            >
              <span>Wholesale Slabs</span>
              <span className="text-[10px] bg-secondary-container text-on-secondary-container px-1 rounded">B2B</span>
            </Link>
          </nav>
          <div className="hidden xl:flex items-center gap-1 font-label-sm text-label-sm text-tertiary bg-tertiary-fixed/30 px-space-sm py-1 rounded">
            <span className="material-symbols-outlined text-[14px]">local_shipping</span>
            Express 30 Mins in Saharsa Ward 1-20
          </div>
        </div>
      </div>

      {/* 4. Mobile Category & Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-full max-w-xs bg-surface-container-lowest h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
                  <Image
                    src="/brand/jmd-cart-logo.png"
                    alt="JMD Cart"
                    width={32}
                    height={32}
                    className="h-7 w-auto object-contain"
                  />
                  <span className="font-headline text-xl text-primary font-bold">
                    JMD<span className="text-secondary">Cart</span>
                  </span>
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-outline hover:text-on-surface"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-[24px]">close</span>
                </button>
              </div>

              <div className="py-4 space-y-1">
                <div className="font-label-sm text-xs font-bold text-outline uppercase tracking-wider mb-2">
                  Explore
                </div>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">home</span>
                  Home Storefront
                </Link>
                <Link
                  href="/categories"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">grid_view</span>
                  All Categories
                </Link>
                <Link
                  href="/brands"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                  Direct FMCG Brands
                </Link>
                <Link
                  href="/wholesale"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-secondary hover:bg-secondary-fixed/20"
                >
                  <span className="material-symbols-outlined text-[20px]">storefront</span>
                  B2B Wholesale Hub
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-container-low"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[20px]">shopping_bag</span>
                    My Cart
                  </div>
                  {cartCount > 0 && (
                    <span className="px-2 py-0.5 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold">
                      {cartCount}
                    </span>
                  )}
                </Link>
                <Link
                  href="/wishlist"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-primary text-[20px]">favorite</span>
                  Saved Wishlist
                </Link>
              </div>

              {categories.length > 0 && (
                <div className="py-2 border-t border-surface-container-high space-y-1">
                  <div className="font-label-sm text-xs font-bold text-outline uppercase tracking-wider mb-2">
                    Popular Aisles
                  </div>
                  {categories.slice(0, 8).map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/category/${cat.slug || cat.id}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-1.5 text-sm text-on-surface-variant hover:text-primary transition-colors"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-surface-container-high space-y-2">
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-on-primary rounded-lg font-bold text-sm shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">person</span>
                {isLoggedIn ? "View My Account" : "Customer Sign In"}
              </Link>
              <a
                href={`tel:${phone.replace(/\s+/g, "")}`}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-surface-container text-on-surface rounded-lg text-xs font-semibold"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                Helpline: {phone}
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 5. Serviceability Modal */}
      {serviceabilityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setServiceabilityModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-2xl p-6 border border-outline-variant/60 z-10">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined text-[22px]">location_on</span>
                <h3 className="font-headline text-lg">Check Delivery Area</h3>
              </div>
              <button
                onClick={() => setServiceabilityModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-xs text-on-surface-variant mt-3 mb-4">
              Enter your 6-digit postal pincode to verify fast 30-minute delivery in Saharsa town and connecting regional wards.
            </p>

            <form onSubmit={checkPincode} className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={pincodeInput}
                  onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 852201"
                  className="flex-1 h-11 px-3 bg-surface-container-low border border-outline-variant/60 rounded-lg text-sm text-on-surface focus:outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="px-4 bg-primary text-on-primary font-bold text-xs rounded-lg hover:bg-primary-container transition-colors"
                >
                  Verify
                </button>
              </div>

              {pincodeStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 ${
                    pincodeStatus.serviceable
                      ? "bg-tertiary-fixed/30 text-on-tertiary-fixed"
                      : "bg-error-container text-on-error-container"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                    {pincodeStatus.serviceable ? "check_circle" : "info"}
                  </span>
                  <span>{pincodeStatus.message}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
