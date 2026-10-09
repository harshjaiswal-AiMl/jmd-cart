"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { PaymentMode } from "@prisma/client";
import { OrderPriceResult } from "@/modules/pricing/pricing.types";
import { calculateOrderPricingAction, finalizeBillAction } from "./actions";

interface ProductCatalogItem {
  id: string;
  name: string;
  shortCode: string;
  companyId: string | null;
  companyName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  hsn: string;
  gstRateBp: number;
  mrpPaise: number;
  packSize: number;
  packLabel: string;
  reorderLevel: number;
  shopStockQty: number;
}

interface CompanyItem {
  id: string;
  name: string;
}

interface PartyItem {
  id: string;
  name: string;
  phone: string | null;
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

interface CartItem {
  productId: string;
  product: ProductCatalogItem;
  qty: number;
}

interface HeldBill {
  id: string;
  timestamp: number;
  partyId: string | null;
  partyName: string;
  items: CartItem[];
  orderDiscountBp: number;
}

interface PosClientProps {
  locationId: string;
  locationName: string;
  cashierName: string;
  cashierRole: string;
  roleDiscountLimitBp: number; // e.g. 500 = 5%
  products: ProductCatalogItem[];
  companies: CompanyItem[];
  parties: PartyItem[];
}

export function PosClient({
  locationId,
  locationName,
  cashierName,
  cashierRole,
  roleDiscountLimitBp,
  products,
  companies,
  parties,
}: PosClientProps) {
  // Search & Catalog state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart / Bill state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<string>("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [cashTenderedPaise, setCashTenderedPaise] = useState<number>(0);
  const [splitCashPaise, setSplitCashPaise] = useState<string>("");
  const [splitUpiPaise, setSplitUpiPaise] = useState<string>("");

  // Live Pricing Result
  const [pricingResult, setPricingResult] = useState<OrderPriceResult | null>(null);
  const [isPricingLoading, startPricingTransition] = useTransition();

  // Held Bills
  const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Finalized Bill Success
  const [finalizedInvoice, setFinalizedInvoice] = useState<{
    id: string;
    number: string;
    totalPaise: number;
  } | null>(null);

  // Submission state
  const [isFinalizing, startFinalizeTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Autofocus search on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Filter catalog products
  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedCompanyId) {
      list = list.filter((p) => p.companyId === selectedCompanyId);
    }
    if (searchTerm.trim().length > 0) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.shortCode.toLowerCase().includes(term) ||
          (p.companyName && p.companyName.toLowerCase().includes(term))
      );
    }
    return list;
  }, [products, selectedCompanyId, searchTerm]);

  // Recalculate dynamic pricing whenever cart or discount changes
  useEffect(() => {
    if (cart.length === 0) {
      setPricingResult(null);
      return;
    }

    const discountNum = parseFloat(orderDiscountPercent);
    const orderDiscountBp = !isNaN(discountNum) && discountNum > 0 ? Math.round(discountNum * 100) : 0;

    startPricingTransition(async () => {
      try {
        const result = await calculateOrderPricingAction(
          cart.map((c) => ({ productId: c.productId, qty: c.qty })),
          orderDiscountBp
        );
        setPricingResult(result);
      } catch (err) {
        console.error("Pricing preview error:", err);
      }
    });
  }, [cart, orderDiscountPercent]);

  // Cart operations
  const addToCart = (product: ProductCatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { productId: product.id, product, qty: 1 }];
    });
    setErrorMessage(null);
  };

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, qty: newQty } : item))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearBill = () => {
    setCart([]);
    setSelectedPartyId("");
    setOrderDiscountPercent("0");
    setPaymentMode(PaymentMode.CASH);
    setCashTenderedPaise(0);
    setPricingResult(null);
    setErrorMessage(null);
    setFinalizedInvoice(null);
    searchInputRef.current?.focus();
  };

  // Hold / Resume
  const holdCurrentBill = () => {
    if (cart.length === 0) return;
    const party = parties.find((p) => p.id === selectedPartyId);
    const discountNum = parseFloat(orderDiscountPercent);
    const newHeld: HeldBill = {
      id: `hold-${Date.now()}`,
      timestamp: Date.now(),
      partyId: selectedPartyId || null,
      partyName: party ? party.name : "Walk-in Retail Customer",
      items: cart,
      orderDiscountBp: !isNaN(discountNum) ? Math.round(discountNum * 100) : 0,
    };

    setHeldBills((prev) => [...prev, newHeld]);
    clearBill();
  };

  const resumeHeldBill = (held: HeldBill) => {
    setCart(held.items);
    setSelectedPartyId(held.partyId || "");
    setOrderDiscountPercent((held.orderDiscountBp / 100).toString());
    setHeldBills((prev) => prev.filter((h) => h.id !== held.id));
    setShowHeldModal(false);
  };

  // Finalize Invoice
  const handleFinalizeBill = () => {
    if (!pricingResult || cart.length === 0) return;
    setErrorMessage(null);

    const totalPaise = pricingResult.totalPaise;
    const discountNum = parseFloat(orderDiscountPercent);
    const orderDiscountBp = !isNaN(discountNum) && discountNum > 0 ? Math.round(discountNum * 100) : 0;

    // Check discount limit
    if (cashierRole !== "SUPER_ADMIN" && orderDiscountBp > roleDiscountLimitBp) {
      setErrorMessage(
        `Order discount of ${(orderDiscountBp / 100).toFixed(
          2
        )}% exceeds your role limit of ${(roleDiscountLimitBp / 100).toFixed(
          2
        )}%. Requires Owner approval.`
      );
      return;
    }

    // Build payments array
    let payments: Array<{ mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amountPaise: number }> = [];

    if (paymentMode === PaymentMode.CASH) {
      payments = [{ mode: "CASH", amountPaise: totalPaise }];
    } else if (paymentMode === PaymentMode.UPI) {
      payments = [{ mode: "UPI", amountPaise: totalPaise }];
    } else if (paymentMode === PaymentMode.CREDIT) {
      if (!selectedPartyId) {
        setErrorMessage("Credit payment requires an approved registered customer/retailer.");
        return;
      }
      payments = []; // Unpaid balance recorded as credit
    } else {
      // Split payments
      const cashAmount = Math.round(parseFloat(splitCashPaise || "0") * 100);
      const upiAmount = Math.round(parseFloat(splitUpiPaise || "0") * 100);

      if (cashAmount + upiAmount < totalPaise && !selectedPartyId) {
        setErrorMessage("Walk-in retail sales must be fully paid. Total paid does not cover bill total.");
        return;
      }

      if (cashAmount > 0) payments.push({ mode: "CASH", amountPaise: cashAmount });
      if (upiAmount > 0) payments.push({ mode: "UPI", amountPaise: upiAmount });
    }

    startFinalizeTransition(async () => {
      try {
        const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const invoice = await finalizeBillAction({
          locationId,
          partyId: selectedPartyId || null,
          orderDiscountBp,
          items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
          payments,
          idempotencyKey,
        });

        setFinalizedInvoice({
          id: invoice.id,
          number: invoice.number,
          totalPaise: invoice.totalPaise,
        });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to finalize invoice");
      }
    });
  };

  const selectedParty = parties.find((p) => p.id === selectedPartyId);
  const totalAmount = pricingResult ? pricingResult.totalPaise : 0;
  const changeDuePaise = cashTenderedPaise > totalAmount ? cashTenderedPaise - totalAmount : 0;

  return (
    <div className="flex flex-col h-screen bg-[#EEF4F8] select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="bg-[#12355B] text-white px-5 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#1B998B] flex items-center justify-center font-bold text-white text-base">
            J
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Shop POS Counter</h1>
            <div className="text-[11px] text-blue-200">
              {locationName} • Cashier: <span className="font-semibold text-white">{cashierName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {heldBills.length > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              className="px-3 py-1.5 rounded bg-[#F4A259] text-gray-900 text-xs font-bold hover:bg-amber-400 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span>Held Bills ({heldBills.length})</span>
            </button>
          )}

          <Link
            href="/godown/stock"
            className="px-3 py-1.5 rounded bg-blue-900/60 hover:bg-blue-900 text-xs font-medium text-white transition-colors"
          >
            Inventory Overview
          </Link>

          <Link
            href="/admin"
            className="px-3 py-1.5 rounded bg-blue-900/60 hover:bg-blue-900 text-xs font-medium text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Two-Pane Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane (60%): Search & Product Catalog */}
        <section className="w-7/12 flex flex-col border-r border-gray-300 bg-white overflow-hidden">
          {/* Search & Company Filter */}
          <div className="p-4 border-b border-gray-200 bg-gray-50/70 space-y-3 shrink-0">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search products by name, short code (e.g. BKJ), or brand..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#12355B]"
              />
              <span className="absolute left-3.5 top-3 text-gray-400">🔍</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3.5 top-2.5 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Company Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedCompanyId(null)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCompanyId === null
                    ? "bg-[#12355B] text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                All Brands
              </button>
              {companies.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => setSelectedCompanyId(comp.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    selectedCompanyId === comp.id
                      ? "bg-[#12355B] text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {comp.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid */}
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-max">
            {filteredProducts.map((p) => {
              const inStock = p.shopStockQty > 0;
              const isLow = p.shopStockQty > 0 && p.shopStockQty <= p.reorderLevel;

              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!inStock}
                  onClick={() => addToCart(p)}
                  className={`p-3 rounded-lg border text-left flex flex-col justify-between transition-all shadow-sm ${
                    !inStock
                      ? "opacity-50 bg-gray-100 border-gray-200 cursor-not-allowed"
                      : "bg-white border-gray-200 hover:border-[#12355B] hover:shadow-md active:scale-[0.98]"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold">
                        {p.shortCode}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          !inStock
                            ? "bg-red-100 text-red-800"
                            : isLow
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {p.shopStockQty} pcs
                      </span>
                    </div>

                    <div className="font-semibold text-xs text-gray-900 mt-1.5 line-clamp-2">
                      {p.name}
                    </div>

                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {p.companyName || "Generic"} • {p.packSize} pcs/{p.packLabel}
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#12355B]">
                      ₹{(p.mrpPaise / 100).toFixed(2)}
                    </span>
                    <span className="text-[11px] font-semibold text-[#1B998B] hover:underline">
                      + Add
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right Pane (40%): Bill, Line Items, Totals & Finalize */}
        <section className="w-5/12 flex flex-col bg-[#F8FAFC] overflow-hidden">
          {/* Party Selector Header */}
          <div className="p-3 bg-white border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Buyer:</span>
            <select
              value={selectedPartyId}
              onChange={(e) => setSelectedPartyId(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#12355B] bg-white font-medium"
            >
              <option value="">Walk-in Retail Customer</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name} ({party.phone}) {party.creditEnabled ? "• Credit Approved" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Party credit status pill */}
          {selectedParty && (
            <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-[11px] text-blue-900 flex justify-between">
              <span>
                Credit Limit: <span className="font-bold">₹{(selectedParty.creditLimitPaise / 100).toLocaleString("en-IN")}</span>
              </span>
              <span>
                Outstanding: <span className="font-bold text-red-600">₹{(selectedParty.currentOutstandingPaise / 100).toLocaleString("en-IN")}</span>
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-2.5 bg-red-100 border-b border-red-200 text-red-800 text-xs font-semibold flex items-center justify-between">
              <span>{errorMessage}</span>
              <button onClick={() => setErrorMessage(null)} className="text-red-700 font-bold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* Cart Line Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-6">
                <div className="text-4xl mb-2">🛒</div>
                <div className="font-semibold text-sm text-gray-600">No items on current bill</div>
                <div className="text-xs mt-1">Click products on the left or search to add items</div>
              </div>
            ) : (
              cart.map((item) => {
                const pricedLine = pricingResult?.lines.find((l) => l.productId === item.productId);
                const packCount = Math.floor(item.qty / item.product.packSize);
                const looseCount = item.qty % item.product.packSize;
                const hasPacks = item.product.packSize > 1 && item.qty >= item.product.packSize;

                return (
                  <div
                    key={item.productId}
                    className="p-2.5 bg-white rounded-lg border border-gray-200 shadow-sm flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs text-gray-900 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        {item.product.shortCode} • MRP ₹{(item.product.mrpPaise / 100).toFixed(2)}
                        {pricedLine && pricedLine.slabDiscountBp > 0 && (
                          <span className="ml-1 text-[#1B998B] font-bold">
                            (-{(pricedLine.slabDiscountBp / 100).toFixed(0)}% slab)
                          </span>
                        )}
                      </div>

                      {hasPacks && (
                        <div className="text-[10px] text-blue-700 font-medium">
                          {packCount} {item.product.packLabel}s {looseCount > 0 && `+ ${looseCount} pcs`}
                        </div>
                      )}
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center border border-gray-300 rounded overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.qty - 1)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateQty(item.productId, parseInt(e.target.value, 10) || 1)}
                        className="w-12 text-center text-xs font-bold text-gray-900 border-none focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateQty(item.productId, item.qty + 1)}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                      >
                        +
                      </button>
                    </div>

                    {/* Line Total */}
                    <div className="text-right shrink-0 w-20">
                      <div className="font-bold text-xs text-gray-900 font-mono">
                        ₹
                        {pricedLine
                          ? (pricedLine.lineTotalPaise / 100).toFixed(2)
                          : ((item.product.mrpPaise * item.qty) / 100).toFixed(2)}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        className="text-[10px] text-red-500 hover:text-red-700 hover:underline mt-0.5"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bill Calculation & Finalization Footer */}
          {cart.length > 0 && (
            <div className="bg-white border-t border-gray-300 p-4 space-y-3 shadow-lg shrink-0">
              {/* Order Discount Input & Auto Buyer Tag */}
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-700">Order Disc %:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={orderDiscountPercent}
                    onChange={(e) => setOrderDiscountPercent(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded font-bold text-center text-xs focus:outline-none focus:ring-1 focus:ring-[#12355B]"
                  />
                  {parseFloat(orderDiscountPercent) > roleDiscountLimitBp / 100 && (
                    <span className="text-[10px] text-amber-600 font-bold">
                      ⚠ &gt;{roleDiscountLimitBp / 100}% Approval Req.
                    </span>
                  )}
                </div>

                {pricingResult && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900">
                    Buyer: {pricingResult.buyerTag}
                  </span>
                )}
              </div>

              {/* Totals Summary */}
              {pricingResult && (
                <div className="space-y-1 text-xs border-t border-gray-100 pt-2 text-gray-600 font-mono">
                  <div className="flex justify-between">
                    <span>Subtotal (MRP):</span>
                    <span>₹{(pricingResult.subtotalPaise / 100).toFixed(2)}</span>
                  </div>
                  {(pricingResult.lineDiscountPaise > 0 || pricingResult.orderDiscountPaise > 0) && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Total Discount:</span>
                      <span>
                        -₹
                        {(
                          (pricingResult.lineDiscountPaise + pricingResult.orderDiscountPaise) /
                          100
                        ).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Taxable Value:</span>
                    <span>₹{(pricingResult.taxablePaise / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST (CGST + SGST):</span>
                    <span>
                      ₹{((pricingResult.cgstPaise + pricingResult.sgstPaise) / 100).toFixed(2)}
                    </span>
                  </div>
                  {pricingResult.roundOffPaise !== 0 && (
                    <div className="flex justify-between text-[11px] text-gray-500">
                      <span>Round-off:</span>
                      <span>
                        {pricingResult.roundOffPaise > 0 ? "+" : ""}
                        {(pricingResult.roundOffPaise / 100).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 border-t border-gray-200 text-base font-extrabold text-[#12355B]">
                    <span className="text-sm font-bold uppercase tracking-wider">Grand Total:</span>
                    <span className="text-2xl font-black">
                      ₹{(pricingResult.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Payment Mode Selector */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CASH)}
                  className={`py-1.5 text-xs font-bold rounded border transition-colors ${
                    paymentMode === PaymentMode.CASH
                      ? "bg-[#12355B] text-white border-[#12355B]"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.UPI)}
                  className={`py-1.5 text-xs font-bold rounded border transition-colors ${
                    paymentMode === PaymentMode.UPI
                      ? "bg-[#12355B] text-white border-[#12355B]"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  📱 UPI
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CARD)}
                  className={`py-1.5 text-xs font-bold rounded border transition-colors ${
                    paymentMode === PaymentMode.CARD
                      ? "bg-[#12355B] text-white border-[#12355B]"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  ✂ Split
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode(PaymentMode.CREDIT)}
                  disabled={!selectedParty?.creditEnabled}
                  className={`py-1.5 text-xs font-bold rounded border transition-colors ${
                    paymentMode === PaymentMode.CREDIT
                      ? "bg-purple-700 text-white border-purple-700"
                      : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  📒 Credit
                </button>
              </div>

              {/* Cash Quick Tender helper */}
              {paymentMode === PaymentMode.CASH && (
                <div className="flex items-center gap-1 overflow-x-auto text-[11px] pt-1">
                  <span className="text-gray-500 font-semibold">Tender:</span>
                  {[totalAmount, 10000, 20000, 50000, 100000, 200000]
                    .filter((val, i, arr) => arr.indexOf(val) === i && val >= totalAmount)
                    .slice(0, 4)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCashTenderedPaise(val)}
                        className={`px-2 py-0.5 rounded font-mono ${
                          cashTenderedPaise === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        ₹{(val / 100).toFixed(0)}
                      </button>
                    ))}
                  {changeDuePaise > 0 && (
                    <span className="text-emerald-700 font-bold ml-auto">
                      Change: ₹{(changeDuePaise / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              )}

              {/* Bottom Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={holdCurrentBill}
                  className="px-3 py-2.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold transition-colors"
                >
                  Hold Bill
                </button>
                <button
                  type="button"
                  onClick={clearBill}
                  className="px-3 py-2.5 rounded bg-gray-100 hover:bg-red-50 text-red-600 text-xs font-semibold transition-colors"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={isFinalizing || isPricingLoading}
                  onClick={handleFinalizeBill}
                  className="flex-1 py-3 px-4 rounded-lg bg-[#12355B] hover:bg-blue-900 text-white text-sm font-bold tracking-wide transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isFinalizing ? "Finalizing Bill..." : "✓ FINALIZE & PRINT"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Held Bills Modal */}
      {showHeldModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-3">
              <h3 className="font-bold text-base text-gray-900">Held Bills ({heldBills.length})</h3>
              <button onClick={() => setShowHeldModal(false)} className="text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {heldBills.map((held) => (
                <div
                  key={held.id}
                  className="p-3 border border-gray-200 rounded-lg flex items-center justify-between hover:bg-gray-50"
                >
                  <div>
                    <div className="font-semibold text-xs text-gray-900">{held.partyName}</div>
                    <div className="text-[11px] text-gray-500">
                      {held.items.length} items • {new Date(held.timestamp).toLocaleTimeString("en-IN")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => resumeHeldBill(held)}
                    className="px-3 py-1.5 bg-[#12355B] text-white text-xs font-bold rounded hover:bg-blue-900"
                  >
                    Resume →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Finalized Bill Success Dialog */}
      {finalizedInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>

            <div>
              <h2 className="text-xl font-black text-gray-900">Invoice Finalized!</h2>
              <div className="text-lg font-mono font-bold text-[#12355B] mt-1">
                {finalizedInvoice.number}
              </div>
              <div className="text-2xl font-black text-gray-900 mt-2">
                ₹{(finalizedInvoice.totalPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Stock deducted from {locationName}. Payments recorded.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link
                href={`/shop/invoices/${finalizedInvoice.id}/print?format=thermal`}
                target="_blank"
                className="w-full py-2.5 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm transition-colors"
              >
                🖨 Print 80mm Receipt
              </Link>
              <Link
                href={`/shop/invoices/${finalizedInvoice.id}/print?format=a4`}
                target="_blank"
                className="w-full py-2.5 px-4 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition-colors"
              >
                📄 Print A4 Tax Invoice
              </Link>
              <button
                type="button"
                onClick={clearBill}
                className="w-full py-2.5 px-4 rounded-lg bg-[#12355B] hover:bg-blue-900 text-white font-bold text-xs transition-colors"
              >
                + Start Next Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
