"use client";

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
} from "./actions";
import { CreditOverrideModal } from "@/components/billing/credit-override-modal";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { paiseToIndianWords } from "@/lib/number-to-words";

export interface ProductCatalogItem {
  id: string;
  name: string;
  shortCode: string;
  weight?: string | null;
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
  unit: "Pcs" | "Carton";
  lineDiscountPercent: number;
  customRatePaise?: number | null;
  customRateInput?: string;
  customDiscInput?: string;
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
  walkInName?: string;
  walkInMobile?: string;
  walkInAddress?: string;
  paymentCollected?: boolean;
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
          (p.weight && p.weight.toLowerCase().includes(term)) ||
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
        const defaultBaseRate = item.unit === "Carton" ? resolved.unitPricePaise * packSize : resolved.unitPricePaise;
        const baseMrp = (item.product.mrpPaise && item.product.mrpPaise > 0)
          ? item.product.mrpPaise
          : (defaultBaseRate > 0 ? (item.unit === "Carton" ? Math.round(defaultBaseRate / packSize) : defaultBaseRate) : paise);
        const mrpPerUnit = item.unit === "Carton" ? baseMrp * packSize : baseMrp;

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
        const defaultBaseRate = item.unit === "Carton" ? resolved.unitPricePaise * packSize : resolved.unitPricePaise;
        const baseMrp = (item.product.mrpPaise && item.product.mrpPaise > 0)
          ? item.product.mrpPaise
          : (defaultBaseRate > 0 ? (item.unit === "Carton" ? Math.round(defaultBaseRate / packSize) : defaultBaseRate) : 0);
        const mrpPerUnit = item.unit === "Carton" ? baseMrp * packSize : baseMrp;

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
    const availablePcs = line.product.shopStockQty ?? 0;
    if (availablePcs <= 0) {
      removeLine(line.id);
      if (stockAlertInfo?.lineId === line.id) setStockAlertInfo(null);
      return;
    }

    if (line.unit === "Carton") {
      const maxCartons = Math.floor(availablePcs / packSize);
      if (maxCartons >= 1) {
        updateLineQty(line.id, maxCartons);
      } else {
        updateActiveTab({
          cart: activeTab.cart.map((item) =>
            item.id === line.id
              ? {
                  ...item,
                  unit: "Pcs",
                  qty: availablePcs,
                  customRatePaise: item.customRatePaise ? Math.round(item.customRatePaise / packSize) : null,
                  customRateInput: item.customRatePaise ? (Math.round(item.customRatePaise / packSize) / 100).toFixed(2) : "",
                }
              : item
          ),
        });
      }
    } else {
      updateLineQty(line.id, availablePcs);
    }
    if (stockAlertInfo?.lineId === line.id) setStockAlertInfo(null);
  };

  const handleAdjustAllToAvailable = () => {
    if (!stockAlertInfo) return;
    updateActiveTab({
      cart: activeTab.cart.map((line) => {
        const packSize = Math.max(1, line.product.packSize);
        const availablePcs = line.product.shopStockQty ?? 0;
        const requestedPcs = line.unit === "Carton" ? line.qty * packSize : line.qty;

        if (requestedPcs <= availablePcs) return line;

        if (availablePcs <= 0) {
          return null as any;
        }

        if (line.unit === "Carton") {
          const maxCartons = Math.floor(availablePcs / packSize);
          if (maxCartons >= 1) {
            return { ...line, qty: maxCartons };
          } else {
            return {
              ...line,
              unit: "Pcs",
              qty: availablePcs,
              customRatePaise: line.customRatePaise ? Math.round(line.customRatePaise / packSize) : null,
              customRateInput: line.customRatePaise ? (Math.round(line.customRatePaise / packSize) / 100).toFixed(2) : "",
            };
          }
        } else {
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

        // Pre-flight check: Insufficient stock check before finalization
        const insufficientItems = activeTab.cart.filter((c) => {
          const packSize = Math.max(1, c.product.packSize);
          const requestedPcs = c.unit === "Carton" ? c.qty * packSize : c.qty;
          const availablePcs = c.product.shopStockQty ?? 0;
          return requestedPcs > availablePcs;
        });

        if (insufficientItems.length > 0) {
          const first = insufficientItems[0];
          const packSize = Math.max(1, first.product.packSize);
          const requestedPcs = first.unit === "Carton" ? first.qty * packSize : first.qty;
          const availablePcs = first.product.shopStockQty ?? 0;

          setStockAlertInfo({
            isOpen: true,
            productName: first.product.name,
            shortCode: first.product.shortCode,
            productId: first.productId,
            lineId: first.id,
            requestedPcs,
            availableShopPcs: availablePcs,
            availableGodownPcs: first.product.godownStockQty ?? 0,
            availableGodownCtn: first.product.godownCartons ?? 0,
            packSize,
            allInsufficient: insufficientItems.map((item) => {
              const ps = Math.max(1, item.product.packSize);
              return {
                lineId: item.id,
                productId: item.productId,
                productName: item.product.name,
                shortCode: item.product.shortCode,
                requestedPcs: item.unit === "Carton" ? item.qty * ps : item.qty,
                availableShopPcs: item.product.shopStockQty ?? 0,
                availableGodownCtn: item.product.godownCartons ?? 0,
              };
            }),
          });

          setErrorMessage(
            `Insufficient stock for "${first.product.name}": Available in Shop: ${availablePcs} pcs, Requested: ${requestedPcs} pcs (Short by ${requestedPcs - availablePcs} pcs).`
          );
          setHighlightedProductId(first.productId);
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
          customerName: activeTab.partyId ? undefined : activeTab.walkInName?.trim() || undefined,
          customerPhone: activeTab.partyId ? undefined : activeTab.walkInMobile?.trim() || undefined,
          customerAddress: activeTab.partyId ? undefined : activeTab.walkInAddress?.trim() || undefined,
          buyerType: effectiveTier,
          orderDiscountBp,
          items: finalizeItems,
          payments,
          idempotencyKey,
          creditOverride: overrideToUse || undefined,
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
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={itemSearchInputRef}
                type="text"
                placeholder="Search items by name, shortcode, brand (Ctrl+K)... Press Enter to add"
                value={itemSearchTerm}
                onChange={(e) => setItemSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredProducts.length > 0) {
                    e.preventDefault();
                    addItemToCart(filteredProducts[0], "Pcs", 1);
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

            {/* Enhanced Autocomplete Dropdown with Live Stock Badges */}
            {filteredProducts.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl z-40 max-h-80 overflow-y-auto divide-y divide-slate-100">
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

                  const hasShopStock = (p.shopStockQty ?? 0) > 0;

                  return (
                    <div
                      key={p.id}
                      onClick={() => addItemToCart(p, "Pcs", 1)}
                      className="p-3 hover:bg-blue-50/60 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-sm md:text-base text-slate-900 truncate">{p.name}</span>
                          {p.weight && (
                            <span className="text-xs text-amber-900 font-extrabold bg-amber-50 px-2 py-0.5 rounded border border-amber-300 shadow-sm">
                              {p.weight}
                            </span>
                          )}
                          <span className="text-xs text-blue-800 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {p.shortCode}
                          </span>
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-semibold">
                            {p.companyName || "General"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                          <span>Pack: <strong className="text-slate-800">{p.packLabel || `${p.packSize} pcs`}</strong></span>
                          <span>•</span>
                          {/* Live Stock Indicators */}
                          {hasShopStock ? (
                            <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Shop Stock: {p.shopStockQty} pcs
                            </span>
                          ) : (
                            <span className="font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              Shop: Out of Stock (0)
                            </span>
                          )}
                          {p.godownCartons > 0 && (
                            <span className="font-semibold text-slate-500">
                              Godown: {p.godownCartons} ctn
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <div className="text-right">
                          {resolved.unitPricePaise > 0 ? (
                            <>
                              <span className="font-mono font-black text-sm md:text-base text-[#12355B] block">
                                ₹{(resolved.unitPricePaise / 100).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-semibold">per piece</span>
                            </>
                          ) : (
                            <span className="font-black text-xs text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              Set Rate in Bill
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addItemToCart(p, "Carton", 1);
                          }}
                          disabled={p.packSize <= 1}
                          className="px-3 py-1.5 text-xs font-black bg-[#12355B]/10 hover:bg-[#12355B]/20 text-[#12355B] rounded-xl transition disabled:opacity-30"
                        >
                          + 1 Ctn
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addItemToCart(p, "Pcs", 1);
                          }}
                          className="px-3 py-1.5 text-xs font-black bg-[#12355B] hover:bg-[#0E2843] text-white rounded-xl shadow-sm transition"
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
              <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-3">
                <Receipt className="w-16 h-16 text-slate-300 stroke-1" />
                <p className="font-extrabold text-base text-slate-700">No items in current bill</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  Search by item name or code above <strong className="font-mono text-slate-800">[Ctrl+K]</strong> or scan barcode to begin billing.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 border-b-2 border-slate-200 text-xs font-black uppercase text-slate-700 tracking-wider sticky top-0 z-10 shadow-xs backdrop-blur-xs">
                    <th className="py-3 px-3 w-12 text-center">#</th>
                    <th className="py-3 px-3 min-w-[280px]">Item Description</th>
                    <th className="py-3 px-2 w-24 text-center">Qty</th>
                    <th className="py-3 px-2 w-28 text-center">Unit</th>
                    <th className="py-3 px-2 w-28 text-right">MRP</th>
                    <th className="py-3 px-2 w-36 text-right">Rate (₹)</th>
                    <th className="py-3 px-2 w-24 text-center">Disc %</th>
                    <th className="py-3 px-3 w-36 text-right">Amount (₹)</th>
                    <th className="py-3 px-2 w-12 text-center">Del</th>
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

                    // Stock calculation
                    const requestedPieces = line.unit === "Carton" ? line.qty * packSize : line.qty;
                    const availablePieces = line.product.shopStockQty ?? 0;
                    const isStockSufficient = requestedPieces <= availablePieces;
                    const shortagePieces = Math.max(0, requestedPieces - availablePieces);
                    const maxCartons = Math.floor(availablePieces / packSize);

                    // Discount % calculation from MRP
                    const effectiveDiscountPercent = mrpPerUnitPaise > 0 && ratePerUnitPaise < mrpPerUnitPaise
                      ? Math.round(((mrpPerUnitPaise - ratePerUnitPaise) / mrpPerUnitPaise) * 10000) / 100
                      : 0;

                    return (
                      <tr
                        key={line.id}
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

                        <td className="py-3 px-3">
                          {/* 1. Large Bold Product Title */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-slate-900 text-sm sm:text-base leading-snug">
                              {line.product.name}
                            </span>
                            {line.product.weight && (
                              <span className="text-xs text-amber-900 font-extrabold bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                                {line.product.weight}
                              </span>
                            )}
                            {line.isCustomRate && (
                              <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                Manual Rate
                              </span>
                            )}
                            {ratePerUnitPaise <= 0 && (
                              <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full border border-rose-300 animate-pulse">
                                Enter Rate!
                              </span>
                            )}
                          </div>

                          {/* 2. Sub-details: Brand, Code, Pack */}
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-1 flex-wrap">
                            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                              {line.product.companyName || "General"}
                            </span>
                            {line.product.weight && (
                              <span className="font-extrabold bg-amber-50 text-amber-900 px-1.5 py-0.5 rounded border border-amber-300">
                                {line.product.weight}
                              </span>
                            )}
                            <span className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
                              {line.product.shortCode}
                            </span>
                            {line.product.packSize > 1 && (
                              <span>Pack: {line.product.packLabel || `${line.product.packSize} pcs`}</span>
                            )}
                            {(line.product.mrpPaise === 0 || !line.product.priceCPaise || line.isCustomRate) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickSaveProductRate(line);
                                }}
                                title="Permanently save this rate as product price in catalog"
                                className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 transition"
                              >
                                Save to Catalog
                              </button>
                            )}
                          </div>

                          {/* 3. Real-Time Stock Status Badge */}
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            {isStockSufficient ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Shop Stock: <strong className="text-emerald-950 font-black">{availablePieces} pcs</strong></span>
                                {line.product.godownCartons > 0 && (
                                  <span className="text-slate-500 font-normal">| Godown: {line.product.godownCartons} ctn</span>
                                )}
                              </span>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 bg-rose-100 border border-rose-300 text-rose-900 px-2.5 py-0.5 rounded-md text-xs font-bold">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>
                                  Only <strong className="underline text-rose-950 font-black">{availablePieces} pcs</strong> in Shop (Short by {shortagePieces} pcs)!
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSetQtyToAvailable(line);
                                  }}
                                  className="ml-1 text-[11px] font-black text-blue-700 hover:text-blue-900 underline"
                                  title="Adjust quantity to match shop stock"
                                >
                                  Set to {line.unit === "Carton" ? (maxCartons >= 1 ? `${maxCartons} Ctn` : `${availablePieces} Pcs`) : `${availablePieces} Pcs`}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openQuickStockModal(line.product, shortagePieces);
                                  }}
                                  className="ml-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-black shadow-xs"
                                  title="Quick Add counter stock"
                                >
                                  + Add Stock
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Qty Input (Large & Clear) */}
                        <td className="py-3 px-2 text-center">
                          <input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={(e) => updateLineQty(line.id, parseInt(e.target.value, 10) || 1)}
                            className="w-20 px-2 py-1.5 text-center font-black text-base sm:text-lg bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] focus:border-[#12355B] shadow-xs"
                          />
                        </td>

                        {/* Unit Selector (Pcs vs Carton) */}
                        <td className="py-3 px-2 text-center">
                          <select
                            value={line.unit}
                            onChange={(e) => updateLineUnit(line.id, e.target.value as "Pcs" | "Carton")}
                            className="w-24 px-2 py-1.5 text-sm sm:text-base font-bold bg-white border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] cursor-pointer"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Carton" disabled={line.product.packSize <= 1}>
                              Carton
                            </option>
                          </select>
                        </td>

                        {/* MRP with Savings Badge */}
                        <td className="py-3 px-2 text-right">
                          {mrpPerUnitPaise > 0 ? (
                            <div>
                              <div className="font-mono font-bold text-sm sm:text-base text-slate-700">
                                ₹{(mrpPerUnitPaise / 100).toFixed(2)}
                              </div>
                              {effectiveDiscountPercent > 0 && (
                                <div className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 inline-block mt-0.5">
                                  Save ₹{((mrpPerUnitPaise - ratePerUnitPaise) / 100).toFixed(0)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No MRP</span>
                          )}
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
                </tbody>
              </table>
            )}
          </div>

          {/* Under-Grid Stock & Customer Last Purchase Indicator */}
          <div className="p-3 bg-slate-100 border-t border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            {highlightedProduct ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-extrabold text-slate-900 text-sm">{highlightedProduct.name}:</span>
                <span className="text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">
                  Shop Stock: <strong className="text-emerald-700 font-black">{highlightedProduct.shopStockQty} pcs</strong>
                </span>
                <span className="text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold">
                  Godown: <strong className="text-slate-900 font-black">{highlightedProduct.godownCartons} ctn</strong> ({highlightedProduct.godownStockQty} pcs)
                </span>
                <button
                  type="button"
                  onClick={() => openQuickStockModal(highlightedProduct)}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs inline-flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3 h-3" />
                  Add Stock
                </button>
              </div>
            ) : (
              <span className="text-slate-500 italic">Select an item above to view real-time shop and warehouse stock.</span>
            )}

            {/* Last purchase for selected party */}
            {selectedParty && lastItemPurchase ? (
              <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Last bought: {lastItemPurchase.date ? new Date(lastItemPurchase.date).toLocaleDateString("en-IN") : "Earlier"} @ ₹{(lastItemPurchase.ratePaise / 100).toFixed(2)} ({lastItemPurchase.invoiceNumber})
              </div>
            ) : selectedParty && highlightedProduct ? (
              <div className="text-xs text-slate-500 italic">No prior purchases for this customer.</div>
            ) : null}
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
                const req = c.unit === "Carton" ? c.qty * ps : c.qty;
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
