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
import { saveUserAddressAction, deleteUserAddressAction, setDefaultAddressAction } from "./address-actions";
import { PaymentModeSettings } from "@/modules/settings/settings.types";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { formatPaise, paiseToRupees } from "@/lib/format-price";

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

  // Stepper state: 1 = Address, 2 = Order Summary, 3 = Payment
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Saved Addresses State
  const [addresses, setAddresses] = useState<SavedAddressDto[]>(savedAddresses);
  const initialSelected = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];
  const [selectedAddressId, setSelectedAddressId] = useState<string>(initialSelected?.id || "");
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressSaveError, setAddressSaveError] = useState<string | null>(null);

  // New Address Form State
  const [newAddress, setNewAddress] = useState({
    name: userName || "",
    phone: userPhone || "",
    addressLine: "",
    area: "",
    city: "",
    state: "Bihar",
    pincode: "",
    type: "HOME" as UserAddressType,
    isDefault: savedAddresses.length === 0,
  });

  // GPS Auto-Detection State
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

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
      setLocationSuccessMsg(`📍 Location detected: ${cityLabel}. Please verify House/Shop No.`);
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

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || addresses[0];

  const [contactPhone, setContactPhone] = useState<string>(
    selectedAddress?.phone || userPhone || ""
  );
  const [addressValue, setAddressValue] = useState<string>(
    selectedAddress?.formattedAddress || userAddress || ""
  );

  // Delivery zone & slot
  const selectedZone = deliveryZones[0] || {
    code: "TOWN",
    name: "Standard Delivery",
    minOrderPaise: 50000,
    freeDeliveryThresholdPaise: 200000,
    deliveryChargePaise: 4000,
    estimatedDeliveryHours: 4,
    active: true,
  };

  const [gstEnabled, setGstEnabled] = useState<boolean>(!!userGstin);
  const [gstinValue, setGstinValue] = useState<string>(userGstin || "");
  const [customerNotes, setCustomerNotes] = useState<string>("");
  const [cartLines, setCartLines] = useState(cart.lines);

  // Payment Selection: "UPI" | "CARD" | "NETBANKING" | "COD"
  const [paymentMethod, setPaymentMethod] = useState<"UPI" | "CARD" | "NETBANKING" | "COD">("UPI");
  const [upiType, setUpiType] = useState<"GPAY" | "PHONEPE" | "PAYTM" | "BHIM" | "CUSTOM">("GPAY");
  const [customUpiId, setCustomUpiId] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<string>("SBI");
  const [cardDetails, setCardDetails] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  // Demo Payment Processing State
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatusText, setPaymentStatusText] = useState("");

  const [state, formAction] = useFormState<CheckoutActionResult | undefined, FormData>(
    checkoutCartAction,
    undefined
  );

  useEffect(() => {
    if (state?.success && state?.orderId) {
      router.push(`/store/orders/${state.orderId}`);
    }
  }, [state, router]);

  // Sync selected address
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
      setNewAddress({
        name: userName || "",
        phone: userPhone || "",
        addressLine: "",
        area: "",
        city: "",
        state: "Bihar",
        pincode: "",
        type: "HOME",
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
    if (!confirm("Are you sure you want to remove this delivery address?")) return;
    const res = await deleteUserAddressAction(id);
    if (res.success) {
      const remaining = addresses.filter((a) => a.id !== id);
      setAddresses(remaining);
      if (selectedAddressId === id && remaining.length > 0) {
        handleSelectAddress(remaining[0]);
      }
    }
  };

  const handleSetDefault = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const res = await setDefaultAddressAction(id);
    if (res.success) {
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, isDefault: a.id === id }))
      );
    }
  };

  const isDeliveryFree = cart.totalPaise >= selectedZone.freeDeliveryThresholdPaise;
  const deliveryFeePaise = isDeliveryFree ? 0 : selectedZone.deliveryChargePaise;
  const finalPayablePaise = cart.totalPaise + deliveryFeePaise;
  const totalSavingsPaise = Math.max(0, cart.subtotalPaise - cart.totalPaise);

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

  // Submit Order / Payment Handler (Simulates Gateway & Submits Action)
  const handleFinalPaymentSubmit = async () => {
    if (!addressValue || addressValue.trim().length < 5) {
      alert("Please select or add a complete delivery address");
      setCurrentStep(1);
      return;
    }

    if (!contactPhone || contactPhone.trim().length < 10) {
      alert("Please verify your 10-digit mobile number in the delivery address");
      setCurrentStep(1);
      return;
    }

    // Realistic Demo Payment Gateway simulation before placing order:
    setIsProcessingPayment(true);
    if (paymentMethod === "UPI") {
      setPaymentStatusText("Connecting to UPI Gateway (Demo)...");
    } else if (paymentMethod === "CARD") {
      setPaymentStatusText("Verifying Card Details (Demo)...");
    } else if (paymentMethod === "NETBANKING") {
      setPaymentStatusText(`Redirecting to ${selectedBank} Net Banking (Demo)...`);
    } else {
      setPaymentStatusText("Confirming Cash on Delivery Order...");
    }

    await new Promise((r) => setTimeout(r, 1200));
    setPaymentStatusText("Payment Authorized ✓ Placing Order...");
    await new Promise((r) => setTimeout(r, 600));

    // Submit form action programmatically
    const formData = new FormData();
    formData.append("deliveryZoneCode", selectedZone.code);
    formData.append("deliveryAddress", addressValue);
    formData.append("contactPhone", contactPhone);
    formData.append(
      "customerNotes",
      `Payment: ${paymentMethod} (${
        paymentMethod === "UPI"
          ? upiType
          : paymentMethod === "NETBANKING"
          ? selectedBank
          : paymentMethod
      }). GST: ${gstEnabled ? gstinValue : "None"}. Notes: ${customerNotes}`
    );

    startTransition(async () => {
      await formAction(formData);
      setIsProcessingPayment(false);
    });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Payment Processing Modal Overlay */}
      {isProcessingPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl border border-surface-container-high space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
              <span className="material-symbols-outlined text-3xl animate-spin">
                progress_activity
              </span>
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-on-surface">
                Processing Secure Order
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">{paymentStatusText}</p>
            </div>
            <div className="text-[11px] text-outline font-medium flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-[14px]">lock</span>
              <span>256-bit SSL Encrypted Transaction</span>
            </div>
          </div>
        </div>
      )}

      {/* Store Header */}
      <StoreHeader
        cartCount={cart.itemsCount}
        cartTotalRupees={paiseToRupees(cart.totalPaise)}
        userName={userName}
        isLoggedIn={true}
        categories={categories}
      />

      <main className="flex-1 w-full pt-32 md:pt-24 pb-20 md:pb-12 bg-surface">
        <div className="w-full max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          {/* Stepper Progress Bar */}
          <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/store/cart"
                className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
                title="Back to Cart"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </Link>
              <h1 className="font-headline text-xl sm:text-2xl font-extrabold text-on-surface">
                Checkout
              </h1>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all ${
                  currentStep === 1
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                  1
                </span>
                <span className="hidden sm:inline">Delivery Address</span>
              </button>

              <span className="text-outline text-xs">›</span>

              <button
                type="button"
                onClick={() => {
                  if (selectedAddress) setCurrentStep(2);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all ${
                  currentStep === 2
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                  2
                </span>
                <span className="hidden sm:inline">Order Summary</span>
              </button>

              <span className="text-outline text-xs">›</span>

              <button
                type="button"
                onClick={() => {
                  if (selectedAddress) setCurrentStep(3);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold transition-all ${
                  currentStep === 3
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container-low text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center font-bold">
                  3
                </span>
                <span className="hidden sm:inline">Payment</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {state?.error && (
            <div className="bg-rose-50 text-rose-700 p-4 rounded-xl flex items-center gap-2.5 border border-rose-200 text-sm font-semibold">
              <span className="material-symbols-outlined text-[20px]">error</span>
              <span>{state.error}</span>
            </div>
          )}

          {/* Two-Column Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN: Stepped Accordion (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* STEP 1: DELIVERY ADDRESS */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high overflow-hidden">
                <div
                  className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-colors ${
                    currentStep === 1
                      ? "bg-primary/5 border-b border-surface-container"
                      : "bg-surface-container-lowest"
                  }`}
                  onClick={() => setCurrentStep(1)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        selectedAddress && currentStep > 1
                          ? "bg-emerald-600 text-white"
                          : currentStep === 1
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {selectedAddress && currentStep > 1 ? "✓" : "1"}
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-on-surface font-headline uppercase tracking-wide">
                        Delivery Address
                      </h2>
                      {currentStep > 1 && selectedAddress && (
                        <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                          {selectedAddress.name} • {selectedAddress.formattedAddress}
                        </p>
                      )}
                    </div>
                  </div>

                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentStep(1);
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Step 1 Content */}
                {currentStep === 1 && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Add New Address Button Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-on-surface-variant">
                        Select an address or add a new one:
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowNewAddressForm(!showNewAddressForm)}
                        className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {showNewAddressForm ? "close" : "add"}
                        </span>
                        <span>{showNewAddressForm ? "Cancel" : "+ Add New Address"}</span>
                      </button>
                    </div>

                    {/* New Address Collapsible Form */}
                    {showNewAddressForm && (
                      <form
                        onSubmit={handleSaveNewAddress}
                        className="bg-surface-container-low p-4 rounded-xl border border-primary/30 space-y-3 animate-fade-in"
                      >
                        <div className="text-xs font-bold text-primary flex items-center justify-between border-b border-surface-container-high pb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[18px]">add_location_alt</span>
                            <span>Add New Delivery Address</span>
                          </div>
                          <span className="text-[10px] text-outline font-semibold">Saharsa &amp; Pan-India</span>
                        </div>

                        {/* Location Auto-Detect Strip */}
                        <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined text-[18px]">my_location</span>
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
                            className="px-3.5 py-1.5 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-60 cursor-pointer shrink-0"
                          >
                            {isDetectingLocation ? (
                              <>
                                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                                <span>Detecting location...</span>
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-[15px]">near_me</span>
                                <span>Detect My Location</span>
                              </>
                            )}
                          </button>
                        </div>

                        {locationSuccessMsg && (
                          <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-lg border border-emerald-200 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                            <span>{locationSuccessMsg}</span>
                          </div>
                        )}

                        {addressSaveError && (
                          <div className="bg-rose-50 text-rose-700 text-xs p-2.5 rounded-lg border border-rose-200">
                            {addressSaveError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
                              Contact Person Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAddress.name}
                              onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
                              placeholder="e.g. Alok Singh"
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
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
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs font-mono focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
                              House / Flat / Shop No. &amp; Street *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAddress.addressLine}
                              onChange={(e) =>
                                setNewAddress({ ...newAddress, addressLine: e.target.value })
                              }
                              placeholder="e.g. Plot No-19, Institutional Area"
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
                              Area / Colony / Ward *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAddress.area}
                              onChange={(e) => setNewAddress({ ...newAddress, area: e.target.value })}
                              placeholder="e.g. Sector 62 / Purab Bazar"
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-on-surface mb-1">
                                City / Town *
                              </label>
                              <input
                                type="text"
                                required
                                value={newAddress.city}
                                onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                                placeholder="e.g. Gurugram, Patna, Delhi"
                                className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs focus:outline-none focus:border-primary"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-on-surface mb-1">
                                Pincode *
                              </label>
                              <input
                                type="text"
                                required
                                maxLength={6}
                                value={newAddress.pincode}
                                onChange={(e) =>
                                  setNewAddress({ ...newAddress, pincode: e.target.value })
                                }
                                placeholder="852201"
                                className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs font-mono focus:outline-none focus:border-primary"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
                              State *
                            </label>
                            <input
                              type="text"
                              required
                              value={newAddress.state}
                              onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                              placeholder="Bihar"
                              className="w-full bg-white px-3 py-2 rounded-lg border border-outline-variant/60 text-xs focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-semibold text-on-surface mb-1">
                              Address Type
                            </label>
                            <div className="flex gap-2">
                              {(["HOME", "WORK", "SHOP"] as UserAddressType[]).map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => setNewAddress({ ...newAddress, type: t })}
                                  className={`flex-1 py-1.5 px-2 rounded-lg font-semibold text-xs border transition-all ${
                                    newAddress.type === t
                                      ? "bg-primary text-white border-primary"
                                      : "bg-white text-on-surface border-outline-variant/60 hover:bg-surface-container"
                                  }`}
                                >
                                  {t === "HOME" ? "🏠 Home" : t === "WORK" ? "🏢 Work" : "🏪 Shop"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                            <input
                              type="checkbox"
                              id="makeDefault"
                              checked={newAddress.isDefault}
                              onChange={(e) =>
                                setNewAddress({ ...newAddress, isDefault: e.target.checked })
                              }
                              className="w-4 h-4 text-primary rounded border-outline-variant/60"
                            />
                            <label htmlFor="makeDefault" className="text-xs text-on-surface cursor-pointer">
                              Save as my default delivery address
                            </label>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
                          <button
                            type="button"
                            onClick={() => setShowNewAddressForm(false)}
                            className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSavingAddress}
                            className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            {isSavingAddress ? "Saving..." : "Save Address"}
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Saved Addresses Cards */}
                    <div className="space-y-2.5">
                      {addresses.length === 0 ? (
                        <div className="p-4 bg-surface-container-low rounded-xl text-center text-xs text-on-surface-variant">
                          No saved addresses yet. Click &quot;+ Add New Address&quot; above.
                        </div>
                      ) : (
                        addresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.id;
                          return (
                            <div
                              key={addr.id}
                              onClick={() => handleSelectAddress(addr)}
                              className={`p-4 rounded-xl cursor-pointer transition-all border flex flex-col gap-2.5 ${
                                isSelected
                                  ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/40"
                                  : "bg-surface-container-low border-surface-container-high hover:border-outline-variant"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 min-w-0">
                                  <div className="pt-0.5">
                                    <div
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        isSelected
                                          ? "border-primary bg-primary"
                                          : "border-outline bg-white"
                                      }`}
                                    >
                                      {isSelected && (
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold text-on-surface">
                                        {addr.name}
                                      </span>
                                      <span className="text-xs font-mono text-on-surface-variant">
                                        {addr.phone}
                                      </span>
                                      <span className="text-[10px] bg-surface-container-high text-on-surface-variant font-semibold px-2 py-0.2 rounded-full uppercase">
                                        {addr.type === "SHOP"
                                          ? "🏪 Shop"
                                          : addr.type === "WORK"
                                          ? "🏢 Work"
                                          : "🏠 Home"}
                                      </span>
                                      {addr.isDefault && (
                                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                                      {addr.formattedAddress}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {!addr.isDefault && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleSetDefault(addr.id, e)}
                                      className="text-[11px] text-on-surface-variant hover:text-primary px-1.5 py-0.5"
                                      title="Set as Default"
                                    >
                                      Set Default
                                    </button>
                                  )}
                                  {addresses.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteAddress(addr.id, e)}
                                      className="text-outline hover:text-rose-600 p-1"
                                      title="Delete"
                                    >
                                      <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isSelected && (
                                <div className="pt-2 border-t border-surface-container flex items-center justify-between">
                                  <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                    <span>Selected for Delivery</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setCurrentStep(2)}
                                    className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                  >
                                    Deliver Here →
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 2: ORDER SUMMARY */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high overflow-hidden">
                <div
                  className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-colors ${
                    currentStep === 2
                      ? "bg-primary/5 border-b border-surface-container"
                      : "bg-surface-container-lowest"
                  }`}
                  onClick={() => {
                    if (selectedAddress) setCurrentStep(2);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep > 2
                          ? "bg-emerald-600 text-white"
                          : currentStep === 2
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {currentStep > 2 ? "✓" : "2"}
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-on-surface font-headline uppercase tracking-wide">
                        Order Summary
                      </h2>
                      {currentStep > 2 && (
                        <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                          {cartLines.length} products ({cart.totalPieces} pieces)
                        </p>
                      )}
                    </div>
                  </div>

                  {currentStep > 2 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentStep(2);
                      }}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Change
                    </button>
                  )}
                </div>

                {/* Step 2 Content */}
                {currentStep === 2 && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Cart Lines Preview */}
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {cartLines.map((line) => {
                        return (
                          <div
                            key={line.productId}
                            className="bg-surface-container-low p-3 rounded-xl flex items-center justify-between gap-3 border border-surface-container-high"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-lg bg-white border border-surface-container-high p-1 shrink-0 flex items-center justify-center">
                                {line.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={line.imageUrl}
                                    alt={line.productName}
                                    className="w-full h-full object-contain"
                                  />
                                ) : (
                                  <span className="material-symbols-outlined text-[20px] text-outline">
                                    inventory_2
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-xs font-bold text-on-surface line-clamp-1">
                                  {line.productName}
                                </h3>
                                <div className="text-[11px] text-on-surface-variant mt-0.5">
                                  ₹{formatPaise(line.pricing.unitPricePaise)} × {line.qty} {line.weight ? `(${line.weight})` : ""}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs font-bold text-primary font-mono">
                                  ₹{formatPaise(line.pricing.lineTotalPaise)}
                                </div>
                              </div>
                              <div className="flex items-center bg-white rounded-lg p-0.5 border border-surface-container-high">
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(line.productId, line.qty - 1)}
                                  className="w-6 h-6 flex items-center justify-center text-primary font-bold text-xs"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-xs font-bold font-mono">
                                  {line.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateQty(line.productId, line.qty + 1)}
                                  className="w-6 h-6 flex items-center justify-center text-primary font-bold text-xs"
                                >
                                  +
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(line.productId)}
                                className="text-outline hover:text-rose-600 p-0.5"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Delivery Notes */}
                    <div>
                      <label className="text-[11px] font-semibold text-on-surface block mb-1">
                        Delivery Instructions / Landmark (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Near Shankar Chowk / Ring the shop bell"
                        value={customerNotes}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        className="w-full bg-surface-container-low px-3 py-2 rounded-xl text-xs text-on-surface border border-surface-container-high focus:outline-none"
                      />
                    </div>

                    {/* Continue Button */}
                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="px-5 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Continue to Payment</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* STEP 3: PAYMENT OPTIONS (Flipkart / Amazon Style) */}
              <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container-high overflow-hidden">
                <div
                  className={`p-4 sm:p-5 flex items-center justify-between cursor-pointer transition-colors ${
                    currentStep === 3
                      ? "bg-primary/5 border-b border-surface-container"
                      : "bg-surface-container-lowest"
                  }`}
                  onClick={() => {
                    if (selectedAddress) setCurrentStep(3);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep === 3
                          ? "bg-primary text-white"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      3
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-on-surface font-headline uppercase tracking-wide">
                        Payment Options
                      </h2>
                      <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">
                        UPI, Cards, Net Banking, or Cash on Delivery
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 3 Content */}
                {currentStep === 3 && (
                  <div className="p-4 sm:p-5 space-y-4">
                    {/* Method 1: UPI */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        paymentMethod === "UPI"
                          ? "bg-primary/5 border-primary shadow-xs"
                          : "bg-surface-container-low border-surface-container-high"
                      }`}
                    >
                      <label
                        onClick={() => setPaymentMethod("UPI")}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymode"
                            checked={paymentMethod === "UPI"}
                            onChange={() => setPaymentMethod("UPI")}
                            className="text-primary focus:ring-primary w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-bold text-on-surface flex items-center gap-2">
                              <span>UPI (Instant Payment)</span>
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                                Fastest
                              </span>
                            </span>
                            <span className="text-[11px] text-on-surface-variant block mt-0.5">
                              Google Pay, PhonePe, Paytm, BHIM &amp; UPI QR
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          qr_code_scanner
                        </span>
                      </label>

                      {paymentMethod === "UPI" && (
                        <div className="mt-3 pt-3 border-t border-surface-container space-y-3 animate-fade-in text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                              { id: "GPAY", label: "Google Pay", icon: "payments" },
                              { id: "PHONEPE", label: "PhonePe", icon: "account_balance_wallet" },
                              { id: "PAYTM", label: "Paytm UPI", icon: "bolt" },
                              { id: "CUSTOM", label: "Any UPI ID", icon: "alternate_email" },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setUpiType(opt.id as any)}
                                className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                                  upiType === opt.id
                                    ? "bg-primary text-white border-primary shadow-2xs"
                                    : "bg-white text-on-surface border-surface-container-high hover:bg-surface-container"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>

                          {upiType === "CUSTOM" && (
                            <div className="pt-1">
                              <input
                                type="text"
                                placeholder="Enter your UPI ID (e.g. mobile@upi)"
                                value={customUpiId}
                                onChange={(e) => setCustomUpiId(e.target.value)}
                                className="w-full bg-white px-3 py-2 rounded-xl text-xs border border-outline-variant/60 focus:outline-none focus:border-primary"
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleFinalPaymentSubmit}
                            className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            <span>Pay ₹{formatPaise(finalPayablePaise)} via UPI</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Method 2: Credit / Debit Card */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        paymentMethod === "CARD"
                          ? "bg-primary/5 border-primary shadow-xs"
                          : "bg-surface-container-low border-surface-container-high"
                      }`}
                    >
                      <label
                        onClick={() => setPaymentMethod("CARD")}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymode"
                            checked={paymentMethod === "CARD"}
                            onChange={() => setPaymentMethod("CARD")}
                            className="text-primary focus:ring-primary w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-bold text-on-surface">
                              Credit / Debit / ATM Card
                            </span>
                            <span className="text-[11px] text-on-surface-variant block mt-0.5">
                              Visa, MasterCard, RuPay, Maestro
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          credit_card
                        </span>
                      </label>

                      {paymentMethod === "CARD" && (
                        <div className="mt-3 pt-3 border-t border-surface-container space-y-2.5 animate-fade-in text-xs">
                          <div>
                            <input
                              type="text"
                              maxLength={19}
                              placeholder="Card Number (XXXX XXXX XXXX XXXX)"
                              value={cardDetails.number}
                              onChange={(e) =>
                                setCardDetails({ ...cardDetails, number: e.target.value })
                              }
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs border border-outline-variant/60 font-mono focus:outline-none focus:border-primary"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              maxLength={5}
                              placeholder="MM / YY"
                              value={cardDetails.expiry}
                              onChange={(e) =>
                                setCardDetails({ ...cardDetails, expiry: e.target.value })
                              }
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs border border-outline-variant/60 font-mono focus:outline-none focus:border-primary"
                            />
                            <input
                              type="password"
                              maxLength={4}
                              placeholder="CVV"
                              value={cardDetails.cvv}
                              onChange={(e) =>
                                setCardDetails({ ...cardDetails, cvv: e.target.value })
                              }
                              className="w-full bg-white px-3 py-2 rounded-xl text-xs border border-outline-variant/60 font-mono focus:outline-none focus:border-primary"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={handleFinalPaymentSubmit}
                            className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">lock</span>
                            <span>Pay ₹{formatPaise(finalPayablePaise)} Securely</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Method 3: Net Banking */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        paymentMethod === "NETBANKING"
                          ? "bg-primary/5 border-primary shadow-xs"
                          : "bg-surface-container-low border-surface-container-high"
                      }`}
                    >
                      <label
                        onClick={() => setPaymentMethod("NETBANKING")}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymode"
                            checked={paymentMethod === "NETBANKING"}
                            onChange={() => setPaymentMethod("NETBANKING")}
                            className="text-primary focus:ring-primary w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-bold text-on-surface">Net Banking</span>
                            <span className="text-[11px] text-on-surface-variant block mt-0.5">
                              All Indian banks supported (SBI, HDFC, ICICI, Axis, PNB)
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          account_balance
                        </span>
                      </label>

                      {paymentMethod === "NETBANKING" && (
                        <div className="mt-3 pt-3 border-t border-surface-container space-y-3 animate-fade-in text-xs">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {["SBI", "HDFC", "ICICI", "Axis", "PNB", "Kotak"].map((b) => (
                              <button
                                key={b}
                                type="button"
                                onClick={() => setSelectedBank(b)}
                                className={`py-2 px-2 rounded-xl border text-center transition-all cursor-pointer font-semibold ${
                                  selectedBank === b
                                    ? "bg-primary text-white border-primary shadow-2xs"
                                    : "bg-white text-on-surface border-surface-container-high hover:bg-surface-container"
                                }`}
                              >
                                {b} Bank
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleFinalPaymentSubmit}
                            className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                            <span>Pay ₹{formatPaise(finalPayablePaise)} with {selectedBank}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Method 4: Cash on Delivery (COD) */}
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        paymentMethod === "COD"
                          ? "bg-primary/5 border-primary shadow-xs"
                          : "bg-surface-container-low border-surface-container-high"
                      }`}
                    >
                      <label
                        onClick={() => setPaymentMethod("COD")}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymode"
                            checked={paymentMethod === "COD"}
                            onChange={() => setPaymentMethod("COD")}
                            className="text-primary focus:ring-primary w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-bold text-on-surface">
                              Cash on Delivery (COD)
                            </span>
                            <span className="text-[11px] text-on-surface-variant block mt-0.5">
                              Pay in cash or scan QR at your doorstep
                            </span>
                          </div>
                        </div>
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          payments
                        </span>
                      </label>

                      {paymentMethod === "COD" && (
                        <div className="mt-3 pt-3 border-t border-surface-container space-y-3 animate-fade-in text-xs">
                          <p className="text-on-surface-variant">
                            You can pay cash or scan delivery agent&apos;s UPI QR code when your order arrives.
                          </p>
                          <button
                            type="button"
                            onClick={handleFinalPaymentSubmit}
                            className="w-full py-3 bg-primary hover:bg-primary-container text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            <span>Confirm Order (Pay on Delivery: ₹{formatPaise(finalPayablePaise)})</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Sticky Order Bill Summary (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-36">
              <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-xs border border-surface-container-high flex flex-col gap-4">
                <h2 className="text-sm font-bold text-on-surface font-headline border-b border-surface-container pb-2">
                  Price Details
                </h2>

                <div className="space-y-2.5 text-xs text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>Price ({cartLines.length} items)</span>
                    <span className="text-outline line-through font-mono">
                      ₹{formatPaise(cart.subtotalPaise)}
                    </span>
                  </div>

                  {totalSavingsPaise > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>Discount Savings</span>
                      <span className="font-mono">- ₹{formatPaise(totalSavingsPaise)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Delivery Charges</span>
                    <span className={isDeliveryFree ? "text-emerald-700 font-bold" : "text-on-surface font-mono"}>
                      {isDeliveryFree ? "FREE" : `₹${formatPaise(deliveryFeePaise)}`}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-surface-container flex items-baseline justify-between text-base font-bold text-on-surface">
                    <span>Total Payable</span>
                    <span className="text-primary text-xl font-extrabold font-mono">
                      ₹{formatPaise(finalPayablePaise)}
                    </span>
                  </div>
                </div>

                {totalSavingsPaise > 0 && (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800 text-center">
                    You will save ₹{formatPaise(totalSavingsPaise)} on this order
                  </div>
                )}

                {/* Safety Badges */}
                <div className="flex items-center justify-center gap-3 text-[11px] text-outline pt-2 border-t border-surface-container">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">lock</span>
                    <span>100% Safe Payments</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">verified</span>
                    <span>Direct FMCG Stock</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Store Footer */}
      <StoreFooter />
    </div>
  );
}
