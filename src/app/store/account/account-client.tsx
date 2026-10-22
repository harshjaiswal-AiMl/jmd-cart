"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SavedAddressDto, UserAddressType } from "@/modules/address/address.types";
import { OrderSummary, OrderStatus } from "@/modules/order/order.types";
import { updateProfileAction } from "./actions";
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

interface AccountClientProps {
  user: AccountUser;
  initialAddresses: SavedAddressDto[];
  initialOrders: OrderSummary[];
  initialWishlistItems?: WishlistItemDto[];
  cartCount?: number;
  cartTotalRupees?: number;
  wishlistCount?: number;
  categories?: Array<{ id: string; name: string }>;
  initialTab?: "orders" | "addresses" | "profile" | "wishlist";
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
  initialTab = "orders",
}: AccountClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "profile" | "wishlist">(initialTab);
  const [isPending, startTransition] = useTransition();

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
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);
  const [newAddress, setNewAddress] = useState({
    name: user.name || "",
    phone: user.phone || "",
    addressLine: "",
    area: "Purab Bazar",
    city: "Saharsa",
    state: "Bihar",
    pincode: "852201",
    type: "SHOP" as UserAddressType,
    isDefault: false,
  });

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

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressSaveError(null);
    try {
      const res = await saveUserAddressAction(newAddress);
      if (!res.success || !res.address) {
        throw new Error(res.error || "Failed to save address");
      }
      setAddresses([res.address, ...addresses.filter((a) => a.id !== res.address!.id)]);
      setShowNewAddressForm(false);
      setNewAddress({
        name: user.name || "",
        phone: user.phone || "",
        addressLine: "",
        area: "Purab Bazar",
        city: "Saharsa",
        state: "Bihar",
        pincode: "852201",
        type: "SHOP",
        isDefault: false,
      });
      router.refresh();
    } catch (err: any) {
      setAddressSaveError(err.message || "Failed to save address");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    const res = await deleteUserAddressAction(id);
    if (res.success) {
      setAddresses(addresses.filter((a) => a.id !== id));
      router.refresh();
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultAddressAction(id);
    if (res.success) {
      setAddresses(
        addresses.map((a) => ({
          ...a,
          isDefault: a.id === id,
        }))
      );
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
      <main className="flex-1 w-full pt-[168px] md:pt-36 pb-20 md:pb-8 bg-surface">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Toast / Feedback */}
          {reorderFeedback && (
            <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              <span>{reorderFeedback}</span>
            </div>
          )}

          {/* Profile Welcome Header Card */}
          <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl font-headline shrink-0 border border-primary/20">
                {user.name ? user.name.slice(0, 2).toUpperCase() : "CU"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-headline text-xl sm:text-2xl font-bold text-on-surface">
                    {user.name}
                  </h1>
                  <span className="text-[10px] bg-secondary-fixed text-on-secondary-fixed font-bold px-2.5 py-0.5 rounded-full uppercase">
                    {user.buyerType === "WHOLESALER"
                      ? "🏢 Wholesaler"
                      : user.buyerType === "RETAILER"
                      ? "🏪 Kirana Retailer"
                      : "🛒 Customer"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1 font-mono">
                  <span>📱 +91 {user.phone}</span>
                  {user.email && (
                    <>
                      <span>•</span>
                      <span>✉️ {user.email}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
              <Link
                href="/store"
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">storefront</span>
                <span>Continue Shopping</span>
              </Link>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-surface-container-high pb-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "orders"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">package_2</span>
              <span>My Orders ({initialOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("addresses")}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "addresses"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">location_on</span>
              <span>Saved Addresses ({addresses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "profile"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">badge</span>
              <span>Profile &amp; GST Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("wishlist")}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shrink-0 ${
                activeTab === "wishlist"
                  ? "bg-primary text-white shadow-xs"
                  : "bg-surface-container-low text-on-surface hover:bg-surface-container"
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-red-500">favorite</span>
              <span>My Wishlist ({wishlistItems.length})</span>
            </button>
          </div>

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
                    const totalRupees = Math.round(order.totalPaise / 100);
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
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline text-base font-bold text-on-surface">Manage Delivery Addresses</h2>
                  <p className="text-xs text-on-surface-variant">
                    Save multiple delivery addresses for your kirana shop, warehouse, or home.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                  className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                  <span>{showNewAddressForm ? "Close Form" : "+ Add New Address"}</span>
                </button>
              </div>

              {/* Add New Address Collapsible Form */}
              {showNewAddressForm && (
                <div className="bg-surface-container-lowest p-5 rounded-2xl border-2 border-primary/40 shadow-sm space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
                    <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[20px]">add_home</span>
                      Add New Delivery Address
                    </span>
                    <span className="text-[10px] text-outline">Saharsa Ward Hub</span>
                  </div>

                  {addressSaveError && (
                    <div className="bg-error-container text-on-error-container text-xs p-3 rounded-xl border border-error">
                      {addressSaveError}
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
                        className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
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
                        className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface font-mono focus:outline-none focus:border-primary"
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
                        className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
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
                        className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">City</label>
                        <input
                          type="text"
                          disabled
                          value="Saharsa"
                          className="w-full bg-surface-container px-3 py-2 rounded-xl border border-outline-variant/30 text-xs text-on-surface-variant font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-on-surface mb-1">Pincode</label>
                        <input
                          type="text"
                          value={newAddress.pincode}
                          onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                          className="w-full bg-white px-3 py-2 rounded-xl border border-outline-variant/60 text-xs text-on-surface font-mono"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-on-surface mb-1.5">
                        Address Category Tag
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(["SHOP", "HOME", "WORK", "OTHER"] as UserAddressType[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewAddress({ ...newAddress, type: t })}
                            className={`py-1.5 px-2 rounded-xl font-bold text-xs border transition-all ${
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
                        className="w-4 h-4 text-primary rounded border-outline-variant/60 focus:ring-primary"
                      />
                      <label htmlFor="makeDefaultAccount" className="text-xs text-on-surface font-medium cursor-pointer">
                        Make this my default delivery address
                      </label>
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-3 border-t border-surface-container-high">
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(false)}
                        className="px-4 py-2 text-xs text-on-surface-variant hover:text-on-surface"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        Save Address
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Saved Addresses List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className={`bg-surface-container-lowest p-5 rounded-2xl border ${
                      addr.isDefault ? "border-primary/60 shadow-sm" : "border-surface-container-high"
                    } flex flex-col justify-between gap-4`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                          <span className="text-sm">
                            {addr.type === "SHOP" ? "🏪" : addr.type === "HOME" ? "🏠" : "🏢"}
                          </span>
                          <span>{addr.name}</span>
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full">
                            ★ Default Address
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {addr.formattedAddress}
                      </p>
                      <div className="text-xs text-outline font-mono">
                        📱 Phone: +91 {addr.phone}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-surface-container-high text-xs">
                      {!addr.isDefault ? (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(addr.id)}
                          className="font-bold text-primary hover:underline"
                        >
                          Set as Default
                        </button>
                      ) : (
                        <span className="text-[11px] text-tertiary font-bold">Primary Address</span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-outline hover:text-error transition-colors flex items-center gap-1 font-semibold"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
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
        </div>
      </main>

      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
