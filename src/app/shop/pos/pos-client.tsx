"use client";

import { categorizeWeightBand, STANDARD_WEIGHT_BANDS, WeightBand } from "@/lib/weight";
import { FontSizeToggle } from "@/components/common/font-size-provider";

import React, { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { PaymentMode } from "@prisma/client";
import {
  Search,
  AlertTriangle,
  Package,
  Sparkles,
  Percent,
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
  Calendar,
} from "lucide-react";

import { OrderPriceResult } from "@/modules/pricing/pricing.types";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import {
  calculateOrderPricingAction,
  finalizeBillAction,
  checkPartyCreditStatusAction,
  setAdminManualRateAction,
  saveProductPriceAction,
  quickAddShopStockAction,
  createQuickPartyAction,
  getPartyBillHistoryAction,
  getPartyLastItemPurchaseAction,
  updatePartyNameAndContactAction,
} from "./actions";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { ItemInfoModal } from "@/components/pos/ItemInfoModal";
import { SaveVoucherDialog } from "@/components/pos/SaveVoucherDialog";
import { SearchIndexItem, buildProductSearchIndex, searchItems } from "@/lib/search/smart-search";

export interface ProductCatalogItem {
  id: string;
  name: string;
  shortCode: string;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  bagSize?: number | null;
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
  address?: string | null;
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

export interface PosCartLine {
  id: string;
  productId: string;
  product: ProductCatalogItem;
  qty: number;
  unit: "Pcs" | "Carton" | "Dozen" | "Bag";
  lineDiscountPercent: number;
  customRatePaise?: number | null;
  customRateInput?: string;
  customDiscInput?: string;
  customMrpPaise?: number | null;
  customMrpInput?: string;
  updateMasterMrp?: boolean;
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
  walkInName?: string;
  walkInMobile?: string;
  walkInAddress?: string;
  paymentCollected?: boolean;
  billDate?: string;
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
  nextInvoicePreview?: string;
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
  nextInvoicePreview,
}: PosClientProps) {
  // Admin check for backdated billing
  const isAdmin = cashierRole === "SUPER_ADMIN" || cashierRole === "ADMIN";
  const todayFormattedWithDay = useMemo(() => {
    try {
      const d = new Date();
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayName = days[d.getDay()];
      return `${day}-${month}-${year} (${dayName})`;
    } catch {
      return "31-10-2026 (Sat)";
    }
  }, []);
  const todayStr = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  // Line MRP editing & master MRP flag
  const updateLineMrp = (lineId: string, value: string) => {
    const valNum = parseFloat(value);
    const paise = !isNaN(valNum) && valNum >= 0 ? Math.round(valNum * 100) : 0;

    updateActiveTab({
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        const bagSize = (item.product as any).bagSize || packSize;
        const mult = item.unit === "Carton" ? packSize : item.unit === "Bag" ? bagSize : item.unit === "Dozen" ? 12 : 1;
        const pieceMrp = mult > 0 ? Math.round(paise / mult) : paise;

        const currentRate = item.customRatePaise ?? 0;
        const newDisc = paise > 0 && currentRate < paise
          ? Math.round(((paise - currentRate) / paise) * 10000) / 100
          : 0;

        return {
          ...item,
          customMrpInput: value,
          customMrpPaise: pieceMrp,
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : item.customDiscInput,
        };
      }),
    });
  };

  const toggleUpdateMasterMrp = (lineId: string) => {
    updateActiveTab({
      cart: activeTab.cart.map((item) =>
        item.id === lineId ? { ...item, updateMasterMrp: !item.updateMasterMrp } : item
      ),
    });
  };

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
      billDate: undefined,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Load tabs from localStorage on mount and sanitize against live catalog
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jmd_pos_bill_tabs");
      const savedActive = localStorage.getItem("jmd_pos_active_tab_id");
      if (saved) {
        const parsed: PosBillTab[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const productMap = new Map(products.map((p) => [p.id, p]));
          const sanitized: PosBillTab[] = parsed.map((tab) => ({
            ...tab,
            cart: (tab.cart || []).filter((line) => {
              const liveProd = productMap.get(line.productId);
              if (!liveProd) return false;
              line.product = liveProd;
              return true;
            }),
          }));
          setTabs(sanitized);
          if (savedActive && sanitized.some((t) => t.id === savedActive)) {
            setActiveTabId(savedActive);
          } else {
            setActiveTabId(sanitized[0].id);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsStorageLoaded(true);
    }
  }, [products]);

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
      billDate: undefined,
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

  // Inline Party details edit state
  const [inlinePartyName, setInlinePartyName] = useState("");
  const [inlinePartyPhone, setInlinePartyPhone] = useState("");
  const [inlinePartyAddress, setInlinePartyAddress] = useState("");
  const [isPartyDirty, setIsPartyDirty] = useState(false);
  const [isSavingInlineParty, setIsSavingInlineParty] = useState(false);
  const [partySaveSuccess, setPartySaveSuccess] = useState(false);

  // Sync inline party fields when selectedParty changes
  useEffect(() => {
    if (selectedParty) {
      setInlinePartyName(selectedParty.name || "");
      setInlinePartyPhone(selectedParty.phone || "");
      setInlinePartyAddress(selectedParty.address || "");
      setIsPartyDirty(false);
      setPartySaveSuccess(false);
    } else {
      setInlinePartyName("");
      setInlinePartyPhone("");
      setInlinePartyAddress("");
      setIsPartyDirty(false);
      setPartySaveSuccess(false);
    }
  }, [selectedParty?.id, selectedParty?.name, selectedParty?.phone, selectedParty?.address]);

  const handleSaveInlineParty = async () => {
    if (!selectedParty) return;
    if (!inlinePartyName.trim()) {
      alert("Customer name cannot be empty");
      return;
    }
    setIsSavingInlineParty(true);
    try {
      const res = await updatePartyNameAndContactAction({
        partyId: selectedParty.id,
        name: inlinePartyName.trim(),
        phone: inlinePartyPhone.trim() || undefined,
        address: inlinePartyAddress.trim() || undefined,
        reason: "POS Quick Inline Edit",
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
        updateActiveTab({ tabTitle: res.party.name });
        setIsPartyDirty(false);
        setPartySaveSuccess(true);
        setTimeout(() => setPartySaveSuccess(false), 2500);
      } else {
        alert(res.error || "Failed to update party");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update party");
    } finally {
      setIsSavingInlineParty(false);
    }
  };

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
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const [lastItemPurchase, setLastItemPurchase] = useState<{
    ratePaise: number;
    qty: number;
    invoiceNumber: string;
    date: string | null;
  } | null>(null);
  const itemSearchInputRef = useRef<HTMLInputElement>(null);
  const [selectedWeightBand, setSelectedWeightBand] = useState<string>("ALL");
  const [isWeightViewOpen, setIsWeightViewOpen] = useState(false);
  const [isItemInfoOpen, setIsItemInfoOpen] = useState(false);
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);

  const weightCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: productsList.length };
    for (const p of productsList) {
      const band = categorizeWeightBand(p.weightValue, p.weightUnit);
      counts[band] = (counts[band] || 0) + 1;
    }
    return counts;
  }, [productsList]);

  // Precomputed search index for instant < 50ms lookup
  const searchIndex: SearchIndexItem[] = useMemo(() => {
    return buildProductSearchIndex(productsList);
  }, [productsList]);

  // Filter products using Smart Item Search (Token + Weight aware)
  const filteredProducts = useMemo(() => {
    if (!itemSearchTerm.trim()) return [];
    return searchItems(itemSearchTerm, searchIndex, { limit: 15 });
  }, [itemSearchTerm, searchIndex]);

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

  // Insufficient Stock Alert Dialog State
  const [stockAlertInfo, setStockAlertInfo] = useState<{
    isOpen: boolean;
    productName: string;
    shortCode: string;
    productId: string;
    lineId: string;
    requestedPcs: number;
    availableShopPcs: number;
    availableGodownPcs: number;
    availableGodownCtn: number;
    packSize: number;
    allInsufficient: Array<{
      lineId: string;
      productId: string;
      productName: string;
      shortCode: string;
      requestedPcs: number;
      availableShopPcs: number;
      availableGodownCtn: number;
    }>;
  } | null>(null);

  // Quick Stock Replenishment Modal State
  const [quickStockModal, setQuickStockModal] = useState<{
    isOpen: boolean;
    product: ProductCatalogItem | null;
    addQty: string;
    unit: "Pcs" | "Carton";
    isLoading: boolean;
  }>({
    isOpen: false,
    product: null,
    addQty: "",
    unit: "Pcs",
    isLoading: false,
  });

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
          const pcs = c.unit === "Carton" ? c.qty * packSize
            : c.unit === "Dozen" ? c.qty * 12
            : c.unit === "Bag" ? c.qty * packSize
            : c.qty;
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
  const addItemToCart = (product: ProductCatalogItem, unit: "Pcs" | "Carton" | "Dozen" | "Bag" = "Pcs", qty: number = 1): string => {
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
    const multiplier = unit === "Carton" || unit === "Bag" ? packSize : unit === "Dozen" ? 12 : 1;
    const initialRatePaise = resolved.unitPricePaise > 0 
      ? resolved.unitPricePaise * multiplier
      : 0;

    const existingIndex = activeTab.cart.findIndex(
      (item) => item.productId === product.id && item.unit === unit
    );

    let targetLineId: string;
    let newCart: PosCartLine[];
    if (existingIndex >= 0) {
      targetLineId = activeTab.cart[existingIndex].id;
      newCart = activeTab.cart.map((item, idx) =>
        idx === existingIndex ? { ...item, qty: item.qty + qty } : item
      );
    } else {
      targetLineId = `line-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newLine: PosCartLine = {
        id: targetLineId,
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
    return targetLineId;
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
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        const resolved = resolvePrice(
          {
            mrpPaise: item.product.mrpPaise,
            priceAPaise: item.product.priceAPaise,
            priceBPaise: item.product.priceBPaise,
            priceCPaise: item.product.priceCPaise,
          },
          effectiveTier
        );
        const defaultBaseRate = item.unit === "Carton" || item.unit === "Bag" ? resolved.unitPricePaise * packSize : item.unit === "Dozen" ? resolved.unitPricePaise * 12 : resolved.unitPricePaise;
        const baseMrp = (item.product.mrpPaise && item.product.mrpPaise > 0)
          ? item.product.mrpPaise
          : (defaultBaseRate > 0 ? (item.unit === "Carton" || item.unit === "Bag" ? Math.round(defaultBaseRate / packSize) : item.unit === "Dozen" ? Math.round(defaultBaseRate / 12) : defaultBaseRate) : paise);
        const mrpPerUnit = item.unit === "Carton" || item.unit === "Bag" ? baseMrp * packSize : item.unit === "Dozen" ? baseMrp * 12 : baseMrp;

        const newDisc = mrpPerUnit > 0 && paise < mrpPerUnit
          ? Math.round(((mrpPerUnit - paise) / mrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...item,
          customRateInput: value,
          customRatePaise: paise,
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : "0",
          isCustomRate: true,
        };
      }),
    });
  };

  const updateLineDiscountPercent = (lineId: string, discInput: string) => {
    const discNum = parseFloat(discInput);
    updateActiveTab({
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        const resolved = resolvePrice(
          {
            mrpPaise: item.product.mrpPaise,
            priceAPaise: item.product.priceAPaise,
            priceBPaise: item.product.priceBPaise,
            priceCPaise: item.product.priceCPaise,
          },
          effectiveTier
        );
        const defaultBaseRate = item.unit === "Carton" || item.unit === "Bag" ? resolved.unitPricePaise * packSize : item.unit === "Dozen" ? resolved.unitPricePaise * 12 : resolved.unitPricePaise;
        const baseMrp = (item.product.mrpPaise && item.product.mrpPaise > 0)
          ? item.product.mrpPaise
          : (defaultBaseRate > 0 ? (item.unit === "Carton" || item.unit === "Bag" ? Math.round(defaultBaseRate / packSize) : item.unit === "Dozen" ? Math.round(defaultBaseRate / 12) : defaultBaseRate) : 0);
        const mrpPerUnit = item.unit === "Carton" || item.unit === "Bag" ? baseMrp * packSize : item.unit === "Dozen" ? baseMrp * 12 : baseMrp;

        if (isNaN(discNum) || discNum < 0) {
          return {
            ...item,
            customDiscInput: discInput,
          };
        }

        const safeDisc = Math.min(100, Math.max(0, discNum));
        let newRatePaise = mrpPerUnit;
        if (mrpPerUnit > 0) {
          newRatePaise = Math.round(mrpPerUnit * (1 - safeDisc / 100));
        }

        return {
          ...item,
          customDiscInput: discInput,
          customRatePaise: newRatePaise,
          customRateInput: (newRatePaise / 100).toFixed(2),
          isCustomRate: true,
        };
      }),
    });
  };

  const handleSetQtyToAvailable = (line: PosCartLine) => {
    const packSize = Math.max(1, line.product.packSize);
    if (line.unit === "Carton") {
      const availableCtn = line.product.godownCartons ?? Math.floor((line.product.godownStockQty ?? 0) / packSize);
      if (availableCtn <= 0) {
        removeLine(line.id);
      } else {
        updateLineQty(line.id, availableCtn);
      }
    } else {
      const availablePcs = line.product.shopStockQty ?? 0;
      if (availablePcs <= 0) {
        removeLine(line.id);
      } else {
        updateLineQty(line.id, availablePcs);
      }
    }
    if (stockAlertInfo?.lineId === line.id) setStockAlertInfo(null);
  };

  const handleAdjustAllToAvailable = () => {
    if (!stockAlertInfo) return;
    updateActiveTab({
      cart: activeTab.cart.map((line) => {
        const packSize = Math.max(1, line.product.packSize);
        if (line.unit === "Carton") {
          const availableCtn = line.product.godownCartons ?? Math.floor((line.product.godownStockQty ?? 0) / packSize);
          if (line.qty <= availableCtn) return line;
          if (availableCtn <= 0) return null as any;
          return { ...line, qty: availableCtn };
        } else {
          const availablePcs = line.product.shopStockQty ?? 0;
          if (line.qty <= availablePcs) return line;
          if (availablePcs <= 0) return null as any;
          return { ...line, qty: availablePcs };
        }
      }).filter(Boolean),
    });
    setStockAlertInfo(null);
    setErrorMessage(null);
  };

  const openQuickStockModal = (product: ProductCatalogItem, suggestedQty?: number) => {
    setQuickStockModal({
      isOpen: true,
      product,
      addQty: suggestedQty ? String(suggestedQty) : "1",
      unit: product.packSize > 1 ? "Carton" : "Pcs",
      isLoading: false,
    });
  };

  const handleExecuteQuickAddStock = async () => {
    if (!quickStockModal.product) return;
    const qtyNum = parseInt(quickStockModal.addQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setErrorMessage("Please enter a valid stock quantity to add.");
      return;
    }

    const packSize = Math.max(1, quickStockModal.product.packSize);
    const addPieces = quickStockModal.unit === "Carton" ? qtyNum * packSize : qtyNum;

    setQuickStockModal((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await quickAddShopStockAction({
        productId: quickStockModal.product.id,
        locationId,
        qtyPcs: addPieces,
        reason: "POS Quick Stock replenishment",
      });

      if (res.success) {
        setProductsList((prev) =>
          prev.map((p) =>
            p.id === quickStockModal.product?.id
              ? { ...p, shopStockQty: res.newShopQty }
              : p
          )
        );
        updateActiveTab({
          cart: activeTab.cart.map((c) =>
            c.productId === quickStockModal.product?.id
              ? {
                  ...c,
                  product: { ...c.product, shopStockQty: res.newShopQty },
                }
              : c
          ),
        });
        setQuickStockModal({ isOpen: false, product: null, addQty: "", unit: "Pcs", isLoading: false });
        if (stockAlertInfo?.productId === quickStockModal.product.id) {
          setStockAlertInfo(null);
        }
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to add stock");
      setQuickStockModal((prev) => ({ ...prev, isLoading: false }));
    }
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

  const updateLineUnit = (lineId: string, newUnit: "Pcs" | "Carton" | "Dozen" | "Bag") => {
    updateActiveTab({
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        const resolved = resolvePrice(
          {
            mrpPaise: item.product.mrpPaise,
            priceAPaise: item.product.priceAPaise,
            priceBPaise: item.product.priceBPaise,
            priceCPaise: item.product.priceCPaise,
          },
          effectiveTier
        );

        const oldMultiplier = item.unit === "Carton" || item.unit === "Bag" ? packSize : item.unit === "Dozen" ? 12 : 1;
        const newMultiplier = newUnit === "Carton" || newUnit === "Bag" ? packSize : newUnit === "Dozen" ? 12 : 1;

        let newRatePaise: number | null = null;
        if (item.isCustomRate && item.customRatePaise != null && item.customRatePaise > 0) {
          const pieceRate = item.customRatePaise / oldMultiplier;
          newRatePaise = Math.round(pieceRate * newMultiplier);
        } else if (resolved.unitPricePaise > 0) {
          newRatePaise = resolved.unitPricePaise * newMultiplier;
        }

        const baseMrp = (item.product.mrpPaise && item.product.mrpPaise > 0)
          ? item.product.mrpPaise
          : (resolved.unitPricePaise > 0 ? resolved.unitPricePaise : (newRatePaise ? Math.round(newRatePaise / newMultiplier) : 0));
        const mrpPerUnit = baseMrp * newMultiplier;

        const effectiveDisc = (mrpPerUnit > 0 && newRatePaise != null && newRatePaise < mrpPerUnit)
          ? Math.round(((mrpPerUnit - newRatePaise) / mrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...item,
          unit: newUnit,
          customRatePaise: newRatePaise,
          customRateInput: newRatePaise && newRatePaise > 0 ? (newRatePaise / 100).toFixed(2) : "",
          customDiscInput: effectiveDisc > 0 ? effectiveDisc.toFixed(1) : "0",
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
      billDate: undefined,
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
      billDate: undefined,
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

    const isPaymentPending = activeTab.paymentCollected === false && (activeTab.paymentMode === PaymentMode.CASH || activeTab.paymentMode === PaymentMode.UPI);

    if (isPaymentPending) {
      const hasCustomerInfo = activeTab.partyId || (activeTab.walkInName?.trim() && (activeTab.walkInMobile?.trim().length || 0) >= 10);
      if (!hasCustomerInfo) {
        setErrorMessage("Customer Name and 10-digit Mobile are mandatory when Payment Pending is selected.");
        return;
      }
      payments = [];
    } else if (activeTab.paymentMode === PaymentMode.CASH) {
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

        // Pre-flight check: Insufficient stock check before finalization (Cartons check Godown, Pcs check Shop)
        const insufficientItems = activeTab.cart.filter((c) => {
          const packSize = Math.max(1, c.product.packSize);
          if (c.unit === "Carton") {
            const requestedPcs = c.qty * packSize;
            const availableGodownPcs = c.product.godownStockQty ?? 0;
            return requestedPcs > availableGodownPcs;
          } else {
            const requestedPcs = c.qty;
            const availableShopPcs = c.product.shopStockQty ?? 0;
            return requestedPcs > availableShopPcs;
          }
        });

        if (insufficientItems.length > 0) {
          const first = insufficientItems[0];
          const packSize = Math.max(1, first.product.packSize);
          const isCarton = first.unit === "Carton";
          const requestedPcs = isCarton ? first.qty * packSize : first.qty;
          const availablePcs = isCarton ? (first.product.godownStockQty ?? 0) : (first.product.shopStockQty ?? 0);

          setStockAlertInfo({
            isOpen: true,
            productName: first.product.name,
            shortCode: first.product.shortCode,
            productId: first.productId,
            lineId: first.id,
            requestedPcs,
            availableShopPcs: first.product.shopStockQty ?? 0,
            availableGodownPcs: first.product.godownStockQty ?? 0,
            availableGodownCtn: first.product.godownCartons ?? 0,
            packSize,
            allInsufficient: insufficientItems.map((item) => {
              const ps = Math.max(1, item.product.packSize);
              const itemIsCarton = item.unit === "Carton";
              return {
                lineId: item.id,
                productId: item.productId,
                productName: item.product.name,
                shortCode: item.product.shortCode,
                requestedPcs: itemIsCarton ? item.qty * ps : item.qty,
                availableShopPcs: item.product.shopStockQty ?? 0,
                availableGodownCtn: item.product.godownCartons ?? 0,
              };
            }),
          });

          setErrorMessage(
            isCarton
              ? `Insufficient stock for "${first.product.name}": Available in Godown: ${first.product.godownCartons ?? 0} ctn (${availablePcs} pcs), Requested: ${first.qty} ctn.`
              : `Insufficient stock for "${first.product.name}": Available in Shop: ${availablePcs} pcs, Requested: ${requestedPcs} pcs (Short by ${requestedPcs - availablePcs} pcs).`
          );
          setHighlightedProductId(first.productId);
          return;
        }

        const finalizeItems = activeTab.cart.map((c) => {
          const packSize = Math.max(1, c.product.packSize);
          const bagSize = (c.product as any).bagSize || packSize;
          const pcs = c.unit === "Carton"
            ? c.qty * packSize
            : c.unit === "Bag"
            ? c.qty * bagSize
            : c.unit === "Dozen"
            ? c.qty * 12
            : c.qty;
          let unitPriceOverridePaise: number | undefined = undefined;
          if (c.customRatePaise != null && c.customRatePaise > 0) {
            unitPriceOverridePaise = c.unit === "Carton"
              ? Math.round(c.customRatePaise / packSize)
              : c.unit === "Bag"
              ? Math.round(c.customRatePaise / bagSize)
              : c.unit === "Dozen"
              ? Math.round(c.customRatePaise / 12)
              : c.customRatePaise;
          }
          const pieceMrp = c.customMrpPaise != null && c.customMrpPaise > 0 ? c.customMrpPaise : (c.product.mrpPaise ?? 0);
          return {
            productId: c.productId,
            qty: pcs,
            unitPriceOverridePaise,
            unitLabel: c.unit,
            originalMrpPaise: c.product.mrpPaise ?? 0,
            mrpOverridden: Boolean(c.customMrpPaise && c.customMrpPaise !== c.product.mrpPaise),
            rateOverridden: Boolean(c.isCustomRate),
            mrpOverridePaise: pieceMrp,
            updateMasterMrp: Boolean(c.updateMasterMrp),
          };
        });

        const res = await finalizeBillAction({
          locationId,
          partyId: activeTab.partyId || null,
          customerName: activeTab.partyId ? undefined : activeTab.walkInName?.trim() || undefined,
          customerPhone: activeTab.partyId ? undefined : activeTab.walkInMobile?.trim() || undefined,
          customerAddress: activeTab.partyId ? undefined : activeTab.walkInAddress?.trim() || undefined,
          buyerType: effectiveTier,
          orderDiscountBp,
          items: finalizeItems,
          payments,
          idempotencyKey,
          creditOverride: overrideToUse || undefined,
          invoiceDate: (() => {
            const isBackdated = isAdmin && Boolean(activeTab.billDate) && activeTab.billDate !== todayStr;
            if (!isBackdated) return undefined;
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, "0");
            const mm = String(now.getMinutes()).padStart(2, "0");
            const ss = String(now.getSeconds()).padStart(2, "0");
            return `${activeTab.billDate}T${hh}:${mm}:${ss}`;
          })(),
        });

        if (!res.success || !res.invoice) {
          const msg = res.error || "Failed to finalize invoice";
          if ((res as any).insufficientStock) {
            const s = (res as any).insufficientStock;
            setStockAlertInfo({
              isOpen: true,
              productName: s.productName,
              shortCode: s.shortCode,
              productId: s.productId,
              lineId: activeTab.cart.find((c) => c.productId === s.productId)?.id || "",
              requestedPcs: s.requestedQty,
              availableShopPcs: s.availableQty,
              availableGodownPcs: 0,
              availableGodownCtn: 0,
              packSize: 1,
              allInsufficient: [{
                lineId: activeTab.cart.find((c) => c.productId === s.productId)?.id || "",
                productId: s.productId,
                productName: s.productName,
                shortCode: s.shortCode,
                requestedPcs: s.requestedQty,
                availableShopPcs: s.availableQty,
                availableGodownCtn: 0,
              }],
            });
            setErrorMessage(msg);
            setHighlightedProductId(s.productId);
            return;
          }
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
      if (e.key === "F1") {
        e.preventDefault();
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
      } else if (e.key === "F2") {
        e.preventDefault();
        if (activeTab.cart.length > 0) {
          setIsSaveConfirmOpen(true);
        } else {
          handleFinalizeBill();
        }
      } else if (e.key === "F3") {
        e.preventDefault();
        handleCreateNewTab();
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHoldCurrentBill();
      } else if (e.key === "F7") {
        e.preventDefault();
        // Repeat previous line
        if (activeTab.cart.length > 0) {
          const lastLine = activeTab.cart[activeTab.cart.length - 1];
          addItemToCart(lastLine.product, lastLine.unit, lastLine.qty);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        setIsItemInfoOpen((prev) => !prev);
      } else if (e.key === "F9") {
        e.preventDefault();
        handleDeleteHighlightedOrLastLine();
      } else if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        // Focus Party Search
        const partyInput = document.querySelector<HTMLInputElement>("input[placeholder*='Search buyer']");
        partyInput?.focus();
        partyInput?.select();
      } else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        // Focus Order Discount
        const discInput = document.querySelector<HTMLInputElement>("input[type='number']#order-discount, input[title*='discount']");
        discInput?.focus();
        discInput?.select();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (activeTab.cart.length > 0) {
          setIsSaveConfirmOpen(true);
        } else {
          handleFinalizeBill();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
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
          <div className="w-9 h-9 rounded-xl bg-white p-0.5 flex items-center justify-center shrink-0 border border-slate-700 shadow-xs">
            <img src="/brand/jmd-cart-logo.png" alt="JMD POS Logo" className="w-full h-full object-contain" />
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
              {isAdmin && activeTab.billDate && activeTab.billDate !== todayStr && (
                <span className="ml-2 inline-flex items-center gap-1 bg-amber-400 text-amber-950 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider shadow-xs border border-amber-500 animate-pulse">
                  <Calendar className="w-3 h-3" />
                  Backdated: {activeTab.billDate}
                </span>
              )}
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

      {/* 1b. FMCG Voucher Details Strip (Image 2 Busy ERP Style) */}
      <div className="bg-white border-b-2 border-slate-300 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 shadow-2xs shrink-0">
        <div className="flex items-center gap-3 sm:gap-5 flex-wrap text-xs font-mono font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-sans text-[11px] font-extrabold">Date:</span>
            <span className="text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              {todayFormattedWithDay}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-sans text-[11px] font-extrabold">Vch. No:</span>
            <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300 font-black">
              {nextInvoicePreview ? `${nextInvoicePreview} (auto)` : (activeTab.tabTitle || "INV/26-27/000001 (auto)")}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 uppercase font-sans text-[11px] font-extrabold">Party:</span>
            <span className="text-slate-900 font-black font-sans text-xs sm:text-sm">
              {selectedParty ? selectedParty.name : (activeTab.walkInName || "Counter Sale")}
            </span>
            <span className="text-slate-600 text-[11px]">
              {selectedParty
                ? `(Cur. Bal: Rs. ${(selectedParty.currentOutstandingPaise / 100).toFixed(2)} ${selectedParty.currentOutstandingPaise >= 0 ? "Dr" : "Cr"})`
                : "(Cur. Bal: Rs. 0.00 Dr)"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <span className="text-slate-500 uppercase font-sans text-[11px] font-extrabold shrink-0">Narration:</span>
          <input
            type="text"
            placeholder="Narration / bill notes..."
            value={activeTab.remarks}
            onChange={(e) => updateActiveTab({ remarks: e.target.value })}
            className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] font-sans"
          />
        </div>
      </div>

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

        {/* Walk-in Customer Snapshot Fields (Auto-lookup on 10 digits) */}
        {!activeTab.partyId && (
          <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Walk-in Customer:</span>
            <div className="flex-1 min-w-[140px] max-w-[180px]">
              <input
                type="tel"
                placeholder="Mobile (10-digit)..."
                value={activeTab.walkInMobile || ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digits = raw.replace(/\D/g, "").slice(0, 10);
                  const updates: Partial<PosBillTab> = { walkInMobile: digits };
                  if (digits.length === 10) {
                    const match = localParties.find((p) => p.phone === digits);
                    if (match) {
                      updates.walkInName = match.name;
                      if (match.address) updates.walkInAddress = match.address;
                    }
                  }
                  updateActiveTab(updates);
                }}
                className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
            <div className="flex-1 min-w-[140px] max-w-[200px]">
              <input
                type="text"
                placeholder="Customer Name..."
                value={activeTab.walkInName || ""}
                onChange={(e) => updateActiveTab({ walkInName: e.target.value })}
                className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="Address / Delivery Location (optional)..."
                value={activeTab.walkInAddress || ""}
                onChange={(e) => updateActiveTab({ walkInAddress: e.target.value })}
                className="w-full px-2.5 py-1 rounded-lg border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Selected Customer Inline Details Strip (Click/press to change, Save button to update DB) */}
        {selectedParty && (
          <div className="w-full flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 text-xs bg-blue-50/50 p-2.5 rounded-xl border border-blue-200">
            <span className="font-black text-blue-900 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <span>👤 Customer:</span>
            </span>
            <div className="flex-1 min-w-[160px] max-w-[240px]">
              <input
                type="text"
                placeholder="Customer Name..."
                value={inlinePartyName}
                onChange={(e) => {
                  setInlinePartyName(e.target.value);
                  setIsPartyDirty(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveInlineParty();
                    itemSearchInputRef.current?.focus();
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                title="Customer Name (Click to edit, Enter to Save)"
              />
            </div>
            <div className="flex-1 min-w-[130px] max-w-[180px]">
              <input
                type="tel"
                placeholder="Mobile (10-digit)..."
                value={inlinePartyPhone}
                onChange={(e) => {
                  setInlinePartyPhone(e.target.value);
                  setIsPartyDirty(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveInlineParty();
                    itemSearchInputRef.current?.focus();
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                title="Customer Phone (Click to edit, Enter to Save)"
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="Address / Delivery Location..."
                value={inlinePartyAddress}
                onChange={(e) => {
                  setInlinePartyAddress(e.target.value);
                  setIsPartyDirty(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveInlineParty();
                    itemSearchInputRef.current?.focus();
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-2xs"
                title="Customer Address (Click to edit, Enter to Save)"
              />
            </div>
            <button
              type="button"
              onClick={handleSaveInlineParty}
              disabled={isSavingInlineParty || (!isPartyDirty && !partySaveSuccess)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                partySaveSuccess
                  ? "bg-emerald-600 text-white"
                  : isPartyDirty
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  : "bg-slate-200 text-slate-500 cursor-default"
              }`}
            >
              {isSavingInlineParty ? (
                <span>Saving...</span>
              ) : partySaveSuccess ? (
                <span>✓ Saved!</span>
              ) : (
                <span>💾 Save</span>
              )}
            </button>
          </div>
        )}

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

          {/* Selected Party Name Badge */}
          {selectedParty && (
            <div className="flex items-center gap-1.5 bg-blue-50/90 border border-blue-200 px-3 py-1 rounded-xl shadow-2xs">
              <span className="font-black text-xs text-blue-950">{selectedParty.name}</span>
            </div>
          )}

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
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={itemSearchInputRef}
                type="text"
                placeholder="Search items by name, weight, code... (e.g. 'bhuj 400')"
                value={itemSearchTerm}
                onChange={(e) => {
                  setItemSearchTerm(e.target.value);
                  setSearchSelectedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    if (filteredProducts.length > 0) {
                      e.preventDefault();
                      setSearchSelectedIndex((prev) => (prev + 1) % filteredProducts.length);
                    } else if (activeTab.cart.length > 0) {
                      e.preventDefault();
                      const qtyInputs = document.querySelectorAll<HTMLInputElement>("table input[data-pos-field='qty']");
                      if (qtyInputs.length > 0) {
                        qtyInputs[qtyInputs.length - 1].focus();
                        qtyInputs[qtyInputs.length - 1].select();
                      }
                    }
                  } else if (e.key === "ArrowUp") {
                    if (filteredProducts.length > 0) {
                      e.preventDefault();
                      setSearchSelectedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
                    }
                  } else if (e.key === "Enter") {
                    if (filteredProducts.length > 0) {
                      e.preventDefault();
                      const chosenSearch = filteredProducts[searchSelectedIndex] || filteredProducts[0];
                      const chosenProduct = productsList.find((item) => item.id === chosenSearch.id);
                      if (!chosenProduct) return;
                      const targetLineId = addItemToCart(chosenProduct, "Pcs", 1);
                      setItemSearchTerm("");
                      setSearchSelectedIndex(0);
                      // Keyboard-first billing: immediately focus Qty field of the added/updated row with number selected
                      setTimeout(() => {
                        const targetQty = targetLineId
                          ? document.querySelector<HTMLInputElement>(`tr[data-line-id='${targetLineId}'] input[data-pos-field='qty']`)
                          : null;
                        const qtyInput = targetQty || document.querySelector<HTMLInputElement>("table tr:last-child input[data-pos-field='qty']");
                        if (qtyInput) {
                          qtyInput.focus();
                          qtyInput.select();
                        }
                      }, 30);
                    }
                  } else if (e.key === "Escape") {
                    if (itemSearchTerm) {
                      e.preventDefault();
                      setItemSearchTerm("");
                      setSearchSelectedIndex(0);
                    }
                  }
                }}
                className="w-full pl-11 pr-24 py-3 bg-white border-2 border-slate-300 rounded-2xl text-sm md:text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#12355B] focus:border-[#12355B] shadow-sm transition"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {itemSearchTerm && (
                  <button
                    onClick={() => setItemSearchTerm("")}
                    className="p-1 text-slate-400 hover:text-slate-600 text-xs font-black mr-1"
                  >
                    ✕
                  </button>
                )}
                <span className="hidden sm:inline-block font-mono text-[11px] font-extrabold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  Ctrl+K
                </span>
              </div>
            </div>

            {/* Busy-Style Minimal Autocomplete Dropdown (Part C) */}
            {filteredProducts.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 font-sans">
                {filteredProducts.map((p, pIdx) => {
                  const isHighlighted = pIdx === searchSelectedIndex;
                  const inStock = (p.shopStockQty ?? 0) + (p.godownStockQty ?? 0) > 0;
                  const weightText = p.weight ? ` ${p.weight}` : (p.weightValue ? ` ${p.weightValue}${p.weightUnit || "g"}` : "");
                  const fullTitle = `${p.name}${weightText}`;

                  return (
                    <div
                      key={p.id}
                      ref={(el) => {
                        if (isHighlighted && el) {
                          el.scrollIntoView({ block: "nearest" });
                        }
                      }}
                      onMouseEnter={() => {
                        setSearchSelectedIndex(pIdx);
                        setHighlightedProductId(p.id);
                      }}
                      onClick={() => {
                        const fullProd = productsList.find((item) => item.id === p.id);
                        if (!fullProd) return;
                        const targetLineId = addItemToCart(fullProd, "Pcs", 1);
                        setItemSearchTerm("");
                        setSearchSelectedIndex(0);
                        setTimeout(() => {
                          const targetQty = targetLineId
                            ? document.querySelector<HTMLInputElement>(`tr[data-line-id='${targetLineId}'] input[data-pos-field='qty']`)
                            : null;
                          const qtyInput = targetQty || document.querySelector<HTMLInputElement>("table tr:last-child input[data-pos-field='qty']");
                          if (qtyInput) {
                            qtyInput.focus();
                            qtyInput.select();
                          }
                        }, 30);
                      }}
                      className={`px-3 py-2 sm:py-2.5 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition ${
                        isHighlighted
                          ? "bg-[#0f172a] text-white font-semibold"
                          : "bg-white text-slate-900 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{fullTitle}</span>
                        {!inStock && (
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                              isHighlighted
                                ? "bg-rose-950 text-rose-200 border border-rose-800"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            Out
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs shrink-0 ml-3 ${
                          isHighlighted ? "text-slate-300" : "text-slate-500 font-medium"
                        }`}
                      >
                        {p.companyName || "Generic"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Busy FMCG Sales Voucher Ledger Grid (Image 2 Style) */}
          <div className="flex-1 overflow-y-auto bg-white border border-slate-300 m-2 rounded-xl shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#e9edf5] border-b-2 border-slate-300 text-[11px] font-black uppercase text-slate-800 tracking-wider sticky top-0 z-10 shadow-xs">
                    <th className="py-2 px-2.5 w-12 text-center border-r border-slate-300">S.N.</th>
                    <th className="py-2 px-3 min-w-[260px] border-r border-slate-300">Item Description</th>
                    <th className="py-2 px-2 w-24 text-center border-r border-slate-300">Qty</th>
                    <th className="py-2 px-2 w-28 text-center border-r border-slate-300">Unit</th>
                    <th className="py-2 px-2 w-28 text-right border-r border-slate-300">List Price (MRP)</th>
                    <th className="py-2 px-2 w-32 text-right border-r border-slate-300">Rate (₹)</th>
                    <th className="py-2 px-2 w-24 text-center border-r border-slate-300">Disc %</th>
                    <th className="py-2 px-3 w-36 text-right border-r border-slate-300">Amount (₹)</th>
                    <th className="py-2 px-2 w-10 text-center">✕</th>
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
                    const defaultRatePaise = line.unit === "Carton" || line.unit === "Bag"
                      ? resolved.unitPricePaise * packSize
                      : line.unit === "Dozen"
                      ? resolved.unitPricePaise * 12
                      : resolved.unitPricePaise;

                    const ratePerUnitPaise = line.customRatePaise != null
                      ? line.customRatePaise
                      : defaultRatePaise;

                    const baseMrp = (line.product.mrpPaise && line.product.mrpPaise > 0)
                      ? line.product.mrpPaise
                      : (ratePerUnitPaise > 0 ? (line.unit === "Carton" || line.unit === "Bag" ? Math.round(ratePerUnitPaise / packSize) : line.unit === "Dozen" ? Math.round(ratePerUnitPaise / 12) : ratePerUnitPaise) : 0);

                    const mrpPerUnitPaise = line.unit === "Carton" || line.unit === "Bag" ? baseMrp * packSize : line.unit === "Dozen" ? baseMrp * 12 : baseMrp;

                    const lineDiscountMultiplier = 1 - (line.lineDiscountPercent || 0) / 100;
                    const lineAmountPaise = Math.round(line.qty * ratePerUnitPaise * lineDiscountMultiplier);

                    // Stock calculation (Carton/Bag checks Godown stock, Pcs/Dozen checks Shop counter stock)
                    const isCarton = line.unit === "Carton" || line.unit === "Bag";
                    const requestedPieces = line.unit === "Carton" || line.unit === "Bag" ? line.qty * packSize : line.unit === "Dozen" ? line.qty * 12 : line.qty;
                    const availablePieces = isCarton ? (line.product.godownStockQty ?? 0) : (line.product.shopStockQty ?? 0);
                    const availableCartons = line.product.godownCartons ?? Math.floor((line.product.godownStockQty ?? 0) / packSize);
                    const isStockSufficient = isCarton
                      ? (line.qty <= availableCartons || requestedPieces <= availablePieces)
                      : (requestedPieces <= availablePieces);
                    const shortagePieces = Math.max(0, requestedPieces - availablePieces);
                    const shortageCartons = Math.max(0, line.qty - availableCartons);
                    const maxCartons = isCarton ? availableCartons : Math.floor(availablePieces / packSize);

                    // Discount % calculation from MRP
                    const effectiveDiscountPercent = mrpPerUnitPaise > 0 && ratePerUnitPaise < mrpPerUnitPaise
                      ? Math.round(((mrpPerUnitPaise - ratePerUnitPaise) / mrpPerUnitPaise) * 10000) / 100
                      : 0;

                    return (
                      <tr
                        key={line.id}
                        data-line-id={line.id}
                        onClick={() => setHighlightedProductId(line.productId)}
                        className={`transition-all cursor-pointer ${
                          !isStockSufficient
                            ? "bg-rose-50/70 hover:bg-rose-100/60 border-l-4 border-l-rose-500"
                            : isSelected
                            ? "bg-amber-50/70 hover:bg-amber-100/50 border-l-4 border-l-amber-500 font-medium"
                            : "hover:bg-slate-50/80"
                        }`}
                      >
                        <td className="py-3 px-3 text-center text-slate-400 font-mono text-xs font-bold">
                          {index + 1}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {line.product.name} {line.product.weight || (line.product.weightValue ? `${line.product.weightValue}${line.product.weightUnit || "g"}` : "")}
                            </span>
                            {!isStockSufficient && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                Low Stock ({isCarton ? `${availableCartons} ctn` : `${line.product.shopStockQty ?? 0} pcs`})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Qty Input (Large & Clear) */}
                        <td className="py-3 px-2 text-center">
                          <input
                            data-pos-field="qty"
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => updateLineQty(line.id, parseInt(e.target.value, 10) || 1)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const row = (e.target as HTMLElement).closest("tr");
                                const unitSelect = row?.querySelector<HTMLSelectElement>("select[data-pos-field='unit']");
                                if (unitSelect) {
                                  unitSelect.focus();
                                } else {
                                  const rateInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='rate']");
                                  if (rateInput) {
                                    rateInput.focus();
                                    rateInput.select();
                                  } else {
                                    itemSearchInputRef.current?.focus();
                                    itemSearchInputRef.current?.select();
                                  }
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                itemSearchInputRef.current?.focus();
                                itemSearchInputRef.current?.select();
                              }
                            }}
                            className="w-20 px-2 py-1.5 text-center font-black text-base sm:text-lg bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] focus:border-[#12355B] shadow-xs"
                          />
                        </td>

                        {/* Unit Selector */}
                        <td className="py-3 px-2 text-center">
                          <select
                            data-pos-field="unit"
                            value={line.unit}
                            onChange={(e) => updateLineUnit(line.id, e.target.value as "Pcs" | "Carton" | "Dozen" | "Bag")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const row = (e.target as HTMLElement).closest("tr");
                                const rateInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='rate']");
                                if (rateInput) {
                                  rateInput.focus();
                                  rateInput.select();
                                } else {
                                  itemSearchInputRef.current?.focus();
                                  itemSearchInputRef.current?.select();
                                }
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                itemSearchInputRef.current?.focus();
                                itemSearchInputRef.current?.select();
                              }
                            }}
                            className="w-32 px-2 py-1.5 text-sm sm:text-base font-bold bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] cursor-pointer"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Carton">Carton (Crt)</option>
                            <option value="Dozen">Dozen (12)</option>
                            <option value="Bag">Bag (Beg)</option>
                          </select>
                        </td>

                        {/* MRP (Editable Input from Owner's Handwritten Note) */}
                        <td className="py-3 px-2 text-right">
                          <div className="flex flex-col items-end">
                            <div className="relative inline-flex items-center justify-end w-28">
                              <span className="absolute left-2 text-slate-400 font-mono text-xs pointer-events-none font-bold">₹</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  line.customMrpInput !== undefined
                                    ? line.customMrpInput
                                    : mrpPerUnitPaise > 0
                                    ? (mrpPerUnitPaise / 100).toFixed(2)
                                    : ""
                                }
                                placeholder="0.00"
                                onChange={(e) => updateLineMrp(line.id, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                data-pos-field="mrp"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    const row = (e.target as HTMLElement).closest("tr");
                                    const rateInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='rate']");
                                    if (rateInput) {
                                      rateInput.focus();
                                      rateInput.select();
                                    }
                                  } else if (e.key === "Escape") {
                                    e.preventDefault();
                                    itemSearchInputRef.current?.focus();
                                    itemSearchInputRef.current?.select();
                                  }
                                }}
                                title="Editable Line MRP"
                                className="w-full pl-5 pr-2 py-1.5 text-right font-mono font-bold text-sm sm:text-base rounded-lg border-2 border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                            {isAdmin && (
                              <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={Boolean(line.updateMasterMrp)}
                                  onChange={() => toggleUpdateMasterMrp(line.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                />
                                <span>Master</span>
                              </label>
                            )}
                          </div>
                        </td>

                        {/* Rate (Editable Busy-Style Input) */}
                        <td className="py-3 px-2 text-right">
                          <div className="relative inline-flex items-center justify-end w-32">
                            <span className="absolute left-2.5 text-slate-400 font-mono text-sm pointer-events-none font-bold">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.customRateInput !== undefined ? line.customRateInput : (ratePerUnitPaise > 0 ? (ratePerUnitPaise / 100).toFixed(2) : "")}
                              placeholder="0.00"
                              onChange={(e) => updateLineRate(line.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              data-pos-field="rate"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const row = (e.target as HTMLElement).closest("tr");
                                  const discInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='disc']");
                                  if (discInput) {
                                    discInput.focus();
                                    discInput.select();
                                  } else {
                                    itemSearchInputRef.current?.focus();
                                    itemSearchInputRef.current?.select();
                                  }
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  itemSearchInputRef.current?.focus();
                                  itemSearchInputRef.current?.select();
                                }
                              }}
                              title="Type here to change selling rate manually"
                              className={`w-full pl-6 pr-2.5 py-1.5 text-right font-mono font-black text-sm sm:text-base rounded-lg border-2 transition-all ${
                                ratePerUnitPaise <= 0
                                  ? "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-300 focus:ring-amber-500"
                                  : line.isCustomRate
                                  ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 focus:ring-emerald-500"
                                  : "border-slate-300 bg-white text-slate-900 focus:ring-[#12355B]"
                              }`}
                            />
                          </div>
                        </td>

                        {/* Disc % (Synchronized with Rate & MRP) */}
                        <td className="py-3 px-2 text-center">
                          <div className="relative inline-flex items-center justify-center w-22">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={
                                line.customDiscInput !== undefined
                                  ? line.customDiscInput
                                  : effectiveDiscountPercent > 0
                                  ? effectiveDiscountPercent.toFixed(1)
                                  : "0"
                              }
                              placeholder="0"
                              onChange={(e) => updateLineDiscountPercent(line.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              data-pos-field="disc"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                  // Row complete! Jump back to Item Search for next product
                                  itemSearchInputRef.current?.focus();
                                  itemSearchInputRef.current?.select();
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  itemSearchInputRef.current?.focus();
                                  itemSearchInputRef.current?.select();
                                }
                              }}
                              title="Discount % off MRP. Changing this automatically calculates selling rate."
                              className="w-full px-2 py-1.5 text-center font-mono font-black text-sm sm:text-base rounded-lg border-2 border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-[#12355B]"
                            />
                            <span className="absolute right-2 text-slate-400 font-bold text-xs pointer-events-none">%</span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right">
                          <span className="font-mono font-black text-base sm:text-lg text-[#12355B]">
                            ₹{(lineAmountPaise / 100).toFixed(2)}
                          </span>
                        </td>

                        {/* Delete Line */}
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLine(line.id);
                            }}
                            title="Remove line (F9)"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Empty Spreadsheet Rows for Classic Busy ERP Look (Image 2) */}
                  {activeTab.cart.length === 0 && (
                    <tr className="h-10 bg-blue-50/20 border-b border-slate-200">
                      <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-200 font-bold">1</td>
                      <td colSpan={8} className="px-4 text-xs font-semibold text-slate-500">
                        👉 Press <strong className="font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs">[Ctrl+K / F1]</strong> or type above to add items to bill...
                      </td>
                    </tr>
                  )}
                  {Array.from({ length: Math.max(0, 10 - Math.max(1, activeTab.cart.length)) }).map((_, emptyIdx) => {
                    const rowNum = Math.max(1, activeTab.cart.length) + emptyIdx + 1;
                    return (
                      <tr key={`empty-row-${rowNum}`} className="h-9 hover:bg-slate-50/40 border-b border-slate-200/80">
                        <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-200 font-bold">{rowNum}</td>
                        <td className="border-r border-slate-200 px-3"></td>
                        <td className="border-r border-slate-200"></td>
                        <td className="border-r border-slate-200"></td>
                        <td className="border-r border-slate-200"></td>
                        <td className="border-r border-slate-200"></td>
                        <td className="border-r border-slate-200"></td>
                        <td className="border-r border-slate-200"></td>
                        <td></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>

          {/* Status Line Under Grid (Part C Busy Style) */}
          <div className="px-3.5 py-2 bg-slate-200 border-t border-slate-300 text-xs font-mono font-medium text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            {highlightedProduct ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900">
                  {highlightedProduct.name} {highlightedProduct.weight || (highlightedProduct.weightValue ? `${highlightedProduct.weightValue}${highlightedProduct.weightUnit || "g"}` : "")}:
                </span>
                <span>Shop: <strong className="font-bold text-emerald-800">{highlightedProduct.shopStockQty} pcs</strong></span>
                <span>|</span>
                <span>Godown: <strong className="font-bold text-slate-900">{highlightedProduct.godownCartons} ctn</strong> ({highlightedProduct.godownStockQty} pcs)</span>
                <span>|</span>
                <span>Pack: <strong className="font-bold text-slate-800">{highlightedProduct.packSize}</strong></span>
                <span>|</span>
                <span>
                  Last rate: <strong className="font-bold text-blue-900">
                    {lastItemPurchase ? `₹${(lastItemPurchase.ratePaise / 100).toFixed(2)}` : `₹${((highlightedProduct.priceAPaise || highlightedProduct.mrpPaise || 0) / 100).toFixed(2)}`}
                  </strong>
                </span>
              </div>
            ) : (
              <span className="text-slate-500 italic">Select or highlight an item to view live stock &amp; rate. Press [F8] for full diagnostics.</span>
            )}
            <div className="flex items-center gap-2 shrink-0">
              {highlightedProduct && (
                <button
                  type="button"
                  onClick={() => setIsItemInfoOpen(true)}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs"
                  title="Open full item specifications [F8]"
                >
                  <span>[F8 Info]</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Right Pane: Totals, Order Discount, Tender & Finalize (Modern Enterprise Style) */}
        <aside className="w-full lg:w-96 bg-white flex flex-col justify-between p-4 space-y-4 shrink-0 shadow-md border-l border-slate-200 overflow-y-auto">
          <div className="space-y-4">
            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs flex items-start justify-between gap-2 shadow-xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-xs font-black text-rose-600 hover:text-rose-900 p-0.5">✕</button>
              </div>
            )}

            {/* Order Discount % */}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <label className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                <span>Order Discount %:</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activeTab.orderDiscountPercent}
                  onChange={(e) => updateActiveTab({ orderDiscountPercent: e.target.value })}
                  className="w-20 px-2 py-1 text-right font-black text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B]"
                />
                <span className="text-slate-500 font-bold text-xs">%</span>
              </div>
            </div>

            {/* Totals Financial Breakdown */}
            <div className="space-y-2 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Subtotal (MRP):</span>
                <span className="font-mono font-bold text-slate-800">₹{(subtotalMrpPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Total Savings / Discount:</span>
                <span className="font-mono text-emerald-700">-₹{(totalDiscountPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Taxable Value:</span>
                <span className="font-mono font-bold text-slate-800">₹{(taxablePaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>CGST / SGST:</span>
                <span className="font-mono font-bold text-slate-800">₹{((cgstPaise + sgstPaise) / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Round-off:</span>
                <span className="font-mono font-bold">
                  {roundoffPaise >= 0 ? `+₹${(roundoffPaise / 100).toFixed(2)}` : `-₹${(Math.abs(roundoffPaise) / 100).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Grand Total Hero Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#0C2340] to-[#12355B] text-white shadow-lg space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Grand Total</span>
                <span className="text-3xl sm:text-4xl font-black font-mono text-[#F4B41A] tracking-tight">
                  ₹{(totalAmountPaise / 100).toFixed(2)}
                </span>
              </div>
              {amountInWords && (
                <p className="text-[11px] text-slate-300/90 italic pt-1 border-t border-white/10 leading-snug">
                  {amountInWords}
                </p>
              )}
            </div>

            {/* Payment Mode Selector */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 block uppercase tracking-wide">
                Payment Tender Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CASH })}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black flex flex-col items-center gap-1 border-2 transition-all ${
                    activeTab.paymentMode === PaymentMode.CASH
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.UPI })}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black flex flex-col items-center gap-1 border-2 transition-all ${
                    activeTab.paymentMode === PaymentMode.UPI
                      ? "bg-sky-600 text-white border-sky-600 shadow-md scale-[1.02]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CREDIT })}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black flex flex-col items-center gap-1 border-2 transition-all ${
                    activeTab.paymentMode === PaymentMode.CREDIT
                      ? "bg-amber-600 text-white border-amber-600 shadow-md scale-[1.02]"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Payment Status (Cash and UPI only) */}
            {(activeTab.paymentMode === PaymentMode.CASH || activeTab.paymentMode === PaymentMode.UPI) && (
              <div className="space-y-1 pt-1">
                <label className="text-xs font-bold text-slate-700">Payment Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateActiveTab({ paymentCollected: true })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      activeTab.paymentCollected !== false
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>✓ Payment Done</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateActiveTab({ paymentCollected: false })}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      activeTab.paymentCollected === false
                        ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span>⏳ Payment Pending</span>
                  </button>
                </div>
                {activeTab.paymentCollected === false && (
                  <p className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-1.5 font-medium">
                    Customer Name and Mobile are mandatory when Payment Pending is selected.
                  </p>
                )}
              </div>
            )}

            {/* Bill Date Selector (Admin Only) */}
            {isAdmin && (
              <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 space-y-1.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-amber-950 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-700" />
                    <span>Bill Date (Admin Only)</span>
                  </label>
                  {activeTab.billDate && activeTab.billDate !== todayStr && (
                    <span className="text-[10px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                      Backdated
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    max={todayStr}
                    value={activeTab.billDate || todayStr}
                    onChange={(e) => updateActiveTab({ billDate: e.target.value === todayStr ? undefined : e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-amber-300 rounded-lg font-mono text-slate-900 focus:ring-2 focus:ring-amber-500 font-bold"
                  />
                  {activeTab.billDate && activeTab.billDate !== todayStr && (
                    <button
                      type="button"
                      onClick={() => updateActiveTab({ billDate: undefined })}
                      title="Reset to real-time today"
                      className="px-2 py-1.5 text-[11px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg shadow-xs"
                    >
                      Today
                    </button>
                  )}
                </div>
                {activeTab.billDate && activeTab.billDate !== todayStr ? (
                  <p className="text-[10px] text-amber-900 font-semibold">
                    Invoice will be sealed on: <strong>{activeTab.billDate}</strong>
                  </p>
                ) : (
                  <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                    <span>🟢 Real-time system date & time will be captured</span>
                  </p>
                )}
              </div>
            )}

            {/* Remarks Input */}
            <div>
              <input
                type="text"
                placeholder="Remarks (vehicle / notes / po)..."
                value={activeTab.remarks}
                onChange={(e) => updateActiveTab({ remarks: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#12355B]"
              />
            </div>
          </div>

          {/* Finalize Action Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {/* Real-time insufficient stock alert indicator right above button */}
            {(() => {
              const insufficientCount = activeTab.cart.filter((c) => {
                const ps = Math.max(1, c.product.packSize);
                const req = c.unit === "Carton" || c.unit === "Bag" ? c.qty * ps : c.unit === "Dozen" ? c.qty * 12 : c.qty;
                if (c.unit === "Carton") {
                  return req > (c.product.godownStockQty ?? 0);
                }
                return req > (c.product.shopStockQty ?? 0);
              }).length;

              if (insufficientCount === 0) return null;

              return (
                <div
                  onClick={() => handleFinalizeBill()}
                  className="p-2.5 bg-rose-50 border-2 border-rose-300 hover:bg-rose-100 rounded-xl cursor-pointer text-xs space-y-1 transition animate-pulse"
                >
                  <div className="flex items-center gap-1.5 font-black text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{insufficientCount} Item(s) Have Insufficient Stock!</span>
                  </div>
                  <p className="text-rose-700 text-[11px]">Click here to review shortage or adjust quantities.</p>
                </div>
              );
            })()}

            <button
              onClick={() => handleFinalizeBill()}
              disabled={activeTab.cart.length === 0 || isFinalizing}
              className="w-full py-4 px-4 rounded-xl font-black text-base bg-[#12355B] hover:bg-[#0E2843] text-white shadow-xl hover:shadow-2xl disabled:opacity-40 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              {isFinalizing ? (
                <span>Finalizing Invoice...</span>
              ) : (
                <>
                  <span>Finalize & Print (F2)</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* 4. Bottom Functional Keys Ribbon (Exact Image 2 Footer) */}
      <footer className="bg-[#0f172a] text-white px-3 py-1.5 flex items-center justify-between text-xs font-mono font-bold shrink-0 border-t border-slate-700">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => handleCloseTab(activeTabId)}
            className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/20 text-slate-200 transition cursor-pointer"
          >
            [Esc - Quit]
          </button>
          <button
            type="button"
            onClick={() => {
              itemSearchInputRef.current?.focus();
              itemSearchInputRef.current?.select();
            }}
            className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/20 text-slate-200 transition cursor-pointer"
          >
            [F1 / Ctrl+K - Search]
          </button>
          <button
            type="button"
            onClick={() => handleFinalizeBill()}
            disabled={activeTab.cart.length === 0 || isFinalizing}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-2.5 py-0.5 rounded border border-emerald-400 text-white transition shadow-xs cursor-pointer"
          >
            [F2 - Done / Print]
          </button>
          <button
            type="button"
            onClick={handleCreateNewTab}
            className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/20 text-slate-200 transition cursor-pointer"
          >
            [F3 - New Bill]
          </button>
          <button
            type="button"
            onClick={handleHoldCurrentBill}
            disabled={activeTab.cart.length === 0}
            className="bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded border border-amber-400/50 text-amber-200 transition cursor-pointer"
          >
            [F4 - Hold Bill]
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab.cart.length > 0) {
                const lastLine = activeTab.cart[activeTab.cart.length - 1];
                addItemToCart(lastLine.product, lastLine.unit, lastLine.qty);
              }
            }}
            disabled={activeTab.cart.length === 0}
            className="bg-slate-700/60 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-500/50 text-slate-200 transition cursor-pointer"
          >
            [F7 - Repeat]
          </button>
          <button
            type="button"
            onClick={() => setIsItemInfoOpen(true)}
            className="bg-blue-900/40 hover:bg-blue-900/60 px-2 py-0.5 rounded border border-blue-400/40 text-blue-200 transition cursor-pointer"
          >
            [F8 - Item Info]
          </button>
          <button
            type="button"
            onClick={handleDeleteHighlightedOrLastLine}
            disabled={activeTab.cart.length === 0}
            className="bg-rose-900/40 hover:bg-rose-900/60 px-2 py-0.5 rounded border border-rose-400/40 text-rose-200 transition cursor-pointer"
          >
            [F9 - Delete Line]
          </button>
        </div>
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-sans text-slate-300">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Connected: <strong>{locationName}</strong></span>
          </span>
          <span>Cashier: <strong className="text-white">{cashierName}</strong></span>
        </div>
      </footer>

      {/* Item Info Diagnostics Modal [F8] */}
      <ItemInfoModal
        isOpen={isItemInfoOpen}
        onClose={() => setIsItemInfoOpen(false)}
        product={highlightedProduct}
        lastPartyRatePaise={lastItemPurchase?.ratePaise}
        partyName={selectedParty?.name}
      />

      {/* Save Voucher Confirmation Dialog [F2] */}
      <SaveVoucherDialog
        isOpen={isSaveConfirmOpen}
        onConfirm={() => {
          setIsSaveConfirmOpen(false);
          handleFinalizeBill();
        }}
        onCancel={() => setIsSaveConfirmOpen(false)}
        partyName={selectedParty ? selectedParty.name : (activeTab.walkInName || "Counter Sale")}
        itemsCount={activeTab.cart.length}
        totalQtyPcs={activeTab.cart.reduce((sum, item) => sum + (item.unit === "Carton" ? item.qty * Math.max(1, item.product.packSize) : item.qty), 0)}
        totalAmountPaise={totalAmountPaise}
        paymentMode={activeTab.paymentMode}
        isSaving={isFinalizing}
      />

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
                        href={`/shop/invoices/${inv.id}/print`}
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
                href={`/shop/invoices/${finalizedInvoice.id}/print`}
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

      {/* Insufficient Stock Detailed Dialog Modal */}
      {stockAlertInfo && stockAlertInfo.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white border-2 border-rose-300 rounded-3xl p-6 max-w-xl w-full space-y-5 shadow-2xl text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-rose-900">Insufficient Stock Alert</h3>
                  <p className="text-xs text-rose-700">The following item(s) cannot be fulfilled from current Shop stock:</p>
                </div>
              </div>
              <button
                onClick={() => setStockAlertInfo(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {stockAlertInfo.allInsufficient.map((item, idx) => {
                const deficit = item.requestedPcs - item.availableShopPcs;
                const cartLine = activeTab.cart.find((c) => c.id === item.lineId);

                return (
                  <div
                    key={item.lineId || idx}
                    className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-black text-sm text-slate-900">{item.productName}</h4>
                        <span className="font-mono text-xs text-slate-500">{item.shortCode}</span>
                      </div>
                      <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300">
                        Short by {deficit} pcs
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-rose-100">
                      <div>
                        <span className="text-slate-500 block">Available in Shop:</span>
                        <strong className="text-slate-900 font-mono text-sm">{item.availableShopPcs} pcs</strong>
                        {item.availableGodownCtn > 0 && (
                          <span className="text-[11px] text-slate-500 block">Godown: {item.availableGodownCtn} ctn</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-500 block">Requested in Bill:</span>
                        <strong className="text-rose-700 font-mono text-sm">{item.requestedPcs} pcs</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {cartLine && (
                        <button
                          type="button"
                          onClick={() => handleSetQtyToAvailable(cartLine)}
                          className="px-3 py-1.5 text-xs font-extrabold bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
                        >
                          Set to Available ({item.availableShopPcs} pcs)
                        </button>
                      )}
                      {cartLine && (
                        <button
                          type="button"
                          onClick={() => {
                            setStockAlertInfo(null);
                            openQuickStockModal(cartLine.product, deficit);
                          }}
                          className="px-3 py-1.5 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition"
                        >
                          + Quick Add Stock
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAdjustAllToAvailable}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition"
              >
                Set All Items to Available Stock
              </button>
              <button
                type="button"
                onClick={() => setStockAlertInfo(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Close / Edit Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Stock Modal (Counter Replenishment) */}
      {quickStockModal.isOpen && quickStockModal.product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl text-slate-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">Add Counter Stock</h3>
                  <p className="text-xs text-slate-500 font-mono">{quickStockModal.product.shortCode}</p>
                </div>
              </div>
              <button
                onClick={() => setQuickStockModal({ isOpen: false, product: null, addQty: "", unit: "Pcs", isLoading: false })}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <p className="font-extrabold text-sm text-slate-900">{quickStockModal.product.name}</p>
              <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                <span>Current Shop Stock: <strong>{quickStockModal.product.shopStockQty} pcs</strong></span>
                <span>Godown: <strong>{quickStockModal.product.godownCartons} ctn</strong></span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="font-bold text-xs text-slate-700 block mb-1">Stock Quantity to Add:</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    autoFocus
                    placeholder="Enter quantity..."
                    value={quickStockModal.addQty}
                    onChange={(e) => setQuickStockModal({ ...quickStockModal, addQty: e.target.value })}
                    className="flex-1 px-3 py-2 text-base font-black border-2 border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                  />
                  <select
                    value={quickStockModal.unit}
                    onChange={(e) => setQuickStockModal({ ...quickStockModal, unit: e.target.value as any })}
                    className="w-28 px-2 py-2 text-sm font-bold border-2 border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#12355B]"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Carton" disabled={quickStockModal.product.packSize <= 1}>
                      Carton ({quickStockModal.product.packSize} pcs)
                    </option>
                  </select>
                </div>
                {quickStockModal.unit === "Carton" && quickStockModal.product.packSize > 1 && (
                  <p className="text-[11px] text-blue-700 font-bold mt-1">
                    = {parseInt(quickStockModal.addQty || "0", 10) * quickStockModal.product.packSize} pieces will be added to Shop.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setQuickStockModal({ isOpen: false, product: null, addQty: "", unit: "Pcs", isLoading: false })}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteQuickAddStock}
                disabled={quickStockModal.isLoading || !quickStockModal.addQty || parseInt(quickStockModal.addQty, 10) <= 0}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-blue-700 hover:bg-blue-800 text-white shadow-md disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {quickStockModal.isLoading ? (
                  <span>Adding Stock...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Confirm & Add to Shop</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
