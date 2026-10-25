"use client";

import { useState, useTransition, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { PaymentMode } from "@prisma/client";
import { OrderPriceResult } from "@/modules/pricing/pricing.types";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import {
  calculateOrderPricingAction,
  finalizeBillAction,
  checkPartyCreditStatusAction,
  setAdminManualRateAction,
  createQuickPartyAction,
} from "./actions";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { ProductImage } from "@/components/common/ProductImage";
import { SearchableSelect } from "@/components/common/SearchableSelect";

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
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  packSize: number;
  packLabel: string;
  reorderLevel: number;
  imageUrl?: string | null;
  shopStockQty: number;
  godownStockQty: number;
  godownCartons: number;
  godownLoose: number;
}

interface CompanyItem {
  id: string;
  name: string;
}

interface PartyItem {
  id: string;
  name: string;
  type: string;
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
  godownLocationId?: string | null;
  cashierName: string;
  cashierRole: string;
  cashierId?: string;
  roleDiscountLimitBp: number; // e.g. 500 = 5%
  products: ProductCatalogItem[];
  companies: CompanyItem[];
  parties: PartyItem[];
}


export function PosClient({
  locationId,
  locationName,
  godownLocationId,
  cashierName,
  cashierRole,
  cashierId,
  roleDiscountLimitBp,
  products,
  companies,
  parties,
}: PosClientProps) {
  // Search & Catalog state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Manual Rate state for unpriced items (Admin / Super Admin)
  const [manualRateModalOpen, setManualRateModalOpen] = useState(false);
  const [manualRateProduct, setManualRateProduct] = useState<ProductCatalogItem | null>(null);
  const [manualRateRupees, setManualRateRupees] = useState("");
  const [manualRateReason, setManualRateReason] = useState("");
  const [isSavingManualRate, setIsSavingManualRate] = useState(false);
  const [productsList, setProductsList] = useState<ProductCatalogItem[]>(products);

  // Update productsList if parent props change
  useEffect(() => {
    setProductsList(products);
  }, [products]);

  // Cart / Bill state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [localParties, setLocalParties] = useState<PartyItem[]>(parties);
  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [selectedTierMode, setSelectedTierMode] = useState<"AUTO" | "WHOLESALER" | "RETAILER" | "CUSTOMER">("AUTO");
  const [orderDiscountPercent, setOrderDiscountPercent] = useState<string>("0");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [cashTenderedPaise, setCashTenderedPaise] = useState<number>(0);
  const [splitCashPaise, setSplitCashPaise] = useState<string>("");
  const [splitUpiPaise, setSplitUpiPaise] = useState<string>("");

  // Quick Customer Add state
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState<{
    name: string;
    phone: string;
    type: "CUSTOMER" | "RETAILER" | "WHOLESALER";
    address: string;
    gstin: string;
  }>({
    name: "",
    phone: "",
    type: "CUSTOMER",
    address: "",
    gstin: "",
  });
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  // Sync parties from props
  useEffect(() => {
    setLocalParties(parties);
  }, [parties]);

  // Credit Limit Override state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideBreachReasons, setOverrideBreachReasons] = useState<string[]>([]);
  const [pendingOverridePartyName, setPendingOverridePartyName] = useState("");
  const [approvedCreditOverride, setApprovedCreditOverride] = useState<{
    approvedByUserId: string;
    reason: string;
  } | null>(null);

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

  const selectedParty = localParties.find((p) => p.id === selectedPartyId);

  // Dynamic Effective Pricing Tier:
  // Auto Mode uses quantity / carton threshold:
  // - Wholesaler (List A) if any line >= 3 cartons OR order >= 36 pcs OR customer type WHOLESALER
  // - Retailer (List B) if any line >= 1 carton OR order >= 12 pcs OR customer type RETAILER
  // - Customer (List C) otherwise
  const effectiveTier = useMemo(() => {
    if (selectedTierMode !== "AUTO") {
      return selectedTierMode;
    }
    if (selectedParty?.type === "WHOLESALER") return "WHOLESALER";
    if (selectedParty?.type === "RETAILER") return "RETAILER";

    let totalCartons = 0;
    let totalPieces = 0;
    for (const item of cart) {
      totalPieces += item.qty;
      if (item.product.packSize > 1) {
        totalCartons += Math.floor(item.qty / item.product.packSize);
      }
    }

    if (totalCartons >= 3 || totalPieces >= 36) {
      return "WHOLESALER";
    }
    if (totalCartons >= 1 || totalPieces >= 12) {
      return "RETAILER";
    }
    return "CUSTOMER";
  }, [selectedTierMode, selectedParty, cart]);

  const partyOptions = useMemo(
    () => [
      { value: "", label: "Walk-in Retail Customer", subLabel: "Cash / UPI retail buyer" },
      ...localParties.map((party) => ({
        value: party.id,
        label: party.name,
        subLabel: `${party.phone ? `Ph: ${party.phone} · ` : ""}${party.type}`,
        badge: party.creditEnabled ? "Credit Approved" : undefined,
        badgeColor: party.creditEnabled ? ("green" as const) : undefined,
      })),
    ],
    [localParties]
  );

  // Filter & sort catalog products:
  // Part B Rule: Out-of-stock items sort AFTER all in-stock items, keeping existing name order within each group.
  const filteredProducts = useMemo(() => {
    let list = productsList;
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

    return [...list].sort((a, b) => {
      // In POS context: in-stock if shop pieces > 0 or godown has at least 1 carton
      const aInStock = (a.shopStockQty > 0 || a.godownCartons > 0) ? 1 : 0;
      const bInStock = (b.shopStockQty > 0 || b.godownCartons > 0) ? 1 : 0;
      if (aInStock !== bInStock) {
        return bInStock - aInStock; // In-stock (1) comes before Out-of-stock (0)
      }
      return a.name.localeCompare(b.name);
    });
  }, [productsList, selectedCompanyId, searchTerm]);

  // Recalculate dynamic pricing whenever cart, discount, or selected party changes
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
          orderDiscountBp,
          false,
          selectedPartyId || null,
          effectiveTier
        );
        setPricingResult(result);
      } catch (err) {
        console.error("Pricing preview error:", err);
      }
    });
  }, [cart, orderDiscountPercent, selectedPartyId, effectiveTier]);

  // Cart operations
  const addToCart = (product: ProductCatalogItem, qtyToAdd: number = 1) => {
    // Check price resolution using effective tier (Wholesaler, Retailer, Customer)
    const resolved = resolvePrice(
      {
        mrpPaise: product.mrpPaise,
        priceAPaise: product.priceAPaise,
        priceBPaise: product.priceBPaise,
        priceCPaise: product.priceCPaise,
      },
      effectiveTier
    );

    if (resolved.isUnpriced || resolved.unitPricePaise <= 0) {
      setErrorMessage(`Cannot add "${product.name}": Price is not set. Admin must enter a manual rate first.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, qty: item.qty + qtyToAdd } : item
        );
      }
      return [...prev, { productId: product.id, product, qty: qtyToAdd }];
    });
    setErrorMessage(null);
  };

  const handleOpenManualRateModal = (product: ProductCatalogItem) => {
    setManualRateProduct(product);
    setManualRateRupees(product.priceCPaise ? (product.priceCPaise / 100).toFixed(2) : "");
    setManualRateReason("POS walk-in unpriced item authorization");
    setManualRateModalOpen(true);
  };

  const handleSaveManualRate = async () => {
    if (!manualRateProduct) return;
    const rateNum = parseFloat(manualRateRupees);
    if (isNaN(rateNum) || rateNum <= 0) {
      setErrorMessage("Please enter a valid rate in Rupees greater than 0.");
      return;
    }

    try {
      setIsSavingManualRate(true);
      const ratePaise = Math.round(rateNum * 100);
      await setAdminManualRateAction({
        productId: manualRateProduct.id,
        ratePaise,
        reason: manualRateReason || "POS cashier unpriced item rate setting",
      });

      // Update local product list
      setProductsList((prev) =>
        prev.map((p) =>
          p.id === manualRateProduct.id
            ? { ...p, priceCPaise: ratePaise, mrpPaise: p.mrpPaise || ratePaise }
            : p
        )
      );

      // Add to cart with newly set rate
      addToCart(
        { ...manualRateProduct, priceCPaise: ratePaise, mrpPaise: manualRateProduct.mrpPaise || ratePaise },
        1
      );

      setManualRateModalOpen(false);
      setManualRateProduct(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to set manual rate");
    } finally {
      setIsSavingManualRate(false);
    }
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
  const handleFinalizeBill = (explicitOverride?: { approvedByUserId: string; reason: string }) => {
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

    const totalPaidPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
    const balanceDuePaise = totalPaise - totalPaidPaise;
    const overrideToUse = explicitOverride || approvedCreditOverride;

    const executeFinalize = () => {
      startFinalizeTransition(async () => {
        try {
          const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const invoice = await finalizeBillAction({
            locationId,
            partyId: selectedPartyId || null,
            buyerType: effectiveTier,
            orderDiscountBp,
            items: cart.map((c) => ({ productId: c.productId, qty: c.qty })),
            payments,
            idempotencyKey,
            creditOverride: overrideToUse || undefined,
          });

          setApprovedCreditOverride(null);
          setFinalizedInvoice({
            id: invoice.id,
            number: invoice.number,
            totalPaise: invoice.totalPaise,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Failed to finalize invoice";
          if (msg.includes("Credit sale blocked") || msg.includes("Credit limit exceeded")) {
            setOverrideBreachReasons([msg]);
            setPendingOverridePartyName(
              parties.find((p) => p.id === selectedPartyId)?.name || "Customer"
            );
            setOverrideModalOpen(true);
          } else {
            setErrorMessage(msg);
          }
        }
      });
    };

    if (balanceDuePaise > 0 && selectedPartyId && !overrideToUse) {
      checkPartyCreditStatusAction(selectedPartyId, balanceDuePaise)
        .then((creditStatus) => {
          if (!creditStatus.canProceedWithoutOverride) {
            setOverrideBreachReasons(creditStatus.breachReasons);
            setPendingOverridePartyName(creditStatus.partyName);
            setOverrideModalOpen(true);
          } else {
            executeFinalize();
          }
        })
        .catch(() => {
          executeFinalize();
        });
    } else {
      executeFinalize();
    }
  };

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustomerForm.name.trim()) {
      setQuickCustomerError("Customer name is required");
      return;
    }

    setQuickCustomerSaving(true);
    setQuickCustomerError(null);

    const res = await createQuickPartyAction({
      name: quickCustomerForm.name.trim(),
      phone: quickCustomerForm.phone.trim() || undefined,
      type: quickCustomerForm.type,
      address: quickCustomerForm.address.trim() || undefined,
      gstin: quickCustomerForm.gstin.trim() || undefined,
    });

    setQuickCustomerSaving(false);

    if (res.error) {
      setQuickCustomerError(res.error);
    } else if (res.party) {
      const newParty: PartyItem = {
        id: res.party.id,
        name: res.party.name,
        type: res.party.type,
        phone: res.party.phone,
        creditEnabled: res.party.creditEnabled,
        creditLimitPaise: res.party.creditLimitPaise,
        currentOutstandingPaise: 0,
      };
      setLocalParties((prev) => [newParty, ...prev]);
      setSelectedPartyId(newParty.id);
      setQuickCustomerModalOpen(false);
      setQuickCustomerForm({ name: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
    }
  };

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
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight">Shop POS Counter</h1>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Billing from: Retail Shop
              </span>
            </div>
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
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 auto-rows-max">
            {filteredProducts.map((p) => {
              const hasShopStock = p.shopStockQty > 0;
              const hasGodownStock = p.godownStockQty > 0;
              const hasGodownCartons = p.godownCartons > 0;
              const isOutEverywhere = !hasShopStock && !hasGodownStock;
              const isLowShopStock = hasShopStock && p.shopStockQty <= p.reorderLevel;

              // Price resolution per selected buyer type
              const buyerType = selectedParty?.type ?? "CUSTOMER";
              const resolved = resolvePrice(
                {
                  mrpPaise: p.mrpPaise,
                  priceAPaise: p.priceAPaise,
                  priceBPaise: p.priceBPaise,
                  priceCPaise: p.priceCPaise,
                },
                buyerType
              );

              const isUnpriced = resolved.isUnpriced || resolved.unitPricePaise <= 0;
              const canEditRate = cashierRole === "SUPER_ADMIN" || cashierRole === "ADMIN";

              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all shadow-sm ${
                    isOutEverywhere
                      ? "bg-gray-50/80 border-gray-200 opacity-60"
                      : "bg-white border-gray-200 hover:border-[#12355B] hover:shadow-md"
                  }`}
                >
                  <div>
                    {/* Header: Short Code & Status Badges */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 font-bold">
                        {p.shortCode}
                      </span>

                      {/* Stock Badges */}
                      <div className="flex flex-col items-end gap-0.5">
                        {hasShopStock ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isLowShopStock
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            Shop: {p.shopStockQty} pcs
                          </span>
                        ) : hasGodownStock ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Godown only
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            0 pcs
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Image & Product Info */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center p-0.5">
                        <ProductImage
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs text-gray-900 line-clamp-2 leading-snug">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {p.companyName || "Generic"} • {p.packSize} pcs/{p.packLabel}
                        </div>
                      </div>
                    </div>

                    {/* Stock Counts Detail (Both Shop & Godown) */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 text-[11px] space-y-0.5 bg-gray-50/60 p-1.5 rounded-lg">
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Shop stock:</span>
                        <span className={`font-bold ${p.shopStockQty > 0 ? "text-emerald-700" : "text-gray-400"}`}>
                          {p.shopStockQty} pcs
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-gray-700">
                        <span>Godown stock:</span>
                        <span className={`font-bold ${p.godownStockQty > 0 ? "text-blue-900" : "text-gray-400"}`}>
                          {p.godownStockQty} pcs ({p.godownCartons} ctn)
                        </span>
                      </div>
                    </div>

                    {/* Godown-only warning & Transfer link if Shop is 0 but Godown has stock */}
                    {!hasShopStock && hasGodownStock && (
                      <div className="mt-2 p-1.5 rounded bg-amber-50 border border-amber-200 text-[10px] space-y-1">
                        <div className="text-amber-800 font-medium">
                          Godown has {p.godownStockQty} pcs ({p.godownCartons} ctn)
                        </div>
                        {canEditRate ? (
                          <Link
                            href={`/godown/operations?from=${godownLocationId || ""}&to=${locationId}&product=${p.id}&cartons=1`}
                            target="_blank"
                            className="inline-flex items-center text-blue-700 hover:text-blue-900 font-bold underline"
                          >
                            Transfer godown → shop
                          </Link>
                        ) : (
                          <div className="text-amber-700 font-medium italic">
                            Ask the godown keeper to transfer stock
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price & Action Buttons */}
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-1 mb-2">
                      {isUnpriced ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                            Price not set
                          </span>
                          {canEditRate && (
                            <button
                              type="button"
                              onClick={() => handleOpenManualRateModal(p)}
                              className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded hover:bg-red-700"
                            >
                              Set Rate
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm font-black text-[#12355B]">
                            ₹{(resolved.unitPricePaise / 100).toFixed(2)}
                          </span>
                          {resolved.listUsed && resolved.listUsed !== "MRP" && (
                            <span className="text-[10px] font-bold px-1 rounded bg-teal-100 text-teal-800">
                              List {resolved.listUsed}
                            </span>
                          )}
                          {p.mrpPaise && p.mrpPaise > resolved.unitPricePaise && (
                            <span className="text-[10px] text-gray-400 line-through">
                              ₹{(p.mrpPaise / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions: Loose vs Carton */}
                    <div className="flex items-center gap-1.5">
                      {/* Add Loose (from Shop) */}
                      <button
                        type="button"
                        disabled={!hasShopStock || isUnpriced}
                        onClick={() => addToCart(p, 1)}
                        className={`flex-1 py-1.5 px-2 rounded text-xs font-bold transition-all text-center ${
                          !hasShopStock || isUnpriced
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                            : "bg-[#12355B] hover:bg-[#1a4a7f] text-white active:scale-95 shadow-sm"
                        }`}
                        title={
                          !hasShopStock
                            ? "Shop has 0 pcs. Cannot sell loose from shop."
                            : isUnpriced
                            ? "Price not set. Enter manual rate first."
                            : "Add loose piece from shop"
                        }
                      >
                        + Add Loose
                      </button>

                      {/* Add Carton (from Godown) */}
                      {p.packSize > 1 && (
                        <button
                          type="button"
                          disabled={!hasGodownCartons || isUnpriced}
                          onClick={() => addToCart(p, p.packSize)}
                          className={`py-1.5 px-2 rounded text-xs font-bold transition-all text-center whitespace-nowrap ${
                            !hasGodownCartons || isUnpriced
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
                              : "bg-[#1B998B] hover:bg-[#167d71] text-white active:scale-95 shadow-sm"
                          }`}
                          title={
                            !hasGodownCartons
                              ? "Godown has no complete cartons."
                              : isUnpriced
                              ? "Price not set."
                              : `Sell 1 whole carton (${p.packSize} pcs) from Godown`
                          }
                        >
                          + 1 Ctn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        {/* Right Pane (40%): Bill, Line Items, Totals & Finalize */}
        <section className="w-5/12 flex flex-col bg-[#F8FAFC] overflow-hidden">
          {/* Party Selector Header */}
          <div className="p-2.5 bg-white border-b border-gray-200 flex items-center gap-2 shrink-0">
            <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Buyer:</span>
            <div className="flex-1 min-w-0">
              <SearchableSelect
                options={partyOptions}
                value={selectedPartyId}
                onChange={(val) => setSelectedPartyId(val)}
                placeholder="Walk-in Retail Customer"
                searchPlaceholder="Search customer by name, phone..."
                popoverWidthClass="w-full min-w-[320px]"
                autoSortInStock={false}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setQuickCustomerError(null);
                setQuickCustomerModalOpen(true);
              }}
              className="px-2.5 py-1.5 text-xs font-bold bg-[#12355B] hover:bg-blue-900 text-white rounded-lg flex items-center gap-1 shadow-sm shrink-0 whitespace-nowrap"
              title="Add new customer"
            >
              <span className="text-sm font-bold">+</span> New
            </button>
          </div>

          {/* Pricing Rate Tier Selector */}
          <div className="px-3 py-1.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-700 text-[11px] shrink-0">Pricing Tier:</span>
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTierMode("AUTO")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  selectedTierMode === "AUTO"
                    ? "bg-[#FDAF18] text-gray-900 shadow-sm ring-1 ring-amber-500"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Automatically sets tier based on carton count and order quantity"
              >
                ⚡ Auto ({effectiveTier === "WHOLESALER" ? "Wholesale A" : effectiveTier === "RETAILER" ? "Retail B" : "Walk-in C"})
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("WHOLESALER")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  selectedTierMode === "WHOLESALER"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Force Wholesaler rate (List A)"
              >
                A (Wholesale)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("RETAILER")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  selectedTierMode === "RETAILER"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Force Retailer rate (List B)"
              >
                B (Retail)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTierMode("CUSTOMER")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  selectedTierMode === "CUSTOMER"
                    ? "bg-purple-700 text-white shadow-sm"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
                title="Force standard Walk-in customer rate (List C)"
              >
                C (Walk-in)
              </button>
            </div>
            <span className="ml-auto text-[10px] text-gray-500 font-medium hidden sm:inline">
              Rate: <span className="font-bold text-gray-900 uppercase">{effectiveTier}</span>
            </span>
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
                        {item.product.shortCode} • MRP ₹{item.product.mrpPaise != null ? (item.product.mrpPaise / 100).toFixed(2) : "N/A"}
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
                          : ((((item.product.mrpPaise ?? item.product.priceCPaise ?? 0) * item.qty)) / 100).toFixed(2)}
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
                  onClick={() => handleFinalizeBill()}
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

      {/* Owner Credit Override Modal */}
      <CreditOverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        partyName={pendingOverridePartyName}
        breachReasons={overrideBreachReasons}
        currentUserRole={cashierRole}
        currentUserId={cashierId}
        onApproved={(override) => {
          setApprovedCreditOverride(override);
          setOverrideModalOpen(false);
          handleFinalizeBill(override);
        }}
      />

      {/* Admin Manual Rate Modal for Unpriced Items */}
      {manualRateModalOpen && manualRateProduct && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800 uppercase tracking-wider">
                Admin Authorization
              </span>
              <h2 className="text-lg font-bold text-gray-900 mt-1">
                Set Manual Selling Rate
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Product: <span className="font-semibold text-gray-800">{manualRateProduct.name}</span> ({manualRateProduct.shortCode})
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700">
                  Rate per Piece (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={manualRateRupees}
                  onChange={(e) => setManualRateRupees(e.target.value)}
                  placeholder="e.g. 45.00"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold focus:ring-[#12355B] focus:border-[#12355B]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-gray-700">
                  Reason / Audit Note
                </label>
                <input
                  type="text"
                  required
                  value={manualRateReason}
                  onChange={(e) => setManualRateReason(e.target.value)}
                  placeholder="Reason for manual rate..."
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setManualRateModalOpen(false);
                  setManualRateProduct(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingManualRate}
                onClick={handleSaveManualRate}
                className="px-4 py-2 rounded-lg bg-[#12355B] hover:bg-blue-900 text-white text-xs font-bold disabled:opacity-50"
              >
                {isSavingManualRate ? "Saving..." : "Authorize & Add to Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      {quickCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Add New Customer</h3>
                <p className="text-xs text-gray-500 mt-0.5">Quickly register customer and apply to current bill</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCustomerModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded"
              >
                ✕
              </button>
            </div>

            {quickCustomerError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-semibold">
                {quickCustomerError}
              </div>
            )}

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Customer / Shop Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={quickCustomerForm.name}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, name: e.target.value })}
                  placeholder="e.g. Ramesh Traders or Rajesh Kumar"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-[#12355B] focus:border-[#12355B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">Mobile Phone</label>
                  <input
                    type="tel"
                    value={quickCustomerForm.phone}
                    onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, phone: e.target.value })}
                    placeholder="10-digit number"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700">Customer Role / Type</label>
                  <select
                    value={quickCustomerForm.type}
                    onChange={(e) =>
                      setQuickCustomerForm({
                        ...quickCustomerForm,
                        type: e.target.value as "CUSTOMER" | "RETAILER" | "WHOLESALER",
                      })
                    }
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="CUSTOMER">Customer (List C)</option>
                    <option value="RETAILER">Retailer (List B)</option>
                    <option value="WHOLESALER">Wholesaler (List A)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">Address / City (Optional)</label>
                <input
                  type="text"
                  value={quickCustomerForm.address}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, address: e.target.value })}
                  placeholder="e.g. Main Market, Gorakhpur"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700">GSTIN (Optional)</label>
                <input
                  type="text"
                  value={quickCustomerForm.gstin}
                  onChange={(e) => setQuickCustomerForm({ ...quickCustomerForm, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 09AAAAA0000A1Z5"
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-xs uppercase"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setQuickCustomerModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickCustomerSaving}
                  className="px-4 py-2 rounded-lg bg-[#12355B] hover:bg-blue-900 text-white text-xs font-bold disabled:opacity-50"
                >
                  {quickCustomerSaving ? "Saving..." : "Save & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

}
