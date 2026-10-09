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
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { PaymentMode } from "@prisma/client";

interface VanProduct {
  id: string;
  name: string;
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
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

interface CartLine {
  product: VanProduct;
  qty: number;
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
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
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
    return parties.find((p) => p.id === selectedPartyId) || null;
  }, [parties, selectedPartyId]);

  // Totals
  const subtotalPaise = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.qty * item.product.mrpPaise, 0);
  }, [cart]);

  const totalPaise = subtotalPaise; // Dynamic slabs can be refined by pricing engine on server

  // Add / adjust cart items
  const addToCart = (product: VanProduct, addQty = 1) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      const currentQty = existing ? existing.qty : 0;
      const targetQty = currentQty + addQty;

      if (targetQty > product.availablePieces) {
        setStatusMessage({
          type: "warning",
          text: `Cannot add more than ${product.availablePieces} pcs available on van`,
        });
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: targetQty } : i
        );
      }
      return [...prev, { product, qty: targetQty }];
    });
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((i) => {
        if (i.product.id !== productId) return i;
        if (newQty > i.product.availablePieces) {
          setStatusMessage({
            type: "warning",
            text: `Max available pieces for ${i.product.name} is ${i.product.availablePieces}`,
          });
          return { ...i, qty: i.product.availablePieces };
        }
        return { ...i, qty: newQty };
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
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
        idempotencyKey,
        items: cart.map((i) => ({ productId: i.product.id, qty: i.qty })),
        payments: [{ mode: paymentMode, amountPaise: totalPaise }],
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              isOnline ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
            }`}
          >
            {isOnline ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">{vanName}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {issueSheetNo}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {isOnline ? "Connected • Server Sync Active" : "Offline • Local Drafts Mode"}
            </p>
          </div>
        </div>

        {/* Offline Drafts Counter Button */}
        {pendingDrafts.length > 0 && (
          <button
            onClick={() => setShowDraftsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors animate-pulse"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{pendingDrafts.length} Unsynced Draft{pendingDrafts.length > 1 ? "s" : ""}</span>
          </button>
        )}
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-sm ${
            statusMessage.type === "success"
              ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-200"
              : statusMessage.type === "warning"
              ? "bg-amber-950/60 border border-amber-500/30 text-amber-200"
              : "bg-rose-950/60 border border-rose-500/30 text-rose-200"
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
        <div className="bg-emerald-950/80 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-white text-base">
                  {lastInvoice.number}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  FINALIZED
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Amount: <strong className="text-white">₹{(lastInvoice.totalPaise / 100).toFixed(2)}</strong>
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
              className="px-4 py-3 rounded-2xl text-xs font-semibold bg-emerald-900/60 text-emerald-200 hover:bg-emerald-900 transition"
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
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Product Items List */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 max-h-[520px] overflow-y-auto">
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
                    className="p-3.5 hover:bg-slate-800/40 flex items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {p.companyName} • <span className="font-mono text-slate-300">{p.shortCode}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <span className="text-emerald-400 font-bold">
                          ₹{(p.mrpPaise / 100).toFixed(2)}/pc
                        </span>
                        <span className="text-slate-400">
                          ({p.cartons} ctn / {p.loosePieces} loose)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {inCart ? (
                        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
                          <button
                            onClick={() => updateCartQty(p.id, inCart.qty - 1)}
                            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-7 text-center font-bold text-xs text-emerald-400">
                            {inCart.qty}
                          </span>
                          <button
                            onClick={() => addToCart(p, 1)}
                            className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p, 1)}
                          disabled={p.availablePieces <= 0}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-30 disabled:cursor-not-allowed shadow transition-all"
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Cart, Customer & Payment Tender */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
            {/* Customer Party Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">Customer / Buyer</label>
              <select
                value={selectedPartyId}
                onChange={(e) => setSelectedPartyId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Cash Retail Buyer (Walk-in)</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name} (Credit: ₹{(party.creditLimitPaise / 100).toFixed(0)})
                  </option>
                ))}
              </select>

              {selectedParty && (
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Credit Limit:</span>
                    <span className="text-white font-mono font-bold">
                      ₹{(selectedParty.creditLimitPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Outstanding:</span>
                    <span className="text-amber-400 font-mono font-bold">
                      ₹{(selectedParty.currentOutstandingPaise / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Remaining Credit:</span>
                    <span className="text-emerald-400 font-mono font-bold">
                      ₹{(
                        (selectedParty.creditLimitPaise - selectedParty.currentOutstandingPaise) /
                        100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
                  Bill Items ({cart.length})
                </span>
                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className="text-slate-400 hover:text-rose-400 text-[11px]"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs bg-slate-950/60 rounded-xl border border-dashed border-slate-800">
                  Select products from the left to build the bill
                </div>
              ) : (
                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {cart.map((line) => (
                    <div
                      key={line.product.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white truncate">{line.product.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {line.qty} pcs @ ₹{(line.product.mrpPaise / 100).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-400 text-xs font-mono mr-1">
                          ₹{((line.qty * line.product.mrpPaise) / 100).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeFromCart(line.product.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded"
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
              <label className="text-xs font-bold text-slate-300">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CASH)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition-all ${
                    paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-md"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
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
                      ? "bg-blue-600 text-white border-blue-500 shadow-md"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
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
                      ? "bg-amber-600 text-white border-amber-500 shadow-md"
                      : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Bill Summary */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">₹{(subtotalPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-1">
                <span>Total Payable:</span>
                <span className="text-emerald-400 font-mono">
                  ₹{(totalPaise / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit / Finalize Action */}
            <button
              onClick={() => handleFinalizeBill()}
              disabled={cart.length === 0 || isSubmitting}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                isOnline
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950"
                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950"
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

      {/* Offline Drafts Queue Modal */}
      {showDraftsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <CloudUpload className="w-5 h-5 text-amber-400" />
                Pending Offline Drafts ({pendingDrafts.length})
              </h3>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              These bills were created without internet connectivity and are safely stored in your phone&apos;s local memory.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {pendingDrafts.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No drafts pending sync.
                </div>
              ) : (
                pendingDrafts.map((draft) => (
                  <div
                    key={draft.clientTempId}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-white">{draft.partyName}</p>
                      <p className="text-[11px] text-slate-400">
                        {draft.items.length} item(s) • ₹{(draft.totalPaise / 100).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-amber-400/90 font-mono">
                        {new Date(draft.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <button
                      onClick={async () => {
                        await deleteDraftInvoice(draft.clientTempId);
                        await loadPendingDrafts();
                      }}
                      className="p-1 text-slate-500 hover:text-rose-400"
                      title="Discard draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={triggerDraftSync}
                disabled={!isOnline || isSyncing || pendingDrafts.length === 0}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-colors shadow"
              >
                {isSyncing ? "Syncing..." : isOnline ? "Sync All to Server Now" : "Connect to Sync"}
              </button>
              <button
                onClick={() => setShowDraftsModal(false)}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
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
