"use client";

import React, { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { PaymentMode } from "@prisma/client";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  Layers,
  ExternalLink,
  Printer,
  History,
  ArrowRight,
  PauseCircle,
} from "lucide-react";

import { OrderPriceResult } from "@/modules/pricing/pricing.types";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import {
  calculateOrderPricingAction,
  finalizeBillAction,
  checkPartyCreditStatusAction,
  setAdminManualRateAction,
  saveProductPriceAction,
  createQuickPartyAction,
  getPartyBillHistoryAction,
  getPartyLastItemPurchaseAction,
} from "./actions";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface ProductCatalogItem {
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

export interface CompanyItem {
  id: string;
  name: string;
}

export interface PartyItem {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

export interface PosCartLine {
  id: string;
  productId: string;
  product: ProductCatalogItem;
  qty: number;
  unit: "Pcs" | "Carton";
  lineDiscountPercent: number;
  customRatePaise?: number | null;
  customRateInput?: string;
  customMrpPaise?: number | null;
  isCustomRate?: boolean;
}

export interface PosBillTab {
  id: string;
  tabTitle: string;
  partyId: string;
  selectedTierMode: "AUTO" | "WHOLESALER" | "RETAILER" | "CUSTOMER";
  cart: PosCartLine[];
  orderDiscountPercent: string;
  paymentMode: PaymentMode;
  splitCashPaise: string;
  splitUpiPaise: string;
  remarks: string;
  isHeld: boolean;
  heldAt?: number;
}

interface PosClientProps {
  locationId: string;
  locationName: string;
  godownLocationId?: string | null;
  cashierName: string;
  cashierRole: string;
  cashierId?: string;
  roleDiscountLimitBp: number;
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
  // Products and parties state
  const [productsList, setProductsList] = useState<ProductCatalogItem[]>(products);
  const [localParties, setLocalParties] = useState<PartyItem[]>(parties);

  useEffect(() => {
    setProductsList(products);
  }, [products]);

  useEffect(() => {
    setLocalParties(parties);
  }, [parties]);

  // Tabs state with localStorage persistence
  const [tabs, setTabs] = useState<PosBillTab[]>([
    {
      id: "tab-1",
      tabTitle: "Bill 1",
      partyId: "",
      selectedTierMode: "AUTO",
      cart: [],
      orderDiscountPercent: "0",
      paymentMode: PaymentMode.CASH,
      splitCashPaise: "",
      splitUpiPaise: "",
      remarks: "",
      isHeld: false,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Load tabs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jmd_pos_bill_tabs");
      const savedActive = localStorage.getItem("jmd_pos_active_tab_id");
      if (saved) {
        const parsed: PosBillTab[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTabs(parsed);
          if (savedActive && parsed.some((t) => t.id === savedActive)) {
            setActiveTabId(savedActive);
          } else {
            setActiveTabId(parsed[0].id);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsStorageLoaded(true);
    }
  }, []);

  // Save tabs to localStorage on change
  useEffect(() => {
    if (!isStorageLoaded) return;
    try {
      localStorage.setItem("jmd_pos_bill_tabs", JSON.stringify(tabs));
      localStorage.setItem("jmd_pos_active_tab_id", activeTabId);
    } catch {
      // ignore
    }
  }, [tabs, activeTabId, isStorageLoaded]);

  // Active tab helper
  const activeTab: PosBillTab = useMemo(() => {
    return (
      tabs.find((t) => t.id === activeTabId) ||
      tabs[0] || {
        id: "tab-1",
        tabTitle: "Bill 1",
        partyId: "",
        selectedTierMode: "AUTO",
        cart: [],
        orderDiscountPercent: "0",
        paymentMode: PaymentMode.CASH,
        splitCashPaise: "",
        splitUpiPaise: "",
        remarks: "",
        isHeld: false,
      }
    );
  }, [tabs, activeTabId]);

  const updateActiveTab = useCallback(
    (patch: Partial<PosBillTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, ...patch } : t))
      );
    },
    [activeTab.id]
  );

  // Selected party details
  const selectedParty = useMemo(() => {
    return localParties.find((p) => p.id === activeTab.partyId) || null;
  }, [localParties, activeTab.partyId]);

  // Dynamic Effective Pricing Tier:
  const effectiveTier = useMemo(() => {
    if (activeTab.selectedTierMode !== "AUTO") {
      return activeTab.selectedTierMode;
    }
    if (selectedParty?.type === "WHOLESALER") return "WHOLESALER";
    if (selectedParty?.type === "RETAILER") return "RETAILER";

    let totalCartons = 0;
    let totalPieces = 0;
    for (const item of activeTab.cart) {
      const pcs = item.unit === "Carton" ? item.qty * item.product.packSize : item.qty;
      totalPieces += pcs;
      if (item.product.packSize > 1) {
        totalCartons += Math.floor(pcs / item.product.packSize);
      }
    }

    if (totalCartons >= 3 || totalPieces >= 36) return "WHOLESALER";
    if (totalCartons >= 1 || totalPieces >= 12) return "RETAILER";
    return "CUSTOMER";
  }, [activeTab.selectedTierMode, selectedParty, activeTab.cart]);

  // Party Options for SearchableSelect
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

  // Item Search and Highlighting
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [lastItemPurchase, setLastItemPurchase] = useState<{
    ratePaise: number;
    qty: number;
    invoiceNumber: string;
    date: string | null;
  } | null>(null);
  const itemSearchInputRef = useRef<HTMLInputElement>(null);

  // Filter products for autocomplete dropdown
  const filteredProducts = useMemo(() => {
    const term = itemSearchTerm.trim().toLowerCase();
    if (!term) return [];
    return productsList
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.shortCode.toLowerCase().includes(term) ||
          (p.companyName && p.companyName.toLowerCase().includes(term))
      )
      .slice(0, 10);
  }, [productsList, itemSearchTerm]);

  // Fetch customer last purchase for highlighted product
  useEffect(() => {
    if (!highlightedProductId || !activeTab.partyId) {
      setLastItemPurchase(null);
      return;
    }
    getPartyLastItemPurchaseAction(activeTab.partyId, highlightedProductId).then((res) => {
      if (res?.success) setLastItemPurchase(res.lastPurchase);
      else setLastItemPurchase(null);
    });
  }, [highlightedProductId, activeTab.partyId]);

  // Live Pricing Result
  const [pricingResult, setPricingResult] = useState<OrderPriceResult | null>(null);
  const [isPricingLoading, startPricingTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Recalculate pricing on cart or discount or party changes
  useEffect(() => {
    if (activeTab.cart.length === 0) {
      setPricingResult(null);
      return;
    }

    const discountNum = parseFloat(activeTab.orderDiscountPercent);
    const orderDiscountBp =
      !isNaN(discountNum) && discountNum > 0 ? Math.round(discountNum * 100) : 0;

    startPricingTransition(async () => {
      try {
        const pricingItems = activeTab.cart.map((c) => {
          const packSize = Math.max(1, c.product.packSize);
          const pcs = c.unit === "Carton" ? c.qty * packSize : c.qty;
          let unitPriceOverridePaise: number | undefined = undefined;
          if (c.customRatePaise != null && c.customRatePaise > 0) {
            unitPriceOverridePaise = c.unit === "Carton"
              ? Math.round(c.customRatePaise / packSize)
              : c.customRatePaise;
          }
          return {
            productId: c.productId,
            qty: pcs,
            unitPriceOverridePaise,
          };
        });

        const result = await calculateOrderPricingAction(
          pricingItems,
          orderDiscountBp,
          false,
          activeTab.partyId || null,
          effectiveTier
        );
        setPricingResult(result);
      } catch (err) {
        console.error("Pricing preview error:", err);
      }
    });
  }, [
    activeTab.cart,
    activeTab.orderDiscountPercent,
    activeTab.partyId,
    effectiveTier,
  ]);

  // Add Item to active cart
  const addItemToCart = (product: ProductCatalogItem, unit: "Pcs" | "Carton" = "Pcs", qty: number = 1) => {
    const resolved = resolvePrice(
      {
        mrpPaise: product.mrpPaise,
        priceAPaise: product.priceAPaise,
        priceBPaise: product.priceBPaise,
        priceCPaise: product.priceCPaise,
      },
      effectiveTier
    );

    const packSize = Math.max(1, product.packSize);
    const initialRatePaise = resolved.unitPricePaise > 0 
      ? (unit === "Carton" ? resolved.unitPricePaise * packSize : resolved.unitPricePaise)
      : 0;

    const existingIndex = activeTab.cart.findIndex(
      (item) => item.productId === product.id && item.unit === unit
    );

    let newCart: PosCartLine[];
    if (existingIndex >= 0) {
      newCart = activeTab.cart.map((item, idx) =>
        idx === existingIndex ? { ...item, qty: item.qty + qty } : item
      );
    } else {
      const newLine: PosCartLine = {
        id: `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        productId: product.id,
        product,
        qty,
        unit,
        lineDiscountPercent: 0,
        customRatePaise: initialRatePaise > 0 ? initialRatePaise : null,
        customRateInput: initialRatePaise > 0 ? (initialRatePaise / 100).toFixed(2) : "",
        isCustomRate: false,
      };
      newCart = [...activeTab.cart, newLine];
    }

    updateActiveTab({ cart: newCart });
    setHighlightedProductId(product.id);
    setItemSearchTerm("");
    setErrorMessage(null);
  };

  const updateLineQty = (lineId: string, newQty: number) => {
    if (newQty <= 0) {
      removeLine(lineId);
      return;
    }
    updateActiveTab({
      cart: activeTab.cart.map((item) =>
        item.id === lineId ? { ...item, qty: newQty } : item
      ),
    });
  };

  const updateLineRate = (lineId: string, value: string) => {
    const valNum = parseFloat(value);
    const paise = !isNaN(valNum) && valNum >= 0 ? Math.round(valNum * 100) : 0;

    updateActiveTab({
      cart: activeTab.cart.map((item) =>
        item.id === lineId
          ? {
              ...item,
              customRateInput: value,
              customRatePaise: paise,
              isCustomRate: true,
            }
          : item
      ),
    });
  };

  const handleQuickSaveProductRate = async (line: PosCartLine) => {
    if (line.customRatePaise == null || line.customRatePaise <= 0) {
      setErrorMessage("Please enter a valid rate greater than 0 first.");
      return;
    }
    const packSize = Math.max(1, line.product.packSize);
    const ratePerPiecePaise = line.unit === "Carton" 
      ? Math.round(line.customRatePaise / packSize)
      : line.customRatePaise;

    try {
      const res = await saveProductPriceAction({
        productId: line.productId,
        ratePaise: ratePerPiecePaise,
        mrpPaise: ratePerPiecePaise,
      });
      if (res.success) {
        setProductsList((prev) =>
          prev.map((p) =>
            p.id === line.productId
              ? { ...p, priceCPaise: ratePerPiecePaise, mrpPaise: ratePerPiecePaise }
              : p
          )
        );
        updateActiveTab({
          cart: activeTab.cart.map((c) =>
            c.productId === line.productId
              ? {
                  ...c,
                  product: { ...c.product, priceCPaise: ratePerPiecePaise, mrpPaise: ratePerPiecePaise },
                }
              : c
          ),
        });
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save rate to catalog");
    }
  };

  const updateLineUnit = (lineId: string, newUnit: "Pcs" | "Carton") => {
    updateActiveTab({
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        let newRatePaise = item.customRatePaise;

        if (item.unit !== newUnit && item.customRatePaise != null && item.customRatePaise > 0) {
          if (newUnit === "Carton") {
            newRatePaise = item.customRatePaise * packSize;
          } else {
            newRatePaise = Math.round(item.customRatePaise / packSize);
          }
        }

        return {
          ...item,
          unit: newUnit,
          customRatePaise: newRatePaise,
          customRateInput: newRatePaise && newRatePaise > 0 ? (newRatePaise / 100).toFixed(2) : "",
        };
      }),
    });
  };

  const updateLineDiscount = (lineId: string, discPercent: number) => {
    const safeDisc = Math.min(100, Math.max(0, discPercent));
    updateActiveTab({
      cart: activeTab.cart.map((item) =>
        item.id === lineId ? { ...item, lineDiscountPercent: safeDisc } : item
      ),
    });
  };

  const removeLine = (lineId: string) => {
    updateActiveTab({
      cart: activeTab.cart.filter((item) => item.id !== lineId),
    });
  };

  const handleDeleteHighlightedOrLastLine = () => {
    if (activeTab.cart.length === 0) return;
    if (highlightedProductId) {
      const idx = activeTab.cart.findIndex((i) => i.productId === highlightedProductId);
      if (idx >= 0) {
        removeLine(activeTab.cart[idx].id);
        return;
      }
    }
    // Otherwise remove the last item
    const last = activeTab.cart[activeTab.cart.length - 1];
    removeLine(last.id);
  };

  // Tab Management
  const handleCreateNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab: PosBillTab = {
      id: newId,
      tabTitle: `Bill ${tabs.length + 1}`,
      partyId: "",
      selectedTierMode: "AUTO",
      cart: [],
      orderDiscountPercent: "0",
      paymentMode: PaymentMode.CASH,
      splitCashPaise: "",
      splitUpiPaise: "",
      remarks: "",
      isHeld: false,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    setPricingResult(null);
    setErrorMessage(null);
    itemSearchInputRef.current?.focus();
  };

  const handleHoldCurrentBill = () => {
    if (activeTab.cart.length === 0) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id ? { ...t, isHeld: true, heldAt: Date.now() } : t
      )
    );
    const otherUnheld = tabs.find((t) => t.id !== activeTab.id && !t.isHeld);
    if (otherUnheld) {
      setActiveTabId(otherUnheld.id);
    } else {
      handleCreateNewTab();
    }
  };

  const handleResumeHeldTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isHeld: false } : t))
    );
    setActiveTabId(tabId);
    setShowHeldModal(false);
  };

  const handleCloseTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabs.length <= 1) {
      const resetTab: PosBillTab = {
        id: `tab-${Date.now()}`,
        tabTitle: "Bill 1",
        partyId: "",
        selectedTierMode: "AUTO",
        cart: [],
        orderDiscountPercent: "0",
        paymentMode: PaymentMode.CASH,
        splitCashPaise: "",
        splitUpiPaise: "",
        remarks: "",
        isHeld: false,
      };
      setTabs([resetTab]);
      setActiveTabId(resetTab.id);
      return;
    }
    const remaining = tabs.filter((t) => t.id !== tabId);
    setTabs(remaining);
    if (activeTabId === tabId) {
      setActiveTabId(remaining[0].id);
    }
  };

  // Party Bill History Drawer & Recent Bills
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [historyBills, setHistoryBills] = useState<any[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showRecentBillsPopover, setShowRecentBillsPopover] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    if (!activeTab.partyId) {
      setRecentBills([]);
      return;
    }
    getPartyBillHistoryAction(activeTab.partyId, 5).then((res) => {
      if (res?.invoices) setRecentBills(res.invoices);
      else setRecentBills([]);
    });
  }, [activeTab.partyId]);

  const handleOpenFullHistory = async () => {
    if (!activeTab.partyId) return;
    setIsLoadingHistory(true);
    setShowHistoryDrawer(true);
    setShowRecentBillsPopover(false);
    try {
      const res = await getPartyBillHistoryAction(activeTab.partyId, 50);
      if (res?.invoices) setHistoryBills(res.invoices);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Quick Customer Add modal
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    name: "",
    phone: "",
    type: "CUSTOMER" as "CUSTOMER" | "RETAILER" | "WHOLESALER",
    address: "",
    gstin: "",
  });
  const [quickCustomerSaving, setQuickCustomerSaving] = useState(false);
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  const handleSaveQuickCustomer = async (e: React.FormEvent) => {
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
        updateActiveTab({ partyId: newParty.id, tabTitle: newParty.name });
        setQuickCustomerModalOpen(false);
        setQuickCustomerForm({ name: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
      }
    } finally {
      setQuickCustomerSaving(false);
    }
  };

  // Credit Override State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideBreachReasons, setOverrideBreachReasons] = useState<string[]>([]);
  const [pendingOverridePartyName, setPendingOverridePartyName] = useState("");
  const [approvedCreditOverride, setApprovedCreditOverride] = useState<{
    approvedByUserId: string;
    reason: string;
  } | null>(null);

  // Manual Rate state (Admin)
  const [manualRateModalOpen, setManualRateModalOpen] = useState(false);
  const [manualRateProduct, setManualRateProduct] = useState<ProductCatalogItem | null>(null);
  const [manualRateRupees, setManualRateRupees] = useState("");
  const [manualRateReason, setManualRateReason] = useState("");
  const [isSavingManualRate, setIsSavingManualRate] = useState(false);

  // Held Bills Modal
  const [showHeldModal, setShowHeldModal] = useState(false);

  // Finalized Bill Success
  const [finalizedInvoice, setFinalizedInvoice] = useState<{
    id: string;
    number: string;
    totalPaise: number;
    paymentMode: PaymentMode;
  } | null>(null);
  const [isFinalizing, startFinalizeTransition] = useTransition();

  // Finalize Bill Action
  const handleFinalizeBill = (explicitOverride?: { approvedByUserId: string; reason: string }) => {
    if (!pricingResult || activeTab.cart.length === 0) return;
    setErrorMessage(null);

    const totalPaise = pricingResult.totalPaise;
    const discountNum = parseFloat(activeTab.orderDiscountPercent);
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

    if (activeTab.paymentMode === PaymentMode.CASH) {
      payments = [{ mode: "CASH", amountPaise: totalPaise }];
    } else if (activeTab.paymentMode === PaymentMode.UPI) {
      payments = [{ mode: "UPI", amountPaise: totalPaise }];
    } else if (activeTab.paymentMode === PaymentMode.CREDIT) {
      if (!activeTab.partyId) {
        setQuickCustomerModalOpen(true);
        setQuickCustomerError("Please select or create a Customer for Demand Credit Bill.");
        return;
      }
      payments = []; // Unpaid credit balance
    } else {
      // Split payments
      const cashAmount = Math.round(parseFloat(activeTab.splitCashPaise || "0") * 100);
      const upiAmount = Math.round(parseFloat(activeTab.splitUpiPaise || "0") * 100);

      if (cashAmount + upiAmount < totalPaise && !activeTab.partyId) {
        setErrorMessage("Walk-in retail sales must be fully paid. Total tendered does not cover bill total.");
        return;
      }

      if (cashAmount > 0) payments.push({ mode: "CASH", amountPaise: cashAmount });
      if (upiAmount > 0) payments.push({ mode: "UPI", amountPaise: upiAmount });
    }

    const overrideToUse = explicitOverride || approvedCreditOverride;

    startFinalizeTransition(async () => {
      try {
        const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        // Check if any item in cart has 0 rate or unpriced
        const unpricedLine = activeTab.cart.find((c) => {
          const resolved = resolvePrice(
            {
              mrpPaise: c.product.mrpPaise,
              priceAPaise: c.product.priceAPaise,
              priceBPaise: c.product.priceBPaise,
              priceCPaise: c.product.priceCPaise,
            },
            effectiveTier
          );
          const rate = c.customRatePaise != null 
            ? c.customRatePaise 
            : (c.unit === "Carton" ? resolved.unitPricePaise * Math.max(1, c.product.packSize) : resolved.unitPricePaise);
          return rate <= 0;
        });

        if (unpricedLine) {
          setErrorMessage(`Please enter a valid selling Rate for "${unpricedLine.product.name}" before finalizing.`);
          setHighlightedProductId(unpricedLine.productId);
          return;
        }

        const finalizeItems = activeTab.cart.map((c) => {
          const packSize = Math.max(1, c.product.packSize);
          const pcs = c.unit === "Carton" ? c.qty * packSize : c.qty;
          let unitPriceOverridePaise: number | undefined = undefined;
          if (c.customRatePaise != null && c.customRatePaise > 0) {
            unitPriceOverridePaise = c.unit === "Carton"
              ? Math.round(c.customRatePaise / packSize)
              : c.customRatePaise;
          }
          return {
            productId: c.productId,
            qty: pcs,
            unitPriceOverridePaise,
          };
        });

        const res = await finalizeBillAction({
          locationId,
          partyId: activeTab.partyId || null,
          buyerType: effectiveTier,
          orderDiscountBp,
          items: finalizeItems,
          payments,
          idempotencyKey,
          creditOverride: overrideToUse || undefined,
        });

        if (!res.success || !res.invoice) {
          const msg = res.error || "Failed to finalize invoice";
          if (
            msg.includes("Credit sale blocked") ||
            msg.includes("Credit limit exceeded") ||
            msg.includes("not authorized for credit") ||
            msg.includes("overdue invoice")
          ) {
            setOverrideBreachReasons([msg]);
            setPendingOverridePartyName(selectedParty?.name || "Customer");
            setOverrideModalOpen(true);
          } else {
            setErrorMessage(msg);
          }
          return;
        }

        const invoice = res.invoice;
        setApprovedCreditOverride(null);
        setFinalizedInvoice({
          id: invoice.id,
          number: invoice.number,
          totalPaise: invoice.totalPaise,
          paymentMode: activeTab.paymentMode,
        });

        // Close/reset finalized tab
        handleCloseTab(activeTab.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to finalize invoice";
        if (
          msg.includes("Credit sale blocked") ||
          msg.includes("Credit limit exceeded") ||
          msg.includes("not authorized for credit") ||
          msg.includes("overdue invoice")
        ) {
          setOverrideBreachReasons([msg]);
          setPendingOverridePartyName(selectedParty?.name || "Customer");
          setOverrideModalOpen(true);
        } else {
          setErrorMessage(msg);
        }
      }
    });
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        handleFinalizeBill();
      } else if (e.key === "F3") {
        e.preventDefault();
        handleCreateNewTab();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHoldCurrentBill();
      } else if (e.key === "F5") {
        e.preventDefault();
        setShowHeldModal((prev) => !prev);
      } else if (e.key === "F9") {
        e.preventDefault();
        handleDeleteHighlightedOrLastLine();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        itemSearchInputRef.current?.focus();
      } else if (e.key === "Escape") {
        setShowHeldModal(false);
        setQuickCustomerModalOpen(false);
        setOverrideModalOpen(false);
        setManualRateModalOpen(false);
        setShowHistoryDrawer(false);
        setShowRecentBillsPopover(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFinalizeBill, activeTab, tabs]);

  // Totals calculations
  const totalAmountPaise = pricingResult ? pricingResult.totalPaise : 0;
  const taxablePaise = pricingResult ? pricingResult.taxablePaise : 0;
  const cgstPaise = pricingResult ? pricingResult.cgstPaise : 0;
  const sgstPaise = pricingResult ? pricingResult.sgstPaise : 0;
  const roundoffPaise = pricingResult ? pricingResult.roundOffPaise : 0;
  const subtotalMrpPaise = pricingResult ? pricingResult.subtotalPaise : 0;
  const totalDiscountPaise = pricingResult ? (pricingResult.lineDiscountPaise + pricingResult.orderDiscountPaise) : 0;
  const amountInWords = totalAmountPaise > 0 ? paiseToIndianWords(totalAmountPaise) : "";

  // Highlighted product details
  const highlightedProduct = useMemo(() => {
    if (!highlightedProductId) return null;
    return productsList.find((p) => p.id === highlightedProductId) || null;
  }, [productsList, highlightedProductId]);

  const heldTabsCount = tabs.filter((t) => t.isHeld).length;

  return (
    <div className="flex flex-col h-screen bg-[#FEFDF7] text-slate-900 select-none overflow-hidden font-sans">
      {/* 1. Top Bar: Focus Mode Header & Open Bill Tabs */}
      <header className="bg-[#12355B] text-white px-3 sm:px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FC830D] flex items-center justify-center font-black text-white text-base shadow-xs">
            J
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight text-white">SHOP POS</h1>
              <span className="bg-[#1B998B]/30 text-emerald-200 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.2 rounded-full uppercase">
                {locationName}
              </span>
            </div>
            <div className="text-[11px] text-white/70">
              Cashier: <strong className="text-white">{cashierName}</strong>
            </div>
          </div>
        </div>

        {/* Bill Tabs & Actions */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                  isActive
                    ? "bg-white text-[#12355B] border-white shadow-xs"
                    : tab.isHeld
                    ? "bg-amber-500/20 text-amber-200 border-amber-500/40 hover:bg-amber-500/30"
                    : "bg-[#0E2843] text-white/80 border-transparent hover:bg-white/10"
                }`}
              >
                {tab.isHeld && <PauseCircle className="w-3.5 h-3.5 text-amber-400" />}
                <span className="truncate max-w-[120px]">
                  {tab.tabTitle || `Bill ${idx + 1}`}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="p-0.5 hover:bg-black/10 rounded text-slate-400 hover:text-slate-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            onClick={handleCreateNewTab}
            title="Open new bill (F3)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#FC830D] hover:bg-[#e57406] text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New (F3)</span>
          </button>

          <button
            onClick={handleHoldCurrentBill}
            title="Hold current bill (F4)"
            disabled={activeTab.cart.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition"
          >
            <PauseCircle className="w-3.5 h-3.5 text-amber-300" />
            <span>Hold (F4)</span>
          </button>

          {heldTabsCount > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              title="View held bills (F5)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-400 text-slate-950 shadow-xs animate-pulse"
            >
              <span>Held ({heldTabsCount})</span>
            </button>
          )}

          <div className="h-5 w-px bg-white/20 mx-1 hidden sm:block" />

          <Link
            href="/godown/stock"
            className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
          >
            Stock
          </Link>

          <Link
            href="/admin"
            className="hidden sm:inline-flex px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* 2. Party Bar: Customer, Balance, Tier, History */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="flex-1">
            <SearchableSelect
              options={partyOptions}
              value={activeTab.partyId}
              onChange={(val) => {
                const party = localParties.find((p) => p.id === val);
                updateActiveTab({
                  partyId: val,
                  tabTitle: party ? party.name : "Walk-in Buyer",
                });
              }}
              placeholder="Select Customer / Buyer..."
              searchPlaceholder="Search buyer by name, phone..."
              popoverWidthClass="w-[340px]"
              autoSortInStock={false}
            />
          </div>

          <button
            onClick={() => {
              setQuickCustomerError(null);
              setQuickCustomerModalOpen(true);
            }}
            title="Add new customer"
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-[#12355B]/10 hover:bg-[#12355B]/20 text-[#12355B] transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Party</span>
          </button>
        </div>

        {/* Customer Balance, Tier & History Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tier Chip */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase px-1.5">Tier:</span>
            <button
              onClick={() => updateActiveTab({ selectedTierMode: "AUTO" })}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                activeTab.selectedTierMode === "AUTO"
                  ? "bg-[#12355B] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Auto ({effectiveTier[0]})
            </button>
            <button
              onClick={() => updateActiveTab({ selectedTierMode: "WHOLESALER" })}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                activeTab.selectedTierMode === "WHOLESALER"
                  ? "bg-[#12355B] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              A
            </button>
            <button
              onClick={() => updateActiveTab({ selectedTierMode: "RETAILER" })}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                activeTab.selectedTierMode === "RETAILER"
                  ? "bg-[#12355B] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              B
            </button>
            <button
              onClick={() => updateActiveTab({ selectedTierMode: "CUSTOMER" })}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                activeTab.selectedTierMode === "CUSTOMER"
                  ? "bg-[#12355B] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              C
            </button>
          </div>

          {/* Party Balance Chip */}
          {selectedParty && (
            <>
              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                  selectedParty.currentOutstandingPaise > 0
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : selectedParty.currentOutstandingPaise < 0
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-slate-50 text-slate-700 border-slate-200"
                }`}
              >
                {selectedParty.currentOutstandingPaise > 0
                  ? `Amount Payable: ₹${(selectedParty.currentOutstandingPaise / 100).toFixed(2)}`
                  : selectedParty.currentOutstandingPaise < 0
                  ? `Advance: ₹${(Math.abs(selectedParty.currentOutstandingPaise) / 100).toFixed(2)}`
                  : "Clear Balance ₹0"}
              </div>

              {selectedParty.creditEnabled && (
                <div className="text-[11px] font-semibold text-slate-600 hidden md:block">
                  Limit: ₹{(selectedParty.creditLimitPaise / 100).toFixed(0)} · Avail: ₹
                  {(
                    (selectedParty.creditLimitPaise - selectedParty.currentOutstandingPaise) /
                    100
                  ).toFixed(0)}
                </div>
              )}

              {/* Recent Bills Flyout Toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowRecentBillsPopover((prev) => !prev)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                >
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Recent Bills ({recentBills.length})</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {showRecentBillsPopover && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-30 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                      <span>Last 5 Bills</span>
                      <button
                        onClick={handleOpenFullHistory}
                        className="text-[11px] text-[#12355B] hover:underline"
                      >
                        Full History &rarr;
                      </button>
                    </div>

                    {recentBills.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2 text-center">No past bills found.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {recentBills.map((inv) => (
                          <div
                            key={inv.id}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-800 font-mono text-[11px]">{inv.number}</p>
                              <p className="text-[10px] text-slate-500">
                                {inv.finalizedAt
                                  ? new Date(inv.finalizedAt).toLocaleDateString("en-IN")
                                  : "Draft"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-[#12355B]">
                                ₹{(inv.totalPaise / 100).toFixed(2)}
                              </p>
                              <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 rounded text-slate-700">
                                {inv.channel}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleOpenFullHistory}
                      className="w-full py-1.5 text-xs font-bold text-center bg-[#12355B] text-white rounded-lg hover:bg-[#0E2843] transition"
                    >
                      View Complete History
                    </button>
                  </div>
                )}
              </div>

              {/* Full History Drawer Button */}
              <button
                onClick={handleOpenFullHistory}
                title="View complete invoice and payment history"
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#12355B] text-white hover:bg-[#0E2843] transition shadow-xs"
              >
                <History className="w-3.5 h-3.5" />
                <span>Full History</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 3. Main Body: Busy-Style Item Grid (Left/Center) + Summary/Tender (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left/Center Pane: Item Search, Table Grid & Stock Indicator */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden border-r border-slate-200">
          {/* Quick Item Search Bar (Ctrl+K) */}
          <div className="p-3 border-b border-slate-200 bg-slate-50/70 relative shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={itemSearchInputRef}
                type="text"
                placeholder="Search items by name, code, brand (Ctrl+K)... Press Enter to add"
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredProducts.length > 0) {
                    e.preventDefault();
                    addItemToCart(filteredProducts[0], "Pcs", 1);
                  }
                }}
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B] shadow-xs"
              />
              {itemSearchTerm && (
                <button
                  onClick={() => setItemSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Autocomplete Dropdown */}
            {filteredProducts.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const resolved = resolvePrice(
                    {
                      mrpPaise: p.mrpPaise,
                      priceAPaise: p.priceAPaise,
                      priceBPaise: p.priceBPaise,
                      priceCPaise: p.priceCPaise,
                    },
                    effectiveTier
                  );

                  return (
                    <div
                      key={p.id}
                      onClick={() => addItemToCart(p, "Pcs", 1)}
                      className="p-2.5 hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1 rounded">
                            {p.shortCode}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {p.companyName} • Pack: {p.packLabel || `${p.packSize} pcs`} • Shop: {p.shopStockQty} pcs | Godown: {p.godownCartons} ctn
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {resolved.unitPricePaise > 0 ? (
                          <span className="font-bold text-xs text-[#12355B]">
                            ₹{(resolved.unitPricePaise / 100).toFixed(2)}/pc
                          </span>
                        ) : (
                          <span className="font-bold text-[11px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            Set Rate in Bill
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addItemToCart(p, "Carton", 1);
                          }}
                          disabled={p.packSize <= 1}
                          className="px-2 py-1 text-[11px] font-bold bg-[#12355B]/10 hover:bg-[#12355B]/20 text-[#12355B] rounded-lg transition disabled:opacity-30"
                        >
                          + 1 Ctn
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addItemToCart(p, "Pcs", 1);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-[#12355B] hover:bg-[#0E2843] text-white rounded-lg transition"
                        >
                          + 1 Pc
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Busy Sales Voucher Keyboard Grid */}
          <div className="flex-1 overflow-y-auto">
            {activeTab.cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-2">
                <Receipt className="w-12 h-12 text-slate-300 stroke-1" />
                <p className="font-semibold text-sm text-slate-600">No items in current bill</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Search by item name or code above (Ctrl+K) or select from catalog to begin billing.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black uppercase text-slate-700 tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2 w-24 text-center">Unit</th>
                    <th className="py-2.5 px-2 w-20 text-right">MRP</th>
                    <th className="py-2.5 px-2 w-24 text-right">Rate</th>
                    <th className="py-2.5 px-2 w-16 text-center">Disc%</th>
                    <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                    <th className="py-2.5 px-2 w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeTab.cart.map((line, index) => {
                    const isSelected = highlightedProductId === line.productId;
                    const resolved = resolvePrice(
                      {
                        mrpPaise: line.product.mrpPaise,
                        priceAPaise: line.product.priceAPaise,
                        priceBPaise: line.product.priceBPaise,
                        priceCPaise: line.product.priceCPaise,
                      },
                      effectiveTier
                    );

                    const packSize = Math.max(1, line.product.packSize);
                    const defaultRatePaise = line.unit === "Carton"
                      ? resolved.unitPricePaise * packSize
                      : resolved.unitPricePaise;

                    const ratePerUnitPaise = line.customRatePaise != null
                      ? line.customRatePaise
                      : defaultRatePaise;

                    const baseMrp = (line.product.mrpPaise && line.product.mrpPaise > 0)
                      ? line.product.mrpPaise
                      : (ratePerUnitPaise > 0 ? (line.unit === "Carton" ? Math.round(ratePerUnitPaise / packSize) : ratePerUnitPaise) : 0);

                    const mrpPerUnitPaise = line.unit === "Carton" ? baseMrp * packSize : baseMrp;

                    const lineDiscountMultiplier = 1 - (line.lineDiscountPercent || 0) / 100;
                    const lineAmountPaise = Math.round(line.qty * ratePerUnitPaise * lineDiscountMultiplier);

                    return (
                      <tr
                        key={line.id}
                        onClick={() => setHighlightedProductId(line.productId)}
                        className={`transition-colors cursor-pointer ${
                          isSelected ? "bg-amber-50/70 font-medium" : "hover:bg-slate-50"
                        }`}
                      >
                        <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {index + 1}
                        </td>

                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                              {line.product.name}
                            </span>
                            {line.isCustomRate && (
                              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                                Manual Rate
                              </span>
                            )}
                            {ratePerUnitPaise <= 0 && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded shrink-0">
                                Enter Rate!
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                            <span>{line.product.companyName}</span>
                            <span>•</span>
                            <span className="font-mono">{line.product.shortCode}</span>
                            {line.product.packSize > 1 && (
                              <>
                                <span>•</span>
                                <span>Pack: {line.product.packLabel || `${line.product.packSize} pcs`}</span>
                              </>
                            )}
                            {(line.product.mrpPaise === 0 || !line.product.priceCPaise || line.isCustomRate) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickSaveProductRate(line);
                                }}
                                title="Permanently save this rate as product price in catalog"
                                className="ml-1 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200 transition"
                              >
                                Save to Catalog
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Qty Input */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => updateLineQty(line.id, parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-1.5 py-1 text-center font-bold text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#12355B]"
                          />
                        </td>

                        {/* Unit Selector (Pcs vs Carton) */}
                        <td className="py-2 px-2 text-center">
                          <select
                            value={line.unit}
                            onChange={(e) => updateLineUnit(line.id, e.target.value as "Pcs" | "Carton")}
                            className="w-20 px-1 py-1 text-xs font-bold bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#12355B]"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Carton" disabled={line.product.packSize <= 1}>
                              Carton
                            </option>
                          </select>
                        </td>

                        {/* MRP */}
                        <td className="py-2 px-2 text-right text-slate-500 font-mono text-xs">
                          {mrpPerUnitPaise > 0 ? `₹${(mrpPerUnitPaise / 100).toFixed(2)}` : <span className="text-[10px] text-slate-400 italic">No MRP</span>}
                        </td>

                        {/* Rate (Editable Busy-Style Input) */}
                        <td className="py-2 px-2 text-right">
                          <div className="relative inline-flex items-center justify-end w-28">
                            <span className="absolute left-2 text-slate-400 font-mono text-[11px] pointer-events-none">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.customRateInput !== undefined ? line.customRateInput : (ratePerUnitPaise > 0 ? (ratePerUnitPaise / 100).toFixed(2) : "")}
                              placeholder="0.00"
                              onChange={(e) => updateLineRate(line.id, e.target.value)}
                              title="Type here to change selling rate manually"
                              className={`w-full pl-5 pr-2 py-1 text-right font-black text-xs rounded border transition-all ${
                                ratePerUnitPaise <= 0
                                  ? "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-300 focus:ring-amber-500"
                                  : line.isCustomRate
                                  ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 font-mono focus:ring-emerald-500"
                                  : "border-slate-300 bg-white text-slate-900 font-mono focus:ring-[#12355B]"
                              }`}
                            />
                          </div>
                        </td>

                        {/* Disc % */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={line.lineDiscountPercent || ""}
                            placeholder="0"
                            onChange={(e) => updateLineDiscount(line.id, parseFloat(e.target.value) || 0)}
                            className="w-14 px-1 py-1 text-center font-bold text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#12355B]"
                          />
                        </td>

                        {/* Amount */}
                        <td className="py-2 px-3 text-right font-black text-[#12355B] font-mono text-xs">
                          ₹{(lineAmountPaise / 100).toFixed(2)}
                        </td>

                        {/* Delete Line */}
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLine(line.id);
                            }}
                            title="Remove line (F9)"
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Under-Grid Stock & Customer Last Purchase Indicator */}
          <div className="p-2.5 bg-slate-100 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            {highlightedProduct ? (
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-800 truncate max-w-xs">{highlightedProduct.name}:</span>
                <span className="text-slate-600">
                  Shop Stock: <strong className="text-slate-900">{highlightedProduct.shopStockQty} pcs</strong>
                </span>
                <span className="text-slate-600">
                  Godown: <strong className="text-slate-900">{highlightedProduct.godownCartons} ctn</strong> ({highlightedProduct.godownStockQty} pcs)
                </span>
              </div>
            ) : (
              <span className="text-slate-400 italic">Select an item above to view real-time shop and warehouse stock.</span>
            )}

            {/* Last purchase for selected party */}
            {selectedParty && lastItemPurchase ? (
              <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Last bought: {lastItemPurchase.date ? new Date(lastItemPurchase.date).toLocaleDateString("en-IN") : "Earlier"} @ ₹{(lastItemPurchase.ratePaise / 100).toFixed(2)} ({lastItemPurchase.invoiceNumber})
              </div>
            ) : selectedParty && highlightedProduct ? (
              <div className="text-[11px] text-slate-500 italic">No prior purchases for this customer.</div>
            ) : null}
          </div>
        </section>

        {/* Right Pane: Totals, Order Discount, Tender & Finalize (Busy style) */}
        <aside className="w-full lg:w-96 bg-white flex flex-col justify-between p-4 space-y-4 shrink-0 shadow-sm overflow-y-auto">
          <div className="space-y-4">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
                <span>{errorMessage}</span>
                <button onClick={() => setErrorMessage(null)} className="text-xs font-bold">✕</button>
              </div>
            )}

            {/* Order Discount % */}
            <div className="flex items-center justify-between gap-2 text-xs">
              <label className="font-bold text-slate-700">Order Discount %:</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activeTab.orderDiscountPercent}
                  onChange={(e) => updateActiveTab({ orderDiscountPercent: e.target.value })}
                  className="w-20 px-2 py-1 text-right font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#12355B]"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (MRP):</span>
                <span className="font-mono">₹{(subtotalMrpPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discount on MRP:</span>
                <span className="font-mono text-emerald-700">-₹{(totalDiscountPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono">₹{(taxablePaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>CGST / SGST:</span>
                <span className="font-mono">₹{((cgstPaise + sgstPaise) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Round-off:</span>
                <span className="font-mono">
                  {roundoffPaise >= 0 ? `+₹${(roundoffPaise / 100).toFixed(2)}` : `-₹${(Math.abs(roundoffPaise) / 100).toFixed(2)}`}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="font-black text-slate-900 text-sm">Grand Total:</span>
                <span className="font-black text-xl text-[#12355B] font-mono">
                  ₹{(totalAmountPaise / 100).toFixed(2)}
                </span>
              </div>
              {amountInWords && (
                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200/60 leading-tight">
                  {amountInWords}
                </p>
              )}
            </div>

            {/* Payment Mode Buttons: Cash | UPI | Credit */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Payment Tender Mode</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CASH })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                    activeTab.paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.UPI })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                    activeTab.paymentMode === PaymentMode.UPI
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CREDIT })}
                  className={`py-2 px-2 rounded-xl text-xs font-bold flex flex-col items-center gap-1 border transition ${
                    activeTab.paymentMode === PaymentMode.CREDIT
                      ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Remarks Input */}
            <div>
              <input
                type="text"
                placeholder="Remarks (vehicle / notes / po)..."
                value={activeTab.remarks}
                onChange={(e) => updateActiveTab({ remarks: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-1 focus:ring-[#12355B]"
              />
            </div>
          </div>

          {/* Finalize Action */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => handleFinalizeBill()}
              disabled={activeTab.cart.length === 0 || isFinalizing}
              className="w-full py-3 px-4 rounded-xl font-black text-sm bg-[#12355B] hover:bg-[#0E2843] text-white shadow-md disabled:opacity-40 transition flex items-center justify-center gap-2"
            >
              {isFinalizing ? (
                <span>Finalizing Invoice...</span>
              ) : (
                <>
                  <span>Finalize & Print (F2)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 4. Bottom Shortcut Legend */}
      <footer className="bg-slate-900 text-slate-400 px-3 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2 shrink-0 border-t border-slate-800">
        <div className="flex items-center gap-4 flex-wrap">
          <span><strong className="text-white font-mono">[F2]</strong> Finalize</span>
          <span><strong className="text-white font-mono">[F3]</strong> New Bill</span>
          <span><strong className="text-white font-mono">[F4]</strong> Hold</span>
          <span><strong className="text-white font-mono">[F5]</strong> Held Bills</span>
          <span><strong className="text-white font-mono">[F9]</strong> Delete Line</span>
          <span><strong className="text-white font-mono">[Ctrl+K]</strong> Search Item</span>
          <span><strong className="text-white font-mono">[Esc]</strong> Close</span>
        </div>
        <div className="text-[10px] text-slate-500 font-mono">
          JMD Cart POS • v2.0
        </div>
      </footer>

      {/* Full History Slide-Over Drawer */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 text-slate-900">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-[#12355B]">
                  Billing History: {selectedParty?.name || "Customer"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedParty?.phone ? `Phone: ${selectedParty.phone} · ` : ""}
                  Type: {selectedParty?.type} · Total Invoices: {historyBills.length}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingHistory ? (
                <div className="p-8 text-center text-xs text-slate-500">Loading invoice history...</div>
              ) : historyBills.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No past invoices found for this party.</div>
              ) : (
                historyBills.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/80 transition space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[#12355B] font-mono">{inv.number}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded">
                          {inv.channel}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                          {inv.paymentStatus}
                        </span>
                      </div>
                      <span className="font-black text-sm text-slate-900 font-mono">
                        ₹{(inv.totalPaise / 100).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {inv.finalizedAt
                          ? new Date(inv.finalizedAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Draft"}
                      </span>
                      <span>{inv.lines?.length || 0} Item(s)</span>
                    </div>

                    {inv.lines && inv.lines.length > 0 && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60 max-h-24 overflow-y-auto space-y-0.5">
                        {inv.lines.map((l: any, i: number) => (
                          <div key={i} className="flex justify-between">
                            <span className="truncate">{l.productName} × {l.qty}</span>
                            <span className="font-mono">₹{(l.lineTotalPaise / 100).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                      <Link
                        href={`/shop/invoices/${inv.id}/print?format=thermal`}
                        target="_blank"
                        className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 inline-flex items-center gap-1 shadow-xs"
                      >
                        <Printer className="w-3 h-3" />
                        Thermal Slip
                      </Link>
                      <Link
                        href={`/shop/invoices/${inv.id}/print?format=a4`}
                        target="_blank"
                        className="px-2.5 py-1 text-[11px] font-bold bg-[#12355B] hover:bg-[#0E2843] text-white rounded-lg inline-flex items-center gap-1 shadow-xs"
                      >
                        <Printer className="w-3 h-3" />
                        Print A4
                      </Link>
                      <Link
                        href={`/shop/invoices/${inv.id}`}
                        target="_blank"
                        className="px-2.5 py-1 text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Held Bills Modal (F5) */}
      {showHeldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#12355B] text-base flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-500" />
                Held Bills ({tabs.filter((t) => t.isHeld).length})
              </h3>
              <button onClick={() => setShowHeldModal(false)} className="text-slate-400 hover:text-slate-700 text-sm">
                ✕
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2">
              {tabs.filter((t) => t.isHeld).length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No held bills pending.</p>
              ) : (
                tabs
                  .filter((t) => t.isHeld)
                  .map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{t.tabTitle}</p>
                        <p className="text-[11px] text-slate-500">
                          {t.cart.length} item(s) • Held {t.heldAt ? new Date(t.heldAt).toLocaleTimeString() : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResumeHeldTab(t.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#12355B] hover:bg-[#0E2843] text-white transition shadow-xs"
                        >
                          Resume Bill
                        </button>
                        <button
                          onClick={() => handleCloseTab(t.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Discard held bill"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHeldModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Close (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Add Modal */}
      {quickCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-[#12355B] text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#FC830D]" />
                Add New Customer
              </h3>
              <button
                onClick={() => setQuickCustomerModalOpen(false)}
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

            <form onSubmit={handleSaveQuickCustomer} className="space-y-3 text-xs">
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
                    <option value="CUSTOMER">Retail Customer</option>
                    <option value="RETAILER">Retailer (Kirana)</option>
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
                  onClick={() => setQuickCustomerModalOpen(false)}
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

      {/* Credit Limit Override Modal */}
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

      {/* Finalized Bill Success Dialog */}
      {finalizedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="font-black text-lg text-[#12355B]">Invoice Finalized!</h3>
              <p className="font-mono text-sm font-bold text-slate-700 mt-1">{finalizedInvoice.number}</p>
              <p className="text-xl font-black text-slate-900 mt-2 font-mono">
                ₹{(finalizedInvoice.totalPaise / 100).toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                href={`/shop/invoices/${finalizedInvoice.id}/print?format=thermal`}
                target="_blank"
                className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center justify-center gap-1.5 transition"
              >
                <Printer className="w-4 h-4" />
                <span>Thermal Slip</span>
              </Link>

              <Link
                href={`/shop/invoices/${finalizedInvoice.id}/print?format=a4`}
                target="_blank"
                className="py-2.5 px-3 rounded-xl font-bold text-xs bg-[#12355B] hover:bg-[#0E2843] text-white flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print A4</span>
              </Link>
            </div>

            <button
              onClick={() => {
                setFinalizedInvoice(null);
                itemSearchInputRef.current?.focus();
              }}
              className="w-full py-2.5 rounded-xl font-bold text-xs bg-[#FC830D] hover:bg-[#e57406] text-white transition shadow-xs"
            >
              Start Next Bill (F3)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
