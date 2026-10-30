"use client";

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
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { QtyUnitPicker, PickerUnit } from "@/components/billing/qty-unit-picker";
import { PaymentMode } from "@prisma/client";

interface VanProduct {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  shortCode: string;
  weight?: string | null;
  packSize: number;
  packLabel: string;
  mrpPaise: number;
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
  } | null>(null);

  // Quick Customer Creation State
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    name: "",
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
      alert("Customer name cannot be empty");
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
        alert(res.error || "Failed to update party");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update party");
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
      setStatusMessage({ type: "info", text: "Back online. Syncing pending drafts..." });
      triggerDraftSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setStatusMessage({
        type: "warning",
        text: "Network dropped. Bills will be saved as local drafts.",
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
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.shortCode.toLowerCase().includes(term) ||
        (p.weight && p.weight.toLowerCase().includes(term)) ||
        p.companyName.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

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

  // Totals
  const subtotalPaise = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty * item.product.mrpPaise, 0);
  }, [cart]);

  const totalPaise = subtotalPaise;
  const totalPiecesInCart = useMemo(() => cart.reduce((sum, i) => sum + i.qty, 0), [cart]);

  // Add / adjust cart items with unit support
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
      const otherPieces = prev
        .filter((i) => i.product.id === product.id && i.unit !== unit)
        .reduce((sum, i) => sum + i.qty, 0);

      const currentUnitPieces = existing ? existing.qty : 0;
      const targetUnitPieces = currentUnitPieces + addPieces;

      if (targetUnitPieces + otherPieces > product.availablePieces) {
        setStatusMessage({
          type: "warning",
          text: `Cannot add: exceeds total ${product.availablePieces} pcs available on van`,
        });
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.unit === unit
            ? { ...i, qty: targetUnitPieces, unitQty: (existing.unitQty || 0) + addQty }
            : i
        );
      }
      return [...prev, { product, qty: targetUnitPieces, unit, unitQty: addQty }];
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
    if (!quickCustomerForm.name.trim()) {
      setQuickCustomerError("Customer name is required");
      return;
    }
    setQuickCustomerSaving(true);
    setQuickCustomerError(null);
    try {
      const res = await createQuickPartyAction({
        name: quickCustomerForm.name.trim(),
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
        setQuickCustomerForm({ name: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
      }
    } catch (err: any) {
      setQuickCustomerError(err.message || "Failed to create customer");
    } finally {
      setQuickCustomerSaving(false);
    }
  };

  // Submit Bill
  const handleFinalizeBill = async (explicitOverride?: { approvedByUserId: string; reason: string }) => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: "Cart is empty. Please select products first." });
      return;
    }

    if (!paymentCollected && (paymentMode === PaymentMode.CASH || paymentMode === PaymentMode.UPI)) {
      const hasCustomerInfo =
        selectedPartyId ||
        (walkInName.trim().length > 0 && walkInMobile.trim().length >= 10);
      if (!hasCustomerInfo) {
        setStatusMessage({
          type: "error",
          text: "Customer Name and 10-digit Mobile are mandatory when Payment Pending is selected.",
        });
        return;
      }
    }

    const overrideToUse = explicitOverride || approvedCreditOverride;

    if (paymentMode === PaymentMode.CREDIT && !overrideToUse) {
      if (!selectedParty) {
        setStatusMessage({ type: "error", text: "Please select a registered customer party for credit sales" });
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
          setStatusMessage({ type: "error", text: "This party is not enabled for credit" });
          return;
        }
        const remainingCredit =
          selectedParty.creditLimitPaise - selectedParty.currentOutstandingPaise;
        if (totalPaise > remainingCredit) {
          setOverrideBreachReasons([
            `Exceeds credit limit! Available credit: ₹${(remainingCredit / 100).toFixed(2)} (Bill: ₹${(totalPaise / 100).toFixed(2)})`
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

    const draftData: VanDraftInvoice = {
      clientTempId,
      idempotencyKey,
      vanLocationId: vanId,
      vanName,
      partyId: selectedPartyId || null,
      partyName: selectedParty?.name || walkInName || "Cash Customer",
      items: cart.map((i) => ({
        productId: i.product.id,
        productName: i.product.name,
        shortCode: i.product.shortCode,
        qty: i.qty,
        packSize: i.product.packSize,
        packLabel: i.product.packLabel,
        mrpPaise: i.product.mrpPaise,
      })),
      payments: [{ mode: paymentMode, amountPaise: totalPaise }],
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
        text: `📶 Saved offline as draft. Total: ₹${(totalPaise / 100).toFixed(2)}. Will sync when reconnected.`,
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
        items: cart.map((i) => ({ productId: i.product.id, qty: i.qty })),
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
        text: `Invoice #${res.invoice.number} finalized successfully!`,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Network error";
      await saveDraftInvoice({ ...draftData, syncStatus: "FAILED", errorMessage: errMsg });
      await loadPendingDrafts();
      clearCart();
      setStatusMessage({
        type: "warning",
        text: `Submission interrupted: ${errMsg}. Bill saved locally as draft.`,
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
            items: draft.items.map((i) => ({ productId: i.productId, qty: i.qty })),
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
          text: `Successfully synced ${syncedCount} offline draft(s) with server!`,
        });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper: Display Customer Label
  const activeCustomerLabel = useMemo(() => {
    if (selectedParty) return selectedParty.name;
    if (walkInName.trim()) return `${walkInName.trim()} (Walk-in)`;
    if (walkInMobile.trim()) return `Cash Customer (${walkInMobile.trim()})`;
    return "Cash Retail Buyer";
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
                Load #{issueSheetNo}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {isOnline ? "🟢 Online • Cloud sync ready" : "🟠 Offline • Local memory safe"}
            </p>
          </div>
        </div>

        {pendingDrafts.length > 0 && (
          <button
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition animate-pulse"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{pendingDrafts.length} Offline Draft{pendingDrafts.length > 1 ? "s" : ""}</span>
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
                BILL GENERATED
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-0.5">
                {lastInvoice.number}
              </h2>
              <p className="text-sm font-bold text-slate-700">
                Total: <strong className="text-emerald-700 text-base">₹{(lastInvoice.totalPaise / 100).toFixed(2)}</strong>
              </p>
            </div>
          </div>

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
              📄 Browser Print
            </Link>
            <button
              onClick={() => {
                setLastInvoice(null);
                clearCart();
              }}
              className="flex-1 min-w-[140px] px-5 py-3 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition text-center"
            >
              + Start Next Sale (अगला बिल)
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
            <span className="truncate">Customer</span>
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
            <span className="truncate">Items ({totalPiecesInCart})</span>
          </button>

          {/* Step 3 Tab */}
          <button
            type="button"
            onClick={() => {
              if (cart.length > 0) setCurrentStep(3);
              else setStatusMessage({ type: "warning", text: "Please add products first before proceeding to payment." });
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
            <span className="truncate">Payment</span>
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
                <span>Step 1: Select Customer (ग्राहक चुनें)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose a registered Kirana store or enter walk-in buyer details
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
              <span>+ New Customer</span>
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
              <span>Registered Shop / Party</span>
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
              <span>Walk-in / Cash Buyer</span>
            </button>
          </div>

          {/* Customer Mode A: Registered Party */}
          {customerMode === "PARTY" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Customer Party / Shop:
                </label>
                <SearchableSelect
                  options={partyOptions}
                  value={selectedPartyId}
                  onChange={(val) => setSelectedPartyId(val)}
                  placeholder="-- Search Kirana Store or Customer Name --"
                  searchPlaceholder="Type shop name, phone or address..."
                  popoverWidthClass="w-full min-w-[320px]"
                  autoSortInStock={false}
                />
              </div>

              {/* Party Profile Card with Inline Editable Fields */}
              {selectedParty && (
                <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                    <span className="text-[11px] font-black uppercase text-blue-900 tracking-wider">
                      Shop &amp; Contact Details
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium">
                      Press Save to update DB
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Shop Name:</label>
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
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phone Number:</label>
                      <input
                        type="tel"
                        value={vanPartyPhone}
                        onChange={(e) => {
                          setVanPartyPhone(e.target.value);
                          setIsPartyDirty(true);
                        }}
                        placeholder="10-digit mobile"
                        className="w-full px-2.5 py-1.5 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Address / Village:</label>
                      <input
                        type="text"
                        value={vanPartyAddress}
                        onChange={(e) => {
                          setVanPartyAddress(e.target.value);
                          setIsPartyDirty(true);
                        }}
                        placeholder="Location"
                        className="w-full px-2.5 py-1.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-3 text-xs">
                      <div>
                        <span className="text-slate-500">Balance: </span>
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
                          <span className="text-slate-500">Credit Limit: </span>
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
                        <span>Saving...</span>
                      ) : partySaveSuccess ? (
                        <span>✓ Saved!</span>
                      ) : (
                        <span>💾 Save Details</span>
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
              <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider block">
                Walk-in Customer Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Mobile (10-digit):</label>
                  <input
                    type="tel"
                    placeholder="Enter 10-digit mobile..."
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
                  <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name:</label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Delivery Address / Village:</label>
                  <input
                    type="text"
                    placeholder="e.g. Bangaon, Ward 4"
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
              <span>Continue to Select Products → (सामान चुनें)</span>
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
              <span className="font-bold text-slate-500">Customer:</span>
              <span className="font-black text-[#12355B] text-sm">{activeCustomerLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
            >
              Change Customer
            </button>
          </div>

          {/* Morning Load Product Search */}
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search morning load items by name, code or weight..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B] shadow-xs"
            />
          </div>

          {/* Loaded Products List */}
          <div className="space-y-2.5">
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center text-slate-400 border border-slate-200 text-xs space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600 text-sm">No morning loaded products match search.</p>
                <p>Only products dispatched on today&apos;s load sheet with available stock appear here.</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.filter((i) => i.product.id === p.id);
                const totalInCartPieces = inCart.reduce((sum, i) => sum + i.qty, 0);

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
                          <h4 className="text-sm font-black text-slate-900">
                            {p.name}
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
                          <span className="text-[#12355B] font-black">
                            ₹{(p.mrpPaise / 100).toFixed(2)}/pc
                          </span>
                        </div>

                        {/* Morning Load Stock Indicator */}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-extrabold">
                            Available: {p.cartons} Ctn + {p.loosePieces} Pcs ({p.availablePieces} pcs)
                          </span>
                          {p.morningIssuedQty !== undefined && (
                            <span className="text-slate-500 font-medium hidden sm:inline">
                              (Morning Load: {p.morningIssuedQty} pcs)
                            </span>
                          )}
                        </div>

                        {/* In-cart summary chip */}
                        {totalInCartPieces > 0 && (
                          <div className="mt-2 text-xs font-black text-blue-900 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                            <span>In Cart: {totalInCartPieces} pcs ({inCart.map(i => `${i.unitQty} ${i.unit}`).join(", ")})</span>
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
                          mrpPaise={p.mrpPaise}
                          availablePieces={p.availablePieces}
                          onAdd={(qty, unit) => {
                            addToCart(p, qty, unit);
                          }}
                          disabled={p.availablePieces <= 0}
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
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                  Total Bill Amount
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  ₹{(totalPaise / 100).toFixed(2)}
                </span>
                <span className="text-xs text-slate-400 ml-2 font-medium">
                  ({totalPiecesInCart} pcs in {cart.length} line{cart.length > 1 ? "s" : ""})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                >
                  ← Customer
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black shadow-lg transition flex items-center gap-1.5"
                >
                  <span>Proceed to Pay (भुगतान) →</span>
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
                <span>Step 3: Review &amp; Payment (बिल और भुगतान)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify bill lines, choose payment mode (Cash/UPI/Credit), and finalize
              </p>
            </div>

            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 underline"
            >
              + Add More Items
            </button>
          </div>

          {/* Customer Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 px-4 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 block">Billed To:</span>
              <strong className="text-sm font-black text-slate-900">{activeCustomerLabel}</strong>
            </div>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-blue-600 font-bold hover:underline"
            >
              Change
            </button>
          </div>

          {/* Itemized Cart Table */}
          <div className="space-y-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Bill Items ({cart.length})
            </span>
            <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {cart.map((line) => {
                const lineTotal = (line.qty * line.product.mrpPaise) / 100;
                return (
                  <div
                    key={`${line.product.id}_${line.unit}`}
                    className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 truncate">{line.product.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {line.unitQty} {line.unit} ({line.qty} pcs) @ ₹{(line.product.mrpPaise / 100).toFixed(2)}/pc
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
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

                      <strong className="text-sm font-black text-slate-900 font-mono w-16 text-right">
                        ₹{lineTotal.toFixed(2)}
                      </strong>

                      <button
                        type="button"
                        onClick={() => removeFromCart(line.product.id, line.unit)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove line"
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
            <span className="text-xs uppercase font-extrabold tracking-widest text-blue-200">
              GRAND TOTAL (कुल राशि)
            </span>
            <div className="text-3xl sm:text-4xl font-black mt-1 font-mono">
              ₹{(totalPaise / 100).toFixed(2)}
            </div>
            <p className="text-xs text-blue-200 mt-1 font-medium">
              Tax-inclusive GST • {totalPiecesInCart} total pieces
            </p>
          </div>

          {/* Payment Mode Selector (3 Big Cards) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
              Choose Payment Mode (भुगतान का तरीका):
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
                  <h4 className="font-black text-sm">💵 Cash (नकद)</h4>
                  <p className="text-[11px] text-slate-500">Collect cash in hand</p>
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
                  <h4 className="font-black text-sm">📱 UPI / QR (ऑनलाइन)</h4>
                  <p className="text-[11px] text-slate-500">PhonePe / GPay / Paytm</p>
                </div>
              </button>

              {/* Credit Mode */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedParty) {
                    alert("Credit sale is only allowed for registered customer parties. Please select a party in Step 1.");
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
                  <h4 className="font-black text-sm">📋 Credit (उधार)</h4>
                  <p className="text-[11px] text-slate-500">
                    {selectedParty?.creditEnabled ? "Credit Approved" : "Registered Party Only"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Payment Status Toggle (Cash / UPI) */}
          {paymentMode !== PaymentMode.CREDIT && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Payment Collection:</span>
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
                  ✓ Payment Received
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
                  ⏳ Payment Pending
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
              ← Back to Items
            </button>

            <button
              type="button"
              onClick={() => handleFinalizeBill()}
              disabled={isSubmitting || cart.length === 0}
              className="flex-1 w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-black shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Generating Invoice...</span>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Finalize Sale &amp; Print Bill (बिल बनाएं)</span>
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
                Quick Add Customer
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
                  Customer / Shop Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickCustomerForm.name}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="e.g. Saharsa Kirana Store"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Customer Type</label>
                  <select
                    value={quickCustomerForm.type}
                    onChange={(e) =>
                      setQuickCustomerForm({ ...quickCustomerForm, type: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B] bg-white"
                  >
                    <option value="CUSTOMER">Retail Consumer</option>
                    <option value="RETAILER">Retailer (Kirana Store)</option>
                    <option value="WHOLESALER">Wholesaler</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Address / Landmark</label>
                <input
                  type="text"
                  value={quickCustomerForm.address}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                  placeholder="e.g. Purab Bazar, Saharsa"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setQuickCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickCustomerSaving}
                  className="px-5 py-2 rounded-xl bg-[#12355B] hover:bg-[#0E2843] text-white font-bold transition disabled:opacity-50"
                >
                  {quickCustomerSaving ? "Saving..." : "Save Customer"}
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
                Pending Offline Drafts ({pendingDrafts.length})
              </h3>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              These bills were created without internet connectivity and are safely stored in your phone&apos;s local memory.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {pendingDrafts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  No drafts pending sync.
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
                      title="Discard draft"
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
                {isSyncing ? "Syncing..." : isOnline ? "Sync All to Server Now" : "Connect to Sync"}
              </button>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Close
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
