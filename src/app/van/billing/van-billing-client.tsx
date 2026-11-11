"use client";
import { BillMessagingCard } from "@/components/billing/bill-messaging-card";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Wifi,
  WifiOff,
  CloudUpload,
  AlertCircle,
  FileText,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  Package,
  User,
  ArrowLeft,
  ArrowRight,
  Check,
  Store,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { BluetoothPrintButton } from "@/components/van/bluetooth-print-button";
import {
  saveDraftInvoice,
  listDraftInvoices,
  deleteDraftInvoice,
  VanDraftInvoice,
} from "@/lib/offline-drafts";
import { createVanInvoiceAction, checkVanPartyCreditStatusAction } from "./actions";
import { createQuickPartyAction, updatePartyNameAndContactAction } from "@/app/shop/pos/actions";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { PartySearchBox } from "@/components/pos/PartySearchBox";
import { searchItems } from "@/lib/search/smart-search";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { QtyUnitPicker, PickerUnit } from "@/components/billing/qty-unit-picker";
import { PaymentMode } from "@prisma/client";
import { tHi } from "@/lib/i18n/messages/hi";

interface VanProduct {
  id: string;
  name: string;
  nameHi?: string | null;
  phone?: string | null;
  address?: string | null;
  shortCode: string;
  weight?: string | null;
  packSize: number;
  packLabel: string;
  mrpPaise: number;
  priceAPaise?: number | null;
  priceBPaise?: number | null;
  priceCPaise?: number | null;
  availablePieces: number;
  cartons: number;
  loosePieces: number;
  companyName: string;
  morningIssuedQty?: number;
  morningSoldQty?: number;
}

interface PartyOption {
  id: string;
  name: string;
  nameHi?: string | null;
  type?: string;
  phone?: string | null;
  address?: string | null;
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

interface CartLine {
  product: VanProduct;
  qty: number;
  unit: PickerUnit;
  unitQty: number;
  customRatePaise?: number | null;
  customRateInput?: string;
  customMrpPaise?: number | null;
  customMrpInput?: string;
  isCustomRate?: boolean;
  isCustomMrp?: boolean;
}

export function getProductTierUnitPrice(
  product: VanProduct,
  targetTier: "WHOLESALER" | "RETAILER" | "CUSTOMER",
  customMrpPaise?: number | null
): number {
  const effectiveBaseMrp =
    customMrpPaise != null && customMrpPaise > 0
      ? customMrpPaise
      : product.mrpPaise && product.mrpPaise > 0
      ? product.mrpPaise
      : 0;

  if (targetTier === "WHOLESALER") {
    if (product.priceAPaise != null && product.priceAPaise > 0) {
      return product.priceAPaise;
    }
    if (effectiveBaseMrp > 0) {
      return Math.round(effectiveBaseMrp * 0.85); // 15% discount for Tier A
    }
  } else if (targetTier === "RETAILER") {
    if (product.priceBPaise != null && product.priceBPaise > 0) {
      return product.priceBPaise;
    }
    if (effectiveBaseMrp > 0) {
      return Math.round(effectiveBaseMrp * 0.92); // 8% discount for Tier B
    }
  } else {
    if (product.priceCPaise != null && product.priceCPaise > 0) {
      return product.priceCPaise;
    }
    if (effectiveBaseMrp > 0) {
      return effectiveBaseMrp;
    }
  }
  return effectiveBaseMrp;
}

interface VanBillingClientProps {
  vanId: string;
  vanName: string;
  issueSheetNo: string;
  products: VanProduct[];
  parties: PartyOption[];
  currentUserRole?: string;
  currentUserId?: string;
}

export function VanBillingClient({
  vanId,
  vanName,
  issueSheetNo,
  products,
  parties,
  currentUserRole = "SALESPERSON",
  currentUserId,
}: VanBillingClientProps) {
  // Stepped Workflow: 1 = Customer, 2 = Products (Morning Load Only), 3 = Payment & Finalize
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [customerMode, setCustomerMode] = useState<"PARTY" | "WALKIN">("PARTY");
  const [selectedTierMode, setSelectedTierMode] = useState<"AUTO" | "WHOLESALER" | "RETAILER" | "CUSTOMER">("AUTO");

  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [localParties, setLocalParties] = useState<PartyOption[]>(parties);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [walkInName, setWalkInName] = useState<string>("");
  const [walkInMobile, setWalkInMobile] = useState<string>("");
  const [walkInAddress, setWalkInAddress] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [paymentCollected, setPaymentCollected] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "warning" | "error" | "info";
    text: string;
  } | null>(null);
  const [lastInvoice, setLastInvoice] = useState<{
    id: string;
    number: string;
    totalPaise: number;
    billUrl?: string | null;
    waMeUrl?: string | null;
    targetPhone?: string | null;
    messagingSkipped?: boolean;
    messagingReason?: string;
  } | null>(null);

  // Quick Customer Creation State
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    name: "",
    nameHi: "",
    phone: "",
    type: "CUSTOMER" as "CUSTOMER" | "RETAILER" | "WHOLESALER",
    address: "",
    gstin: "",
  });
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  // Credit Limit Override State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideBreachReasons, setOverrideBreachReasons] = useState<string[]>([]);
  const [pendingOverridePartyName, setPendingOverridePartyName] = useState("");
  const [approvedCreditOverride, setApprovedCreditOverride] = useState<{
    approvedByUserId: string;
    reason: string;
  } | null>(null);

  // Offline Drafts State
  const [pendingDrafts, setPendingDrafts] = useState<VanDraftInvoice[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDraftsModal, setShowDraftsModal] = useState(false);

  // Selected party details
  const selectedParty = useMemo(() => {
    return localParties.find((p) => p.id === selectedPartyId) || null;
  }, [localParties, selectedPartyId]);

  // Inline Party details edit state for Van
  const [vanPartyName, setVanPartyName] = useState("");
  const [vanPartyPhone, setVanPartyPhone] = useState("");
  const [vanPartyAddress, setVanPartyAddress] = useState("");
  const [isPartyDirty, setIsPartyDirty] = useState(false);
  const [isSavingParty, setIsSavingParty] = useState(false);
  const [partySaveSuccess, setPartySaveSuccess] = useState(false);

  useEffect(() => {
    if (selectedParty) {
      setVanPartyName(selectedParty.name || "");
      setVanPartyPhone(selectedParty.phone || "");
      setVanPartyAddress(selectedParty.address || "");
      setIsPartyDirty(false);
      setPartySaveSuccess(false);
    } else {
      setVanPartyName("");
      setVanPartyPhone("");
      setVanPartyAddress("");
      setIsPartyDirty(false);
      setPartySaveSuccess(false);
    }
  }, [selectedParty?.id, selectedParty?.name, selectedParty?.phone, selectedParty?.address]);

  const handleSavePartyInVan = async () => {
    if (!selectedParty) return;
    if (!vanPartyName.trim()) {
      alert(tHi("customerNameEmptyAlert"));
      return;
    }
    setIsSavingParty(true);
    try {
      const res = await updatePartyNameAndContactAction({
        partyId: selectedParty.id,
        name: vanPartyName.trim(),
        phone: vanPartyPhone.trim() || undefined,
        address: vanPartyAddress.trim() || undefined,
        reason: "Van App Inline Edit",
      });
      if (res.success && res.party) {
        setLocalParties((prev) =>
          prev.map((p) =>
            p.id === selectedParty.id
              ? {
                  ...p,
                  name: res.party!.name,
                  phone: res.party!.phone,
                  address: res.party!.address,
                }
              : p
          )
        );
        setIsPartyDirty(false);
        setPartySaveSuccess(true);
        setTimeout(() => setPartySaveSuccess(false), 2500);
      } else {
        alert(res.error || tHi("partyUpdateFailedError"));
      }
    } catch (err: any) {
      alert(err.message || tHi("partyUpdateFailedError"));
    } finally {
      setIsSavingParty(false);
    }
  };

  useEffect(() => {
    setLocalParties(parties);
  }, [parties]);

  // Monitor Network
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      setStatusMessage({ type: "info", text: tHi("onlineSyncingMsg") });
      triggerDraftSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatusMessage({
        type: "warning",
        text: tHi("offlineModeNotice"),
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadPendingDrafts();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPendingDrafts = async () => {
    try {
      const drafts = await listDraftInvoices(vanId);
      setPendingDrafts(drafts.filter((d) => d.syncStatus !== "SYNCED"));
    } catch {
      // ignore
    }
  };

  // Filter products: Only Morning Loaded Products matching search
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const matches = searchItems(searchTerm, products as any, { limit: 100 });
    return matches.map((m: any) => (m.product ?? m) as VanProduct);
  }, [products, searchTerm]);

  const effectiveTier = useMemo<"WHOLESALER" | "RETAILER" | "CUSTOMER">(() => {
    if (selectedTierMode !== "AUTO") return selectedTierMode;
    if (customerMode === "WALKIN") return "CUSTOMER";
    if (selectedParty?.type === "WHOLESALER") return "WHOLESALER";
    if (selectedParty?.type === "RETAILER") return "RETAILER";
    return "CUSTOMER";
  }, [selectedTierMode, customerMode, selectedParty]);

  const partyOptions = useMemo(
    () => [
      { value: "", label: "-- Choose a Registered Shop / Party --", subLabel: "Tap to select" },
      ...localParties.map((p) => ({
        value: p.id,
        label: p.name,
        subLabel: `${p.phone ? "📞 " + p.phone + " • " : ""}${p.address || "Saharsa"}`,
        badge: p.creditEnabled ? "Credit Allowed" : undefined,
        badgeColor: p.creditEnabled ? ("green" as const) : undefined,
      })),
    ],
    [localParties]
  );

  // Totals calculated using dynamic Pricing Tier & custom rate overrides
  const subtotalPaise = useMemo(() => {
    return cart.reduce((sum, line) => {
      const packSize = Math.max(1, line.product.packSize || 1);
      const bagSize = (line.product as any).bagSize || packSize;
      const pieceMultiplier =
        line.unit === "CARTON"
          ? packSize
          : line.unit === "BAG"
          ? bagSize
          : line.unit === "DOZEN"
          ? 12
          : 1;

      const defaultPieceRatePaise = getProductTierUnitPrice(
        line.product,
        effectiveTier,
        line.isCustomMrp && line.customMrpPaise != null
          ? Math.round(line.customMrpPaise / pieceMultiplier)
          : null
      );
      const defaultUnitRatePaise = defaultPieceRatePaise * pieceMultiplier;
      const effectiveUnitRatePaise =
        line.isCustomRate && line.customRatePaise != null
          ? line.customRatePaise
          : defaultUnitRatePaise;

      return sum + line.unitQty * effectiveUnitRatePaise;
    }, 0);
  }, [cart, effectiveTier]);

  const totalPaise = subtotalPaise;
  const totalPiecesInCart = useMemo(() => cart.reduce((sum, i) => sum + i.qty, 0), [cart]);

  // Direct line Rate and MRP updaters
  const updateLineRate = (productId: string, unit: PickerUnit, inputStr: string) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId || line.unit !== unit) return line;
        const parsed = parseFloat(inputStr);
        const paise = !isNaN(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
        return {
          ...line,
          customRateInput: inputStr,
          customRatePaise: paise,
          isCustomRate: paise != null,
        };
      })
    );
  };

  const updateLineMrp = (productId: string, unit: PickerUnit, inputStr: string) => {
    setCart((prev) =>
      prev.map((line) => {
        if (line.product.id !== productId || line.unit !== unit) return line;
        const parsed = parseFloat(inputStr);
        const paise = !isNaN(parsed) && parsed >= 0 ? Math.round(parsed * 100) : null;
        return {
          ...line,
          customMrpInput: inputStr,
          customMrpPaise: paise,
          isCustomMrp: paise != null,
        };
      })
    );
  };

  // Add / adjust cart items with unit support (stock availability check removed so zero stock never blocks billing)
  const addToCart = (
    product: VanProduct,
    addQty: number,
    unit: PickerUnit = "PCS"
  ) => {
    const packSize = Math.max(1, product.packSize || 1);
    const bagSize = (product as any).bagSize || packSize;
    const pieceMultiplier =
      unit === "CARTON"
        ? packSize
        : unit === "BAG"
        ? bagSize
        : unit === "DOZEN"
        ? 12
        : 1;
    const addPieces = addQty * pieceMultiplier;

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.unit === unit);
      const currentUnitPieces = existing ? existing.qty : 0;
      const targetUnitPieces = currentUnitPieces + addPieces;

      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.unit === unit
            ? { ...i, qty: targetUnitPieces, unitQty: (existing.unitQty || 0) + addQty }
            : i
        );
      }
      return [
        ...prev,
        {
          product,
          qty: targetUnitPieces,
          unit,
          unitQty: addQty,
        },
      ];
    });
  };

  const removeFromCart = (productId: string, unit?: PickerUnit) => {
    setCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && (!unit || i.unit === unit)))
    );
  };

  const adjustCartQty = (productId: string, unit: PickerUnit, delta: number) => {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.product.id === productId && i.unit === unit) {
            const packSize = Math.max(1, i.product.packSize || 1);
            const bagSize = (i.product as any).bagSize || packSize;
            const mult =
              unit === "CARTON" ? packSize : unit === "BAG" ? bagSize : unit === "DOZEN" ? 12 : 1;
            const newUnitQty = i.unitQty + delta;
            if (newUnitQty <= 0) return null;
            return {
              ...i,
              unitQty: newUnitQty,
              qty: newUnitQty * mult,
            };
          }
          return i;
        })
        .filter(Boolean) as CartLine[];
    });
  };

  const clearCart = () => {
    setCart([]);
    setSelectedPartyId("");
    setWalkInName("");
    setWalkInMobile("");
    setWalkInAddress("");
    setPaymentMode(PaymentMode.CASH);
    setCurrentStep(1);
  };

  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBillName = quickCustomerForm.name.trim();
    if (!trimmedBillName) {
      setQuickCustomerError(tHi("customerRequiredError"));
      return;
    }
    if (/[\u0900-\u097F]/.test(trimmedBillName) || /[^\x20-\x7E]/.test(trimmedBillName) || !/[A-Za-z]/.test(trimmedBillName)) {
      setQuickCustomerError(tHi("englishBillNameError"));
      return;
    }
    setQuickCustomerSaving(true);
    setQuickCustomerError(null);
    try {
      const res = await createQuickPartyAction({
        name: trimmedBillName,
        nameHi: quickCustomerForm.nameHi.trim() || undefined,
        requireEnglishBillName: true,
        phone: quickCustomerForm.phone.trim() || undefined,
        type: quickCustomerForm.type,
        address: quickCustomerForm.address.trim() || undefined,
        gstin: quickCustomerForm.gstin.trim() || undefined,
      });
      if (res.error) {
        setQuickCustomerError(res.error);
      } else if (res.party) {
        const newParty: PartyOption = {
          id: res.party.id,
          name: res.party.name,
          nameHi: (res.party as any).nameHi ?? null,
          phone: res.party.phone,
          address: res.party.address,
          creditEnabled: res.party.creditEnabled,
          creditLimitPaise: res.party.creditLimitPaise,
          currentOutstandingPaise: 0,
        };
        setLocalParties((prev) => [newParty, ...prev]);
        setSelectedPartyId(newParty.id);
        setCustomerMode("PARTY");
        setQuickCustomerOpen(false);
        setQuickCustomerForm({ name: "", nameHi: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
      }
    } catch (err: any) {
      setQuickCustomerError(err.message || tHi("customerCreateFailedError"));
    } finally {
      setQuickCustomerSaving(false);
    }
  };

  // Submit Bill
  const handleFinalizeBill = async (explicitOverride?: { approvedByUserId: string; reason: string }) => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: tHi("cartEmptyError") });
      return;
    }

    if (!paymentCollected && (paymentMode === PaymentMode.CASH || paymentMode === PaymentMode.UPI)) {
      const hasCustomerInfo =
        selectedPartyId ||
        (walkInName.trim().length > 0 && walkInMobile.trim().length >= 10);
      if (!hasCustomerInfo) {
        setStatusMessage({
          type: "error",
          text: tHi("pendingNeedsCustomerError"),
        });
        return;
      }
    }

    const overrideToUse = explicitOverride || approvedCreditOverride;

    if (paymentMode === PaymentMode.CREDIT && !overrideToUse) {
      if (!selectedParty) {
        setStatusMessage({ type: "error", text: tHi("creditNeedsPartyError") });
        return;
      }

      if (isOnline) {
        try {
          const checkRes = await checkVanPartyCreditStatusAction(selectedParty.id, totalPaise);
          if (checkRes.success && checkRes.status && !checkRes.status.canProceedWithoutOverride) {
            setOverrideBreachReasons(checkRes.status.breachReasons);
            setPendingOverridePartyName(checkRes.status.partyName);
            setOverrideModalOpen(true);
            return;
          }
        } catch {
          // Proceed to let server handle it
        }
      } else {
        if (!selectedParty.creditEnabled) {
          setStatusMessage({ type: "error", text: tHi("creditPartyNotEnabledOffline") });
          return;
        }
        const remainingCredit =
          selectedParty.creditLimitPaise - selectedParty.currentOutstandingPaise;
        if (totalPaise > remainingCredit) {
          setOverrideBreachReasons([
            tHi("creditLimitExceedOffline", { avail: (remainingCredit / 100).toFixed(2), bill: (totalPaise / 100).toFixed(2) })
          ]);
          setPendingOverridePartyName(selectedParty.name);
          setOverrideModalOpen(true);
          return;
        }
      }
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    const clientTempId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const idempotencyKey = `van_${vanId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const mappedItems = cart.map((i) => {
      const packSize = Math.max(1, i.product.packSize || 1);
      const bagSize = (i.product as any).bagSize || packSize;
      const pieceMultiplier =
        i.unit === "CARTON"
          ? packSize
          : i.unit === "BAG"
          ? bagSize
          : i.unit === "DOZEN"
          ? 12
          : 1;

      const defaultPieceRatePaise = getProductTierUnitPrice(
        i.product,
        effectiveTier,
        i.isCustomMrp && i.customMrpPaise != null
          ? Math.round(i.customMrpPaise / pieceMultiplier)
          : null
      );
      const defaultUnitRatePaise = defaultPieceRatePaise * pieceMultiplier;
      const effectiveUnitRatePaise =
        i.isCustomRate && i.customRatePaise != null
          ? i.customRatePaise
          : defaultUnitRatePaise;
      const pieceRatePaise = Math.round(effectiveUnitRatePaise / pieceMultiplier);

      const defaultUnitMrpPaise = (i.product.mrpPaise || 0) * pieceMultiplier;
      const effectiveUnitMrpPaise =
        i.isCustomMrp && i.customMrpPaise != null
          ? i.customMrpPaise
          : defaultUnitMrpPaise;
      const pieceMrpPaise = Math.round(effectiveUnitMrpPaise / pieceMultiplier);

      return {
        productId: i.product.id,
        productName: i.product.name,
        shortCode: i.product.shortCode,
        qty: i.qty,
        packSize: i.product.packSize,
        packLabel: i.product.packLabel,
        mrpPaise: pieceMrpPaise,
        unitPriceOverridePaise: pieceRatePaise,
        mrpOverridePaise: pieceMrpPaise,
        originalMrpPaise: i.product.mrpPaise,
        unitLabel: i.unit === "CARTON" ? "Carton" : i.unit === "BAG" ? "Bag" : i.unit === "DOZEN" ? "Dozen" : "Pcs",
        rateOverridden: Boolean(i.isCustomRate),
        mrpOverridden: Boolean(i.isCustomMrp),
      };
    });

    const draftData: VanDraftInvoice = {
      clientTempId,
      idempotencyKey,
      vanLocationId: vanId,
      vanName,
      partyId: selectedPartyId || null,
      partyName: selectedParty?.name || walkInName || "Cash Customer",
      items: mappedItems,
      payments: [{ mode: paymentMode, amountPaise: totalPaise }],
      pricingTier: effectiveTier,
      buyerType: effectiveTier,
      totalPaise,
      createdAt: new Date().toISOString(),
      syncStatus: "DRAFT",
    };

    if (!isOnline) {
      await saveDraftInvoice(draftData);
      await loadPendingDrafts();
      clearCart();
      setIsSubmitting(false);
      setStatusMessage({
        type: "warning",
        text: tHi("offlineSavedWarning", { total: (totalPaise / 100).toFixed(2) }),
      });
      return;
    }

    try {
      const res = await createVanInvoiceAction({
        locationId: vanId,
        partyId: selectedPartyId || null,
        customerName: selectedPartyId ? undefined : walkInName.trim() || undefined,
        customerPhone: selectedPartyId ? undefined : walkInMobile.trim() || undefined,
        customerAddress: selectedPartyId ? undefined : walkInAddress.trim() || undefined,
        idempotencyKey,
        pricingTier: effectiveTier,
        buyerType: effectiveTier,
        items: mappedItems.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          unitPriceOverridePaise: i.unitPriceOverridePaise,
          mrpOverridePaise: i.mrpOverridePaise,
          originalMrpPaise: i.originalMrpPaise,
          mrpOverridden: i.mrpOverridden,
          rateOverridden: i.rateOverridden,
          unitLabel: i.unitLabel,
        })),
        payments: paymentCollected && paymentMode !== PaymentMode.CREDIT ? [{ mode: paymentMode, amountPaise: totalPaise }] : [],
        paymentStatus: (!paymentCollected || paymentMode === PaymentMode.CREDIT) ? "PENDING" : "PAID",
        creditOverride: overrideToUse || undefined,
      });

      if (!res.success || !res.invoice) {
        const errorMsg = res.error || "Invoice finalization failed";
        if (errorMsg.includes("Credit sale blocked") || errorMsg.includes("Credit limit exceeded")) {
          setOverrideBreachReasons([errorMsg]);
          setPendingOverridePartyName(selectedParty?.name || "Customer");
          setOverrideModalOpen(true);
          setIsSubmitting(false);
          return;
        }
        throw new Error(errorMsg);
      }

      setApprovedCreditOverride(null);
      setLastInvoice(res.invoice);
      clearCart();
      setStatusMessage({
        type: "success",
        text: tHi("invoiceSuccessToast", { number: res.invoice.number }),
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      await saveDraftInvoice({ ...draftData, syncStatus: "FAILED", errorMessage: errMsg });
      await loadPendingDrafts();
      clearCart();
      setStatusMessage({
        type: "warning",
        text: tHi("invoiceInterruptedWarning", { err: errMsg }),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerDraftSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const drafts = await listDraftInvoices(vanId);
      const pending = drafts.filter((d) => d.syncStatus !== "SYNCED");

      let syncedCount = 0;
      for (const draft of pending) {
        try {
          const res = await createVanInvoiceAction({
            locationId: draft.vanLocationId,
            partyId: draft.partyId || null,
            idempotencyKey: draft.idempotencyKey,
            pricingTier: draft.pricingTier,
            buyerType: draft.buyerType,
            items: draft.items.map((i) => ({
              productId: i.productId,
              qty: i.qty,
              unitPriceOverridePaise: i.unitPriceOverridePaise,
              mrpOverridePaise: i.mrpOverridePaise,
              originalMrpPaise: i.originalMrpPaise,
              rateOverridden: i.rateOverridden,
              mrpOverridden: i.mrpOverridden,
              unitLabel: i.unitLabel,
            })),
            payments: draft.payments.map((p) => ({
              mode: p.mode as PaymentMode,
              amountPaise: p.amountPaise,
            })),
          });

          if (res.success && res.invoice) {
            await deleteDraftInvoice(draft.clientTempId);
            syncedCount++;
          }
        } catch {
          // keep draft for next attempt
        }
      }

      await loadPendingDrafts();
      if (syncedCount > 0) {
        setStatusMessage({
          type: "success",
          text: tHi("syncedDraftsSuccess", { count: syncedCount }),
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper: Display Customer Label (Hindi display name in Van UI)
  const activeCustomerLabel = useMemo(() => {
    if (selectedParty) return selectedParty.nameHi || selectedParty.name;
    if (walkInName.trim()) return `${walkInName.trim()} (${tHi("walkInCustomer")})`;
    if (walkInMobile.trim()) return `${tHi("walkInCustomer")} (${walkInMobile.trim()})`;
    return tHi("walkInCustomer");
  }, [selectedParty, walkInName, walkInMobile]);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* 1. Vehicle & Network Sync Status */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2.5 rounded-xl ${
              isOnline
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-slate-900">{vanName}</span>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {tHi("loadShortBadge", { sheet: issueSheetNo })}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {isOnline ? tHi("onlineSyncReady") : tHi("offlineSyncSafe")}
            </p>
          </div>
        </div>

        {pendingDrafts.length > 0 && (
          <button
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition animate-pulse"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{tHi("offlineDraftsBtn", { count: pendingDrafts.length })}</span>
          </button>
        )}
      </div>

      {/* 2. Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : statusMessage.type === "warning"
              ? "bg-amber-50 border border-amber-200 text-amber-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-75 hover:opacity-100 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. Invoice Finalized Success Modal */}
      {lastInvoice && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-5 sm:p-6 space-y-4 shadow-lg text-emerald-950 animate-in zoom-in-95">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                {tHi("billGeneratedBadge")}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                {lastInvoice.number}
              </h2>
              <p className="text-sm font-bold text-slate-700">
                {tHi("totalWord")} <strong className="text-emerald-700 text-base">₹{(lastInvoice.totalPaise / 100).toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <BillMessagingCard
            locale="hi"
            invoiceId={lastInvoice.id}
            invoiceNumber={lastInvoice.number}
            defaultPhone={lastInvoice.targetPhone}
            billUrl={lastInvoice.billUrl}
            waMeUrl={lastInvoice.waMeUrl}
            initialSkipped={lastInvoice.messagingSkipped}
            initialReason={lastInvoice.messagingReason}
          />

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
            <BluetoothPrintButton
              invoiceId={lastInvoice.id}
              invoiceNumber={lastInvoice.number}
              variant="primary"
            />
            <Link
              href={`/shop/invoices/${lastInvoice.id}/print`}
              target="_blank"
              className="px-4 py-3 rounded-2xl text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition"
            >
              {tHi("browserPrintBtn")}
            </Link>
            <button
              onClick={() => {
                setLastInvoice(null);
                clearCart();
              }}
              className="flex-1 min-w-[140px] px-5 py-3 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition text-center"
            >
              {tHi("startNextSaleBtn")}
            </button>
          </div>
        </div>
      )}

      {/* 4. Interactive 3-Step Flow Stepper */}
      <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-xs">
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-black">
          {/* Step 1 Tab */}
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              currentStep === 1
                ? "bg-[#12355B] text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
                currentStep === 1 ? "bg-white text-[#12355B]" : "bg-slate-200 text-slate-700"
              }`}
            >
              1
            </span>
            <span className="truncate">{tHi("step1Short")}</span>
          </button>

          {/* Step 2 Tab */}
          <button
            type="button"
            onClick={() => setCurrentStep(2)}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              currentStep === 2
                ? "bg-[#12355B] text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
                currentStep === 2 ? "bg-white text-[#12355B]" : "bg-slate-200 text-slate-700"
              }`}
            >
              2
            </span>
            <span className="truncate">{tHi("step2Short", { count: totalPiecesInCart })}</span>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => {
              if (cart.length > 0) setCurrentStep(3);
              else setStatusMessage({ type: "warning", text: tHi("addProductsFirstWarning") });
            }}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition ${
              currentStep === 3
                ? "bg-[#12355B] text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-black ${
                currentStep === 3 ? "bg-white text-[#12355B]" : "bg-slate-200 text-slate-700"
              }`}
            >
              3
            </span>
            <span className="truncate">{tHi("step3Short")}</span>
          </button>
        </div>
      </div>

      {/* ================= STEP 1: CUSTOMER SELECTION ================= */}
      {currentStep === 1 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-5 shadow-xs text-slate-900 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>{tHi("step1Customer")}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tHi("step1Subtitle")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setQuickCustomerError(null);
                setQuickCustomerOpen(true);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#12355B]/10 hover:bg-[#12355B]/20 text-[#12355B] transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{tHi("newCustomerBtn")}</span>
            </button>
          </div>

          {/* Mode Switcher: Registered Party vs Walk-in */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setCustomerMode("PARTY")}
              className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
                customerMode === "PARTY"
                  ? "bg-white text-[#12355B] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Store className="w-4 h-4" />
              <span>{tHi("registeredShopTab")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomerMode("WALKIN");
                setSelectedPartyId("");
              }}
              className={`py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 ${
                customerMode === "WALKIN"
                  ? "bg-white text-[#12355B] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User className="w-4 h-4" />
              <span>{tHi("walkInBuyerTab")}</span>
            </button>
          </div>

          {/* Customer Mode A: Registered Party */}
          {customerMode === "PARTY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {tHi("selectCustomerLabel")}
                </label>
                <PartySearchBox
                  parties={localParties as any}
                  selectedPartyId={selectedPartyId}
                  onSelect={(party) => setSelectedPartyId(party.id)}
                  onClear={() => setSelectedPartyId("")}
                  placeholder={tHi("searchPartyPlaceholder")}
                  allowQuickAdd={true}
                  onQuickAdd={() => setQuickCustomerOpen(true)}
                  locale="hi"
                />
              </div>

              {/* Party Profile Card with Inline Editable Fields */}
              {selectedParty && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                    <span className="text-xs font-black text-blue-900">
                      {tHi("shopContactDetailsTitle")}
                    </span>
                    <span className="text-xs text-blue-700 font-medium">
                      {tHi("pressSaveUpdateDb")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-0.5">{tHi("shopNameLabel")}</label>
                      <input
                        type="text"
                        value={vanPartyName}
                        onChange={(e) => {
                          setVanPartyName(e.target.value);
                          setIsPartyDirty(true);
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-0.5">{tHi("phoneNumberLabel")}</label>
                      <input
                        type="tel"
                        value={vanPartyPhone}
                        onChange={(e) => {
                          setVanPartyPhone(e.target.value);
                          setIsPartyDirty(true);
                        }}
                        placeholder={tHi("phonePlaceholder")}
                        className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-0.5">{tHi("addressVillageLabel")}</label>
                      <input
                        type="text"
                        value={vanPartyAddress}
                        onChange={(e) => {
                          setVanPartyAddress(e.target.value);
                          setIsPartyDirty(true);
                        }}
                        placeholder={tHi("locationPlaceholder")}
                        className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">{tHi("balanceLabel")} </span>
                        <strong
                          className={
                            selectedParty.currentOutstandingPaise > 0
                              ? "text-amber-700"
                              : selectedParty.currentOutstandingPaise < 0
                              ? "text-emerald-700"
                              : "text-slate-700"
                          }
                        >
                          ₹{(Math.abs(selectedParty.currentOutstandingPaise) / 100).toFixed(2)}
                        </strong>
                      </div>
                      {selectedParty.creditEnabled && (
                        <div>
                          <span className="text-slate-500">{tHi("creditLimitShort")} </span>
                          <strong className="text-slate-800">
                            ₹{(selectedParty.creditLimitPaise / 100).toFixed(0)}
                          </strong>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleSavePartyInVan}
                      disabled={isSavingParty || (!isPartyDirty && !partySaveSuccess)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                        partySaveSuccess
                          ? "bg-emerald-600 text-white"
                          : isPartyDirty
                          ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                          : "bg-slate-200 text-slate-400 cursor-default"
                      }`}
                    >
                      {isSavingParty ? (
                        <span>{tHi("savingText")}</span>
                      ) : partySaveSuccess ? (
                        <span>{tHi("savedDetailsBtn")}</span>
                      ) : (
                        <span>{tHi("saveDetailsBtn")}</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Customer Mode B: Walk-in Cash Customer */}
          {customerMode === "WALKIN" && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-black text-slate-700 block">
                {tHi("walkInSectionTitle")}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{tHi("walkInMobileLabel")}</label>
                  <input
                    type="tel"
                    placeholder={tHi("walkInMobilePlaceholder")}
                    value={walkInMobile}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setWalkInMobile(digits);
                      if (digits.length === 10) {
                        const match = localParties.find((p) => p.phone === digits);
                        if (match) {
                          setWalkInName(match.name);
                          if (match.address) setWalkInAddress(match.address);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{tHi("walkInNameLabel")}</label>
                  <input
                    type="text"
                    placeholder={tHi("walkInNamePlaceholder")}
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{tHi("walkInAddressLabel")}</label>
                  <input
                    type="text"
                    placeholder={tHi("walkInAddressPlaceholder")}
                    value={walkInAddress}
                    onChange={(e) => setWalkInAddress(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 1 Next Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#12355B] hover:bg-[#0E2843] text-white text-sm font-black shadow-md flex items-center justify-center gap-2 transition"
            >
              <span>{tHi("continueSelectProductsBtn")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: PRODUCT SELECTION (MORNING LOAD ONLY) ================= */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Customer Mini Summary Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 px-4 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-500">{tHi("customerBannerLabel")}</span>
              <span className="font-black text-[#12355B] text-sm">{activeCustomerLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
            >
              {tHi("changeCustomerBtn")}
            </button>
          </div>

          {/* Pricing Tier Selector (Auto / Tier A / Tier B / Tier C) */}
          <div className="flex items-center justify-between gap-2 flex-wrap bg-white p-2.5 px-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">{tHi("priceTierLabel")}</span>
              <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${
                effectiveTier === "WHOLESALER"
                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                  : effectiveTier === "RETAILER"
                  ? "bg-blue-100 text-blue-900 border border-blue-200"
                  : "bg-emerald-100 text-emerald-900 border border-emerald-200"
              }`}>
                {effectiveTier === "WHOLESALER" ? tHi("tierAWholesale") : effectiveTier === "RETAILER" ? tHi("tierBRetail") : tHi("tierCStandard")}
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setSelectedTierMode("AUTO")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  selectedTierMode === "AUTO"
                    ? "bg-[#12355B] text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tHi("tierAutoBtn", { tier: effectiveTier[0] })}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("WHOLESALER")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  selectedTierMode === "WHOLESALER"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tHi("tierABtn")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("RETAILER")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  selectedTierMode === "RETAILER"
                    ? "bg-blue-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tHi("tierBBtn")}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("CUSTOMER")}
                className={`px-2.5 py-1 rounded-lg text-xs font-black transition ${
                  selectedTierMode === "CUSTOMER"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {tHi("tierCBtn")}
              </button>
            </div>
          </div>

          {/* Morning Load Product Search */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tHi("searchItemPlaceholder")}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B] shadow-xs"
            />
          </div>

          {/* Loaded Products List */}
          <div className="space-y-2.5">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 text-xs space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600 text-base">{tHi("noMorningLoadMatchTitle")}</p>
                <p>{tHi("noMorningLoadMatchDesc")}</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.filter((i) => i.product.id === p.id);
                const totalInCartPieces = inCart.reduce((sum, i) => sum + i.qty, 0);
                const tierPieceRate = getProductTierUnitPrice(p, effectiveTier);

                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      totalInCartPieces > 0
                        ? "bg-blue-50/40 border-blue-300 shadow-xs"
                        : "bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Product Metadata */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-base font-black text-slate-900">
                            {p.nameHi || p.name}
                          </h4>
                          {p.weight && (
                            <span className="text-[10px] font-extrabold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300">
                              {p.weight}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                          <span className="font-semibold text-slate-700">{p.companyName}</span>
                          <span>•</span>
                          <span className="font-mono text-slate-600">{p.shortCode}</span>
                          <span>•</span>
                          <span className="text-[#12355B] font-black bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {tHi("ratePerPcPrefix")} ₹{(tierPieceRate / 100).toFixed(2)}/{tHi("pcs")}
                          </span>
                          <span className="text-slate-500 font-bold line-through">
                            {tHi("mrpShortLabel")} ₹{(p.mrpPaise / 100).toFixed(2)}
                          </span>
                        </div>

                        {/* Morning Load Stock Indicator */}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-extrabold">
                            {tHi("availableStockChip", { cartons: p.cartons, loose: p.loosePieces, total: p.availablePieces })}
                          </span>
                          {p.morningIssuedQty !== undefined && (
                            <span className="text-slate-500 font-medium hidden sm:inline">
                              {tHi("morningLoadChip", { qty: p.morningIssuedQty })}
                            </span>
                          )}
                        </div>

                        {/* In-cart summary chip */}
                        {totalInCartPieces > 0 && (
                          <div className="mt-2 text-xs font-black text-blue-900 flex items-center gap-1.5 flex-wrap">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            <span>{tHi("inCartSummaryChip", { pieces: totalInCartPieces })}</span>
                          </div>
                        )}

                        {/* In-cart inline editable MRP & Rate */}
                        {inCart.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-200/60 space-y-1.5">
                            {inCart.map((cLine) => {
                              const packSize = Math.max(1, p.packSize || 1);
                              const bagSize = (p as any).bagSize || packSize;
                              const mult = cLine.unit === "CARTON" ? packSize : cLine.unit === "BAG" ? bagSize : cLine.unit === "DOZEN" ? 12 : 1;
                              const defPieceRate = getProductTierUnitPrice(p, effectiveTier, cLine.isCustomMrp && cLine.customMrpPaise != null ? Math.round(cLine.customMrpPaise / mult) : null);
                              const defUnitRate = defPieceRate * mult;
                              const effUnitRate = cLine.isCustomRate && cLine.customRatePaise != null ? cLine.customRatePaise : defUnitRate;
                              const defUnitMrp = (p.mrpPaise || 0) * mult;
                              const effUnitMrp = cLine.isCustomMrp && cLine.customMrpPaise != null ? cLine.customMrpPaise : defUnitMrp;

                              return (
                                <div key={cLine.unit} className="p-1.5 bg-white/90 rounded-xl border border-blue-200 flex items-center justify-between gap-2 flex-wrap text-xs">
                                  <span className="font-black text-slate-800">{cLine.unitQty} {cLine.unit}:</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-slate-500">MRP:</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={cLine.customMrpInput !== undefined ? cLine.customMrpInput : (effUnitMrp / 100).toFixed(2)}
                                        onChange={(e) => updateLineMrp(p.id, cLine.unit, e.target.value)}
                                        className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border border-slate-300"
                                      />
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-bold text-slate-500">Rate:</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={cLine.customRateInput !== undefined ? cLine.customRateInput : (effUnitRate / 100).toFixed(2)}
                                        onChange={(e) => updateLineRate(p.id, cLine.unit, e.target.value)}
                                        className="w-16 px-1.5 py-0.5 text-right font-mono font-bold text-xs rounded border border-emerald-400 bg-emerald-50 text-emerald-950 font-black"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Qty & Unit Picker */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <QtyUnitPicker
                          productId={p.id}
                          productName={p.name}
                          packSize={p.packSize}
                          bagSize={(p as any).bagSize || p.packSize}
                          packLabel={p.packLabel}
                          mrpPaise={tierPieceRate}
                          availablePieces={p.availablePieces}
                          allowZeroStock={true}
                          onAdd={(qty, unit) => {
                            addToCart(p, qty, unit);
                          }}
                          disabled={false}
                          locale="hi"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating / Sticky Bottom Summary Tray */}
          {cart.length > 0 && (
            <div className="sticky bottom-3 z-20 bg-slate-900 text-white p-3 sm:p-4 rounded-3xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2">
              <div>
                <span className="text-xs font-bold text-slate-400 block">
                  {tHi("totalBillAmountLabel")}
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  ₹{(totalPaise / 100).toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 ml-2 font-medium">
                  {tHi("cartCountSummary", { pieces: totalPiecesInCart, lines: cart.length })}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                >
                  ← {tHi("step1Short")}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black shadow-lg transition flex items-center gap-1.5"
                >
                  <span>{tHi("nextStepBtn")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: PAYMENT & FINALIZE ================= */}
      {currentStep === 3 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-6 shadow-xs text-slate-900 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span>{tHi("step3Payment")}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tHi("step3Subtitle")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
            >
              {tHi("addMoreItemsBtn")}
            </button>
          </div>

          {/* Customer Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">{tHi("billedToLabel")}</span>
              <strong className="text-sm font-black text-slate-900">{activeCustomerLabel}</strong>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-blue-600 font-bold hover:underline"
            >
              {tHi("changeBtn")}
            </button>
          </div>

          {/* Itemized Cart Table */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-700 block">
              {tHi("billItemsHeading", { count: cart.length })}
            </span>
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white shadow-2xs">
              {cart.map((line) => {
                const packSize = Math.max(1, line.product.packSize || 1);
                const bagSize = (line.product as any).bagSize || packSize;
                const mult = line.unit === "CARTON" ? packSize : line.unit === "BAG" ? bagSize : line.unit === "DOZEN" ? 12 : 1;
                const defaultPieceRatePaise = getProductTierUnitPrice(
                  line.product,
                  effectiveTier,
                  line.isCustomMrp && line.customMrpPaise != null ? Math.round(line.customMrpPaise / mult) : null
                );
                const defaultUnitRatePaise = defaultPieceRatePaise * mult;
                const effectiveUnitRatePaise = line.isCustomRate && line.customRatePaise != null ? line.customRatePaise : defaultUnitRatePaise;

                const defaultUnitMrpPaise = (line.product.mrpPaise || 0) * mult;
                const effectiveUnitMrpPaise = line.isCustomMrp && line.customMrpPaise != null ? line.customMrpPaise : defaultUnitMrpPaise;

                const lineTotal = (line.unitQty * effectiveUnitRatePaise) / 100;

                return (
                  <div
                    key={`${line.product.id}_${line.unit}`}
                    className="p-3 hover:bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-black text-slate-900 truncate">{line.product.nameHi || line.product.name}</p>
                        {line.product.weight && (
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                            {line.product.weight}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                          {effectiveTier === "WHOLESALER" ? "Tier A" : effectiveTier === "RETAILER" ? "Tier B" : "Tier C"}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {line.unitQty} {line.unit === "CARTON" ? tHi("unitCarton") : line.unit === "BAG" ? tHi("unitBag") : line.unit === "DOZEN" ? tHi("unitDozen") : tHi("unitPcs")} ({line.qty} {tHi("pcs")})
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">MRP:</span>
                        <div className="relative w-20">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.customMrpInput !== undefined ? line.customMrpInput : (effectiveUnitMrpPaise / 100).toFixed(2)}
                            onChange={(e) => updateLineMrp(line.product.id, line.unit, e.target.value)}
                            className={`w-full pl-4 pr-1 py-0.5 text-right font-mono font-bold text-xs rounded border ${
                              line.isCustomMrp ? "border-amber-400 bg-amber-50 text-amber-950 font-black" : "border-slate-300 bg-white text-slate-900"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Rate:</span>
                        <div className="relative w-20">
                          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.customRateInput !== undefined ? line.customRateInput : (effectiveUnitRatePaise / 100).toFixed(2)}
                            onChange={(e) => updateLineRate(line.product.id, line.unit, e.target.value)}
                            className={`w-full pl-4 pr-1 py-0.5 text-right font-mono font-bold text-xs rounded border ${
                              line.isCustomRate ? "border-emerald-500 bg-emerald-50 text-emerald-950 font-black" : "border-slate-300 bg-white text-slate-900"
                            }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200 ml-1">
                        <button
                          type="button"
                          onClick={() => adjustCartQty(line.product.id, line.unit, -1)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center font-black"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs">{line.unitQty}</span>
                        <button
                          type="button"
                          onClick={() => adjustCartQty(line.product.id, line.unit, 1)}
                          className="w-7 h-7 rounded-lg bg-white text-slate-700 hover:bg-slate-200 flex items-center justify-center font-black"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <strong className="text-sm font-black text-slate-900 font-mono w-20 text-right">
                        ₹{lineTotal.toFixed(2)}
                      </strong>

                      <button
                        type="button"
                        onClick={() => removeFromCart(line.product.id, line.unit)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title={tHi("removeLineTitle")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Giant Grand Total Box */}
          <div className="bg-[#12355B] text-white rounded-3xl p-5 text-center shadow-md">
            <span className="text-sm font-extrabold text-blue-200">
              {tHi("grandTotalUpper")}
            </span>
            <div className="text-3xl sm:text-4xl font-black mt-1 font-mono">
              ₹{(totalPaise / 100).toFixed(2)}
            </div>
            <p className="text-xs text-blue-200 mt-1 font-medium">
              {tHi("gstIncludedSummary", { pieces: totalPiecesInCart })}
            </p>
          </div>

          {/* Payment Mode Selector (3 Big Cards) */}
          <div className="space-y-2">
            <label className="text-sm font-black text-slate-800 block">
              {tHi("paymentModeLabel")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Cash Mode */}
              <button
                type="button"
                onClick={() => setPaymentMode(PaymentMode.CASH)}
                className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-3 ${
                  paymentMode === PaymentMode.CASH
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm">{tHi("modeCash")}</h4>
                  <p className="text-xs text-slate-500">{tHi("modeCashSub")}</p>
                </div>
              </button>

              {/* UPI Mode */}
              <button
                type="button"
                onClick={() => setPaymentMode(PaymentMode.UPI)}
                className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-3 ${
                  paymentMode === PaymentMode.UPI
                    ? "border-blue-600 bg-blue-50/70 text-blue-950 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    paymentMode === PaymentMode.UPI
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm">{tHi("modeUpi")}</h4>
                  <p className="text-xs text-slate-500">{tHi("modeUpiSub")}</p>
                </div>
              </button>

              {/* Credit Mode */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedParty) {
                    setStatusMessage({ type: "error", text: tHi("creditNeedsPartyError") });
                    setCurrentStep(1);
                    return;
                  }
                  setPaymentMode(PaymentMode.CREDIT);
                }}
                className={`p-4 rounded-2xl border-2 text-left transition flex items-center gap-3 ${
                  paymentMode === PaymentMode.CREDIT
                    ? "border-amber-600 bg-amber-50/70 text-amber-950 shadow-xs"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    paymentMode === PaymentMode.CREDIT
                      ? "bg-amber-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm">{tHi("modeCredit")}</h4>
                  <p className="text-xs text-slate-500">
                    {selectedParty?.creditEnabled ? tHi("creditApprovedTag") : tHi("creditRegisteredOnlyTag")}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Payment Status Toggle (Cash / UPI) */}
          {paymentMode !== PaymentMode.CREDIT && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">{tHi("paymentCollectionLabel")}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentCollected(true)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    paymentCollected
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-300"
                  }`}
                >
                  {tHi("paymentReceivedBtn")}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentCollected(false)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition ${
                    !paymentCollected
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-300"
                  }`}
                >
                  {tHi("paymentPendingBtn")}
                </button>
              </div>
            </div>
          )}

          {/* Finalize Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
            >
              {tHi("prevStepBtn")}
            </button>

            <button
              type="button"
              onClick={() => handleFinalizeBill()}
              disabled={isSubmitting || cart.length === 0}
              className="flex-1 w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-black shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{tHi("generatingInvoiceText")}</span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>{tHi("finalizeBillBtn")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Quick Customer Creation Modal */}
      {quickCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#12355B] text-base flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" />
                {tHi("quickAddCustomerTitle")}
              </h3>
              <button
                onClick={() => setQuickCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            {quickCustomerError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {quickCustomerError}
              </div>
            )}

            <form onSubmit={handleCreateQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {tHi("englishBillNameLabel")}
                </label>
                <p className="text-xs text-slate-500 mb-1">{tHi("englishBillNameHint")}</p>
                <input
                  type="text"
                  required
                  value={quickCustomerForm.name}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="e.g. Gupta Kirana Store"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  {tHi("hindiDisplayNameLabel")}
                </label>
                <input
                  type="text"
                  value={quickCustomerForm.nameHi}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, nameHi: e.target.value })}
                  placeholder={tHi("hindiDisplayNamePlaceholder")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">{tHi("phoneLabel")}</label>
                  <input
                    type="tel"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                    placeholder={tHi("phonePlaceholder")}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">{tHi("customerTypeLabel")}</label>
                  <select
                    value={quickCustomerForm.type}
                    onChange={(e) =>
                      setQuickCustomerForm({ ...quickCustomerForm, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B] bg-white"
                  >
                    <option value="CUSTOMER">{tHi("retailConsumer")}</option>
                    <option value="RETAILER">{tHi("retailerKirana")}</option>
                    <option value="WHOLESALER">{tHi("wholesaler")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">{tHi("addressLabel")}</label>
                <input
                  type="text"
                  value={quickCustomerForm.address}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                  placeholder={tHi("addressPlaceholder")}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  {tHi("cancelBtn")}
                </button>
                <button
                  type="submit"
                  disabled={quickCustomerSaving}
                  className="px-5 py-2 rounded-xl bg-[#12355B] hover:bg-[#0E2843] text-white font-bold transition disabled:opacity-50"
                >
                  {quickCustomerSaving ? tHi("savingText") : tHi("saveCustomerBtn")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Offline Drafts Queue Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#12355B] text-base flex items-center gap-2">
                <CloudUpload className="w-5 h-5 text-amber-500" />
                {tHi("offlineDraftsModalTitle", { count: pendingDrafts.length })}
              </h3>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {tHi("offlineDraftsModalDesc")}
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {pendingDrafts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  {tHi("noDraftsPendingSync")}
                </div>
              ) : (
                pendingDrafts.map((draft) => (
                  <div
                    key={draft.clientTempId}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{draft.partyName}</p>
                      <p className="text-[11px] text-slate-500">
                        {draft.items.length} item(s) • ₹{(draft.totalPaise / 100).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-amber-600 font-mono">
                        {new Date(draft.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        await deleteDraftInvoice(draft.clientTempId);
                        await loadPendingDrafts();
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title={tHi("discardDraftTitle")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={triggerDraftSync}
                disabled={!isOnline || isSyncing || pendingDrafts.length === 0}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#12355B] hover:bg-[#0E2843] text-white disabled:opacity-40 transition-colors shadow-xs"
              >
                {isSyncing ? tHi("syncingText") : isOnline ? tHi("syncAllNowBtn") : tHi("connectToSyncBtn")}
              </button>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                {tHi("doneBtn")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Limit Override Modal */}
      <CreditOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        partyName={pendingOverridePartyName}
        breachReasons={overrideBreachReasons}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        onApproved={(override) => {
          setApprovedCreditOverride(override);
          setOverrideModalOpen(false);
          handleFinalizeBill(override);
        }}
      />
    </div>
  );
}
