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

  // Delivery location modal & state
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [currentLocationText, setCurrentLocationText] = useState("Select Location");
  const [isDetectingHeaderLocation, setIsDetectingHeaderLocation] = useState(false);
  const [locationDetectError, setLocationDetectError] = useState<string | null>(null);

  // Helper to persist location and broadcast across tabs & components
  const applyNewLocation = (
    display: string,
    details: {
      area?: string;
      city?: string;
      state?: string;
      pincode?: string;
      lat?: number;
      lng?: number;
      source?: string;
    }
  ) => {
    setCurrentLocationText(display);
    try {
      localStorage.setItem(
        "jmd_delivery_location",
        JSON.stringify({
          display,
          area: details.area || "",
          city: details.city || "",
          state: details.state || "",
          pincode: details.pincode || "",
          lat: details.lat,
          lng: details.lng,
          source: details.source || "user",
          isUserSelected: true,
          updatedAt: Date.now(),
        })
      );
      window.dispatchEvent(
        new CustomEvent("jmd_location_updated", {
          detail: { display, ...details },
        })
      );
    } catch {}
  };

  // Multi-tier cascade to resolve real location via IP if GPS fails
  const resolveRealLocationCascade = async (): Promise<boolean> => {
    // 1. Try our Next.js API route (which queries ip-api -> ipapi.co -> freeipapi)
    try {
      const res = await fetch("/api/store/geo/reverse?mode=ip");
      const data = await res.json();
      if (data.success && data.city && data.source !== "fallback") {
        const locLabel = [data.area, data.city].filter(Boolean).join(", ") || data.city;
        const fullText = data.pincode ? `${locLabel} (${data.pincode})` : locLabel;
        applyNewLocation(fullText, data);
        return true;
      }
    } catch {}

    // 2. Direct client-side fetch from phone browser (bypasses server LAN/private IP!)
    try {
      const bdcRes = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client");
      if (bdcRes.ok) {
        const d = await bdcRes.json();
        const city = d.city || d.locality || d.principalSubdivision;
        if (city) {
          const locLabel = [d.locality, city].filter(Boolean).join(", ") || city;
          const fullText = d.postcode ? `${locLabel} (${d.postcode})` : locLabel;
          applyNewLocation(fullText, {
            area: d.locality || city,
            city,
            state: d.principalSubdivision || "",
            pincode: d.postcode || "",
            lat: d.latitude,
            lng: d.longitude,
            source: "client-bdc",
          });
          return true;
        }
      }
    } catch {}

    // 3. Direct client-side ipapi.co
    try {
      const ipRes = await fetch("https://ipapi.co/json/");
      if (ipRes.ok) {
        const d = await ipRes.json();
        if (d.city) {
          const locLabel = d.city;
          const fullText = d.postal ? `${locLabel} (${d.postal})` : locLabel;
          applyNewLocation(fullText, {
            area: d.city,
            city: d.city,
            state: d.region || "",
            pincode: d.postal || "",
            lat: d.latitude,
            lng: d.longitude,
            source: "client-ipapi",
          });
          return true;
        }
      }
    } catch {}

    return false;
  };

  // Auto-detect real location on mount or load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    const checkSavedLocation = () => {
      try {
        const saved = localStorage.getItem("jmd_delivery_location");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (
            parsed?.display &&
            parsed.source !== "fallback" &&
            parsed.source !== "error-fallback" &&
            !parsed.display.toLowerCase().includes("saharsa")
          ) {
            return parsed.display;
          }
        }
      } catch {}
      return null;
    };

    const existingDisplay = checkSavedLocation();
    if (existingDisplay) {
      setCurrentLocationText(existingDisplay);
    } else {
      // Auto-detect real location dynamically
      const autoDetect = async () => {
        // If GPS permission is already granted, use it immediately
        if (navigator.geolocation && navigator.permissions?.query) {
          try {
            const perm = await navigator.permissions.query({ name: "geolocation" });
            if (perm.state === "granted") {
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  if (!isMounted) return;
                  try {
                    const lat = pos.coords.latitude;
                    const lng = pos.coords.longitude;
                    const res = await fetch(`/api/store/geo/reverse?lat=${lat}&lng=${lng}`);
                    const data = await res.json();
                    if (data.success && isMounted && (data.city || data.area)) {
                      const locLabel = [data.area, data.city].filter(Boolean).join(", ") || data.city;
                      const fullText = data.pincode ? `${locLabel} (${data.pincode})` : locLabel;
                      applyNewLocation(fullText, data);
                      return;
                    }
                  } catch {}
                  if (isMounted) resolveRealLocationCascade();
                },
                () => {
                  if (isMounted) resolveRealLocationCascade();
                },
                { enableHighAccuracy: true, timeout: 6000 }
              );
              return;
            }
          } catch {}
        }

        // Silent IP resolution cascade
        if (isMounted) {
          const success = await resolveRealLocationCascade();
          if (!success && isMounted) {
            setCurrentLocationText("Select Location");
          }
        }
      };

      autoDetect();
    }

    // Cross-tab and in-page location sync listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "jmd_delivery_location" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.display && isMounted) {
            setCurrentLocationText(parsed.display);
          }
        } catch {}
      }
    };

    const handleCustomLocationEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ display?: string }>;
      if (customEvent.detail?.display && isMounted) {
        setCurrentLocationText(customEvent.detail.display);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("jmd_location_updated", handleCustomLocationEvent);

    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("jmd_location_updated", handleCustomLocationEvent);
    };
  }, []);

  const handleDetectLocationFromHeader = () => {
    setIsDetectingHeaderLocation(true);
    setLocationDetectError(null);

    let hasResolved = false;

    // Safety fallback: Give mobile phones 8 seconds for the user to respond to browser permission!
    const fallbackTimer = setTimeout(async () => {
      if (hasResolved) return;
      hasResolved = true;
      const success = await resolveRealLocationCascade();
      if (success) {
        setLocationModalOpen(false);
      } else {
        setLocationDetectError("Could not acquire location. Please enable location permissions.");
      }
      setIsDetectingHeaderLocation(false);
    }, 8000);

    if (typeof window === "undefined" || !navigator.geolocation) {
      clearTimeout(fallbackTimer);
      resolveRealLocationCascade().then((success) => {
        if (success) setLocationModalOpen(false);
        else setLocationDetectError("Location access unavailable.");
        setIsDetectingHeaderLocation(false);
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (hasResolved) return;
        hasResolved = true;
        clearTimeout(fallbackTimer);
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await fetch(`/api/store/geo/reverse?lat=${lat}&lng=${lng}`);
          const data = await res.json();

          if (data.success && (data.city || data.area)) {
            const locLabel = [data.area, data.city].filter(Boolean).join(", ") || data.city;
            const fullText = data.pincode ? `${locLabel} (${data.pincode})` : locLabel;
            applyNewLocation(fullText, data);
            setLocationModalOpen(false);
          } else {
            // Fallback to IP cascade
            const success = await resolveRealLocationCascade();
            if (success) setLocationModalOpen(false);
          }
        } catch {
          const success = await resolveRealLocationCascade();
          if (success) setLocationModalOpen(false);
        } finally {
          setIsDetectingHeaderLocation(false);
        }
      },
      async (err) => {
        if (hasResolved) return;
        hasResolved = true;
        clearTimeout(fallbackTimer);
        // Fallback to IP cascade on permission denial or error
        const success = await resolveRealLocationCascade();
        if (success) {
          setLocationModalOpen(false);
        } else {
          setLocationDetectError("Please enable device location permissions in your browser.");
        }
        setIsDetectingHeaderLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

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
    const params = new URLSearchParams();
    if (searchValue.trim()) {
      params.set("q", searchValue.trim());
    }
    router.push(`/store?${params.toString()}#products-grid`);
  };

  const handleClearSearch = () => {
    setSearchValue("");
    setSearchResults([]);
    setShowDropdown(false);
    router.push("/store#products-grid");
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(92,12,30,0.06)] border-b border-surface-container-high/60">
        {/* 1. Top Regional Guarantee & Helpline Strip */}
        <div className="w-full bg-primary-container text-on-primary py-1 px-3 sm:px-4 lg:px-8">
          <div className="max-w-[1280px] mx-auto flex items-center justify-between text-[11px] sm:text-xs tracking-wide">
            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden text-ellipsis whitespace-nowrap">
              <span className="font-semibold flex items-center gap-1 shrink-0">
                <span>⚡</span> Express 30-min Delivery
              </span>
              <span className="opacity-40">•</span>
              <span>Free delivery &gt; ₹2,000</span>
              <span className="hidden md:inline opacity-40">•</span>
              <span className="hidden md:inline">100% Genuine Staples</span>
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
          {/* Logo & Interactive Location Trigger */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/" className="flex items-center gap-1.5 sm:gap-2 group">
              <img
                src="/brand/jmd-cart-logo.png"
                alt="JMD Cart Logo"
                width={40}
                height={40}
                className="h-8 sm:h-10 w-auto object-contain transition-transform group-hover:scale-105 shrink-0"
              />
              <span className="font-headline text-xl sm:text-2xl tracking-tight text-primary font-bold whitespace-nowrap">
                JMD<span className="text-secondary">Cart</span>
              </span>
            </Link>

            {/* Interactive Location Chip (Visible on BOTH Phone and Desktop) */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high transition-all text-left cursor-pointer group shrink-0 active:scale-95 shadow-2xs max-w-[140px] xs:max-w-[170px] sm:max-w-[200px]"
              title="Click to change your delivery location"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <span className="material-symbols-outlined text-[15px] sm:text-[17px]">near_me</span>
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-[9px] sm:text-[10px] text-outline font-semibold flex items-center gap-0.5">
                  <span>Deliver to</span>
                  <span className="material-symbols-outlined text-[10px] sm:text-[12px]">expand_more</span>
                </div>
                <div className="font-bold text-on-surface text-[11px] sm:text-xs truncate">
                  {currentLocationText}
                </div>
              </div>
            </button>
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

            {/* Account Action */}
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
                <Link
                  href="/login"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-xs font-bold text-on-surface transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">account_circle</span>
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
              )}

              {/* Account Dropdown with all features */}
              {accountDropdownOpen && isLoggedIn && (
                <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 divide-y divide-surface-container">
                  {/* User Profile Header */}
                  <div className="px-4 py-2.5 bg-surface-container-low/50">
                    <div className="font-headline font-bold text-sm text-on-surface truncate">
                      {userName || "Customer"}
                    </div>
                    <div className="text-[10px] font-semibold text-primary mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Verified Buyer Account
                    </div>
                  </div>

                  {/* All Account Features as Separate Options */}
                  <div className="py-1">
                    <Link
                      href="/store/account?tab=orders"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">package_2</span>
                      <span>My Orders</span>
                    </Link>

                    <Link
                      href="/store/account?tab=addresses"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                      <span>Saved Addresses</span>
                    </Link>

                    <Link
                      href="/store/account?tab=profile"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                      <span>Profile &amp; GST Details</span>
                    </Link>

                    <Link
                      href="/store/wishlist"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-[18px] text-rose-500">favorite</span>
                        <span>My Wishlist</span>
                      </div>
                      {wishlistCount > 0 && (
                        <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                          {wishlistCount}
                        </span>
                      )}
                    </Link>

                    <Link
                      href="/store/account?tab=security"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
                      <span>Change Password</span>
                    </Link>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1">
                    <Link
                      href="/logout"
                      onClick={() => setAccountDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50/60 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Sign Out</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Shopping Bag Button */}
            <Link
              href="/store/cart"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs transition-all shrink-0 ${
                cartCount > 0
                  ? "bg-primary hover:bg-primary-container text-on-primary shadow-xs active:scale-95"
                  : "bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/60"
              }`}
              title={cartCount > 0 ? `${cartCount} items in cart (₹${cartTotalRupees})` : "Shopping Cart"}
            >
              <span className="material-symbols-outlined text-[18px] sm:text-[20px] shrink-0">shopping_bag</span>
              {cartCount > 0 ? (
                <>
                  <span className="hidden sm:inline font-bold">
                    ₹{cartTotalRupees.toLocaleString("en-IN")}
                  </span>
                  <span className="bg-secondary-container text-on-secondary-container px-1.5 py-0.2 rounded-full text-[11px] font-black shrink-0">
                    {cartCount}
                  </span>
                </>
              ) : (
                <span className="hidden sm:inline font-semibold">Cart</span>
              )}
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 text-on-surface hover:bg-surface-container-low rounded-lg shrink-0 w-9 h-9 flex items-center justify-center"
              aria-label="Toggle Navigation Menu"
            >
              <span className="material-symbols-outlined text-[24px] shrink-0">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* 2b. Mobile Dedicated Full-Width Search Input Row (Only on Phone) */}
        <div ref={mobileSearchRef} className="md:hidden px-3 pb-2.5 relative">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full">
            <span className="material-symbols-outlined absolute left-3 text-outline text-[18px] pointer-events-none shrink-0">
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
                href="/store/account?tab=orders"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">package_2</span>
                My Orders
              </Link>
              <Link
                href="/store/account?tab=addresses"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                Saved Addresses
              </Link>
              <Link
                href="/store/account?tab=profile"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
                Profile &amp; GST
              </Link>
              <Link
                href="/store/account?tab=security"
                onClick={() => setMobileMenuOpen(false)}
                className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center gap-2 text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px] text-primary">lock</span>
                Change Password
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

      {/* 6. Blinkit/Swiggy-style Location Selector Modal / Mobile Bottom Sheet */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-surface-container-high p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 relative pb-8 sm:pb-6"
            role="dialog"
            aria-modal="true"
          >
            {/* Mobile Drag Handle Pill */}
            <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">location_on</span>
                </div>
                <div>
                  <h3 className="font-headline text-base font-bold text-on-surface">
                    Delivery Location
                  </h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Real-time delivery availability &amp; slots
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer"
                title="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Current Active Location Display */}
            {currentLocationText && currentLocationText !== "Select Location" ? (
              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  </div>
                  <div className="leading-tight min-w-0">
                    <div className="text-[10px] text-outline font-semibold">Active Location</div>
                    <div className="text-xs sm:text-sm font-bold text-on-surface truncate">
                      {currentLocationText}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/60 flex items-center gap-2.5 text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-[18px] text-outline shrink-0">location_off</span>
                <span>No location set yet. Tap below to detect your current location.</span>
              </div>
            )}

            {/* Auto-Detect Button */}
            <button
              type="button"
              onClick={handleDetectLocationFromHeader}
              disabled={isDetectingHeaderLocation}
              className="w-full p-4 rounded-2xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs sm:text-sm flex items-center justify-between shadow-sm active:scale-[0.98] transition-all cursor-pointer group disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className={`material-symbols-outlined text-[22px] ${isDetectingHeaderLocation ? "animate-spin" : ""}`}>
                    {isDetectingHeaderLocation ? "progress_activity" : "my_location"}
                  </span>
                </div>
                <div className="text-left">
                  <div className="text-sm font-extrabold">
                    {isDetectingHeaderLocation ? "Detecting Live Location..." : "Use Current Location"}
                  </div>
                  <div className="text-[11px] opacity-85 font-normal">
                    {isDetectingHeaderLocation ? "Fetching GPS coordinates & address..." : "Instant 1-tap auto-detect using device location"}
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </button>

            {locationDetectError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                <span>{locationDetectError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Mobile Bottom Navigation Bar (Phone Only) - Automatically hidden on Detail, Cart, and Checkout to prevent bar overlapping! */}
      {!pathname?.includes("/store/products/") &&
        pathname !== "/store/cart" &&
        pathname !== "/store/checkout" &&
        !pathname?.includes("/invoice") && (
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
                href="/store/wishlist"
                className={`flex flex-col items-center py-1 px-2 rounded-lg relative transition-colors ${
                  pathname === "/store/wishlist"
                    ? "text-red-600 font-bold"
                    : "hover:text-red-500"
                }`}
              >
                <div className="relative">
                  <span className="material-symbols-outlined text-[20px]">favorite</span>
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-red-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-black">
                      {wishlistCount}
                    </span>
                  )}
                </div>
                <span>Wishlist</span>
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
                href="/store/cart"
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
        )}
    </>
  );
}
