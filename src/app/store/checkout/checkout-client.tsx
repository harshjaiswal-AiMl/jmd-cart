"use client";

import { useState, useTransition, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CartSummary } from "@/modules/cart/cart.service";
import { DeliveryZone } from "@/modules/delivery/delivery.types";
import { SavedAddressDto, UserAddressType } from "@/modules/address/address.types";
import { checkoutCartAction, CheckoutActionResult } from "./actions";
import { updateCartQtyAction, removeFromCartAction } from "@/app/store/cart/actions";
import { saveUserAddressAction, deleteUserAddressAction } from "./address-actions";
import { PaymentModeSettings } from "@/modules/settings/settings.types";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";

interface CheckoutClientProps {
  cart: CartSummary;
  deliveryZones: DeliveryZone[];
  paymentSettings: PaymentModeSettings;
  categories?: Array<{ id: string; name: string }>;
  savedAddresses?: SavedAddressDto[];
  isCreditParty?: boolean;
  creditPartyName?: string;
  userPhone?: string;
  userName?: string;
  userAddress?: string;
  userGstin?: string;
}

function PlaceOrderButton({ disabled, isPending }: { disabled?: boolean; isPending?: boolean }) {
  const { pending } = useFormStatus();
  const loading = pending || isPending;

  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full py-3.5 px-5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] disabled:opacity-50 text-center flex items-center justify-center gap-2"
    >
      {loading ? (
        <>
          <span className="material-symbols-outlined text-[18px] animate-spin">hourglass_top</span>
          <span>Placing Order & Reserving Stock...</span>
        </>
      ) : (
        <>
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>Confirm & Place Order</span>
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </>
      )}
    </button>
  );
}

export function CheckoutClient({
  cart,
  deliveryZones,
  paymentSettings,
  categories = [],
  savedAddresses = [],
  isCreditParty = false,
  creditPartyName = "",
  userPhone = "",
  userName = "",
  userAddress = "",
  userGstin = "",
}: CheckoutClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Saved Addresses State
  const [addresses, setAddresses] = useState<SavedAddressDto[]>(savedAddresses);
  const initialSelected = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string>(initialSelected?.id || "custom");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    name: userName || "",
    phone: userPhone || "",
    addressLine: "",
    area: "Purab Bazar",
    city: "Saharsa",
    state: "Bihar",
    pincode: "852201",
    type: "SHOP" as UserAddressType,
    isDefault: false,
  });

  const [selectedZoneCode, setSelectedZoneCode] = useState<string>(
    deliveryZones.length > 0 ? deliveryZones[0].code : "TOWN"
  );
  const [selectedSlot, setSelectedSlot] = useState<"evening" | "morning">("evening");
  const [gstEnabled, setGstEnabled] = useState<boolean>(!!userGstin);
  const [gstinValue, setGstinValue] = useState<string>(userGstin || "10AAECJ3829K1ZT");

  const [contactPhone, setContactPhone] = useState<string>(
    initialSelected?.phone || userPhone
  );
  const [addressValue, setAddressValue] = useState<string>(
    initialSelected?.formattedAddress ||
      userAddress ||
      "D.B. Road, Purab Bazar, Saharsa, Bihar - 852201"
  );
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [cartLines, setCartLines] = useState(cart.lines);

  // When selected address changes, sync addressValue and contactPhone
  const handleSelectAddress = (addr: SavedAddressDto) => {
    setSelectedAddressId(addr.id);
    setAddressValue(addr.formattedAddress);
    setContactPhone(addr.phone);
  };

  // Handle Save New Address
  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddress(true);
    setAddressSaveError(null);
    try {
      const res = await saveUserAddressAction(newAddress);
      if (!res.success || !res.address) {
        throw new Error(res.error || "Failed to save delivery address");
      }
      const updatedList = [res.address, ...addresses.filter((a) => a.id !== res.address!.id)];
      setAddresses(updatedList);
      handleSelectAddress(res.address);
      setShowNewAddressForm(false);
      // Reset form
      setNewAddress({
        name: userName || "",
        phone: userPhone || "",
        addressLine: "",
        area: "Purab Bazar",
        city: "Saharsa",
        state: "Bihar",
        pincode: "852201",
        type: "SHOP",
        isDefault: false,
      });
    } catch (err: any) {
      setAddressSaveError(err.message || "Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Remove this saved delivery address?")) return;
    const res = await deleteUserAddressAction(id);
    if (res.success) {
      const remaining = addresses.filter((a) => a.id !== id);
      setAddresses(remaining);
      if (selectedAddressId === id && remaining.length > 0) {
        handleSelectAddress(remaining[0]);
      }
    }
  };

  const defaultMode = paymentSettings.codEnabled
    ? "COD"
    : paymentSettings.upiDeliveryEnabled
    ? "UPI_DELIVERY"
    : isCreditParty && paymentSettings.creditEnabledForCreditParties
    ? "CREDIT"
    : "COD";

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>(defaultMode);

  const [state, formAction] = useFormState<CheckoutActionResult | undefined, FormData>(
    checkoutCartAction,
    undefined
  );

  useEffect(() => {
    if (state?.success && state?.orderId) {
      router.push(`/store/orders/${state.orderId}`);
    }
  }, [state, router]);

  const selectedZone = deliveryZones.find((z) => z.code === selectedZoneCode) || deliveryZones[0] || {
    code: "TOWN",
    name: "Saharsa Town",
    minOrderPaise: 50000,
    freeDeliveryThresholdPaise: 200000,
    deliveryChargePaise: 4000,
    estimatedDeliveryHours: 4,
    active: true,
  };

  const isDeliveryFree = cart.totalPaise >= selectedZone.freeDeliveryThresholdPaise;
  const deliveryFeePaise = isDeliveryFree ? 0 : selectedZone.deliveryChargePaise;
  const finalPayablePaise = cart.totalPaise + deliveryFeePaise;
  const progressPercent = Math.min(
    100,
    Math.round((cart.totalPaise / selectedZone.freeDeliveryThresholdPaise) * 100)
  );
  const deficitPaise = Math.max(0, selectedZone.freeDeliveryThresholdPaise - cart.totalPaise);

  const totalSavingsPaise = Math.max(0, cart.subtotalPaise - cart.totalPaise);
  const savingsPercent =
    cart.subtotalPaise > 0
      ? Math.round((totalSavingsPaise / cart.subtotalPaise) * 100)
      : 0;

  const handleUpdateQty = (productId: string, newQty: number) => {
    if (newQty < 1) return;
    startTransition(async () => {
      await updateCartQtyAction(productId, newQty);
      setCartLines((prev) =>
        prev.map((l) =>
          l.productId === productId
            ? {
                ...l,
                qty: newQty,
                pricing: {
                  ...l.pricing,
                  qty: newQty,
                  lineTotalPaise: l.pricing.unitPricePaise * newQty,
                },
              }
            : l
        )
      );
      router.refresh();
    });
  };

  const handleRemoveItem = (productId: string) => {
    startTransition(async () => {
      await removeFromCartAction(productId);
      setCartLines((prev) => prev.filter((l) => l.productId !== productId));
      router.refresh();
    });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Header */}
      <StoreHeader
        cartCount={cart.itemsCount}
        cartTotalRupees={Math.round(cart.totalPaise / 100)}
        userName={userName}
        isLoggedIn={true}
        categories={categories}
      />

      <main className="flex-1 w-full pt-[168px] md:pt-36 pb-20 md:pb-8 bg-surface">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 py-6 space-y-6">
          {/* Stepper Context Header */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/store"
                className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
                title="Back to Catalog"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </Link>
              <div>
                <span className="text-xs text-secondary uppercase tracking-widest block font-bold font-headline">
                  Checkout • Saharsa Ward Hub
                </span>
                <h1 className="font-headline text-xl lg:text-2xl text-primary font-bold">
                  Review Your Order • {cart.itemsCount} {cart.itemsCount === 1 ? "Product" : "Products"} ({cart.totalPieces} Pieces)
                </h1>
              </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl border border-surface-container-high text-xs">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-on-primary font-bold">1</span>
              <span className="font-bold text-primary">Basket</span>
              <span className="text-outline text-xs">→</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary text-on-secondary font-bold">2</span>
              <span className="font-bold text-secondary">Saharsa Address</span>
              <span className="text-outline text-xs">→</span>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-surface-container-high text-on-surface-variant font-bold">3</span>
              <span className="text-on-surface-variant font-medium">Payment</span>
            </div>
          </div>

          {/* Error Banner */}
          {state?.error && (
            <div className="bg-error-container text-on-error-container p-4 rounded-xl flex items-center gap-3 border border-error text-sm font-semibold">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>{state.error}</span>
            </div>
          )}

          {/* Form wrapper */}
          <form action={formAction}>
            <input type="hidden" name="deliveryZoneCode" value={selectedZoneCode} />
            <input type="hidden" name="deliveryAddress" value={addressValue} />
            <input type="hidden" name="contactPhone" value={contactPhone} />
            <input
              type="hidden"
              name="customerNotes"
              value={`Slot: ${selectedSlot === "evening" ? "Today 5-8 PM" : "Tomorrow 8-11 AM"}. GST: ${
                gstEnabled ? gstinValue : "None"
              }. Mode: ${selectedPaymentMode}. ${customerNotes}`}
            />

            {/* Main Dual Panel Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT SECTION (7 cols): Progress + Items + Address + Slot + GST */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Free Delivery Meter Card */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[22px]">local_shipping</span>
                      <span className="text-xs md:text-sm text-on-surface font-bold">
                        {isDeliveryFree ? (
                          <span className="text-tertiary">Congratulations! You unlocked Free Town Delivery!</span>
                        ) : (
                          <>
                            Add <span className="text-secondary font-bold">₹{Math.round(deficitPaise / 100)}</span> more to unlock <span className="text-tertiary font-bold">Free Town Delivery!</span>
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[11px] bg-tertiary-fixed text-on-tertiary-fixed font-bold px-2.5 py-0.5 rounded-full">
                      ₹{Math.round(cart.totalPaise / 100)} / ₹{Math.round(selectedZone.freeDeliveryThresholdPaise / 100)}
                    </span>
                  </div>

                  {/* Gauge Bar */}
                  <div className="w-full bg-surface-container-high rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-secondary-container h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>Standard Ward Rate: ₹{Math.round(selectedZone.deliveryChargePaise / 100)}</span>
                    <span className="text-tertiary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">bolt</span>
                      Saharsa Express Ward 1–20 Qualified
                    </span>
                  </div>
                </div>

                {/* Basket Items List */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">shopping_cart</span>
                      <h2 className="text-sm font-bold text-on-surface font-headline">
                        Cart Items ({cartLines.length} Products)
                      </h2>
                    </div>
                    <span className="text-[11px] text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded font-bold">
                      Live Mandi Slabs Applied
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {cartLines.map((line) => {
                      const lineMrp = Math.round(line.mrpPaise / 100);
                      const linePrice = Math.round(line.pricing.unitPricePaise / 100);
                      const lineTotal = Math.round(line.pricing.lineTotalPaise / 100);
                      const perUnitSavings = lineMrp - linePrice;

                      return (
                        <div
                          key={line.productId}
                          className="bg-surface-container-low p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border border-surface-container-high"
                        >
                          <div className="flex items-center gap-3.5">
                            <Link
                              href={`/store/products/${line.productId}`}
                              className="w-14 h-14 rounded-xl bg-white border border-surface-container-high p-1 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-2xs group"
                            >
                              {line.imageUrl ? (
                                <img
                                  src={line.imageUrl}
                                  alt={line.productName}
                                  className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <span className="material-symbols-outlined text-[22px] text-outline">inventory_2</span>
                              )}
                            </Link>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {line.companyName && (
                                  <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">
                                    {line.companyName}
                                  </span>
                                )}
                                {line.weight && (
                                  <span className="text-[10px] bg-surface-container-high text-on-surface-variant font-semibold px-1.5 py-0.2 rounded">
                                    {line.weight}
                                  </span>
                                )}
                                <span className="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed px-1.5 py-0.2 rounded font-bold">
                                  {line.pricing.tier || "CUSTOMER"} Slab
                                </span>
                              </div>
                              <h3 className="text-xs sm:text-sm font-bold text-on-surface mt-1">
                                <Link
                                  href={`/store/products/${line.productId}`}
                                  className="hover:text-primary transition-colors line-clamp-1"
                                >
                                  {line.productName}
                                </Link>
                              </h3>
                              <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-xs font-bold text-primary font-mono">₹{linePrice}</span>
                                {perUnitSavings > 0 && (
                                  <>
                                    <span className="text-[11px] text-outline line-through">MRP ₹{lineMrp}</span>
                                    <span className="text-[10px] text-tertiary font-bold">Save ₹{perUnitSavings}/pc</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stepper & Line Total */}
                          <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                            <div className="flex items-center bg-surface-container-lowest rounded-lg p-1 shadow-sm border border-surface-container-high">
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(line.productId, line.qty - 1)}
                                className="w-7 h-7 flex items-center justify-center text-primary hover:bg-surface-container-low rounded font-bold"
                              >
                                -
                              </button>
                              <span className="w-8 text-center text-xs font-bold text-on-surface font-mono">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQty(line.productId, line.qty + 1)}
                                className="w-7 h-7 flex items-center justify-center text-primary hover:bg-surface-container-low rounded font-bold"
                              >
                                +
                              </button>
                            </div>

                            <div className="text-right min-w-[70px]">
                              <div className="text-sm font-bold text-on-surface font-mono">₹{lineTotal}</div>
                              <div className="text-[10px] text-outline">₹{linePrice}/pc</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(line.productId)}
                              className="text-outline hover:text-error transition-colors p-1"
                              title="Remove item"
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Suggestion banner */}
                  <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between border border-surface-container-high">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[20px]">add_circle</span>
                      <span className="text-xs text-on-surface font-semibold">
                        Need sugar, tea or bulk sacks for wholesale slab savings?
                      </span>
                    </div>
                    <Link href="/store/wholesale" className="text-xs font-bold text-primary hover:underline">
                      Explore Slabs →
                    </Link>
                  </div>
                </div>

                {/* Delivery Address Card with Multiple Saved Addresses */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[22px]">pin_drop</span>
                      <div>
                        <h2 className="text-sm font-bold text-on-surface font-headline">
                          Delivery Address (Select or Add New)
                        </h2>
                        <p className="text-[11px] text-on-surface-variant">
                          Orders are dispatched via Saharsa Express Tempo / E-Rickshaw directly to this address.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                      className="px-3 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-white text-xs font-bold transition-all flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {showNewAddressForm ? "close" : "add_location_alt"}
                      </span>
                      <span>{showNewAddressForm ? "Cancel" : "+ Add New Address"}</span>
                    </button>
                  </div>

                  {/* Add New Address Form Modal / Inline Collapsible */}
                  {showNewAddressForm && (
                    <div className="bg-surface-container-low p-4 rounded-xl border-2 border-primary/40 space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between border-b border-surface-container-high pb-2">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[18px]">add_home</span>
                          Add New Delivery Address
                        </span>
                        <span className="text-[10px] text-outline">Saharsa Ward 1 to 20</span>
                      </div>

                      {addressSaveError && (
                        <div className="bg-error-container text-on-error-container text-xs p-2.5 rounded-lg border border-error">
                          {addressSaveError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-on-surface mb-1">
                            Contact Person Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={newAddress.name}
                            onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                            placeholder="e.g. Ramesh Kumar / Shop In-Charge"
                            className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
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
                            className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs text-on-surface font-mono focus:outline-none focus:border-primary"
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
                            className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
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
                            className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs text-on-surface focus:outline-none focus:border-primary"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold text-on-surface mb-1">City</label>
                            <input
                              type="text"
                              disabled
                              value="Saharsa"
                              className="w-full bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/30 text-xs text-on-surface-variant font-semibold"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-on-surface mb-1">Pincode</label>
                            <input
                              type="text"
                              value={newAddress.pincode}
                              onChange={(e) => setNewAddress({ ...newAddress, pincode: e.target.value })}
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs text-on-surface font-mono"
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
                                className={`py-1.5 px-2 rounded-lg font-bold text-xs border transition-all ${
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
                            id="makeDefault"
                            checked={newAddress.isDefault}
                            onChange={(e) => setNewAddress({ ...newAddress, isDefault: e.target.checked })}
                            className="w-4 h-4 text-primary rounded border-outline-variant/60 focus:ring-primary"
                          />
                          <label htmlFor="makeDefault" className="text-xs text-on-surface font-medium cursor-pointer">
                            Make this my default delivery address
                          </label>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
                        <button
                          type="button"
                          onClick={() => setShowNewAddressForm(false)}
                          className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewAddress}
                          disabled={isSavingAddress || !newAddress.name || !newAddress.phone || !newAddress.addressLine}
                          className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                        >
                          {isSavingAddress ? "Saving..." : "Save & Deliver Here"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Saved Addresses List / Radio Cards */}
                  <div className="space-y-3">
                    {addresses.length === 0 ? (
                      <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high text-center">
                        <p className="text-xs font-semibold text-on-surface-variant">
                          No saved addresses found. Please click &quot;+ Add New Address&quot; above to add your shop or home.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {addresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => handleSelectAddress(addr)}
                              className={`p-3.5 rounded-xl cursor-pointer transition-all border flex items-start justify-between gap-3 ${
                                isSelected
                                  ? "bg-primary-fixed/20 border-primary shadow-xs ring-1 ring-primary/40"
                                  : "bg-surface-container-low border-surface-container-high hover:border-outline-variant"
                              }`}
                            >
                              <div className="flex items-start gap-3 min-w-0">
                                <div className="pt-0.5 shrink-0">
                                  <div
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? "border-primary bg-primary"
                                        : "border-outline bg-white"
                                    }`}
                                  >
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-on-surface">{addr.name}</span>
                                    <span className="text-[10px] font-mono text-outline font-semibold">
                                      {addr.phone}
                                    </span>
                                    <span className="text-[10px] bg-secondary-fixed text-on-secondary-fixed font-bold px-2 py-0.2 rounded-full uppercase">
                                      {addr.type === "SHOP" && "🏪 Kirana Shop"}
                                      {addr.type === "HOME" && "🏠 Home"}
                                      {addr.type === "WORK" && "🏢 Work / Godown"}
                                      {addr.type === "OTHER" && "📍 Other"}
                                    </span>
                                    {addr.isDefault && (
                                      <span className="text-[10px] bg-tertiary-fixed text-on-tertiary-fixed font-bold px-1.5 py-0.2 rounded">
                                        ★ Default
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
                                    {addr.formattedAddress}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                {isSelected ? (
                                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5 bg-primary/10 px-2 py-0.5 rounded-full">
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                    Delivering Here
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectAddress(addr);
                                    }}
                                    className="text-xs font-bold text-primary hover:underline px-2 py-0.5"
                                  >
                                    Select
                                  </button>
                                )}
                                {addresses.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteAddress(addr.id, e)}
                                    className="text-outline hover:text-error p-1 rounded transition-colors"
                                    title="Delete address"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Zone Selector */}
                    <div className="pt-2 border-t border-surface-container-high">
                      <label className="text-[11px] text-outline uppercase font-bold block mb-1">
                        Select Saharsa Delivery Hub &amp; Speed
                      </label>
                      <select
                        value={selectedZoneCode}
                        onChange={(e) => setSelectedZoneCode(e.target.value)}
                        className="w-full bg-surface-container-low p-2.5 rounded-lg text-xs text-on-surface font-semibold border border-surface-container-high focus:outline-none"
                      >
                        {deliveryZones.map((z) => (
                          <option key={z.code} value={z.code}>
                            {z.name} (Delivery: ₹{Math.round(z.deliveryChargePaise / 100)} • Free above ₹{Math.round(z.freeDeliveryThresholdPaise / 100)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Delivery Slot Picker */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[22px]">schedule</span>
                      <h2 className="text-sm font-bold text-on-surface font-headline">Select Fulfillment Slot</h2>
                    </div>
                    <span className="text-[11px] text-tertiary font-bold bg-tertiary-fixed/40 px-2 py-0.5 rounded">
                      30-min Express Available
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setSelectedSlot("evening")}
                      className={`p-3.5 rounded-xl cursor-pointer flex flex-col gap-1 transition-all border ${
                        selectedSlot === "evening"
                          ? "bg-primary-fixed/20 border-primary shadow-sm"
                          : "bg-surface-container-low border-surface-container-high hover:bg-surface-container"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">Today Evening</span>
                        <span className="text-[10px] bg-tertiary text-on-tertiary px-2 py-0.2 rounded font-bold">Fastest</span>
                      </div>
                      <div className="text-sm font-bold text-on-surface">5:00 PM – 8:00 PM</div>
                      <div className="text-[11px] text-on-surface-variant">Saharsa Local Electric Tempo Dispatch</div>
                    </div>

                    <div
                      onClick={() => setSelectedSlot("morning")}
                      className={`p-3.5 rounded-xl cursor-pointer flex flex-col gap-1 transition-all border ${
                        selectedSlot === "morning"
                          ? "bg-primary-fixed/20 border-primary shadow-sm"
                          : "bg-surface-container-low border-surface-container-high hover:bg-surface-container"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface">Tomorrow Morning</span>
                        <span className="text-[10px] text-outline font-semibold">Standard</span>
                      </div>
                      <div className="text-sm font-bold text-on-surface">8:00 AM – 11:00 AM</div>
                      <div className="text-[11px] text-on-surface-variant">Best for kirana bulk restocking</div>
                    </div>
                  </div>
                </div>

                {/* GST Invoice Input / Commercial ITC Card */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                      </div>
                      <div>
                        <h3 className="text-xs md:text-sm font-bold text-on-surface">Input Tax Credit (GST Invoice)</h3>
                        <p className="text-[11px] text-on-surface-variant">
                          Claim 100% GSTR-3B tax offset for registered Bihar commercial buyers
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={gstEnabled}
                        onChange={(e) => setGstEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  {gstEnabled && (
                    <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high space-y-2">
                      <div>
                        <label className="block text-[10px] text-outline uppercase font-bold mb-1">
                          Business GSTIN
                        </label>
                        <input
                          type="text"
                          value={gstinValue}
                          onChange={(e) => setGstinValue(e.target.value.toUpperCase())}
                          placeholder="e.g. 10AAECJ3829K1ZT"
                          className="w-full bg-surface-container-lowest text-xs text-on-surface px-3 py-2 rounded-lg uppercase tracking-wider font-semibold border border-outline-variant/40 focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-tertiary text-xs">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>Commercial tax invoice will include your GSTIN for GSTR-1 input credit.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT SECTION (5 cols): Sticky Summary & Payment */}
              <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-40">
                {/* Savings Banner */}
                {totalSavingsPaise > 0 && (
                  <div className="bg-tertiary text-on-tertiary p-4 rounded-xl shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-on-tertiary/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-tertiary-fixed text-[22px]">savings</span>
                      </div>
                      <div>
                        <div className="text-xs md:text-sm font-bold">Total Savings: ₹{Math.round(totalSavingsPaise / 100)}</div>
                        <div className="text-[11px] text-on-tertiary/80">Direct Mandi rates + Slab discounts</div>
                      </div>
                    </div>
                    <span className="text-xs uppercase bg-on-tertiary text-tertiary font-bold px-2 py-1 rounded">
                      {savingsPercent}% Saved
                    </span>
                  </div>
                )}

                {/* Bill Breakdown Card */}
                <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                  <h2 className="text-sm font-bold text-on-surface font-headline border-b border-surface-container pb-2">
                    Price Details (Bill Breakdown)
                  </h2>

                  <div className="space-y-2 text-xs text-on-surface-variant">
                    <div className="flex justify-between">
                      <span>Total Retail MRP</span>
                      <span className="line-through text-outline font-mono">₹{Math.round(cart.subtotalPaise / 100)}</span>
                    </div>
                    <div className="flex justify-between text-tertiary font-semibold">
                      <span>Wholesale Slab Savings</span>
                      <span className="font-mono">- ₹{Math.round(totalSavingsPaise / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Taxable Value</span>
                      <span className="text-on-surface font-mono">₹{Math.round(cart.taxablePaise / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated GST</span>
                      <span className="text-on-surface font-mono">₹{Math.round(cart.totalTaxPaise / 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery Fee ({selectedZone.name})</span>
                      <span className={isDeliveryFree ? "text-tertiary font-bold" : "text-on-surface font-mono"}>
                        {isDeliveryFree ? "FREE" : `₹${Math.round(deliveryFeePaise / 100)}`}
                      </span>
                    </div>

                    <div className="pt-3 border-t border-surface-container flex items-baseline justify-between text-base font-bold text-on-surface">
                      <span>Net Payable Amount</span>
                      <span className="text-primary text-xl font-bold font-mono">
                        ₹{Math.round(finalPayablePaise / 100)}
                      </span>
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="pt-2 border-t border-surface-container space-y-2">
                    <label className="text-[11px] text-outline uppercase font-bold block mb-1">
                      Payment Choice upon Delivery
                    </label>

                    {/* Mode 1: COD */}
                    {paymentSettings.codEnabled && (
                      <label
                        onClick={() => setSelectedPaymentMode("COD")}
                        className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                          selectedPaymentMode === "COD"
                            ? "bg-primary-fixed/20 border-primary"
                            : "bg-surface-container-low border-surface-container-high hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">payments</span>
                          <div>
                            <div className="text-xs font-bold text-on-surface">Cash on Delivery (COD)</div>
                            <div className="text-[10px] text-on-surface-variant">Pay cash directly to tempo pilot</div>
                          </div>
                        </div>
                        {selectedPaymentMode === "COD" && (
                          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                        )}
                      </label>
                    )}

                    {/* Mode 2: UPI */}
                    {paymentSettings.upiDeliveryEnabled && (
                      <label
                        onClick={() => setSelectedPaymentMode("UPI_DELIVERY")}
                        className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                          selectedPaymentMode === "UPI_DELIVERY"
                            ? "bg-primary-fixed/20 border-primary"
                            : "bg-surface-container-low border-surface-container-high hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[18px]">qr_code_scanner</span>
                          <div>
                            <div className="text-xs font-bold text-on-surface">UPI / QR on Delivery</div>
                            <div className="text-[10px] text-on-surface-variant">GPay, PhonePe, Paytm on unloading</div>
                          </div>
                        </div>
                        {selectedPaymentMode === "UPI_DELIVERY" && (
                          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                        )}
                      </label>
                    )}

                    {/* Mode 3: Credit */}
                    {isCreditParty && (
                      <label
                        onClick={() => setSelectedPaymentMode("CREDIT")}
                        className={`p-3 rounded-lg flex items-center justify-between cursor-pointer border transition-all ${
                          selectedPaymentMode === "CREDIT"
                            ? "bg-primary-fixed/20 border-primary"
                            : "bg-surface-container-low border-surface-container-high hover:bg-surface-container"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-tertiary text-[18px]">account_balance</span>
                          <div>
                            <div className="text-xs font-bold text-on-surface">15-Day Merchant Khata ({creditPartyName})</div>
                            <div className="text-[10px] text-on-surface-variant">Post order to registered credit account</div>
                          </div>
                        </div>
                        {selectedPaymentMode === "CREDIT" && (
                          <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                        )}
                      </label>
                    )}
                  </div>

                  {/* Order Note */}
                  <div>
                    <label className="text-[11px] text-outline uppercase font-bold block mb-1">
                      Delivery Landmark / Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Near Shankar Chowk, DB Road"
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      className="w-full bg-surface-container-low p-2 rounded-lg text-xs text-on-surface border border-surface-container-high focus:outline-none"
                    />
                  </div>

                  {/* Submit Button */}
                  <PlaceOrderButton disabled={cartLines.length === 0} />

                  <div className="flex items-center justify-center gap-3 text-[11px] text-outline pt-1">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">lock</span> 256-bit Secure
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">verified</span> 100% Genuine
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
