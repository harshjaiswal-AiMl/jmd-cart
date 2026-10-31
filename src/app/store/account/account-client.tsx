"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SavedAddressDto, UserAddressType } from "@/modules/address/address.types";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { updateProfileAction, changeUserPasswordAction } from "./actions";
import {
  saveUserAddressAction,
  deleteUserAddressAction,
  setDefaultAddressAction,
} from "@/app/store/checkout/address-actions";
import { reorderOrderAction } from "@/app/store/orders/actions";
import { WishlistItemDto } from "@/modules/wishlist/wishlist.types";
import { removeFromWishlistAction, moveToCartAction } from "@/app/store/wishlist/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { formatPaise } from "@/lib/format-price";

interface AccountUser {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  buyerType: string;
  buyerApproved: boolean;
  partyGstin: string | null;
  createdAt: Date;
}

type AccountTab = "overview" | "orders" | "addresses" | "profile" | "wishlist" | "security";

interface AccountClientProps {
  user: AccountUser;
  initialAddresses: SavedAddressDto[];
  initialOrders: OrderSummary[];
  initialWishlistItems?: WishlistItemDto[];
  cartCount?: number;
  cartTotalRupees?: number;
  wishlistCount?: number;
  categories?: Array<{ id: string; name: string }>;
  initialTab?: AccountTab;
}

export function AccountClient({
  user,
  initialAddresses,
  initialOrders,
  initialWishlistItems = [],
  cartCount = 0,
  cartTotalRupees = 0,
  wishlistCount = 0,
  categories = [],
  initialTab = "overview",
}: AccountClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AccountTab>(initialTab || "overview");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Wishlist State
  const [wishlistItems, setWishlistItems] = useState<WishlistItemDto[]>(initialWishlistItems);
  const [wishlistActionId, setWishlistActionId] = useState<string | null>(null);

  // Profile Form State
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email || "");
  const [profileGstin, setProfileGstin] = useState(user.partyGstin || "");
  const [profileMessage, setProfileMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Addresses State
  const [addresses, setAddresses] = useState<SavedAddressDto[]>(initialAddresses);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    name: user.name || "",
    phone: user.phone || "",
    addressLine: "",
    area: "",
    city: "",
    state: "Bihar",
    pincode: "",
    type: "SHOP" as UserAddressType,
    isDefault: false,
  });

  const handleFetchCurrentLocation = () => {
    setIsDetectingLocation(true);
    setAddressSaveError(null);
    setLocationSuccessMsg(null);

    let hasResolved = false;

    const applyAddressFromLocation = (data: {
      area?: string;
      city?: string;
      state?: string;
      pincode?: string;
      road?: string;
    }) => {
      setNewAddress((prev) => ({
        ...prev,
        area: data.area || prev.area,
        city: data.city || prev.city,
        state: data.state || prev.state,
        pincode: data.pincode || prev.pincode,
        addressLine: prev.addressLine || (data.road ? data.road : prev.addressLine),
      }));
      const cityLabel = [data.area, data.city, data.pincode].filter(Boolean).join(", ");
      setLocationSuccessMsg(`📍 Location detected: ${cityLabel}. Please verify Flat/Shop No.`);
      const locLabel = [data.area, data.city].filter(Boolean).join(", ") || data.city || "";
      const fullText = data.pincode ? `${locLabel} (${data.pincode})` : locLabel;
      try {
        localStorage.setItem(
          "jmd_delivery_location",
          JSON.stringify({
            display: fullText,
            area: data.area,
            city: data.city,
            state: data.state,
            pincode: data.pincode,
            isUserSelected: true,
          })
        );
        window.dispatchEvent(new CustomEvent("jmd_location_updated", { detail: { display: fullText } }));
      } catch {}
    };

    const fallbackIpCascade = async () => {
      // 1. Server route (queries ip-api -> ipapi.co -> freeipapi)
      try {
        const res = await fetch("/api/store/geo/reverse?mode=ip");
        const data = await res.json();
        if (data.success && data.city && data.source !== "fallback") {
          applyAddressFromLocation(data);
          setIsDetectingLocation(false);
          return true;
        }
      } catch {}

      // 2. Direct client-side BigDataCloud
      try {
        const bdcRes = await fetch("https://api.bigdatacloud.net/data/reverse-geocode-client");
        if (bdcRes.ok) {
          const d = await bdcRes.json();
          const city = d.city || d.locality || d.principalSubdivision;
          if (city) {
            applyAddressFromLocation({
              area: d.locality || city,
              city,
              state: d.principalSubdivision || "",
              pincode: d.postcode || "",
            });
            setIsDetectingLocation(false);
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
            applyAddressFromLocation({
              area: d.city,
              city: d.city,
              state: d.region || "",
              pincode: d.postal || "",
            });
            setIsDetectingLocation(false);
            return true;
          }
        }
      } catch {}

      setIsDetectingLocation(false);
      return false;
    };

    // Safety fallback timer: gives mobile users 8s to accept browser prompt!
    const fallbackTimer = setTimeout(async () => {
      if (hasResolved) return;
      hasResolved = true;
      const ok = await fallbackIpCascade();
      if (!ok) {
        setAddressSaveError("Could not detect location automatically. Please enter your address.");
      }
    }, 8000);

    if (typeof window === "undefined" || !navigator.geolocation) {
      clearTimeout(fallbackTimer);
      fallbackIpCascade();
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
            applyAddressFromLocation(data);
          } else {
            await fallbackIpCascade();
          }
        } catch {
          await fallbackIpCascade();
        } finally {
          setIsDetectingLocation(false);
        }
      },
      async () => {
        if (hasResolved) return;
        hasResolved = true;
        clearTimeout(fallbackTimer);
        const ok = await fallbackIpCascade();
        if (!ok) {
          setAddressSaveError("Location permission denied. Please enter address manually.");
        }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  };

  // Orders State
  const [reorderFeedback, setReorderFeedback] = useState<string | null>(null);

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("name", profileName);
      fd.append("email", profileEmail);
      fd.append("gstin", profileGstin);

      const res = await updateProfileAction(fd);
      if (res.success) {
        setProfileMessage({ type: "ok", text: "Profile details updated successfully!" });
        router.refresh();
      } else {
        setProfileMessage({ type: "err", text: res.error || "Failed to update profile" });
      }
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("currentPassword", currentPassword);
      fd.append("newPassword", newPassword);
      fd.append("confirmPassword", confirmPassword);

      const res = await changeUserPasswordAction(fd);
      if (res.success) {
        setPasswordMessage({ type: "ok", text: "Your password has been changed successfully!" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ type: "err", text: res.error || "Failed to update password" });
      }
    });
  };

  const handleOpenNewAddressForm = () => {
    setEditingAddressId(null);
    setNewAddress({
      name: user.name || "",
      phone: user.phone || "",
      addressLine: "",
      area: "",
      city: "",
      state: "Bihar",
      pincode: "",
      type: "SHOP",
      isDefault: addresses.length === 0,
    });
    setAddressSaveError(null);
    setShowNewAddressForm(true);
  };

  const handleEditAddress = (addr: SavedAddressDto) => {
    setEditingAddressId(addr.id);
    setNewAddress({
      name: addr.name,
      phone: addr.phone,
      addressLine: addr.addressLine,
      area: addr.area,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      type: addr.type,
      isDefault: addr.isDefault,
    });
    setAddressSaveError(null);
    setShowNewAddressForm(true);
  };

  const handleCancelAddressForm = () => {
    setShowNewAddressForm(false);
    setEditingAddressId(null);
    setAddressSaveError(null);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressSaveError(null);
    try {
      const payload = {
        ...newAddress,
        id: editingAddressId || undefined,
      };
      const res = await saveUserAddressAction(payload);
      if (!res.success || !res.address) {
        throw new Error(res.error || "Failed to save address");
      }
      
      const saved = res.address;
      if (editingAddressId) {
        setAddresses((prev) =>
          prev.map((a) => {
            if (a.id === saved.id) return saved;
            if (saved.isDefault) return { ...a, isDefault: false };
            return a;
          })
        );
      } else {
        setAddresses((prev) => {
          const others = saved.isDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev;
          return [saved, ...others];
        });
      }

      setShowNewAddressForm(false);
      setEditingAddressId(null);
      setNewAddress({
        name: user.name || "",
        phone: user.phone || "",
        addressLine: "",
        area: "",
        city: "",
        state: "Bihar",
        pincode: "",
        type: "SHOP",
        isDefault: false,
      });
      router.refresh();
    } catch (err: any) {
      let msg = err.message || "Failed to save address";
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed)) {
          msg = parsed.map((i: any) => i.message || "Invalid input").join(" • ");
        }
      } catch {}
      setAddressSaveError(msg);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    const res = await deleteUserAddressAction(id);
    if (res.success) {
      setAddresses(addresses.filter((a) => a.id !== id));
      if (editingAddressId === id) {
        handleCancelAddressForm();
      }
      router.refresh();
    }
  };

  const handleSetDefault = async (id: string) => {
    // Optimistic UI update
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    const res = await setDefaultAddressAction(id);
    if (!res.success) {
      // Revert if failed
      router.refresh();
    }
  };

  const handleReorder = (orderId: string) => {
    startTransition(async () => {
      setReorderFeedback(null);
      const res = await reorderOrderAction(orderId);
      if (res.success) {
        setReorderFeedback(`Added ${res.addedCount} items to your shopping cart!`);
        setTimeout(() => {
          router.push("/store/cart");
        }, 600);
      } else {
        alert(res.error || "Failed to reorder items");
      }
    });
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.DELIVERED:
        return "bg-emerald-100 text-emerald-800 border-emerald-300";
      case OrderStatus.DISPATCHED:
        return "bg-indigo-100 text-indigo-800 border-indigo-300";
      case OrderStatus.PROCESSING:
        return "bg-purple-100 text-purple-800 border-purple-300";
      case OrderStatus.CONFIRMED:
        return "bg-blue-100 text-blue-800 border-blue-300";
      case OrderStatus.CANCELLED:
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-amber-100 text-amber-800 border-amber-300";
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col justify-between">
      {/* 1. Header */}
      <StoreHeader
        cartCount={cartCount}
        cartTotalRupees={cartTotalRupees}
        wishlistCount={wishlistItems.length}
        userName={user.name}
        isLoggedIn={true}
        categories={categories}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-32 md:pt-24 pb-24 md:pb-12 bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-4 sm:py-6 space-y-6">
          {/* Toast / Feedback */}
          {reorderFeedback && (
            <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              <span>{reorderFeedback}</span>
            </div>
          )}

          {/* OVERVIEW VIEW (Only shown on /store/account without tab) */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-in">
              {/* Profile Welcome Header Card */}
              <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-3xl shadow-sm border border-surface-container-high/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl sm:text-2xl font-headline shrink-0 border border-primary/20">
                    {user.name ? user.name.slice(0, 2).toUpperCase() : "CU"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="font-headline text-lg sm:text-2xl font-black text-on-surface truncate">
                        {user.name}
                      </h1>
                      <span className="text-[10px] bg-secondary-fixed text-on-secondary-fixed font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                        {user.buyerType === "WHOLESALER"
                          ? "🏢 Wholesaler"
                          : user.buyerType === "RETAILER"
                          ? "🏪 Kirana Retailer"
                          : "🛒 Customer"}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-on-surface-variant mt-1">
                      <span className="flex items-center gap-1 font-mono font-medium">
                        <span className="material-symbols-outlined text-[14px] text-primary">smartphone</span>
                        +91 {user.phone}
                      </span>
                      {user.email && (
                        <span className="flex items-center gap-1 text-on-surface-variant truncate">
                          <span className="hidden sm:inline opacity-40">•</span>
                          <span className="material-symbols-outlined text-[14px] text-secondary">alternate_email</span>
                          <span className="truncate">{user.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-surface-container-high/60">
                  <Link
                    href="/store"
                    className="flex-1 md:flex-none justify-center px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                    <span>Continue Shopping</span>
                  </Link>
                  <Link
                    href="/logout"
                    className="px-3.5 py-2.5 rounded-xl border border-outline-variant/60 hover:bg-red-50 hover:text-error text-on-surface-variant text-xs font-semibold transition-all flex items-center gap-1"
                    title="Sign out of account"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span className="hidden sm:inline">Sign Out</span>
                  </Link>
                </div>
              </div>

              {/* Account Feature Cards Grid (Flipkart/Amazon style) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                  href="/store/account?tab=orders"
                  onClick={() => setActiveTab("orders")}
                  className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high hover:border-primary/40 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">package_2</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>My Orders</span>
                      <span className="text-xs bg-surface-container-high text-on-surface-variant font-semibold px-2 py-0.5 rounded-full">
                        {initialOrders.length}
                      </span>
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Track current orders, re-order staples &amp; download GST invoices.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/store/account?tab=addresses"
                  onClick={() => setActiveTab("addresses")}
                  className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high hover:border-primary/40 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">location_on</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>Saved Addresses</span>
                      <span className="text-xs bg-surface-container-high text-on-surface-variant font-semibold px-2 py-0.5 rounded-full">
                        {addresses.length}
                      </span>
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Manage delivery destinations for your shop, godown, or residence.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/store/account?tab=profile"
                  onClick={() => setActiveTab("profile")}
                  className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high hover:border-primary/40 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">badge</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
                      Profile &amp; GST Details
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Update contact details and registered GSTIN for B2B input tax credit.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/store/wishlist"
                  className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high hover:border-primary/40 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">favorite</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>My Wishlist</span>
                      <span className="text-xs bg-rose-50 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                        {wishlistItems.length}
                      </span>
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Explore saved FMCG products and quickly add them to your cart.
                    </p>
                  </div>
                </Link>

                <Link
                  href="/store/account?tab=security"
                  onClick={() => setActiveTab("security")}
                  className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high hover:border-primary/40 hover:shadow-md transition-all group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[26px]">lock</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-headline font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
                      Change Password
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Keep your account safe by updating your secret password.
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          )}

          {/* DEDICATED INDIVIDUAL PAGE HEADER (Shown when on addresses, orders, profile, security) */}
          {activeTab !== "overview" && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-4">
              <div className="space-y-1">
                <nav className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                  <Link href="/" className="hover:text-primary transition-colors">Home</Link>
                  <span>/</span>
                  <Link
                    href="/store/account"
                    onClick={() => setActiveTab("overview")}
                    className="hover:text-primary transition-colors"
                  >
                    Account
                  </Link>
                  <span>/</span>
                  <span className="text-on-surface font-semibold capitalize">
                    {activeTab === "addresses"
                      ? "Saved Addresses"
                      : activeTab === "orders"
                      ? "My Orders"
                      : activeTab === "profile"
                      ? "Profile & GST"
                      : activeTab === "security"
                      ? "Change Password"
                      : "Wishlist"}
                  </span>
                </nav>
                <h1 className="font-headline text-xl sm:text-2xl font-black text-on-surface">
                  {activeTab === "addresses"
                    ? `Saved Delivery Addresses (${addresses.length})`
                    : activeTab === "orders"
                    ? `My Orders (${initialOrders.length})`
                    : activeTab === "profile"
                    ? "Profile & GST Details"
                    : activeTab === "security"
                    ? "Change Password & Security"
                    : "My Saved Wishlist"}
                </h1>
              </div>

              <Link
                href="/store/account"
                onClick={() => setActiveTab("overview")}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-outline-variant/60 hover:bg-surface-container-low text-xs font-bold text-on-surface transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>All Account Options</span>
              </Link>
            </div>
          )}

          {/* TAB 1: ORDERS */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {initialOrders.length === 0 ? (
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high p-12 text-center space-y-3 shadow-sm">
                  <span className="text-5xl block">📦</span>
                  <h3 className="font-bold text-base text-on-surface font-headline">No Orders Placed Yet</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    You haven&apos;t placed any orders yet. Explore our live catalog with wholesale volume slabs and 30-min delivery.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/store"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-xs hover:bg-primary-container"
                    >
                      Start Shopping →
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {initialOrders.map((order) => {
                    const totalRupees = formatPaise(order.totalPaise);
                    const formattedDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={order.id}
                        className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md transition-shadow flex flex-col gap-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container-high pb-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-sm text-primary">
                              #{order.orderNumber}
                            </span>
                            <span className="text-xs text-on-surface-variant">• {formattedDate}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(
                                order.status
                              )}`}
                            >
                              ● {order.status}
                            </span>
                          </div>
                        </div>

                        {/* Order Details Preview */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div>
                            <div className="text-xs text-on-surface-variant mb-1">
                              Fulfillment: <strong className="text-on-surface">{order.deliveryZoneName}</strong>
                            </div>
                            <div className="text-xs text-on-surface-variant">
                              Delivery Address:{" "}
                              <span className="text-on-surface font-medium line-clamp-1">
                                {order.deliveryAddress}
                              </span>
                            </div>
                            {order.invoiceNumber && (
                              <div className="text-[11px] text-tertiary font-bold mt-1">
                                Official Tax Invoice: #{order.invoiceNumber}
                              </div>
                            )}
                          </div>

                          <div className="text-left sm:text-right shrink-0">
                            <div className="text-xs text-on-surface-variant">Total Amount</div>
                            <div className="text-lg font-black text-primary font-mono">₹{totalRupees}</div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high flex-wrap">
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleReorder(order.id)}
                            className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">sync</span>
                            <span>Re-Order Items</span>
                          </button>
                          <Link
                            href={`/store/orders/${order.id}`}
                            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:bg-primary-container transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <span>Track Order &amp; Tax Invoice</span>
                            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ADDRESSES */}
          {activeTab === "addresses" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-base sm:text-lg font-bold text-on-surface">Manage Delivery Addresses</h2>
                  <p className="text-xs text-on-surface-variant">
                    Save delivery addresses for your kirana shop, retail counter, warehouse, or home.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={showNewAddressForm ? handleCancelAddressForm : handleOpenNewAddressForm}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-xs self-start sm:self-auto cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showNewAddressForm ? "close" : "add_location_alt"}
                  </span>
                  <span>{showNewAddressForm ? "Close Form" : "+ Add New Address"}</span>
                </button>
              </div>

              {/* Add / Edit Address Form */}
              {showNewAddressForm && (
                <div className="bg-surface-container-lowest p-4 sm:p-6 rounded-3xl border-2 border-primary/40 shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                    <span className="text-sm sm:text-base font-bold text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px]">
                        {editingAddressId ? "edit_location_alt" : "add_home"}
                      </span>
                      <span>{editingAddressId ? "Edit Delivery Address" : "Add New Delivery Address"}</span>
                    </span>
                    <span className="text-[10px] text-outline font-semibold">Pan-Bihar &amp; India Delivery</span>
                  </div>

                  {/* Location Auto-Detect Strip */}
                  <div className="p-3.5 bg-primary/5 rounded-2xl border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <span className="material-symbols-outlined text-[20px]">my_location</span>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-on-surface">Use Current Location</div>
                        <div className="text-[11px] text-on-surface-variant">Auto-detect area, city and pincode</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchCurrentLocation}
                      disabled={isDetectingLocation}
                      className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer shrink-0"
                    >
                      {isDetectingLocation ? (
                        <>
                          <span className="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                          <span>Detecting location...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">near_me</span>
                          <span>Detect My Location</span>
                        </>
                      )}
                    </button>
                  </div>

                  {locationSuccessMsg && (
                    <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
                      <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">check_circle</span>
                      <span>{locationSuccessMsg}</span>
                    </div>
                  )}

                  {addressSaveError && (
                    <div className="bg-error-container/40 text-error text-xs p-3.5 rounded-xl border border-error/30 flex items-center gap-2 font-medium">
                      <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                      <span>{addressSaveError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveAddress} className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                    <div>
                      <label className="block text-[11px] font-bold text-on-surface mb-1">
                        Contact Person Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newAddress.name}
                        onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                        placeholder="e.g. Ramesh Kumar"
                        className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-on-surface mb-1">
                        10-Digit Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        value={newAddress.phone}
                        onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                        placeholder="e.g. 94314XXXXX"
                        className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface font-mono focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-on-surface mb-1">
                        Flat / House No. / Shop No. &amp; Street *
                      </label>
                      <input
                        type="text"
                        required
                        value={newAddress.addressLine}
                        onChange={(e) => setNewAddress({ ...newAddress, addressLine: e.target.value })}
                        placeholder="e.g. Shop No. 12, Station Road, Near Shankar Chowk"
                        className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-on-surface mb-1">
                        Market / Area / Ward *
                      </label>
                      <input
                        type="text"
                        required
                        value={newAddress.area}
                        onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                        placeholder="e.g. Purab Bazar, Naya Bazar, Bariyahi"
                        className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="sm:col-span-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">City / Town *</label>
                        <input
                          type="text"
                          required
                          value={newAddress.city}
                          onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                          placeholder="e.g. Gurugram, Patna, Delhi"
                          className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">State *</label>
                        <input
                          type="text"
                          required
                          value={newAddress.state}
                          onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                          placeholder="Bihar"
                          className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">Pincode *</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                          placeholder="852201"
                          className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface font-mono focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-on-surface mb-1.5">
                        Address Category Tag
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {(["SHOP", "HOME", "WORK", "OTHER"] as UserAddressType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewAddress({ ...newAddress, type: t })}
                            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                              newAddress.type === t
                                ? "bg-primary text-white border-primary shadow-2xs"
                                : "bg-white text-on-surface border-outline-variant/60 hover:bg-surface-container"
                            }`}
                          >
                            {t === "SHOP" && "🏪 Shop"}
                            {t === "HOME" && "🏠 Home"}
                            {t === "WORK" && "🏢 Work"}
                            {t === "OTHER" && "📍 Other"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="makeDefaultAccount"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                        className="w-4 h-4 text-primary rounded border-outline-variant/60 focus:ring-primary cursor-pointer"
                      />
                      <label htmlFor="makeDefaultAccount" className="text-xs text-on-surface font-medium cursor-pointer">
                        Make this my default delivery address
                      </label>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                      <button
                        type="button"
                        onClick={handleCancelAddressForm}
                        className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>{editingAddressId ? "Update Address" : "Save Address"}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Saved Addresses List */}
              {addresses.length === 0 ? (
                <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high text-center space-y-3">
                  <span className="material-symbols-outlined text-[36px] text-outline">location_off</span>
                  <p className="text-xs font-bold text-on-surface">No saved delivery addresses</p>
                  <p className="text-[11px] text-on-surface-variant max-w-sm mx-auto">
                    Add your kirana shop or home address so you can checkout with one tap.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenNewAddressForm}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-xs hover:bg-primary-container"
                  >
                    + Add Your First Address
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border transition-all ${
                        addr.isDefault
                          ? "border-primary/60 shadow-sm ring-1 ring-primary/10"
                          : "border-surface-container-high hover:border-outline-variant/60"
                      } flex flex-col justify-between gap-4`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                            <span className="text-sm">
                              {addr.type === "SHOP" ? "🏪" : addr.type === "HOME" ? "🏠" : "🏢"}
                            </span>
                            <span>{addr.name}</span>
                          </span>
                          {addr.isDefault && (
                            <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <span>★</span>
                              <span>Default Address</span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed break-words">
                          {addr.formattedAddress}
                        </p>
                        <div className="text-xs text-outline font-mono flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <span>+91 {addr.phone}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between pt-3 border-t border-surface-container-high text-xs gap-2">
                        {!addr.isDefault ? (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr.id)}
                            className="font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[15px]">star</span>
                            <span>Set as Default</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-primary font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>
                            <span>Primary Address</span>
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleEditAddress(addr)}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-on-surface font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Edit this address"
                          >
                            <span className="material-symbols-outlined text-[15px] text-primary">edit</span>
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant/60 hover:bg-red-50 text-outline hover:text-error font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            title="Delete this address"
                          >
                            <span className="material-symbols-outlined text-[15px]">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROFILE & GST */}
          {activeTab === "profile" && (
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm max-w-2xl space-y-5">
              <div>
                <h2 className="font-headline text-base font-bold text-on-surface">Account &amp; Business Profile</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Update your contact details and registered GSTIN for B2B input tax invoicing.
                </p>
              </div>

              {profileMessage && (
                <div
                  className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between border ${
                    profileMessage.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-red-50 text-red-800 border-red-200"
                  }`}
                >
                  <span>{profileMessage.text}</span>
                  <button onClick={() => setProfileMessage(null)} className="underline ml-4">
                    ✕
                  </button>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">
                    Customer / Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface font-semibold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">
                    Mobile Number (Verified)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      disabled
                      value={user.phone}
                      className="w-full bg-surface-container px-3.5 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-mono text-on-surface-variant font-semibold"
                    />
                    <span className="absolute right-3 text-[11px] text-tertiary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[15px]">verified</span>
                      Verified
                    </span>
                  </div>
                  <span className="text-[10px] text-outline mt-1 block">
                    Mobile number is linked to your account authentication and delivery SMS dispatches.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    value={profileEmail}
                    onChange={(e) => setProfileEmail(e.target.value)}
                    placeholder="shop@example.com"
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-on-surface mb-1">
                    Commercial GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    value={profileGstin}
                    onChange={(e) => setProfileGstin(e.target.value.toUpperCase())}
                    placeholder="10AAAAA0000A1Z5"
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface uppercase font-mono focus:outline-none focus:border-primary"
                  />
                  <span className="text-[10px] text-outline mt-1 block">
                    Required to claim Input Tax Credit (ITC) for registered Bihar wholesale buyers.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>💾</span>
                    <span>{isPending ? "Saving..." : "Save Profile Details"}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: MY WISHLIST */}
          {activeTab === "wishlist" && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high">
                <div>
                  <h2 className="font-headline text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2">
                    <span className="text-red-500">❤️</span>
                    <span>Saved Wishlist Items</span>
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Keep track of items you plan to reorder or buy in upcoming depot restocks.
                  </p>
                </div>
                <Link
                  href="/store/wishlist"
                  className="text-xs font-bold text-primary hover:underline self-start sm:self-auto flex items-center gap-1"
                >
                  <span>Open Dedicated Wishlist Page</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
                </Link>
              </div>

              {wishlistItems.length === 0 ? (
                <div className="bg-surface-container-lowest p-12 rounded-2xl border border-surface-container-high text-center space-y-3">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-50 text-red-500 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px]">favorite_border</span>
                  </div>
                  <h3 className="font-headline text-base font-bold text-on-surface">No Items in Wishlist</h3>
                  <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                    You haven&apos;t saved any products yet. Browse the catalogue and tap the heart icon on any item!
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/store"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                    >
                      Browse Catalogue
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {wishlistItems.map((item) => {
                    const isBusy = wishlistActionId === item.productId && isPending;

                    return (
                      <div
                        key={item.id}
                        className="bg-surface-container-lowest rounded-2xl border border-surface-container-high/80 p-4 flex flex-col justify-between hover:shadow-md transition-all relative group"
                      >
                        <div className="absolute top-3 right-3 z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setWishlistActionId(item.productId);
                              startTransition(async () => {
                                try {
                                  const res = await removeFromWishlistAction(item.productId);
                                  if (res.success) {
                                    setWishlistItems((prev) => prev.filter((i) => i.productId !== item.productId));
                                  }
                                } finally {
                                  setWishlistActionId(null);
                                }
                              });
                            }}
                            disabled={isBusy}
                            title="Remove from Wishlist"
                            className="w-8 h-8 rounded-full bg-white/90 hover:bg-red-50 text-outline hover:text-error border border-surface-container-high flex items-center justify-center transition-all shadow-2xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>

                        <div>
                          <Link href={`/store/products/${item.productId}`} className="block text-center py-2">
                            <div className="w-full h-36 flex items-center justify-center">
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-20 h-20 rounded-xl bg-surface-container-high flex items-center justify-center text-outline text-2xl">
                                  📦
                                </div>
                              )}
                            </div>
                          </Link>

                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-1.5 text-[10px] text-outline">
                              <span className="font-semibold text-primary">{item.companyName || "Depot"}</span>
                              {item.weight && (
                                <>
                                  <span>•</span>
                                  <span className="font-bold text-on-surface">{item.weight}</span>
                                </>
                              )}
                            </div>
                            <Link
                              href={`/store/products/${item.productId}`}
                              className="font-headline font-bold text-xs text-on-surface group-hover:text-primary transition-colors line-clamp-2"
                            >
                              {item.name}
                            </Link>

                            <div className="mt-1">
                              {item.inStock ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  Ready to dispatch
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                                  Restocking
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-surface-container-high/60 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-headline font-extrabold text-sm text-on-surface">
                                ₹{item.priceRupees.toLocaleString("en-IN")}
                              </span>
                              {item.mrpRupees > item.priceRupees && (
                                <span className="text-[11px] text-outline line-through">
                                  ₹{item.mrpRupees.toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                            {item.discountPercent > 0 && (
                              <span className="text-[10px] font-bold text-secondary">
                                {item.discountPercent}% OFF
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setWishlistActionId(item.productId);
                              startTransition(async () => {
                                try {
                                  const res = await moveToCartAction(item.productId, 1);
                                  if (res.success) {
                                    setWishlistItems((prev) => prev.filter((i) => i.productId !== item.productId));
                                    router.push("/store/cart");
                                  }
                                } finally {
                                  setWishlistActionId(null);
                                }
                              });
                            }}
                            disabled={isBusy || !item.inStock}
                            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                              item.inStock
                                ? "bg-primary hover:bg-primary-container text-white"
                                : "bg-surface-container-high text-outline cursor-not-allowed"
                            }`}
                          >
                            {isBusy ? (
                              <span>Moving...</span>
                            ) : item.inStock ? (
                              <>
                                <span className="material-symbols-outlined text-[15px]">shopping_bag</span>
                                <span>Move to Basket</span>
                              </>
                            ) : (
                              <span>Out of Stock</span>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SECURITY & CHANGE PASSWORD */}
          {activeTab === "security" && (
            <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm max-w-xl space-y-5 animate-fade-in">
              <div>
                <h2 className="font-headline text-base font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">lock_reset</span>
                  <span>Change Password</span>
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Update your password to keep your buyer account and delivery orders secure.
                </p>
              </div>

              {passwordMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                    passwordMessage.type === "ok"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-error-container/40 text-error border border-error/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {passwordMessage.type === "ok" ? "check_circle" : "error"}
                  </span>
                  <span>{passwordMessage.text}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Current Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    New Password (min 6 characters) *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface mb-1">
                    Confirm New Password *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-white px-3.5 py-2.5 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-6 py-2.5 bg-primary hover:bg-primary-container text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">save</span>
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
