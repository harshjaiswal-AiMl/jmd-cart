"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

interface SearchProductItem {
  id: string;
  name: string;
  shortCode: string;
  weight: string | null;
  imageUrl: string | null;
  companyName: string | null;
  categoryName: string | null;
  priceRupees: number;
  mrpRupees: number;
  inStock: boolean;
}

interface StoreHeaderProps {
  cartCount?: number;
  cartTotalRupees?: number;
  wishlistCount?: number;
  currentSearch?: string;
  activeCategory?: string;
  categories?: Array<{ id: string; name: string }>;
  userName?: string;
  isLoggedIn?: boolean;
}

export function StoreHeader({
  cartCount = 0,
  cartTotalRupees = 0,
  wishlistCount = 0,
  currentSearch = "",
  activeCategory = "",
  categories = [],
  userName = "",
  isLoggedIn = false,
}: StoreHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(currentSearch);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Live product search state
  const [searchResults, setSearchResults] = useState<SearchProductItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchValue(currentSearch);
  }, [currentSearch]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const isInsideDesktop = searchContainerRef.current?.contains(target);
      const isInsideMobile = mobileSearchRef.current?.contains(target);
      if (!isInsideDesktop && !isInsideMobile) {
        setShowDropdown(false);
      }
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query
  useEffect(() => {
    const term = searchValue.trim();
    if (term.length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/store/search?q=${encodeURIComponent(term)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchValue]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (searchValue.trim()) {
      params.set("q", searchValue.trim());
    } else {
      params.delete("q");
    }
    router.push(`/store?${params.toString()}`);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setSearchResults([]);
    setShowDropdown(false);
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.delete("q");
    router.push(`/store?${params.toString()}`);
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(92,12,30,0.06)] border-b border-surface-container-high/60">
        {/* 1. Top Regional Guarantee & Helpline Strip */}
        <div className="w-full bg-primary-container text-on-primary py-1 px-3 sm:px-4 lg:px-8">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between text-[11px] sm:text-xs tracking-wide">
            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="font-semibold flex items-center gap-1 shrink-0">
                <span>⚡</span> Lightning Fast Wholesale Delivery
              </span>
              <span className="opacity-40">•</span>
              <span className="hidden sm:inline">Free delivery &gt; ₹2,000</span>
              <span className="hidden md:inline opacity-40">•</span>
              <span className="hidden md:inline">100% Genuine Wholesale Staples</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="hidden sm:flex items-center gap-1 text-secondary-fixed font-bold">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                GST Ready
              </span>
              <span className="hidden sm:inline opacity-40">•</span>
              <a
                href="tel:+916278223400"
                className="hover:text-primary-fixed-dim transition-colors flex items-center gap-1 font-semibold"
              >
                <span className="material-symbols-outlined text-[13px]">call</span>
                <span className="hidden sm:inline">Helpline:</span> +91 6278 223400
              </a>
            </div>
          </div>
        </div>

        {/* 2. Main Navigation Bar */}
        <div className="h-16 md:h-20 max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group">
              <img
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105"
              />
              <span className="font-headline text-xl sm:text-2xl tracking-tight text-primary font-bold">
                JMD<span className="text-secondary">Cart</span>
              </span>
            </Link>
          </div>

          {/* Desktop & Tablet Live Search Bar */}
          <div ref={searchContainerRef} className="hidden md:flex flex-1 max-w-xl mx-2 relative">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
              <span className="material-symbols-outlined absolute left-3.5 text-outline text-[20px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchValue}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setShowDropdown(true);
                }}
                placeholder="Search rice, atta, biscuits, mustard oil, spices..."
                className="w-full h-11 pl-11 pr-28 bg-surface-container-low border border-outline-variant/60 rounded-xl text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors shadow-2xs"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-20 text-outline hover:text-on-surface p-1 rounded-full text-xs transition-colors"
                  title="Clear search"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs"
              >
                Search
              </button>
            </form>

            {/* Desktop Live Search Autocomplete Dropdown */}
            {showDropdown && searchValue.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-50 animate-fade-in">
                {isSearching ? (
                  <div className="p-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant font-medium">
                    <span className="material-symbols-outlined animate-spin text-[18px] text-primary">progress_activity</span>
                    <span>Searching products...</span>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    <div className="px-3.5 py-2 bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between border-b border-surface-container-high/60">
                      <span>Products ({searchResults.length})</span>
                      <span className="text-[10px] text-outline font-normal">Click to open or press Enter</span>
                    </div>
                    <div className="max-h-[340px] overflow-y-auto divide-y divide-surface-container-low">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          href={`/store/products/${item.id}`}
                          onClick={() => setShowDropdown(false)}
                          className="flex items-center gap-3 p-2.5 sm:p-3 hover:bg-surface-container-low/80 transition-colors group"
                        >
                          <div className="w-12 h-12 rounded-lg border border-outline-variant/40 bg-white p-1 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xs group-hover:border-primary/40">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <span className="material-symbols-outlined text-outline text-[22px]">inventory_2</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs sm:text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                                {item.name}
                              </h4>
                              {item.weight && (
                                <span className="text-[10px] bg-surface-container-high px-1.5 py-0.2 rounded font-semibold text-on-surface-variant shrink-0">
                                  {item.weight}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant mt-0.5">
                              {item.companyName && (
                                <span className="font-semibold text-secondary truncate">{item.companyName}</span>
                              )}
                              {item.categoryName && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{item.categoryName}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-2">
                            <div className="text-xs sm:text-sm font-black text-primary font-mono">
                              ₹{item.priceRupees.toFixed(2)}
                            </div>
                            {item.mrpRupees > item.priceRupees && (
                              <div className="text-[10px] text-outline line-through font-mono">
                                ₹{item.mrpRupees.toFixed(2)}
                              </div>
                            )}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full inline-block mt-0.5 ${
                                item.inStock
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {item.inStock ? "In Stock" : "Out of Stock"}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchSubmit}
                      className="w-full p-2.5 bg-surface-container-low text-xs font-bold text-primary hover:bg-primary-fixed/20 text-center border-t border-surface-container-high/60 transition-colors flex items-center justify-center gap-1"
                    >
                      <span>See all results for &quot;{searchValue}&quot; in Store</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-5 text-center">
                    <span className="material-symbols-outlined text-outline text-[28px] block mb-1">search_off</span>
                    <p className="text-xs font-bold text-on-surface">No products found for &quot;{searchValue}&quot;</p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Try searching for atta, mustard oil, rice, biscuits, or spices
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Wholesale Hub CTA */}
            <Link
              href="/store/wholesale"
              className="hidden lg:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold text-xs shadow-2xs hover:bg-secondary-fixed-dim transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">storefront</span>
              Wholesale Hub
            </Link>

            {/* Wishlist Header Quick Icon */}
            <Link
              href="/store/wishlist"
              className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-surface-container-low text-on-surface transition-colors"
              title="My Wishlist"
            >
              <span className="material-symbols-outlined text-[22px] text-on-surface hover:text-red-500 transition-colors">
                favorite
              </span>
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-600 text-white rounded-full min-w-[16px] h-4 px-1 text-[9px] flex items-center justify-center font-black shadow-xs">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Account Dropdown */}
            <div className="relative" ref={accountRef}>
              {isLoggedIn ? (
                <button
                  type="button"
                  onClick={() => setAccountDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-surface-container-low transition-colors text-on-surface cursor-pointer text-left"
                  aria-expanded={accountDropdownOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs ring-2 ring-primary/20">
                    {userName ? userName.slice(0, 2).toUpperCase() : "U"}
                  </div>
                  <div className="hidden xl:block text-left">
                    <div className="text-[10px] text-outline leading-tight font-medium flex items-center gap-0.5">
                      <span>Namaste</span>
                      <span className="material-symbols-outlined text-[12px]">expand_more</span>
                    </div>
                    <div className="text-xs font-bold text-on-surface leading-tight truncate max-w-[85px]">
                      {userName || "Account"}
                    </div>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAccountDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-xs font-bold text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
                  <span className="hidden sm:inline">Sign In</span>
                  <span className="material-symbols-outlined text-[14px] text-outline">expand_more</span>
                </button>
              )}

              {/* Dropdown Popup Menu */}
              {accountDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  {isLoggedIn ? (
                    <>
                      <div className="px-4 py-3 border-b border-surface-container-high bg-surface-container-low/50">
                        <div className="font-headline font-bold text-sm text-on-surface truncate">
                          {userName || "Customer"}
                        </div>
                        <div className="text-[10px] font-semibold text-primary mt-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Verified Saharsa Buyer
                        </div>
                      </div>

                      <div className="py-1">
                        <Link
                          href="/store/account?tab=profile"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-primary">person</span>
                          <span>My Profile & GST</span>
                        </Link>

                        <Link
                          href="/store/account?tab=orders"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-tertiary">package_2</span>
                          <span>My Orders & Invoices</span>
                        </Link>

                        <Link
                          href="/store/account?tab=addresses"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px] text-secondary">location_on</span>
                          <span>Saved Delivery Addresses</span>
                        </Link>

                        <Link
                          href="/store/wishlist"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-red-500 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[18px] text-red-500">favorite</span>
                            <span>My Wishlist</span>
                          </div>
                          {wishlistCount > 0 && (
                            <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                              {wishlistCount}
                            </span>
                          )}
                        </Link>
                      </div>

                      <div className="pt-1 border-t border-surface-container-high">
                        <Link
                          href="/logout"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="flex items-center gap-3 px-4 py-2 text-xs font-semibold text-error hover:bg-red-50/60 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">logout</span>
                          <span>Sign Out</span>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="p-3 space-y-2">
                      <div className="text-xs text-on-surface-variant font-medium">
                        Sign in to track orders, manage addresses, and save favorites.
                      </div>
                      <Link
                        href="/login"
                        onClick={() => setAccountDropdownOpen(false)}
                        className="block w-full py-2 bg-primary hover:bg-primary-container text-on-primary text-center font-bold text-xs rounded-xl transition-all shadow-xs"
                      >
                        Sign In
                      </Link>
                      <div className="text-[11px] text-center text-outline">
                        New kirana shop?{" "}
                        <Link
                          href="/login"
                          onClick={() => setAccountDropdownOpen(false)}
                          className="text-primary font-bold hover:underline"
                        >
                          Register here
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Shopping Bag Button */}
            <Link
              href="/store/checkout"
              className="flex items-center gap-1.5 sm:gap-2 bg-primary hover:bg-primary-container text-on-primary px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs transition-all shadow-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">shopping_bag</span>
              <span className="hidden sm:inline font-bold">
                ₹{cartTotalRupees.toLocaleString("en-IN")}
              </span>
              <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.2 rounded-full text-[11px] font-black">
                {cartCount}
              </span>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-on-surface hover:bg-surface-container-low rounded-lg"
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined text-[24px]">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* 2b. Mobile Dedicated Full-Width Search Input Row (Only on Phone) */}
        <div ref={mobileSearchRef} className="md:hidden px-3 pb-2.5 relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchValue}
              onFocus={() => setShowDropdown(true)}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search rice, atta, oil, biscuits, spices..."
              className="w-full h-10 pl-9 pr-24 bg-surface-container-low border border-outline-variant/60 rounded-xl text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors shadow-2xs"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-16 text-outline hover:text-on-surface p-1 rounded-full text-xs transition-colors"
                title="Clear search"
              >
                <span className="material-symbols-outlined text-[15px]">close</span>
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1 px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary-container transition-colors shadow-xs"
            >
              Search
            </button>
          </form>

          {/* Mobile Search Autocomplete Dropdown */}
          {showDropdown && searchValue.trim().length > 0 && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-white rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden z-50 animate-fade-in">
              {isSearching ? (
                <div className="p-3.5 flex items-center justify-center gap-2 text-xs text-on-surface-variant font-medium">
                  <span className="material-symbols-outlined animate-spin text-[16px] text-primary">progress_activity</span>
                  <span>Searching products...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <div className="px-3 py-1.5 bg-surface-container-low text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between border-b border-surface-container-high/60">
                    <span>Products ({searchResults.length})</span>
                    <span className="text-[9px] text-outline font-normal">Tap to view</span>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto divide-y divide-surface-container-low">
                    {searchResults.map((item) => (
                      <Link
                        key={item.id}
                        href={`/store/products/${item.id}`}
                        onClick={() => setShowDropdown(false)}
                        className="flex items-center gap-2.5 p-2 hover:bg-surface-container-low transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg border border-outline-variant/40 bg-white p-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xs">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-outline text-[18px]">inventory_2</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <h4 className="text-xs font-bold text-on-surface truncate">
                              {item.name}
                            </h4>
                            {item.weight && (
                              <span className="text-[9px] bg-surface-container-high px-1 py-0.2 rounded font-semibold text-on-surface-variant shrink-0">
                                {item.weight}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
                            {item.companyName && (
                              <span className="font-semibold text-secondary truncate">{item.companyName}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <div className="text-xs font-black text-primary font-mono">
                            ₹{item.priceRupees.toFixed(2)}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="w-full p-2 bg-surface-container-low text-[11px] font-bold text-primary hover:bg-primary-fixed/20 text-center border-t border-surface-container-high/60 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>View all results for &quot;{searchValue}&quot;</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-xs font-bold text-on-surface">No products found</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Try searching atta, rice, oil, biscuits, spices
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Category Sub-Navigation Bar */}
        <div className="w-full bg-surface-container-lowest border-t border-surface-container-high/60">
          <div className="max-w-[1280px] mx-auto px-3 sm:px-4 lg:px-8 flex items-center justify-between overflow-hidden">
            <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto py-2 scrollbar-none text-xs w-full">
              <Link
                href="/store"
                className={`whitespace-nowrap transition-colors font-bold pb-0.5 shrink-0 ${
                  !activeCategory && pathname === "/store"
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                All Categories
              </Link>
              {categories.slice(0, 8).map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <Link
                    key={cat.id}
                    href={`/store?categoryId=${cat.id}`}
                    className={`whitespace-nowrap transition-colors font-semibold pb-0.5 shrink-0 ${
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
                className={`font-bold whitespace-nowrap flex items-center gap-1 shrink-0 ${
                  pathname === "/store/wholesale"
                    ? "text-secondary border-b-2 border-secondary"
                    : "text-secondary hover:underline"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">percent</span>
                Wholesale Slabs
              </Link>
            </nav>
          </div>
        </div>

        {/* 4. Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-surface-container-lowest border-t border-surface-container-high p-4 space-y-3 shadow-xl animate-fade-in">
            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <Link
                href="/store"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">storefront</span>
                All Groceries
              </Link>
              <Link
                href="/store/wholesale"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-secondary-fixed/40 text-on-secondary-fixed hover:bg-secondary-fixed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-secondary">warehouse</span>
                Wholesale Hub
              </Link>
              <Link
                href="/store/account"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">manage_accounts</span>
                My Account & Addresses
              </Link>
              <Link
                href="/store/account?tab=orders"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-tertiary">receipt_long</span>
                Track Orders
              </Link>
              <Link
                href="/store/checkout"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">shopping_cart</span>
                My Basket ({cartCount})
              </Link>
              <Link
                href="/store/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-on-surface"
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-red-500">favorite</span>
                  <span>My Wishlist</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="bg-red-50 text-red-600 border border-red-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {wishlistCount}
                  </span>
                )}
              </Link>
            </div>
            <div className="pt-2 border-t border-surface-container-high flex items-center justify-between text-xs">
              <a
                href="tel:+916278223400"
                className="flex items-center gap-1.5 text-primary font-bold py-1 px-2"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                Call Saharsa Depot
              </a>
              {isLoggedIn ? (
                <Link
                  href="/logout"
                  className="text-on-surface-variant hover:text-error py-1 px-2 font-medium"
                >
                  Sign Out
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="text-primary font-bold py-1 px-2 hover:underline"
                >
                  Sign In / Register
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 5. Mobile Bottom Navigation Bar (Phone Only) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high/80 px-2 py-1.5 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-around text-[10px] font-semibold text-on-surface-variant">
          <Link
            href="/store"
            className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors ${
              pathname === "/store" || pathname === "/"
                ? "text-primary font-bold"
                : "hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">storefront</span>
            <span>Store</span>
          </Link>
          <a
            href="#products-grid"
            className="flex flex-col items-center py-1 px-2 rounded-lg hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">category</span>
            <span>Categories</span>
          </a>
          <Link
            href="/store/wholesale"
            className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors ${
              pathname === "/store/wholesale"
                ? "text-secondary font-bold"
                : "hover:text-secondary"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">warehouse</span>
            <span>Wholesale</span>
          </Link>
          <Link
            href="/store/account"
            className={`flex flex-col items-center py-1 px-2 rounded-lg transition-colors ${
              pathname?.startsWith("/store/account") || pathname?.startsWith("/store/orders")
                ? "text-primary font-bold"
                : "hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">account_circle</span>
            <span>Account</span>
          </Link>
          <Link
            href="/store/checkout"
            className={`flex flex-col items-center py-1 px-2 rounded-lg relative transition-colors ${
              pathname === "/store/checkout" || pathname === "/store/cart"
                ? "text-primary font-bold"
                : "hover:text-primary"
            }`}
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-secondary text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-black">
                  {cartCount}
                </span>
              )}
            </div>
            <span>Cart</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
