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
import { createQuickPartyAction } from "@/app/shop/pos/actions";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { QtyUnitPicker } from "@/components/billing/qty-unit-picker";
import { PaymentMode } from "@prisma/client";

interface VanProduct {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  shortCode: string;
  packSize: number;
  packLabel: string;
  mrpPaise: number;
  availablePieces: number;
  cartons: number;
  loosePieces: number;
  companyName: string;
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
  unit: "PCS" | "CARTON";
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

  useEffect(() => {
    setLocalParties(parties);
  }, [parties]);

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
          creditEnabled: res.party.creditEnabled,
          creditLimitPaise: res.party.creditLimitPaise,
          currentOutstandingPaise: 0,
        };
        setLocalParties((prev) => [newParty, ...prev]);
        setSelectedPartyId(newParty.id);
        setQuickCustomerOpen(false);
        setQuickCustomerForm({ name: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
      }
    } catch (err: any) {
      setQuickCustomerError(err.message || "Failed to create customer");
    } finally {
      setQuickCustomerSaving(false);
    }
  };

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

    // Initial draft list load
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

  // Filter products
  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.shortCode.toLowerCase().includes(term) ||
        p.companyName.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  // Selected party details
  const selectedParty = useMemo(() => {
    return localParties.find((p) => p.id === selectedPartyId) || null;
  }, [localParties, selectedPartyId]);

  const partyOptions = useMemo(
    () => [
      { value: "", label: "Cash Retail Buyer (Walk-in)", subLabel: "Walk-in cash buyer" },
      ...localParties.map((p) => ({
        value: p.id,
        label: p.name,
        subLabel: `Credit Limit: ₹${((p.creditLimitPaise || 0) / 100).toFixed(0)}`,
        badge: p.creditEnabled ? "Credit Approved" : undefined,
        badgeColor: p.creditEnabled ? ("green" as const) : undefined,
      })),
    ],
    [localParties]
  );

  // Totals
  const subtotalPaise = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty * item.product.mrpPaise, 0);
  }, [cart]);

  const totalPaise = subtotalPaise; // Dynamic slabs can be refined by pricing engine on server

  // Add / adjust cart items with unit support
  const addToCart = (
    product: VanProduct,
    addPieces: number,
    unit: "PCS" | "CARTON" = "PCS",
    unitQty: number = addPieces
  ) => {
    setCart((prev) => {
      // Find line with same product AND same unit
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
            ? { ...i, qty: targetUnitPieces, unitQty: (existing.unitQty || existing.qty) + unitQty }
            : i
        );
      }
      return [...prev, { product, qty: targetUnitPieces, unit, unitQty }];
    });
  };

  const removeFromCart = (productId: string, unit?: "PCS" | "CARTON") => {
    setCart((prev) =>
      prev.filter((i) => !(i.product.id === productId && (!unit || i.unit === unit)))
    );
  };

  const clearCart = () => {
    setCart([]);
    setSelectedPartyId("");
    setPaymentMode(PaymentMode.CASH);
  };

  // Submit Bill
  const handleFinalizeBill = async (explicitOverride?: { approvedByUserId: string; reason: string }) => {
    if (cart.length === 0) {
      setStatusMessage({ type: "error", text: "Cart is empty" });
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

    // Check credit policy if payment mode is CREDIT
    if (paymentMode === PaymentMode.CREDIT && !overrideToUse) {
      if (!selectedParty) {
        setStatusMessage({ type: "error", text: "Select a customer party for credit sales" });
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
      partyName: selectedParty?.name || "Cash Customer",
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
      // Offline: Save directly to IndexedDB
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

    // Online: Finalize with Server Action
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
      // If network dropped mid-request, save as draft for automatic replay!
      await saveDraftInvoice({ ...draftData, syncStatus: "FAILED", errorMessage: errMsg });
      await loadPendingDrafts();
      clearCart();
      setStatusMessage({
        type: "warning",
        text: `Submission interrupted: ${errMsg}. Bill saved locally as draft to prevent data loss.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync Pending Drafts
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

  return (
    <div className="space-y-4">
      {/* Top Status & Offline Queue Strip */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl ${
              isOnline ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#12355B]">{vanName}</span>
              <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                {issueSheetNo}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isOnline ? "Connected • Server Sync Active" : "Offline • Local Drafts Mode"}
            </p>
          </div>
        </div>

        {/* Offline Drafts Counter Button */}
        {pendingDrafts.length > 0 && (
          <button
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors animate-pulse"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{pendingDrafts.length} Unsynced Draft{pendingDrafts.length > 1 ? "s" : ""}</span>
          </button>
        )}
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-xs ${
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
            className="text-[10px] opacity-75 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Success Modal / Invoice Finalized Alert */}
      {lastInvoice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-[#12355B] text-base">
                  {lastInvoice.number}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  FINALIZED
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Amount: <strong className="text-slate-900">₹{(lastInvoice.totalPaise / 100).toFixed(2)}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BluetoothPrintButton
              invoiceId={lastInvoice.id}
              invoiceNumber={lastInvoice.number}
              variant="primary"
            />
            <button
              onClick={() => setLastInvoice(null)}
              className="px-4 py-3 rounded-2xl text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Catalog Left / Cart Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Product Catalog */}
        <div className="lg:col-span-7 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search items by name or code..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B] shadow-xs"
            />
          </div>

          {/* Product Items List */}
          <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 max-h-[520px] overflow-y-auto shadow-xs">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No loaded products matching search query.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const inCart = cart.find((i) => i.product.id === p.id);
                return (
                  <div
                    key={p.id}
                    className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {p.companyName} • <span className="font-mono text-slate-600">{p.shortCode}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="text-[#12355B] font-bold">
                          ₹{(p.mrpPaise / 100).toFixed(2)}/pc
                        </span>
                        <span className="text-slate-500">
                          ({p.cartons} ctn / {p.loosePieces} loose)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <QtyUnitPicker
                        productId={p.id}
                        productName={p.name}
                        packSize={p.packSize}
                        packLabel={p.packLabel}
                        mrpPaise={p.mrpPaise}
                        availablePieces={p.availablePieces}
                        onAdd={(qty, unit) => {
                          const packSize = Math.max(1, p.packSize || 1);
                          const pieces = unit === "CARTON" ? qty * packSize : qty;
                          addToCart(p, pieces, unit, qty);
                        }}
                        disabled={p.availablePieces <= 0}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Cart, Customer & Payment Tender */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 space-y-4 shadow-xs text-slate-900">
            {/* Customer Party Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Customer / Buyer</label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickCustomerError(null);
                    setQuickCustomerOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#12355B] hover:text-[#0E2843] bg-[#12355B]/10 hover:bg-[#12355B]/20 px-2 py-0.5 rounded-md transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  New
                </button>
              </div>
              <SearchableSelect
                options={partyOptions}
                value={selectedPartyId}
                onChange={(val) => setSelectedPartyId(val)}
                placeholder="Cash Retail Buyer (Walk-in)"
                searchPlaceholder="Search customer by name..."
                popoverWidthClass="w-full min-w-[280px]"
                autoSortInStock={false}
              />

              {selectedParty && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1.5 shadow-xs">
                  <div className="border-b border-slate-200/80 pb-1.5 mb-1">
                    <div className="font-bold text-slate-900 text-xs">{selectedParty.name}</div>
                    {selectedParty.phone && (
                      <div className="text-[11px] text-slate-600 font-mono mt-0.5">📱 {selectedParty.phone}</div>
                    )}
                    {selectedParty.address && (
                      <div className="text-[11px] text-slate-600 font-normal mt-0.5">📍 {selectedParty.address}</div>
                    )}
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Credit Limit:</span>
                    <span className="text-slate-900 font-mono font-bold">
                      ₹{(selectedParty.creditLimitPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Outstanding:</span>
                    <span className="text-amber-700 font-mono font-bold">
                      ₹{(selectedParty.currentOutstandingPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Remaining Credit:</span>
                    <span className="text-emerald-700 font-mono font-bold">
                      ₹{(
                        (selectedParty.creditLimitPaise - selectedParty.currentOutstandingPaise) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {!selectedPartyId && (
                <div className="space-y-1.5 pt-1 text-xs">
                  <input
                    type="tel"
                    placeholder="Customer Mobile (10-digit)..."
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
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Customer Name..."
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Address / Area (optional)..."
                    value={walkInAddress}
                    onChange={(e) => setWalkInAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-[#12355B]" />
                  Bill Items ({cart.length})
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-slate-500 hover:text-rose-600 text-[11px]"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Select products from the left to build the bill
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map((line, idx) => (
                    <div
                      key={`${line.product.id}_${line.unit}_${idx}`}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{line.product.name}</p>
                        <p className="text-[10px] text-slate-600 font-medium">
                          {line.unit === "CARTON" ? (
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                              📦 {line.unitQty} {line.product.packLabel || "Carton"}(s) ({line.qty} pcs)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[10px]">
                              🛍 {line.qty} pcs
                            </span>
                          )}{" "}
                          @ ₹{(line.product.mrpPaise / 100).toFixed(2)}/pc
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#12355B] text-xs font-mono mr-1">
                          ₹{((line.qty * line.product.mrpPaise) / 100).toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(line.product.id, line.unit)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CASH)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.UPI)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    paymentMode === PaymentMode.UPI
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CREDIT)}
                  disabled={!selectedParty?.creditEnabled}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    paymentMode === PaymentMode.CREDIT
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Payment Status (Cash and UPI only) */}
            {(paymentMode === PaymentMode.CASH || paymentMode === PaymentMode.UPI) && (
              <div className="space-y-1.5 pt-0.5">
                <label className="text-xs font-bold text-slate-700">Payment Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentCollected(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      paymentCollected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>✓ Payment Done</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentCollected(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      !paymentCollected
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>⏳ Payment Pending</span>
                  </button>
                </div>
                {!paymentCollected && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5 font-medium">
                    Customer Name and Mobile are mandatory when Payment Pending is selected so staff can follow up.
                  </p>
                )}
              </div>
            )}

            {/* Bill Summary */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-950 font-semibold">₹{(subtotalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-1">
                <span>Total Payable:</span>
                <span className="text-[#12355B] font-mono">
                  ₹{(totalPaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit / Finalize Action */}
            <button
              onClick={() => handleFinalizeBill()}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                isOnline
                  ? "bg-[#12355B] hover:bg-[#0E2843] text-white shadow-[#12355B]/15"
                  : "bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/15"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : isOnline ? (
                <>
                  <span>Finalize & Issue Bill</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Save Offline Draft</span>
                  <CloudUpload className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Customer Modal */}
      {quickCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#12355B] text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#FC830D]" />
                Add New Customer
              </h3>
              <button
                type="button"
                onClick={() => setQuickCustomerOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            {quickCustomerError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                {quickCustomerError}
              </div>
            )}

            <form onSubmit={handleCreateQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Customer / Shop Name *
                </label>
                <input
                  type="text"
                  required
                  value={quickCustomerForm.name}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Kirana Store"
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
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                  >
                    <option value="CUSTOMER">Retail Walk-in (Customer)</option>
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
                  placeholder="e.g. Purab Bazar, Ward 12"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={quickCustomerForm.gstin}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="15-character GSTIN"
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
