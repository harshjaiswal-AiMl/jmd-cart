"use client";
import { BillMessagingCard } from "@/components/billing/bill-messaging-card";

import { categorizeWeightBand, STANDARD_WEIGHT_BANDS, WeightBand } from "@/lib/weight";
import { FontSizeToggle } from "@/components/common/font-size-provider";

import React, { useState, useTransition, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Edit3,
} from "lucide-react";

import { OrderPriceResult } from "@/modules/pricing/pricing.types";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import {
  calculateOrderPricingAction,
  finalizeBillAction,
  checkPartyCreditStatusAction,
  setAdminManualRateAction,
  saveProductPriceAction,
  updateProductMasterFromPosAction,
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
import { PartySearchBox } from "@/components/pos/PartySearchBox";
import { PartySearchModal } from "@/components/pos/PartySearchModal";
import { SaveVoucherDialog, type DialogPaymentMode, type PrintPaperFormat } from "@/components/pos/SaveVoucherDialog";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import type { BusinessDetails, PosOperationalSettings } from "@/modules/settings/settings.types";
import { QuickAddProductModal } from "@/components/pos/QuickAddProductModal";
import { EditProductMasterModal } from "@/components/pos/EditProductMasterModal";
import { StockCorrectionModal } from "@/components/pos/StockCorrectionModal";
import { PosTodaySalesModal } from "@/components/pos/PosTodaySalesModal";
import { RevisionHistoryModal } from "@/components/pos/RevisionHistoryModal";
import { saveInvoiceRevisionAction } from "./actions";
import { cancelInvoiceAction } from "../invoices/actions";
import { toIstDateString } from "@/lib/datetime";
import { SearchIndexItem, buildProductSearchIndex, searchItems, splitHighlightSegments } from "@/lib/search/smart-search";

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
  gstin?: string | null;
  creditDays?: number;
  creditEnabled: boolean;
  creditLimitPaise: number;
  currentOutstandingPaise: number;
}

// Helper to get tier unit price per piece (with standard % discount fallback if explicit price A/B is unset)
export function getTierUnitPrice(
  product: { mrpPaise?: number | null; priceAPaise?: number | null; priceBPaise?: number | null; priceCPaise?: number | null },
  targetTier: "WHOLESALER" | "RETAILER" | "CUSTOMER",
  customMrpPaise?: number | null
): number {
  const effectiveBaseMrp = (customMrpPaise != null && customMrpPaise > 0)
    ? customMrpPaise
    : (product.mrpPaise && product.mrpPaise > 0 ? product.mrpPaise : 0);

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
      return effectiveBaseMrp; // Tier C = MRP / list C
    }
  }
  return effectiveBaseMrp;
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
  customAmountInput?: string;
  customNameInput?: string;
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
  paymentMode: PaymentMode | "SPLIT";
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
  documentType?: "RETAIL" | "GST";
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
  categories?: Array<{ id: string; name: string }>;
  parties: PartyItem[];
  nextInvoicePreview?: string;
  initialEditInvoice?: any;
  posSettings?: PosOperationalSettings;
  businessDetails?: BusinessDetails;
  initialStartNewBill?: boolean;
  canDeleteBill?: boolean;
  canVoidInvoice?: boolean;
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
  categories = [],
  parties,
  nextInvoicePreview,
  initialEditInvoice,
  posSettings,
  businessDetails,
  initialStartNewBill = false,
  canDeleteBill = false,
  canVoidInvoice = false,
}: PosClientProps) {
  const effectivePosSettings: PosOperationalSettings = {
    showFinalizedModal: posSettings?.showFinalizedModal ?? false,
    askPartyOnNewBill: posSettings?.askPartyOnNewBill ?? true,
    quickFinish: posSettings?.quickFinish ?? false,
    managerCanDelete: posSettings?.managerCanDelete ?? false,
    creditAllParties: posSettings?.creditAllParties ?? true,
  };
  const router = useRouter();
  // Admin check for backdated billing
  const isAdmin = cashierRole === "SUPER_ADMIN" || cashierRole === "ADMIN";
  const isPrivilegedDateUser = isAdmin || cashierRole === "ACCOUNTS";
  const isEditMode = Boolean(initialEditInvoice);
  const [isEditPartyLocked, setIsEditPartyLocked] = useState<boolean>(Boolean(initialEditInvoice));
  const [editReason, setEditReason] = useState("");
  const [showRevisionHistory, setShowRevisionHistory] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [editProductModal, setEditProductModal] = useState<{
    isOpen: boolean;
    product: ProductCatalogItem | null;
  }>({
    isOpen: false,
    product: null,
  });
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lastUsedPaymentMode, setLastUsedPaymentMode] = useState<DialogPaymentMode>("CASH");
  const [isPartyPopupOpen, setIsPartyPopupOpen] = useState(false);
  const [partyPopupReason, setPartyPopupReason] = useState<"alt_p" | "new_bill">("alt_p");
  const printIframeRef = useRef<HTMLIFrameElement>(null);
  const [lastPrintedInvoice, setLastPrintedInvoice] = useState<{ fullInvoice: any; format: PrintPaperFormat } | null>(null);
  const [printFallbackToast, setPrintFallbackToast] = useState<{ invoice: any; format: PrintPaperFormat; number: string } | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [voidEditModalOpen, setVoidEditModalOpen] = useState(false);
  const [voidEditReason, setVoidEditReason] = useState("");
  const [voidEditError, setVoidEditError] = useState<string | null>(null);
  const [isVoidingEdit, setIsVoidingEdit] = useState(false);
  const [counterDetailsOpen, setCounterDetailsOpen] = useState(false);
  const [counterDetailsSaveParty, setCounterDetailsSaveParty] = useState(false);
  const [showTodaySalesModal, setShowTodaySalesModal] = useState(false);
  const [shortStockCorrection, setShortStockCorrection] = useState<{
    productId: string;
    productName: string;
    currentStock: number;
    neededStock: number;
  } | null>(null);

  const [liveProducts, setLiveProducts] = useState<ProductCatalogItem[]>(products);

  const maxFutureDateStr = useMemo(() => {
    try {
      const d = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    }
  }, []);
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

  // Line MRP editing & bidirectional sync with Rate & Disc %
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

        let newRatePaise: number;
        let newDisc: number;

        if (item.lineDiscountPercent && item.lineDiscountPercent > 0) {
          // Disc% active: keep Disc%, recalculate Rate from new MRP
          newRatePaise = Math.round(paise * (1 - item.lineDiscountPercent / 100));
          newDisc = item.lineDiscountPercent;
        } else if (item.customRatePaise != null && item.customRatePaise > 0) {
          // Rate was entered: recalculate Disc%
          if (paise > item.customRatePaise) {
            newRatePaise = item.customRatePaise;
            newDisc = Math.round(((paise - newRatePaise) / paise) * 10000) / 100;
          } else {
            newRatePaise = paise;
            newDisc = 0;
          }
        } else {
          newRatePaise = paise;
          newDisc = 0;
        }

        return {
          ...item,
          customMrpInput: value,
          customMrpPaise: pieceMrp,
          customRatePaise: newRatePaise,
          customRateInput: (newRatePaise / 100).toFixed(2),
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : "0",
          lineDiscountPercent: newDisc,
        };
      }),
    });
  };


  const updateLineAmount = (lineId: string, value: string) => {
    const valNum = parseFloat(value);
    const totalPaise = !isNaN(valNum) && valNum >= 0 ? Math.round(valNum * 100) : 0;

    updateActiveTab({
      cart: activeTab.cart.map((item) => {
        if (item.id !== lineId) return item;
        const packSize = Math.max(1, item.product.packSize);
        const bagSize = (item.product as any).bagSize || packSize;
        const mult = item.unit === "Carton" ? packSize : item.unit === "Bag" ? bagSize : item.unit === "Dozen" ? 12 : 1;

        const effectiveBaseMrp = (item.customMrpPaise != null && item.customMrpPaise > 0)
          ? item.customMrpPaise
          : (item.product.mrpPaise && item.product.mrpPaise > 0 ? item.product.mrpPaise : 0);
        let mrpPerUnit = effectiveBaseMrp * mult;

        const newRatePaise = item.qty > 0 ? Math.round(totalPaise / item.qty) : totalPaise;

        let updatedPieceMrp = item.customMrpPaise;
        let updatedMrpInput = item.customMrpInput;
        if (newRatePaise > mrpPerUnit && mrpPerUnit > 0) {
          mrpPerUnit = newRatePaise;
          updatedPieceMrp = Math.round(newRatePaise / mult);
          updatedMrpInput = (newRatePaise / 100).toFixed(2);
        }

        const newDisc = mrpPerUnit > 0 && newRatePaise < mrpPerUnit
          ? Math.round(((mrpPerUnit - newRatePaise) / mrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...item,
          customAmountInput: value,
          customRateInput: (newRatePaise / 100).toFixed(2),
          customRatePaise: newRatePaise,
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : "0",
          lineDiscountPercent: newDisc,
          customMrpPaise: updatedPieceMrp,
          customMrpInput: updatedMrpInput,
          isCustomRate: true,
        };
      }),
    });
  };

  const updateLineProductName = (lineId: string, value: string) => {
    updateActiveTab({
      cart: activeTab.cart.map((item) =>
        item.id === lineId
          ? {
              ...item,
              customNameInput: value,
            }
          : item
      ),
    });
  };

  const persistProductNameChange = async (lineId: string) => {
    const line = activeTab.cart.find((c) => c.id === lineId);
    if (!line || !line.customNameInput || line.customNameInput.trim() === line.product.name) return;
    const newName = line.customNameInput.trim();
    try {
      await updateProductMasterFromPosAction({
        productId: line.productId,
        name: newName,
      });
      setProductsList((prev) =>
        prev.map((p) => (p.id === line.productId ? { ...p, name: newName } : p))
      );
      updateActiveTab({
        cart: activeTab.cart.map((item) =>
          item.id === lineId
            ? { ...item, product: { ...item.product, name: newName } }
            : item
        ),
      });
    } catch (err) {
      console.error("Failed to update product name in master:", err);
    }
  };

  const persistMrpChange = async (lineId: string) => {
    const line = activeTab.cart.find((c) => c.id === lineId);
    if (!line || line.customMrpPaise == null || line.customMrpPaise <= 0) return;
    try {
      await updateProductMasterFromPosAction({
        productId: line.productId,
        mrpPaise: line.customMrpPaise,
      });
      setProductsList((prev) =>
        prev.map((p) => (p.id === line.productId ? { ...p, mrpPaise: line.customMrpPaise! } : p))
      );
      updateActiveTab({
        cart: activeTab.cart.map((item) =>
          item.id === lineId
            ? { ...item, product: { ...item.product, mrpPaise: line.customMrpPaise! } }
            : item
        ),
      });
    } catch (err) {
      console.error("Failed to update product MRP in master:", err);
    }
  };

    const POS_FIELD_ORDER = ["name", "qty", "unit", "mrp", "rate", "disc", "amount"];

  const isCaretAtStart = (el: HTMLElement): boolean => {
    if (el.tagName !== "INPUT") return true;
    const inp = el as HTMLInputElement;
    try {
      if (inp.selectionStart == null || inp.selectionEnd == null) return true;
      return inp.selectionStart === 0 ||
        (inp.selectionStart === 0 && inp.selectionEnd === inp.value.length);
    } catch {
      return true;
    }
  };

  const isCaretAtEnd = (el: HTMLElement): boolean => {
    if (el.tagName !== "INPUT") return true;
    const inp = el as HTMLInputElement;
    try {
      if (inp.selectionStart == null || inp.selectionEnd == null) return true;
      return inp.selectionEnd >= inp.value.length ||
        (inp.selectionStart === 0 && inp.selectionEnd === inp.value.length);
    } catch {
      return true;
    }
  };

  const handlePosCellKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    currentField: string,
    rowIndex: number,
    lineId: string,
    currentQty?: number
  ) => {
    const currentIdx = POS_FIELD_ORDER.indexOf(currentField);
    const targetEl = e.target as HTMLElement;
    const row = targetEl.closest("tr");

    // 1. Qty Up / Down arrow: Increments or decrements quantity
    if (currentField === "qty") {
      if (e.key === "ArrowUp" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const input = targetEl as HTMLInputElement;
        const val = parseInt(input.value, 10) || currentQty || 1;
        const nextQty = val + 1;
        input.value = String(nextQty);
        updateLineQty(lineId, nextQty);
        input.select();
        return;
      }
      if (e.key === "ArrowDown" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const input = targetEl as HTMLInputElement;
        const val = parseInt(input.value, 10) || currentQty || 1;
        const nextQty = Math.max(1, val - 1);
        input.value = String(nextQty);
        updateLineQty(lineId, nextQty);
        input.select();
        return;
      }
    }

    // 2. Up Arrow (move to same column in previous row)
    if (e.key === "ArrowUp") {
      if (currentField !== "unit") {
        e.preventDefault();
        const prevRow = row?.previousElementSibling;
        if (prevRow) {
          const prevEl = prevRow.querySelector<HTMLElement>(`[data-pos-field="${currentField}"]`);
          if (prevEl) {
            prevEl.focus();
            if ("select" in prevEl && typeof (prevEl as any).select === "function") {
              (prevEl as any).select();
            }
            return;
          }
        } else {
          itemSearchInputRef.current?.focus();
          itemSearchInputRef.current?.select();
          return;
        }
      }
    }

    // 3. Down Arrow (move to same column in next row)
    if (e.key === "ArrowDown") {
      if (currentField !== "unit") {
        e.preventDefault();
        const nextRow = row?.nextElementSibling;
        if (nextRow) {
          const nextEl = nextRow.querySelector<HTMLElement>(`[data-pos-field="${currentField}"]`);
          if (nextEl) {
            nextEl.focus();
            if ("select" in nextEl && typeof (nextEl as any).select === "function") {
              (nextEl as any).select();
            }
            return;
          }
        } else {
          itemSearchInputRef.current?.focus();
          itemSearchInputRef.current?.select();
          return;
        }
      }
    }

    // 4. Right Arrow, Enter, Tab (move forward to next cell)
    if (e.key === "ArrowRight" || e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      const atEnd = e.key === "Enter" || e.key === "Tab" || isCaretAtEnd(targetEl);
      if (atEnd) {
        e.preventDefault();
        if (currentIdx < POS_FIELD_ORDER.length - 1) {
          const nextField = POS_FIELD_ORDER[currentIdx + 1];
          const nextEl = row?.querySelector<HTMLElement>(`[data-pos-field="${nextField}"]`);
          if (nextEl) {
            nextEl.focus();
            if ("select" in nextEl && typeof (nextEl as any).select === "function") {
              (nextEl as any).select();
            }
          }
        } else {
          // Last cell (amount) -> go to next row's name or search input
          const nextRow = row?.nextElementSibling;
          const nextRowName = nextRow?.querySelector<HTMLElement>(`[data-pos-field="name"]`);
          if (nextRowName) {
            nextRowName.focus();
            if ("select" in nextRowName && typeof (nextRowName as any).select === "function") {
              (nextRowName as any).select();
            }
          } else {
            itemSearchInputRef.current?.focus();
            itemSearchInputRef.current?.select();
          }
        }
        return;
      }
    }

    // 5. Left Arrow, Shift+Tab (move backward to previous cell)
    if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) {
      const atStart = (e.key === "Tab" && e.shiftKey) || isCaretAtStart(targetEl);
      if (atStart) {
        e.preventDefault();
        if (currentIdx > 0) {
          const prevField = POS_FIELD_ORDER[currentIdx - 1];
          const prevEl = row?.querySelector<HTMLElement>(`[data-pos-field="${prevField}"]`);
          if (prevEl) {
            prevEl.focus();
            if ("select" in prevEl && typeof (prevEl as any).select === "function") {
              (prevEl as any).select();
            }
          }
        } else {
          // First cell (name) -> move to previous row's amount
          const prevRow = row?.previousElementSibling;
          const prevRowAmount = prevRow?.querySelector<HTMLElement>(`[data-pos-field="amount"]`);
          if (prevRowAmount) {
            prevRowAmount.focus();
            if ("select" in prevRowAmount && typeof (prevRowAmount as any).select === "function") {
              (prevRowAmount as any).select();
            }
          } else {
            itemSearchInputRef.current?.focus();
            itemSearchInputRef.current?.select();
          }
        }
        return;
      }
    }

    // 6. Escape (jump to search bar)
    if (e.key === "Escape") {
      e.preventDefault();
      itemSearchInputRef.current?.focus();
      itemSearchInputRef.current?.select();
      return;
    }
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

  // Autofocus item search input on POS mount / page return (skip when opening directly via New Bill party prompt)
  useEffect(() => {
    if (initialStartNewBill || isPartyPopupOpen) return;
    const timer = setTimeout(() => {
      itemSearchInputRef.current?.focus();
      itemSearchInputRef.current?.select();
    }, 120);
    return () => clearTimeout(timer);
  }, [initialStartNewBill, isPartyPopupOpen]);

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
      documentType: "RETAIL",
      isHeld: false,
      billDate: undefined,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>("tab-1");
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  // Load tabs from localStorage on mount and sanitize against live catalog
  useEffect(() => {
    if (initialEditInvoice) {
      const productMap = new Map(products.map((p) => [p.id, p]));
      const editCart: PosCartLine[] = (initialEditInvoice.items || []).map((it: any, idx: number) => {
        const prod = productMap.get(it.productId) || {
          id: it.productId,
          name: it.product?.name || "Product",
          shortCode: it.product?.shortCode || "P0000",
          weight: it.product?.weight || null,
          packSize: it.product?.packSize || 1,
          packLabel: it.product?.packLabel || "Carton",
          mrpPaise: it.mrpPaise,
          priceCPaise: it.unitPricePaise,
          gstRateBp: it.gstRateBp || 500,
          hsn: it.hsn || "21069099",
          shopStockQty: 0,
          godownStockQty: 0,
          godownCartons: 0,
          godownLoose: 0,
          companyId: null,
          companyName: null,
          categoryId: null,
          categoryName: null,
          priceAPaise: null,
          priceBPaise: null,
          reorderLevel: 0,
        };

        const packSize = Math.max(1, prod.packSize || 1);
        const bagSize = (prod as any).bagSize || packSize;
        const rawUnit = (it.unitLabel || (prod.packLabel === "Carton" ? "Carton" : "Pcs")) as "Pcs" | "Carton" | "Dozen" | "Bag";
        const unit = (rawUnit === "Carton" || rawUnit === "Bag" || rawUnit === "Dozen" || rawUnit === "Pcs") ? rawUnit : "Pcs";
        const mult = unit === "Carton" ? packSize : unit === "Bag" ? bagSize : unit === "Dozen" ? 12 : 1;
        const isPack = mult > 1 && it.qty >= mult && it.qty % mult === 0;
        const lineQty = isPack ? it.qty / mult : it.qty;
        const effectiveUnit = isPack ? unit : (mult > 1 && it.qty < mult ? "Pcs" : unit);
        const effectiveMult = effectiveUnit === "Carton" ? packSize : effectiveUnit === "Bag" ? bagSize : effectiveUnit === "Dozen" ? 12 : 1;

        const ratePerUnitPaise = it.unitPricePaise * effectiveMult;
        const mrpPerUnitPaise = (it.mrpPaise || 0) * effectiveMult;
        const discPercent = (it.discountBp || 0) / 100;

        return {
          id: `edit-line-${idx}-${it.productId}`,
          productId: it.productId,
          product: prod as any,
          qty: lineQty,
          unit: effectiveUnit,
          lineDiscountPercent: discPercent,
          customRatePaise: ratePerUnitPaise,
          customRateInput: (ratePerUnitPaise / 100).toFixed(2),
          isCustomRate: true,
          customMrpPaise: mrpPerUnitPaise > 0 ? (effectiveMult > 1 ? Math.round(mrpPerUnitPaise / effectiveMult) : mrpPerUnitPaise) : it.mrpPaise,
          customMrpInput: ((mrpPerUnitPaise || 0) / 100).toFixed(2),
          customDiscInput: discPercent > 0 ? discPercent.toFixed(1) : "0",
        };
      });

      const editTab: PosBillTab = {
        id: "tab-edit",
        tabTitle: `Edit: ${initialEditInvoice.number}`,
        partyId: initialEditInvoice.partyId || "",
        selectedTierMode: "AUTO",
        cart: editCart,
        orderDiscountPercent: "0",
        paymentMode:
          initialEditInvoice.paymentStatus === "PENDING" ||
          (initialEditInvoice.paymentStatus as string) === "UNPAID"
            ? PaymentMode.CREDIT
            : initialEditInvoice.paymentStatus === "PARTIAL"
            ? ("SPLIT" as any)
            : initialEditInvoice.payments?.find((p: any) => p.mode === "CREDIT")?.mode ||
              initialEditInvoice.payments?.[0]?.mode ||
              PaymentMode.CASH,
        splitCashPaise:
          initialEditInvoice.paymentStatus === "PARTIAL"
            ? (() => {
                const cashP = (initialEditInvoice.payments || [])
                  .filter((p: any) => p.mode === "CASH")
                  .reduce((s: number, p: any) => s + (p.amountPaise || 0), 0);
                return cashP > 0 ? (cashP / 100).toString() : "";
              })()
            : "",
        splitUpiPaise:
          initialEditInvoice.paymentStatus === "PARTIAL"
            ? (() => {
                const upiP = (initialEditInvoice.payments || [])
                  .filter((p: any) => p.mode === "UPI")
                  .reduce((s: number, p: any) => s + (p.amountPaise || 0), 0);
                return upiP > 0 ? (upiP / 100).toString() : "";
              })()
            : "",
        remarks: initialEditInvoice.notes || "",
        documentType: initialEditInvoice.documentType || "RETAIL",
        isHeld: false,
        walkInName: initialEditInvoice.customerName || "",
        walkInMobile: initialEditInvoice.customerPhone || "",
        walkInAddress: initialEditInvoice.customerAddress || "",
        billDate: toIstDateString(initialEditInvoice.invoiceDate || initialEditInvoice.createdAt),
      };

      setTabs([editTab]);
      setActiveTabId("tab-edit");
      setIsStorageLoaded(true);
      return;
    }
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

  // Save tabs to localStorage on change (never overwrite POS tabs during invoice edit mode)
  useEffect(() => {
    if (!isStorageLoaded || isEditMode) return;
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
        documentType: "RETAIL",
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
  const [isPartyCardExpanded, setIsPartyCardExpanded] = useState(false);

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

  // Tier change handler that actively reprices ALL lines to chosen Tier (A/B/C/Auto)
  const handleTierChange = (newTierMode: "AUTO" | "WHOLESALER" | "RETAILER" | "CUSTOMER") => {
    let targetTier: "WHOLESALER" | "RETAILER" | "CUSTOMER";
    if (newTierMode !== "AUTO") {
      targetTier = newTierMode;
    } else {
      if (selectedParty?.type === "WHOLESALER") targetTier = "WHOLESALER";
      else if (selectedParty?.type === "RETAILER") targetTier = "RETAILER";
      else targetTier = "CUSTOMER";
    }

    const tierLetter = targetTier === "WHOLESALER" ? "A" : targetTier === "RETAILER" ? "B" : "C";

    const repricedCart = activeTab.cart.map((line) => {
      const packSize = Math.max(1, line.product.packSize);
      const bagSize = (line.product as any).bagSize || packSize;
      const multiplier = line.unit === "Carton" ? packSize : line.unit === "Bag" ? bagSize : line.unit === "Dozen" ? 12 : 1;

      const unitPricePaise = getTierUnitPrice(line.product, targetTier, line.customMrpPaise);

      const effectiveBaseMrp = (line.customMrpPaise != null && line.customMrpPaise > 0)
        ? line.customMrpPaise
        : (line.product.mrpPaise && line.product.mrpPaise > 0 ? line.product.mrpPaise : unitPricePaise);
      const mrpPerUnit = effectiveBaseMrp * multiplier;

      if (unitPricePaise > 0) {
        const newRatePaise = unitPricePaise * multiplier;
        const newDisc = mrpPerUnit > newRatePaise
          ? Math.round(((mrpPerUnit - newRatePaise) / mrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...line,
          customRatePaise: newRatePaise,
          customRateInput: (newRatePaise / 100).toFixed(2),
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : "0",
          lineDiscountPercent: newDisc,
          isCustomRate: false,
        };
      } else {
        return line;
      }
    });

    updateActiveTab({
      selectedTierMode: newTierMode,
      cart: repricedCart,
    });
    setErrorMessage(null);
  };

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

  // Filter products using Smart Item Search (Weight + MRP + Partial Words)
  const filteredProducts = useMemo(() => {
    if (!itemSearchTerm.trim()) return [];
    return searchItems(itemSearchTerm, searchIndex, { limit: 25 });
  }, [itemSearchTerm, searchIndex]);

  // Dedicated Capture Keyboard Listener for F8 Discard Unsaved Bill Modal
  useEffect(() => {
    if (!discardConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "Escape" || k === "n") {
        e.preventDefault();
        e.stopPropagation();
        setDiscardConfirmOpen(false);
      } else if (e.key === "Enter" || k === "y") {
        e.preventDefault();
        e.stopPropagation();
        setDiscardConfirmOpen(false);
        updateActiveTab({
          cart: [],
          partyId: "",
          orderDiscountPercent: "0",
          remarks: "",
          walkInName: "",
          walkInMobile: "",
          walkInAddress: "",
        });
        setPricingResult(null);
        setToastMsg("Unsaved bill discarded");
        setTimeout(() => setToastMsg(null), 2500);
        setTimeout(() => {
          itemSearchInputRef.current?.focus();
          itemSearchInputRef.current?.select();
        }, 25);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [discardConfirmOpen, updateActiveTab]);

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

  const handleOpenEditProductMaster = (prodToEdit?: ProductCatalogItem | null) => {
    let targetProduct = prodToEdit || null;
    if (!targetProduct) {
      if (typeof document !== "undefined") {
        const activeTr = document.activeElement?.closest("tr[data-line-id]");
        const lineId = activeTr?.getAttribute("data-line-id");
        if (lineId) {
          const cartLine = activeTab.cart.find((c) => c.id === lineId);
          if (cartLine) targetProduct = cartLine.product;
        }
      }
      if (!targetProduct && highlightedProductId) {
        targetProduct = productsList.find((p) => p.id === highlightedProductId) || null;
      }
      if (!targetProduct && filteredProducts.length > 0 && filteredProducts[searchSelectedIndex]) {
        targetProduct = productsList.find((p) => p.id === filteredProducts[searchSelectedIndex].id) || null;
      }
      if (!targetProduct && activeTab.cart.length > 0) {
        targetProduct = activeTab.cart[activeTab.cart.length - 1].product;
      }
    }
    setEditProductModal({
      isOpen: true,
      product: targetProduct || (productsList.length > 0 ? productsList[0] : null),
    });
  };

  const handleProductMasterUpdated = (updatedProduct: any) => {
    // 1. Update in productsList & liveProducts state
    setProductsList((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p))
    );
    setLiveProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p))
    );

    // 2. If this product is in the active bill cart, update the cart line
    const isInCart = activeTab.cart.some((c) => c.productId === updatedProduct.id);
    if (isInCart) {
      const updatedCart = activeTab.cart.map((line) => {
        if (line.productId !== updatedProduct.id) return line;

        const newProduct = { ...line.product, ...updatedProduct };
        const resolved = resolvePrice(
          {
            mrpPaise: newProduct.mrpPaise,
            priceAPaise: newProduct.priceAPaise,
            priceBPaise: newProduct.priceBPaise,
            priceCPaise: newProduct.priceCPaise,
          },
          effectiveTier
        );

        const packSize = Math.max(1, newProduct.packSize);
        const defaultRatePaise =
          line.unit === "Carton" || line.unit === "Bag"
            ? resolved.unitPricePaise * packSize
            : line.unit === "Dozen"
            ? resolved.unitPricePaise * 12
            : resolved.unitPricePaise;

        const baseMrp =
          newProduct.mrpPaise && newProduct.mrpPaise > 0
            ? newProduct.mrpPaise
            : defaultRatePaise;

        const mrpPerUnitPaise =
          line.unit === "Carton" || line.unit === "Bag"
            ? baseMrp * packSize
            : line.unit === "Dozen"
            ? baseMrp * 12
            : baseMrp;

        return {
          ...line,
          product: newProduct,
          mrpPaise: mrpPerUnitPaise,
          customMrpInput: undefined,
          customMrpPaise: undefined,
          ratePaise: defaultRatePaise,
          customRateInput: undefined,
          customRatePaise: undefined,
          isCustomRate: false,
          amountPaise: Math.round(line.qty * defaultRatePaise),
        };
      });

      updateActiveTab({ cart: updatedCart });
    }

    setToastMsg(`Product Master updated: ${updatedProduct.name}`);
    setTimeout(() => setToastMsg(null), 3500);
  };

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
    const packSize = Math.max(1, product.packSize);
    const bagSize = (product as any).bagSize || packSize;
    const multiplier = unit === "Carton" ? packSize : unit === "Bag" ? bagSize : unit === "Dozen" ? 12 : 1;

    const tierUnitPrice = getTierUnitPrice(product, effectiveTier);
    const initialRatePaise = tierUnitPrice * multiplier;
    const baseMrp = (product.mrpPaise && product.mrpPaise > 0) ? product.mrpPaise : tierUnitPrice;
    const initialMrpPerUnit = baseMrp * multiplier;
    const initialDisc = initialMrpPerUnit > initialRatePaise
      ? Math.round(((initialMrpPerUnit - initialRatePaise) / initialMrpPerUnit) * 10000) / 100
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
        lineDiscountPercent: initialDisc,
        customRatePaise: initialRatePaise > 0 ? initialRatePaise : null,
        customRateInput: initialRatePaise > 0 ? (initialRatePaise / 100).toFixed(2) : "",
        customDiscInput: initialDisc > 0 ? initialDisc.toFixed(1) : "0",
        customMrpPaise: product.mrpPaise ?? null,
        customMrpInput: initialMrpPerUnit > 0 ? (initialMrpPerUnit / 100).toFixed(2) : "",
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
        item.id === lineId ? { ...item, qty: newQty, customAmountInput: undefined } : item
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
        const bagSize = (item.product as any).bagSize || packSize;
        const mult = item.unit === "Carton" ? packSize : item.unit === "Bag" ? bagSize : item.unit === "Dozen" ? 12 : 1;

        const effectiveBaseMrp = (item.customMrpPaise != null && item.customMrpPaise > 0)
          ? item.customMrpPaise
          : (item.product.mrpPaise && item.product.mrpPaise > 0 ? item.product.mrpPaise : (paise > 0 ? Math.round(paise / mult) : 0));
        let mrpPerUnit = effectiveBaseMrp * mult;

        let updatedPieceMrp = item.customMrpPaise;
        let updatedMrpInput = item.customMrpInput;
        if (paise > mrpPerUnit) {
          mrpPerUnit = paise;
          updatedPieceMrp = Math.round(paise / mult);
          updatedMrpInput = (paise / 100).toFixed(2);
        }

        const newDisc = mrpPerUnit > 0 && paise < mrpPerUnit
          ? Math.round(((mrpPerUnit - paise) / mrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...item,
          customMrpPaise: updatedPieceMrp,
          customMrpInput: updatedMrpInput,
          customRateInput: value,
          customRatePaise: paise,
          customDiscInput: newDisc > 0 ? newDisc.toFixed(1) : "0",
          lineDiscountPercent: newDisc,
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
        const bagSize = (item.product as any).bagSize || packSize;
        const mult = item.unit === "Carton" ? packSize : item.unit === "Bag" ? bagSize : item.unit === "Dozen" ? 12 : 1;

        const effectiveBaseMrp = (item.customMrpPaise != null && item.customMrpPaise > 0)
          ? item.customMrpPaise
          : (item.product.mrpPaise && item.product.mrpPaise > 0 ? item.product.mrpPaise : 0);
        const mrpPerUnit = effectiveBaseMrp * mult;

        if (isNaN(discNum) || discNum < 0) {
          return {
            ...item,
            customDiscInput: discInput,
          };
        }

        const safeDisc = Math.min(100, Math.max(0, discNum));
        const newRatePaise = mrpPerUnit > 0 ? Math.round(mrpPerUnit * (1 - safeDisc / 100)) : 0;

        return {
          ...item,
          customDiscInput: discInput,
          lineDiscountPercent: safeDisc,
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
        const bagSize = (item.product as any).bagSize || packSize;
        const oldMult = item.unit === "Carton" ? packSize : item.unit === "Bag" ? bagSize : item.unit === "Dozen" ? 12 : 1;
        const newMult = newUnit === "Carton" ? packSize : newUnit === "Bag" ? bagSize : newUnit === "Dozen" ? 12 : 1;

        const effectiveBaseMrp = (item.customMrpPaise != null && item.customMrpPaise > 0)
          ? item.customMrpPaise
          : (item.product.mrpPaise && item.product.mrpPaise > 0 ? item.product.mrpPaise : 0);
        const newMrpPerUnit = effectiveBaseMrp * newMult;

        let newRatePaise: number;
        if (item.lineDiscountPercent && item.lineDiscountPercent > 0) {
          newRatePaise = Math.round(newMrpPerUnit * (1 - item.lineDiscountPercent / 100));
        } else if (item.customRatePaise != null && item.customRatePaise > 0) {
          const pieceRate = item.customRatePaise / oldMult;
          newRatePaise = Math.round(pieceRate * newMult);
        } else {
          const tierUnitPrice = getTierUnitPrice(item.product, effectiveTier, item.customMrpPaise);
          newRatePaise = tierUnitPrice * newMult;
        }

        const effectiveDisc = (newMrpPerUnit > 0 && newRatePaise < newMrpPerUnit)
          ? Math.round(((newMrpPerUnit - newRatePaise) / newMrpPerUnit) * 10000) / 100
          : 0;

        return {
          ...item,
          unit: newUnit,
          customMrpInput: newMrpPerUnit > 0 ? (newMrpPerUnit / 100).toFixed(2) : "",
          customRatePaise: newRatePaise,
          customRateInput: newRatePaise > 0 ? (newRatePaise / 100).toFixed(2) : "",
          customDiscInput: effectiveDisc > 0 ? effectiveDisc.toFixed(1) : "0",
          lineDiscountPercent: effectiveDisc,
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

  // Tab Management & New Bill Flow (G13)
  const startFreshBillAndPromptParty = useCallback((openPartyModal: boolean = true) => {
    setFinalizedInvoice(null);
    setFinalizedModalFocusIndex(0);
    setPricingResult(null);
    setErrorMessage(null);

    setTabs((prev) => {
      const current = prev.find((t) => t.id === activeTabId) || prev[0];
      // Hold non-empty active bill so nothing is silently discarded
      const withHeld = current && current.cart.length > 0 && !current.isHeld
        ? prev.map((t) => (t.id === current.id ? { ...t, isHeld: true, heldAt: Date.now() } : t))
        : prev;

      const heldTabs = withHeld.filter((t) => t.isHeld);
      const freshId = current && current.cart.length === 0 && !current.isHeld ? current.id : `tab-${Date.now()}`;
      const freshTab: PosBillTab = {
        id: freshId,
        tabTitle: `Bill ${heldTabs.length + 1}`,
        partyId: "",
        selectedTierMode: "AUTO",
        cart: [],
        orderDiscountPercent: "0",
        paymentMode: lastUsedPaymentMode === "CREDIT" ? PaymentMode.CASH : (lastUsedPaymentMode as any),
        splitCashPaise: "",
        splitUpiPaise: "",
        remarks: "",
        documentType: "RETAIL",
        isHeld: false,
        walkInName: "",
        walkInMobile: "",
        walkInAddress: "",
        billDate: undefined,
      };
      setActiveTabId(freshId);
      return heldTabs.length > 0 ? [...heldTabs, freshTab] : [freshTab];
    });

    if (openPartyModal && effectivePosSettings.askPartyOnNewBill) {
      setPartyPopupReason("new_bill");
      setIsPartyPopupOpen(true);
    } else {
      setTimeout(() => {
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
      }, 40);
    }
  }, [activeTabId, effectivePosSettings.askPartyOnNewBill, lastUsedPaymentMode]);

  const handleCreateNewTab = useCallback(() => {
    startFreshBillAndPromptParty(true);
  }, [startFreshBillAndPromptParty]);

  // Trigger Party popup on landing via Alt+F3 (?new=1) or live event on /shop/pos
  const newBillInitTriggeredRef = useRef(false);
  useEffect(() => {
    if (!isStorageLoaded) return;
    if (initialStartNewBill && !initialEditInvoice && !newBillInitTriggeredRef.current) {
      newBillInitTriggeredRef.current = true;
      startFreshBillAndPromptParty(true);
    }
  }, [isStorageLoaded, initialStartNewBill, initialEditInvoice, startFreshBillAndPromptParty]);

  useEffect(() => {
    const onAltF3Event = () => {
      startFreshBillAndPromptParty(true);
    };
    window.addEventListener("pos-new-bill-alt-f3", onAltF3Event);
    return () => window.removeEventListener("pos-new-bill-alt-f3", onAltF3Event);
  }, [startFreshBillAndPromptParty]);

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
        setIsPartyPopupOpen(false);
        setQuickCustomerForm({ name: "", phone: "", type: "CUSTOMER", address: "", gstin: "" });
        setTimeout(() => {
          itemSearchInputRef.current?.focus();
          itemSearchInputRef.current?.select();
        }, 25);
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
    documentType?: "RETAIL" | "GST";
    billUrl?: string | null;
    waMeUrl?: string | null;
    targetPhone?: string | null;
    messagingSkipped?: boolean;
    messagingReason?: string;
  } | null>(null);
  const [finalizedModalFocusIndex, setFinalizedModalFocusIndex] = useState<number>(0);
  const thermalBtnRef = useRef<HTMLAnchorElement>(null);
  const a4BtnRef = useRef<HTMLAnchorElement>(null);
  const nextBillBtnRef = useRef<HTMLButtonElement>(null);
  const [isFinalizing, startFinalizeTransition] = useTransition();

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("jmd_pos_last_payment_mode");
      if (savedMode === "CASH" || savedMode === "UPI" || savedMode === "CREDIT" || savedMode === "SPLIT") {
        setLastUsedPaymentMode(savedMode);
      }
    } catch {
      // ignore
    }
  }, []);

  const triggerDirectIframePrint = useCallback((fullInvoice: any, format: PrintPaperFormat) => {
    if (!fullInvoice) {
      setPrintFallbackToast({ invoice: fullInvoice, format, number: "" });
      return;
    }
    setLastPrintedInvoice({ fullInvoice, format });
    try {
      const html = renderDirectPrintHtml(
        fullInvoice,
        businessDetails || {
          legalName: "JMD Cart",
          tradeName: "JMD Cart",
          gstin: "",
          fssai: "",
          address: "",
          phone: "",
          email: "",
          upiId: "",
        },
        format
      );
      const iframe = printIframeRef.current;
      if (!iframe) throw new Error("Print frame not mounted");
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) throw new Error("Print frame document inaccessible");
      doc.open();
      doc.write(html);
      doc.close();
      setPrintFallbackToast(null);
      setTimeout(() => {
        try {
          const win = iframe.contentWindow;
          if (!win) throw new Error("Print window missing");
          win.focus();
          win.print();
        } catch (printErr) {
          console.warn("[Direct Print Warning]:", printErr);
          setPrintFallbackToast({ invoice: fullInvoice, format, number: fullInvoice.number || "" });
        }
      }, 30);
    } catch (err) {
      console.warn("[Direct Print Setup Error]:", err);
      setPrintFallbackToast({ invoice: fullInvoice, format, number: fullInvoice?.number || "" });
    }
  }, [businessDetails]);

  // Finalize Bill Action
  const getInsufficientStockItems = (cart: PosCartLine[]) => {
    return cart.filter((c) => {
      const packSize = Math.max(1, c.product.packSize);
      const isCarton = c.unit === "Carton" || c.unit === "Bag";
      const requestedPcs = isCarton
        ? c.qty * packSize
        : c.unit === "Dozen"
        ? c.qty * 12
        : c.qty;

      const availableGodownPcs = c.product.godownStockQty ?? 0;
      const availableShopPcs = c.product.shopStockQty ?? 0;
      const availableGodownCtn = c.product.godownCartons ?? Math.floor(availableGodownPcs / packSize);

      if (isCarton) {
        return availableGodownPcs <= 0 || availableGodownCtn <= 0 || requestedPcs > availableGodownPcs || c.qty > availableGodownCtn;
      } else {
        const totalPcsAvailable = availableShopPcs + availableGodownPcs;
        return totalPcsAvailable <= 0 || requestedPcs > totalPcsAvailable;
      }
    });
  };

  const handleFinalizeBill = (
    explicitOverride?: { approvedByUserId: string; reason: string },
    chosenFormat: PrintPaperFormat = "thermal",
    modeOverride?: DialogPaymentMode
  ) => {
    if (!pricingResult || activeTab.cart.length === 0) return;
    setErrorMessage(null);

    const totalPaise = totalAmountPaise;
    const effectiveMode = (modeOverride || activeTab.paymentMode || "CASH") as DialogPaymentMode;
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

    // Build payments array derived strictly from Payment Mode
    let payments: Array<{ mode: "CASH" | "UPI" | "CARD" | "CREDIT"; amountPaise: number }> = [];
    let derivedPaymentStatus: "PAID" | "PENDING" | "PARTIAL" = "PAID";

    if (effectiveMode === "CASH") {
      payments = [{ mode: "CASH", amountPaise: totalPaise }];
      derivedPaymentStatus = "PAID";
    } else if (effectiveMode === "UPI") {
      payments = [{ mode: "UPI", amountPaise: totalPaise }];
      derivedPaymentStatus = "PAID";
    } else if (effectiveMode === "CREDIT") {
      if (!activeTab.partyId) {
        setQuickCustomerModalOpen(true);
        setQuickCustomerError("Please select or create a Customer for Demand Credit Bill.");
        return;
      }
      payments = [];
      derivedPaymentStatus = "PENDING";
    } else {
      // SPLIT: Cash + UPI + remaining Credit
      const cashAmount = Math.max(0, Math.round((parseFloat(activeTab.splitCashPaise || "0") || 0) * 100));
      const upiAmount = Math.max(0, Math.round((parseFloat(activeTab.splitUpiPaise || "0") || 0) * 100));

      if (cashAmount + upiAmount > totalPaise) {
        setErrorMessage("Split Cash + UPI exceeds bill total.");
        return;
      }
      if (cashAmount + upiAmount < totalPaise && !activeTab.partyId) {
        setErrorMessage("Walk-in retail sales must be fully paid. Total tendered does not cover bill total.");
        return;
      }

      if (cashAmount > 0) payments.push({ mode: "CASH", amountPaise: cashAmount });
      if (upiAmount > 0) payments.push({ mode: "UPI", amountPaise: upiAmount });
      derivedPaymentStatus = cashAmount + upiAmount >= totalPaise ? "PAID" : "PARTIAL";
    }

    const overrideToUse = explicitOverride || approvedCreditOverride;

    startFinalizeTransition(async () => {
      try {
        const idempotencyKey = `pos_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        // Check if any item in cart has 0 rate or unpriced
        // Validate HSN for GST Bills
        if (activeTab.documentType === "GST") {
          const missingHsn = activeTab.cart.filter(
            (c) => !c.product.hsn || c.product.hsn.trim() === "" || c.product.hsn.trim() === "0000"
          );
          if (missingHsn.length > 0) {
            setErrorMessage(
              `Cannot issue GST Tax Invoice: ${missingHsn.length} item(s) missing valid HSN code: ${missingHsn.map((m) => m.product.name).join(", ")}. Please update product HSN in catalog.`
            );
            return;
          }
        }

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

        // Handle Invoice Edit Revision Save
        if (isEditMode && initialEditInvoice) {
          const editItems = activeTab.cart.map((c) => {
            const packSize = Math.max(1, c.product.packSize);
            const bagSize = (c.product as any).bagSize || packSize;
            const pcs = c.unit === "Carton"
              ? c.qty * packSize
              : c.unit === "Bag"
              ? c.qty * bagSize
              : c.unit === "Dozen"
              ? c.qty * 12
              : c.qty;
            let ratePaise = c.customRatePaise != null && c.customRatePaise > 0
              ? (c.unit === "Carton" ? Math.round(c.customRatePaise / packSize) : c.customRatePaise)
              : undefined;
            return {
              productId: c.productId,
              qty: pcs,
              mrpPaise: c.customMrpPaise ?? c.product.mrpPaise ?? 0,
              ratePaise,
              discountBp: Math.round((c.lineDiscountPercent || 0) * 100),
              unitLabel: c.unit,
            };
          });

          const origBillDateStr = toIstDateString(initialEditInvoice.invoiceDate || initialEditInvoice.createdAt);
          const hasDateChanged = Boolean(activeTab.billDate && activeTab.billDate !== origBillDateStr);

          const editRes = await saveInvoiceRevisionAction({
            invoiceId: initialEditInvoice.id,
            expectedVersion: initialEditInvoice.version,
            reason: editReason.trim() || "POS voucher edit",
            allowPartyChange: !isEditPartyLocked,
            partyId: isEditPartyLocked ? (initialEditInvoice.partyId || null) : (activeTab.partyId || null),
            customerName: isEditPartyLocked
              ? (initialEditInvoice.customerName ?? undefined)
              : (activeTab.partyId ? undefined : activeTab.walkInName?.trim() || undefined),
            customerPhone: isEditPartyLocked
              ? (initialEditInvoice.customerPhone ?? undefined)
              : (activeTab.partyId ? undefined : activeTab.walkInMobile?.trim() || undefined),
            customerAddress: isEditPartyLocked
              ? (initialEditInvoice.customerAddress ?? undefined)
              : (activeTab.partyId ? undefined : activeTab.walkInAddress?.trim() || undefined),
            invoiceDate: hasDateChanged ? activeTab.billDate : origBillDateStr,
            dateChangeReason: hasDateChanged ? editReason.trim() : undefined,
            items: editItems,
            notes: activeTab.remarks,
          });

          if (editRes.success && editRes.invoice) {
            const printUrl = `/shop/invoices/${editRes.invoice.id}/print${activeTab.documentType === "GST" ? "?format=a4" : ""}`;
            router.push(printUrl);
          } else {
            setErrorMessage(editRes.error || "Failed to save invoice revision");
          }
          return;
        }

        // Owner Policy: Stock restriction removed completely - bill any product regardless of stock
        // Insufficient stock items proceed directly to finalization without blocking or popups

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
          documentType: activeTab.documentType ?? "RETAIL",
          paymentStatus: derivedPaymentStatus,
          notes: activeTab.remarks?.trim() || undefined,
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
        setLastUsedPaymentMode(effectiveMode);
        try {
          localStorage.setItem("jmd_pos_last_payment_mode", effectiveMode);
        } catch {
          // ignore
        }

        const effectivePrintFormat: PrintPaperFormat =
          effectiveMode === "CREDIT" || activeTab.documentType === "GST"
            ? chosenFormat
            : "thermal";

        if (effectivePosSettings.showFinalizedModal) {
          handleCloseTab(activeTab.id);
          setFinalizedInvoice({
            ...invoice,
            documentType: activeTab.documentType ?? "RETAIL",
          });
          setFinalizedModalFocusIndex(0);
          return;
        }

        // G3 Default: Direct hidden-iframe printing WITHOUT leaving /shop/pos or opening any new tab
        if ((invoice as any).fullInvoice) {
          triggerDirectIframePrint((invoice as any).fullInvoice, effectivePrintFormat);
        } else {
          setPrintFallbackToast({ invoice: null, format: effectivePrintFormat, number: invoice.number });
        }

        // Reset bill for next customer cleanly on /shop/pos and prompt Party if setting enabled
        handleCloseTab(activeTab.id);
        setToastMsg(`Saved ${invoice.number} · ₹${(invoice.totalPaise / 100).toFixed(2)}`);
        setTimeout(() => setToastMsg(null), 4000);
        if (effectivePosSettings.askPartyOnNewBill) {
          setPartyPopupReason("new_bill");
          setIsPartyPopupOpen(true);
        } else {
          setTimeout(() => {
            itemSearchInputRef.current?.focus();
            itemSearchInputRef.current?.select();
          }, 50);
        }
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

  // Helper to start the next bill cleanly (resetting tabs and exiting edit mode if active)
  const handleStartNextBill = useCallback(() => {
    setFinalizedInvoice(null);
    setFinalizedModalFocusIndex(0);
    if (initialEditInvoice || activeTab.id === "tab-edit") {
      router.push("/shop/pos");
      const freshTab: PosBillTab = {
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
        documentType: "RETAIL",
        isHeld: false,
        walkInName: "",
        walkInMobile: "",
        walkInAddress: "",
        billDate: undefined,
      };
      setTabs([freshTab]);
      setActiveTabId("tab-1");
    } else {
      if (tabs.length === 0) {
        const freshTab: PosBillTab = {
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
          documentType: "RETAIL",
          isHeld: false,
          walkInName: "",
          walkInMobile: "",
          walkInAddress: "",
          billDate: undefined,
        };
        setTabs([freshTab]);
        setActiveTabId(freshTab.id);
      }
    }
    if (effectivePosSettings.askPartyOnNewBill) {
      setPartyPopupReason("new_bill");
      setIsPartyPopupOpen(true);
    } else {
      setTimeout(() => {
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
      }, 60);
    }
  }, [initialEditInvoice, activeTab.id, tabs.length, router, effectivePosSettings.askPartyOnNewBill]);

  // Focus synchronization for Finalized Modal buttons
  useEffect(() => {
    if (!finalizedInvoice) return;
    const buttons = [thermalBtnRef.current, a4BtnRef.current, nextBillBtnRef.current];
    buttons[finalizedModalFocusIndex]?.focus();
  }, [finalizedInvoice, finalizedModalFocusIndex]);

  // Dedicated keyboard capture listener for Finalized Invoice dialog
  useEffect(() => {
    if (!finalizedInvoice) return;

    // Immediately focus button 0 (Thermal Slip) on mount
    const timer = setTimeout(() => {
      thermalBtnRef.current?.focus();
    }, 20);

    const handleModalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === "INPUT" || activeEl?.tagName === "TEXTAREA";

      // ESC or F3: Start Next Bill
      if (e.key === "Escape" || e.key === "F3") {
        e.preventDefault();
        e.stopPropagation();
        handleStartNextBill();
        return;
      }

      // Quick number triggers:
      // Pressing '1' -> Thermal Slip
      // Pressing '2' -> Print A4
      // Pressing '3' -> Start Next Bill
      if (!isInput && (e.key === "1" || e.key === "t" || e.key === "T")) {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/shop/invoices/${finalizedInvoice.id}/print`);
        return;
      }
      if (!isInput && (e.key === "2" || e.key === "a" || e.key === "A")) {
        e.preventDefault();
        e.stopPropagation();
        router.push(`/shop/invoices/${finalizedInvoice.id}/print?format=a4`);
        return;
      }
      if (!isInput && e.key === "3") {
        e.preventDefault();
        e.stopPropagation();
        handleStartNextBill();
        return;
      }

      // Arrow navigation & Tab cycling strictly between the 3 buttons
      const buttons = [thermalBtnRef.current, a4BtnRef.current, nextBillBtnRef.current];

      if (e.key === "ArrowRight" || e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        setFinalizedModalFocusIndex((prev) => {
          const nextIdx = (prev + 1) % 3;
          buttons[nextIdx]?.focus();
          return nextIdx;
        });
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        e.stopPropagation();
        setFinalizedModalFocusIndex((prev) => {
          const prevIdx = (prev - 1 + 3) % 3;
          buttons[prevIdx]?.focus();
          return prevIdx;
        });
        return;
      }

      if (e.key === "Enter") {
        if (isInput) return;
        e.preventDefault();
        e.stopPropagation();
        if (finalizedModalFocusIndex === 0) {
          router.push(`/shop/invoices/${finalizedInvoice.id}/print`);
        } else if (finalizedModalFocusIndex === 1) {
          router.push(`/shop/invoices/${finalizedInvoice.id}/print?format=a4`);
        } else {
          handleStartNextBill();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleModalKeyDown, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleModalKeyDown, true);
    };
  }, [finalizedInvoice, finalizedModalFocusIndex, handleStartNextBill, router]);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If a modal with its own capture handler is open, yield completely
      if (finalizedInvoice || isSaveConfirmOpen || isPartyPopupOpen || discardConfirmOpen || voidEditModalOpen || counterDetailsOpen) {
        return;
      }

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
      } else if (e.key === "F5") {
        e.preventDefault();
        setShowHeldModal((prev) => !prev);
      } else if (e.key === "F6") {
        e.preventDefault();
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
      } else if (e.key === "F7") {
        e.preventDefault();
        if (activeTab.cart.length > 0) {
          const lastLine = activeTab.cart[activeTab.cart.length - 1];
          addItemToCart(lastLine.product, lastLine.unit, lastLine.qty);
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        e.stopPropagation();
        if (isEditMode && initialEditInvoice) {
          if (!canVoidInvoice) return;
          setVoidEditReason("");
          setVoidEditError(null);
          setVoidEditModalOpen(true);
          return;
        }
        if (!canDeleteBill) return;
        if (activeTab.cart.length === 0) {
          updateActiveTab({ partyId: "", remarks: "", orderDiscountPercent: "0", walkInName: "", walkInMobile: "", walkInAddress: "" });
          setToastMsg("Empty bill cleared");
          setTimeout(() => setToastMsg(null), 2000);
          itemSearchInputRef.current?.focus();
          itemSearchInputRef.current?.select();
        } else {
          setDiscardConfirmOpen(true);
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        handleDeleteHighlightedOrLastLine();
      } else if (e.altKey && (e.code === "KeyP" || e.key.toLowerCase() === "p")) {
        e.preventDefault();
        e.stopPropagation();
        if (isEditMode && isEditPartyLocked) {
          setErrorMessage("Customer is locked on this billed invoice. Click 'Change Party' to unlock if intentional.");
          return;
        }
        setPartyPopupReason("alt_p");
        setIsPartyPopupOpen(true);
      } else if (e.altKey && (e.code === "KeyN" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        e.stopPropagation();
        if (isEditMode && isEditPartyLocked) {
          setErrorMessage("Customer is locked on this billed invoice. Click 'Change Party' to unlock if intentional.");
          return;
        }
        setQuickCustomerModalOpen(true);
      } else if (e.altKey && (e.code === "KeyC" || e.key.toLowerCase() === "c")) {
        e.preventDefault();
        updateActiveTab({ paymentMode: PaymentMode.CASH, paymentCollected: true });
        if (effectivePosSettings.quickFinish && activeTab.cart.length > 0) {
          handleFinalizeBill(undefined, "thermal", "CASH");
        }
      } else if (e.altKey && (e.code === "KeyU" || e.key.toLowerCase() === "u")) {
        e.preventDefault();
        updateActiveTab({ paymentMode: PaymentMode.UPI, paymentCollected: true });
        if (effectivePosSettings.quickFinish && activeTab.cart.length > 0) {
          handleFinalizeBill(undefined, "thermal", "UPI");
        }
      } else if (e.altKey && (e.code === "KeyR" || e.key.toLowerCase() === "r")) {
        e.preventDefault();
        const creditAllowed = Boolean(selectedParty) && (effectivePosSettings.creditAllParties || selectedParty?.creditEnabled);
        if (creditAllowed) {
          updateActiveTab({ paymentMode: PaymentMode.CREDIT, paymentCollected: false });
          if (effectivePosSettings.quickFinish && activeTab.cart.length > 0) {
            handleFinalizeBill(undefined, "thermal", "CREDIT");
          }
        } else {
          setErrorMessage(selectedParty ? "No credit for this party." : "Select a party for credit.");
        }
      } else if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
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
      } else if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        updateActiveTab({ documentType: activeTab.documentType === "GST" ? "RETAIL" : "GST" });
        return;
      } else if (e.altKey && e.key.toLowerCase() === "m") {
        e.preventDefault();
        handleOpenEditProductMaster();
        return;
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        if (lastPrintedInvoice?.fullInvoice) {
          e.preventDefault();
          triggerDirectIframePrint(lastPrintedInvoice.fullInvoice, lastPrintedInvoice.format);
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        itemSearchInputRef.current?.focus();
        itemSearchInputRef.current?.select();
      } else if (e.key === "Escape") {
        if (editProductModal.isOpen) {
          setEditProductModal({ isOpen: false, product: null });
          return;
        }
        if (showQuickAddModal) {
          setShowQuickAddModal(false);
          return;
        }
        if (quickStockModal.isOpen) {
          setQuickStockModal({ isOpen: false, product: null, addQty: "", unit: "Pcs", isLoading: false });
          return;
        }
        if (stockAlertInfo && stockAlertInfo.isOpen) {
          setStockAlertInfo(null);
          return;
        }
        if (isSaveConfirmOpen) {
          setIsSaveConfirmOpen(false);
          return;
        }
        if (showHeldModal || quickCustomerModalOpen || overrideModalOpen || manualRateModalOpen || showHistoryDrawer || showRecentBillsPopover || showTodaySalesModal || showRevisionHistory) {
          setShowHeldModal(false);
          setQuickCustomerModalOpen(false);
          setOverrideModalOpen(false);
          setManualRateModalOpen(false);
          setShowHistoryDrawer(false);
          setShowRecentBillsPopover(false);
          setShowTodaySalesModal(false);
          setShowRevisionHistory(false);
          return;
        }
        if (isPartyCardExpanded) {
          setIsPartyCardExpanded(false);
          return;
        }
        if (itemSearchTerm) {
          setItemSearchTerm("");
          setSearchSelectedIndex(0);
          return;
        }
        // Esc goes back from POS to management dashboard
        if (activeTab.cart.length === 0) {
          if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
          } else {
            router.push("/admin");
          }
        } else {
          if (confirm("Go back to previous page? Current unsaved bill tab will be closed.")) {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/admin");
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleFinalizeBill,
    handleCreateNewTab,
    activeTab,
    tabs,
    finalizedInvoice,
    isSaveConfirmOpen,
    isPartyPopupOpen,
    discardConfirmOpen,
    voidEditModalOpen,
    counterDetailsOpen,
    selectedParty,
    effectivePosSettings.quickFinish,
    lastPrintedInvoice,
    triggerDirectIframePrint,
    isEditMode,
    canDeleteBill,
    canVoidInvoice,
  ]);

  // Voucher lines preview memo for SaveVoucherDialog
  const previewLines = useMemo(() => {
    return activeTab.cart.map((line) => {
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

      const ratePerUnitPaise = line.isCustomRate && line.customRatePaise != null
        ? line.customRatePaise
        : defaultRatePaise;

      const amountPaise = Math.round(line.qty * ratePerUnitPaise);
      const totalPieces = line.unit === "Carton" || line.unit === "Bag"
        ? line.qty * packSize
        : line.unit === "Dozen"
        ? line.qty * 12
        : line.qty;

      const isCarton = line.unit === "Carton" || line.unit === "Bag";
      const availablePieces = isCarton ? (line.product.godownStockQty ?? 0) : (line.product.shopStockQty ?? 0);
      const isShortage = totalPieces > availablePieces;

      return {
        id: line.id,
        name: line.product.name,
        weight: line.product.weight || (line.product.weightValue ? `${line.product.weightValue}${line.product.weightUnit || "g"}` : null),
        qty: line.qty,
        unit: line.unit,
        totalPieces,
        ratePaise: ratePerUnitPaise,
        discountPercent: line.lineDiscountPercent || 0,
        amountPaise,
        isShortage,
        isZeroRate: ratePerUnitPaise <= 0,
      };
    });
  }, [activeTab.cart, effectiveTier]);

    // 1. Calculate Subtotal (MRP) directly by summing each line's (MRP * Qty)
  const subtotalMrpPaise = useMemo(() => {
    return activeTab.cart.reduce((sum, line) => {
      const packSize = Math.max(1, line.product.packSize);
      const bagSize = (line.product as any).bagSize || packSize;
      const mult = line.unit === "Carton" ? packSize : line.unit === "Bag" ? bagSize : line.unit === "Dozen" ? 12 : 1;

      const baseMrp = (line.customMrpPaise != null && line.customMrpPaise > 0)
        ? line.customMrpPaise
        : ((line.product.mrpPaise && line.product.mrpPaise > 0)
          ? line.product.mrpPaise
          : (line.customRatePaise && line.customRatePaise > 0 ? Math.round(line.customRatePaise / mult) : 0));

      const lineMrpPerUnitPaise = mult > 0 ? baseMrp * mult : baseMrp;
      return sum + Math.round(line.qty * lineMrpPerUnitPaise);
    }, 0);
  }, [activeTab.cart]);

  // 2. Calculate Final Grand Total directly by summing each line's Amount from the grid
  const rawGridAmountPaise = useMemo(() => {
    return activeTab.cart.reduce((sum, line) => {
      if (line.customAmountInput !== undefined && !isNaN(parseFloat(line.customAmountInput))) {
        return sum + Math.round(parseFloat(line.customAmountInput) * 100);
      }
      const packSize = Math.max(1, line.product.packSize);
      const bagSize = (line.product as any).bagSize || packSize;
      const mult = line.unit === "Carton" ? packSize : line.unit === "Bag" ? bagSize : line.unit === "Dozen" ? 12 : 1;
      const resolved = resolvePrice(
        {
          mrpPaise: line.product.mrpPaise,
          priceAPaise: line.product.priceAPaise,
          priceBPaise: line.product.priceBPaise,
          priceCPaise: line.product.priceCPaise,
        },
        effectiveTier
      );
      const defaultRatePaise = line.unit === "Carton" || line.unit === "Bag"
        ? resolved.unitPricePaise * mult
        : line.unit === "Dozen"
        ? resolved.unitPricePaise * 12
        : resolved.unitPricePaise;

      const ratePerUnitPaise = line.isCustomRate && line.customRatePaise != null
        ? line.customRatePaise
        : defaultRatePaise;

      return sum + Math.round(line.qty * ratePerUnitPaise);
    }, 0);
  }, [activeTab.cart, effectiveTier]);

  const orderDiscountPercent = useMemo(() => {
    const d = parseFloat(activeTab.orderDiscountPercent);
    return !isNaN(d) && d > 0 ? d : 0;
  }, [activeTab.orderDiscountPercent]);

  const orderDiscountPaise = useMemo(() => {
    return orderDiscountPercent > 0
      ? Math.round(rawGridAmountPaise * (orderDiscountPercent / 100))
      : 0;
  }, [rawGridAmountPaise, orderDiscountPercent]);

  const netAmountPaise = Math.max(0, rawGridAmountPaise - orderDiscountPaise);
  // Round off (round to nearest whole rupee)
  const totalAmountPaise = Math.round(netAmountPaise / 100) * 100;
  const roundoffPaise = totalAmountPaise - netAmountPaise;

  const totalDiscountPaise = Math.max(0, subtotalMrpPaise - totalAmountPaise);

  const taxablePaise = pricingResult ? pricingResult.taxablePaise : 0;
  const cgstPaise = pricingResult ? pricingResult.cgstPaise : 0;
  const sgstPaise = pricingResult ? pricingResult.sgstPaise : 0;
  const amountInWords = totalAmountPaise > 0 ? paiseToIndianWords(totalAmountPaise) : "";

  // Highlighted product details
  const highlightedProduct = useMemo(() => {
    if (!highlightedProductId) return null;
    return productsList.find((p) => p.id === highlightedProductId) || null;
  }, [productsList, highlightedProductId]);

  const heldTabsCount = tabs.filter((t) => t.isHeld).length;

  return (
    <div className="flex flex-col h-screen bg-[#FEFDF7] text-slate-900 select-none overflow-hidden font-sans">
      {/* 1. Brand Light Command Header (#FEFDF7 / White with #790E11 Maroon & #FDAF18 Amber accents) */}
      <header className="bg-[#FEFDF7] text-slate-900 px-3 sm:px-4 py-1 flex items-center justify-between gap-3 shadow-xs shrink-0 border-b-2 border-[#790E11]/20 h-11 z-30">
        {/* Left: Brand & Station Context */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-white border border-[#790E11]/20 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
            <img src="/brand/jmd-cart-logo.png" alt="JMD POS Logo" width={28} height={28} className="w-full h-full object-contain" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-black tracking-tight text-[#790E11] uppercase">Shop POS</h1>
            <span className="bg-[#790E11] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {locationName}
            </span>
            <span className="text-slate-400 text-xs hidden md:inline">·</span>
            <span className="text-slate-700 text-xs hidden md:inline font-semibold">
              Cashier: <strong className="text-slate-900">{cashierName}</strong>
            </span>
            {isAdmin && activeTab.billDate && activeTab.billDate !== todayStr && (
              <span className="inline-flex items-center gap-1 bg-[#FDAF18] text-slate-950 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-wider shadow-xs border border-[#FC830D]">
                <Calendar className="w-3 h-3" />
                Backdated: {activeTab.billDate}
              </span>
            )}
          </div>
        </div>

        {/* Center: Bill Tabs with compact [+ New (F3)] and [Hold (F4)] */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-xl">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                  isActive
                    ? "bg-[#790E11] text-white border-[#790E11] shadow-xs"
                    : tab.isHeld
                    ? "bg-[#FFF1D6] text-[#790E11] border-[#FDAF18] hover:bg-[#FDAF18]/30"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {tab.isHeld && <PauseCircle className="w-3 h-3 text-[#FC830D] shrink-0" />}
                <span className="truncate max-w-[100px] text-[11px]">
                  {tab.tabTitle || `Bill ${idx + 1}`}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className={`p-0.5 rounded ${isActive ? "text-white/80 hover:text-white" : "text-slate-400 hover:text-slate-800"}`}
                    title="Close tab"
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FDAF18] hover:bg-[#FC830D] text-slate-950 border border-[#FC830D] shadow-2xs transition shrink-0 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>New (F3)</span>
          </button>

          <button
            onClick={handleHoldCurrentBill}
            title="Hold current bill (F4)"
            disabled={activeTab.cart.length === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 disabled:opacity-40 transition shrink-0 cursor-pointer"
          >
            <PauseCircle className="w-3 h-3 text-[#FC830D]" />
            <span>Hold (F4)</span>
          </button>

          {heldTabsCount > 0 && (
            <button
              onClick={() => setShowHeldModal(true)}
              title="View held bills (F5)"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FFF1D6] text-[#790E11] border border-[#FDAF18] shadow-xs shrink-0 cursor-pointer"
            >
              <span>Held ({heldTabsCount})</span>
            </button>
          )}
        </div>

        {/* Right: Unified Action Button Family */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowQuickAddModal(true)}
            className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-2xs transition cursor-pointer"
            title="Quick create new product"
          >
            <Plus className="w-3 h-3 text-emerald-700" />
            <span>+ Product</span>
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditProductMaster()}
            className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 shadow-2xs transition cursor-pointer"
            title="Edit product master details (Alt+M)"
          >
            <Edit3 className="w-3 h-3 text-[#790E11]" />
            <span>Master</span>
            <kbd className="text-[9px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-mono">Alt+M</kbd>
          </button>
          <button
            type="button"
            onClick={() => setShowTodaySalesModal(true)}
            className="h-7 px-2.5 rounded-lg text-xs font-bold bg-white hover:bg-amber-50 text-slate-800 border border-slate-300 flex items-center gap-1 shadow-2xs transition cursor-pointer"
            title="Today's total sales summary"
          >
            <Banknote className="w-3 h-3 text-[#FC830D]" />
            <span>Today</span>
          </button>

          <div className="h-4 w-px bg-slate-300 mx-0.5 hidden xl:block" />

          <Link
            href="/app/pro?tab=products"
            className="hidden xl:inline-flex h-7 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 items-center gap-1 transition"
            title="Mobile Catalog & Price Tier Manager"
          >
            <Smartphone className="w-3 h-3 text-[#790E11]" />
            <span>PRO Catalog</span>
          </Link>
          <Link
            href="/godown/stock"
            className="hidden xl:inline-flex h-7 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 items-center transition"
          >
            Stock
          </Link>
          <Link
            href="/admin"
            className="hidden xl:inline-flex h-7 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 items-center transition"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Edit Mode Alert Banner */}
      {isEditMode && initialEditInvoice && (
        <div className="w-full bg-amber-500 text-slate-950 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 font-sans shadow-xs border-b border-amber-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-slate-950 text-amber-300 px-2 py-0.5 rounded font-black text-xs uppercase tracking-wide">
              Editing Invoice
            </span>
            <span className="font-black text-sm font-mono">
              {initialEditInvoice.number} · Rev {initialEditInvoice.version || 1}
            </span>
            <span className="text-xs font-semibold bg-amber-400/80 px-2 py-0.5 rounded">
              Original: ₹{((initialEditInvoice.totalPaise || 0) / 100).toFixed(2)} ({initialEditInvoice.items?.length || 0} items)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRevisionHistory(true)}
              className="text-xs font-bold bg-white text-slate-900 px-2.5 py-1 rounded shadow-xs flex items-center gap-1 hover:bg-slate-50 transition"
            >
              <History className="w-3.5 h-3.5 text-purple-700" />
              <span>Revision History ({initialEditInvoice.revisions?.length || 0})</span>
            </button>
            <Link
              href={`/shop/invoices/${initialEditInvoice.id}`}
              className="text-xs font-bold bg-slate-900 text-white px-2.5 py-1 rounded shadow-xs hover:bg-slate-800 transition"
            >
              Cancel Edit
            </Link>
          </div>
        </div>
      )}

      {/* 2. Unified POS Voucher & Party Strip (Slim, Scannable ~42px) */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs shrink-0 z-20">
        {/* Left: Date & Voucher Preview Chips */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono">
            <span className="text-slate-500 font-sans font-bold text-[10px] uppercase">Date:</span>
            <span className="font-bold text-slate-800">{todayFormattedWithDay}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-mono">
            <span className="text-slate-500 font-sans font-bold text-[10px] uppercase">Vch:</span>
            <span className="font-bold text-slate-900">
              {initialEditInvoice?.number
                ? `${initialEditInvoice.number} (Editing)`
                : activeTab.id === "tab-edit" && activeTab.tabTitle?.startsWith("Edit: ")
                ? `${activeTab.tabTitle.replace("Edit: ", "")} (Editing)`
                : nextInvoicePreview
                ? `${nextInvoicePreview}`
                : (activeTab.tabTitle || "INV/26-27/000001")}
            </span>
          </div>
        </div>

        {/* Center: Compact Party Card with Expand/Edit toggle */}
        <div className="flex items-center gap-2 flex-1 min-w-[300px] max-w-3xl">
          <div className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded flex-1 transition-all">
            <div className="w-5 h-5 rounded bg-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <span className="text-[11px]">👤</span>
            </div>
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-bold text-sm text-slate-900 truncate">
                {selectedParty ? selectedParty.name : (activeTab.walkInName || "Counter Sale (Walk-in)")}
              </span>
              {!selectedParty && !(isEditMode && isEditPartyLocked) && (
                <button
                  type="button"
                  onClick={() => setCounterDetailsOpen(true)}
                  className="text-[11px] font-bold text-[#790E11] hover:underline shrink-0 cursor-pointer"
                  title="Add optional walk-in customer name & mobile"
                >
                  + Details
                </button>
              )}
              {selectedParty?.phone && (
                <span className="text-[11px] font-mono text-slate-500 shrink-0 hidden sm:inline">
                  {selectedParty.phone}
                </span>
              )}
              {/* Balance Badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                selectedParty
                  ? selectedParty.currentOutstandingPaise > 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : selectedParty.currentOutstandingPaise < 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                {selectedParty
                  ? selectedParty.currentOutstandingPaise > 0
                    ? `Due: ₹${(selectedParty.currentOutstandingPaise / 100).toFixed(2)}`
                    : selectedParty.currentOutstandingPaise < 0
                    ? `Adv: ₹${(Math.abs(selectedParty.currentOutstandingPaise) / 100).toFixed(2)}`
                    : "Clear Bal: ₹0"
                  : "Bal: ₹0"}
              </span>
            </div>

            {/* Tier Selector Chips */}
            <div className="flex items-center gap-0.5 bg-slate-200/70 p-0.5 rounded text-[11px] shrink-0 font-bold">
              <span className="text-[9px] text-slate-500 uppercase px-1">Tier:</span>
              <button
                type="button"
                onClick={() => handleTierChange("AUTO")}
                className={`px-1.5 py-0.2 rounded text-[10px] transition ${
                  activeTab.selectedTierMode === "AUTO"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Auto Tier based on Party"
              >
                Auto({effectiveTier[0]})
              </button>
              <button
                type="button"
                onClick={() => handleTierChange("WHOLESALER")}
                className={`px-1.5 py-0.2 rounded text-[10px] transition ${
                  activeTab.selectedTierMode === "WHOLESALER"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Wholesaler (Tier A)"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => handleTierChange("RETAILER")}
                className={`px-1.5 py-0.2 rounded text-[10px] transition ${
                  activeTab.selectedTierMode === "RETAILER"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Retailer (Tier B)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => handleTierChange("CUSTOMER")}
                className={`px-1.5 py-0.2 rounded text-[10px] transition ${
                  activeTab.selectedTierMode === "CUSTOMER"
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                title="Customer (Tier C)"
              >
                C
              </button>
            </div>

            {/* Select / Change Party Button (Locked by default in Edit Mode) */}
            {isEditMode && isEditPartyLocked ? (
              <button
                type="button"
                data-testid="pos-party-unlock"
                onClick={() => {
                  if (
                    window.confirm(
                      "This bill's customer name is locked. Are you sure you want to change the customer on this finalized invoice?"
                    )
                  ) {
                    setIsEditPartyLocked(false);
                  }
                }}
                className="h-7 px-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-400 text-xs font-bold text-amber-950 flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                title="Customer name is locked on billed invoices. Click to unlock if you intentionally need to change it."
              >
                <span>🔒 Party Fixed</span>
                <span className="underline text-[10px] ml-0.5">Change</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="pos-party-trigger"
                onClick={() => {
                  setPartyPopupReason("alt_p");
                  setIsPartyPopupOpen(true);
                }}
                className="h-7 px-2.5 rounded-lg bg-white hover:bg-amber-50 border border-[#790E11]/40 text-xs font-bold text-slate-800 flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
                title="Search or select party (Alt+P)"
              >
                <Edit3 className="w-3 h-3 text-[#790E11]" />
                <span>Party</span>
                <kbd className="text-[10px] bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-mono font-bold">Alt+P</kbd>
              </button>
            )}

            {/* Recent Bills & Full History if party is selected */}
            {selectedParty && (
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRecentBillsPopover((prev) => !prev)}
                    className="h-6 px-1.5 rounded bg-white hover:bg-slate-50 border border-slate-300 text-[10px] font-bold text-slate-700 flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Recent bills"
                  >
                    <Clock className="w-2.5 h-2.5 text-slate-500" />
                    <span>Bills ({recentBills.length})</span>
                  </button>
                  {showRecentBillsPopover && (
                    <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5">
                        <span>Last 5 Bills</span>
                        <button onClick={handleOpenFullHistory} className="text-[11px] text-blue-600 hover:underline">
                          Full History &rarr;
                        </button>
                      </div>
                      {recentBills.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2 text-center">No past bills found.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {recentBills.map((inv) => (
                            <div key={inv.id} className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-slate-800 font-mono text-[11px]">{inv.number}</p>
                                <p className="text-[10px] text-slate-500">{inv.finalizedAt ? new Date(inv.finalizedAt).toLocaleDateString("en-IN") : "Draft"}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-slate-900">₹{(inv.totalPaise / 100).toFixed(2)}</p>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-200 rounded text-slate-700">{inv.channel}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={handleOpenFullHistory} className="w-full py-1.5 text-xs font-bold text-center bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition">
                        View Complete History
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleOpenFullHistory}
                  className="h-6 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-white flex items-center gap-1 shadow-2xs cursor-pointer"
                  title="Complete ledger & invoice history"
                >
                  <History className="w-2.5 h-2.5" />
                  <span>History</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Narration Input */}
        <div className="flex items-center gap-1.5 w-52 shrink-0">
          <span className="text-slate-400 uppercase font-sans text-[10px] font-bold shrink-0">Notes:</span>
          <input
            type="text"
            placeholder="Narration / bill notes..."
            value={activeTab.remarks}
            onChange={(e) => updateActiveTab({ remarks: e.target.value })}
            className="w-full px-2 py-0.5 text-xs bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 font-sans"
          />
        </div>
      </div>

      {/* Expanded Party Details Drawer / Dropdown */}
      {isPartyCardExpanded && (
        <div className="bg-slate-50 border-b border-slate-300 px-3 sm:px-4 py-2 shadow-md flex flex-col gap-2 shrink-0 animate-in slide-in-from-top-2 duration-150 z-20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-600" />
              <span>Select or Edit Customer Details</span>
            </span>
            <button
              type="button"
              onClick={() => setIsPartyCardExpanded(false)}
              className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <span>Done / Collapse ▲</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[280px]">
              <PartySearchBox
                parties={localParties as any}
                selectedPartyId={activeTab.partyId}
                autoFocus={!(isEditMode && isEditPartyLocked)}
                disabled={isEditMode && isEditPartyLocked}
                id="pos-party-search-input"
                onSelect={(party) => {
                  if (isEditMode && isEditPartyLocked) return;
                  updateActiveTab({
                    partyId: party.id,
                    tabTitle: party.name,
                  });
                  setIsPartyCardExpanded(false);
                  setTimeout(() => {
                    itemSearchInputRef.current?.focus();
                    itemSearchInputRef.current?.select();
                  }, 40);
                }}
                onAddNewParty={() => {
                  setQuickCustomerError(null);
                  setQuickCustomerModalOpen(true);
                }}
              />
            </div>
            <button
              onClick={() => {
                setQuickCustomerError(null);
                setQuickCustomerModalOpen(true);
              }}
              title="Add new customer"
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ New Party</span>
            </button>
          </div>

          {/* Walk-in Customer Fields (if no party selected) */}
          {!activeTab.partyId && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 text-xs">
              <span className="font-bold text-slate-500 text-[10px] uppercase">Walk-in:</span>
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
                    if (match && !activeTab.walkInName?.trim()) {
                      updates.walkInName = match.name;
                      if (match.address && !activeTab.walkInAddress?.trim()) {
                        updates.walkInAddress = match.address;
                      }
                    }
                  }
                  updateActiveTab(updates);
                }}
                className="w-36 px-2.5 py-1 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 font-mono bg-white"
              />
              <input
                type="text"
                placeholder="Customer Name..."
                value={activeTab.walkInName || ""}
                onChange={(e) => updateActiveTab({ walkInName: e.target.value })}
                className="w-48 px-2.5 py-1 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 bg-white"
              />
              <input
                type="text"
                placeholder="Delivery Address (optional)..."
                value={activeTab.walkInAddress || ""}
                onChange={(e) => updateActiveTab({ walkInAddress: e.target.value })}
                className="flex-1 min-w-[180px] px-2.5 py-1 rounded border border-slate-300 text-xs focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>
          )}

          {/* Selected Party Inline Fields (if party selected) */}
          {selectedParty && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200 text-xs">
              <span className="font-bold text-blue-900 text-[10px] uppercase">Edit Buyer:</span>
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
                className="w-48 px-2.5 py-1 rounded border border-slate-300 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500"
                title="Customer Name (Enter to Save)"
              />
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
                className="w-36 px-2.5 py-1 rounded border border-slate-300 text-xs font-mono text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                title="Customer Phone (Enter to Save)"
              />
              <input
                type="text"
                placeholder="Customer Address..."
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
                className="flex-1 min-w-[180px] px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-800 bg-white focus:ring-2 focus:ring-blue-500"
                title="Customer Address (Enter to Save)"
              />
              <button
                type="button"
                onClick={handleSaveInlineParty}
                disabled={isSavingInlineParty || (!isPartyDirty && !partySaveSuccess)}
                className={`px-3 py-1 rounded text-xs font-bold transition shadow-xs ${
                  partySaveSuccess
                    ? "bg-emerald-600 text-white"
                    : isPartyDirty
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    : "bg-slate-200 text-slate-500 cursor-default"
                }`}
              >
                {isSavingInlineParty ? "Saving..." : partySaveSuccess ? "✓ Saved!" : "💾 Save"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. Main Body: Busy-Style Item Grid (Left/Center) + Summary/Tender (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left/Center Pane: Item Search, Table Grid & Stock Indicator */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden border-r border-slate-200">
          

          {/* Fast Item Search Bar (Ctrl+K) */}
          <div className="px-3 py-1.5 border-b border-slate-200 bg-slate-50/50 relative shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                id="pos-item-search"
                ref={itemSearchInputRef}
                type="text"
                placeholder="Scan barcode / enter item name, weight, code... (e.g. 'bhuj 400') [Ctrl+K]"
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
                      const nameInputs = document.querySelectorAll<HTMLInputElement>("table input[data-pos-field='name']");
                      if (nameInputs.length > 0) {
                        nameInputs[0].focus();
                        nameInputs[0].select();
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
                      // Immediately focus Product Name of the added/updated row with text selected
                      setTimeout(() => {
                        const targetName = targetLineId
                          ? document.querySelector<HTMLInputElement>(`tr[data-line-id='${targetLineId}'] input[data-pos-field='name']`)
                          : null;
                        const nameInput = targetName || document.querySelector<HTMLInputElement>("table tr:last-child input[data-pos-field='name']");
                        if (nameInput) {
                          nameInput.focus();
                          nameInput.select();
                        }
                      }, 40);
                    } else if (!itemSearchTerm.trim() && activeTab.cart.length > 0) {
                      e.preventDefault();
                      setIsSaveConfirmOpen(true);
                    }
                  } else if (e.key === "Escape") {
                    if (itemSearchTerm) {
                      e.preventDefault();
                      setItemSearchTerm("");
                      setSearchSelectedIndex(0);
                    }
                  }
                }}
                className="w-full pl-9 pr-24 py-1.5 bg-white border border-slate-300 rounded-lg text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 shadow-2xs transition"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {itemSearchTerm && (
                  <button
                    onClick={() => setItemSearchTerm("")}
                    className="p-1 text-slate-400 hover:text-slate-600 text-xs font-black mr-1"
                  >
                    ✕
                  </button>
                )}
                <span className="hidden sm:inline-block font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                  Ctrl+K
                </span>
              </div>
            </div>

            {/* Autocomplete Dropdown (G11) */}
            {filteredProducts.length > 0 && (
              <div
                data-testid="pos-search-results"
                role="listbox"
                aria-label="Product search results"
                className="absolute left-3 right-3 top-full mt-1 bg-white border-2 border-[#790E11]/40 rounded-lg shadow-2xl z-40 max-h-80 overflow-y-auto divide-y divide-slate-100 font-sans"
              >
                {filteredProducts.map((p, pIdx) => {
                  const isHighlighted = pIdx === searchSelectedIndex;
                  const inStock = (p.shopStockQty ?? 0) + (p.godownStockQty ?? 0) > 0;
                  const weightText = p.weight ? ` ${p.weight}` : (p.weightValue ? ` ${p.weightValue}${p.weightUnit || "g"}` : "");
                  const fullTitle = `${p.name}${weightText}`;
                  const segments = splitHighlightSegments(fullTitle, itemSearchTerm);
                  const mrpRupeesStr = p.mrpPaise && p.mrpPaise > 0 ? `MRP ₹${(p.mrpPaise / 100).toFixed(0)}` : null;

                  return (
                    <div
                      key={p.id}
                      role="option"
                      aria-selected={isHighlighted}
                      data-testid="pos-search-option"
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
                          const targetName = targetLineId
                            ? document.querySelector<HTMLInputElement>(`tr[data-line-id='${targetLineId}'] input[data-pos-field='name']`)
                            : null;
                          const nameInput = targetName || document.querySelector<HTMLInputElement>("table tr:last-child input[data-pos-field='name']");
                          if (nameInput) {
                            nameInput.focus();
                            nameInput.select();
                          }
                        }, 40);
                      }}
                      className={`px-3.5 py-2.5 flex items-center justify-between text-sm cursor-pointer transition ${
                        isHighlighted
                          ? "bg-[#790E11] text-white font-semibold"
                          : "bg-white text-slate-900 hover:bg-amber-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="truncate font-semibold">
                          {segments.map((seg, sIdx) =>
                            seg.matched ? (
                              <mark
                                key={sIdx}
                                className={
                                  isHighlighted
                                    ? "bg-[#FDAF18] text-slate-950 px-0.5 rounded font-black"
                                    : "bg-amber-200 text-slate-950 px-0.5 rounded font-black"
                                }
                              >
                                {seg.text}
                              </mark>
                            ) : (
                              <React.Fragment key={sIdx}>{seg.text}</React.Fragment>
                            )
                          )}
                        </span>
                        {mrpRupeesStr && (
                          <span
                            className={`font-mono text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${
                              isHighlighted
                                ? "bg-white/15 text-[#FDAF18]"
                                : "bg-slate-100 text-slate-800 border border-slate-200"
                            }`}
                          >
                            {mrpRupeesStr}
                          </span>
                        )}
                        {(() => {
                          const resolved = resolvePrice(
                            {
                              mrpPaise: p.mrpPaise ?? null,
                              priceAPaise: p.priceAPaise ?? null,
                              priceBPaise: p.priceBPaise ?? null,
                              priceCPaise: p.priceCPaise ?? null,
                            },
                            effectiveTier
                          );
                          const price = resolved.unitPricePaise;
                          return price > 0 ? (
                            <span
                              className={`font-mono text-xs font-bold shrink-0 ${
                                isHighlighted ? "text-emerald-200" : "text-emerald-700"
                              }`}
                            >
                              Rate ₹{(price / 100).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-400 font-semibold shrink-0">
                              Rate unset
                            </span>
                          );
                        })()}
                        {!inStock && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              isHighlighted
                                ? "bg-rose-950 text-rose-200 border border-rose-700"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            Out
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xs shrink-0 ml-3 flex items-center gap-2 font-mono ${
                          isHighlighted ? "text-slate-200" : "text-slate-600"
                        }`}
                      >
                        <span className="font-sans font-semibold">{p.companyName || "Generic"}</span>
                        <span>· {p.packSize} pcs/ctn</span>
                        <span>· Shop:{p.shopStockQty ?? 0} Gdn:{p.godownStockQty ?? 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* FMCG Sales Voucher Ledger Grid (Text-Until-Focused Hero Grid) */}
          <div className="flex-1 overflow-y-auto bg-white">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-700 tracking-wider sticky top-0 z-10 shadow-2xs select-none">
                    <th className="py-2 px-2.5 w-11 text-center border-r border-slate-200">#</th>
                    <th className="py-2 px-3 min-w-[260px] border-r border-slate-200">Item Description</th>
                    <th className="py-2 px-2 w-20 text-center border-r border-slate-200">Qty</th>
                    <th className="py-2 px-2 w-24 text-center border-r border-slate-200">Unit</th>
                    <th className="py-2 px-2 w-26 text-right border-r border-slate-200">List Price</th>
                    <th className="py-2 px-2 w-28 text-right border-r border-slate-200">Rate (₹)</th>
                    <th className="py-2 px-2 w-20 text-center border-r border-slate-200">Disc %</th>
                    <th className="py-2 px-3 w-32 text-right border-r border-slate-200">Amount (₹)</th>
                    <th className="py-2 px-2 w-14 text-center">Act</th>
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

                    const ratePerUnitPaise = line.isCustomRate && line.customRatePaise != null
                      ? line.customRatePaise
                      : defaultRatePaise;

                    const baseMrp = (line.customMrpPaise != null && line.customMrpPaise > 0)
                      ? line.customMrpPaise
                      : ((line.product.mrpPaise && line.product.mrpPaise > 0)
                        ? line.product.mrpPaise
                        : (ratePerUnitPaise > 0 ? (line.unit === "Carton" || line.unit === "Bag" ? Math.round(ratePerUnitPaise / packSize) : line.unit === "Dozen" ? Math.round(ratePerUnitPaise / 12) : ratePerUnitPaise) : 0));

                    const mrpPerUnitPaise = line.unit === "Carton" || line.unit === "Bag" ? baseMrp * packSize : line.unit === "Dozen" ? baseMrp * 12 : baseMrp;

                    const lineAmountPaise = Math.round(line.qty * ratePerUnitPaise);

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
                        className={`min-h-[44px] h-11 transition-colors cursor-pointer ${
                          !isStockSufficient
                            ? "bg-rose-50/70 hover:bg-rose-100/60 border-l-4 border-l-rose-500"
                            : isSelected
                            ? "bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-[#790E11] font-medium"
                            : index % 2 === 0
                            ? "bg-white hover:bg-slate-50"
                            : "bg-slate-50/40 hover:bg-slate-100/60"
                        }`}
                      >
                        <td className="py-1.5 px-2.5 text-center text-slate-600 font-mono text-sm font-bold border-r border-slate-100">
                          {index + 1}
                        </td>

                        <td className="py-1.5 px-2 border-r border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              data-pos-field="name"
                              value={line.customNameInput !== undefined ? line.customNameInput : line.product.name}
                              onChange={(e) => updateLineProductName(line.id, e.target.value)}
                              onBlur={() => persistProductNameChange(line.id)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => handlePosCellKeyDown(e, "name", index, line.id)}
                              title="Product Name (Editable - permanently updates product in catalog)"
                              className="flex-1 min-h-[38px] px-2 py-1 text-base font-bold text-slate-900 bg-transparent hover:bg-slate-100/60 rounded border border-transparent hover:border-slate-300 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                            />
                            {!isStockSufficient && (
                              <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                                Low ({isCarton ? `${availableCartons} ctn` : `${line.product.shopStockQty ?? 0} pcs`})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Qty Input */}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-100">
                          <input
                            data-pos-field="qty"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={line.qty}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9]/g, "");
                              updateLineQty(line.id, sanitized === "" ? 1 : parseInt(sanitized, 10) || 1);
                            }}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handlePosCellKeyDown(e, "qty", index, line.id, line.qty)}
                            className="w-18 min-h-[38px] px-1.5 py-1 text-center font-black text-base bg-transparent hover:bg-slate-100/60 rounded border border-transparent hover:border-slate-300 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                          />
                        </td>

                        {/* Unit Selector */}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-100">
                          <select
                            data-pos-field="unit"
                            aria-label={`Unit for ${line.product.name}`}
                            value={line.unit}
                            onChange={(e) => updateLineUnit(line.id, e.target.value as "Pcs" | "Carton" | "Dozen" | "Bag")}
                            onKeyDown={(e) => handlePosCellKeyDown(e, "unit", index, line.id)}
                            className="w-28 min-h-[38px] px-1.5 py-1 text-base font-semibold bg-transparent hover:bg-slate-100/60 rounded border border-transparent hover:border-slate-300 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none cursor-pointer transition-colors"
                          >
                            <option value="Pcs">Pcs</option>
                            <option value="Carton">Carton (Crt)</option>
                            <option value="Dozen">Dozen (12)</option>
                            <option value="Bag">Bag (Beg)</option>
                          </select>
                        </td>

                        {/* MRP */}
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-100">
                          <div className="flex flex-col items-end">
                            <div className="relative inline-flex items-center justify-end w-24">
                              <span className="absolute left-1.5 text-slate-500 font-mono text-xs pointer-events-none font-bold">₹</span>
                              <input
                                type="text" inputMode="decimal"
                                value={
                                  line.customMrpInput !== undefined
                                    ? line.customMrpInput
                                    : mrpPerUnitPaise > 0
                                    ? (mrpPerUnitPaise / 100).toFixed(2)
                                    : ""
                                }
                                placeholder="0.00"
                                onChange={(e) => updateLineMrp(line.id, e.target.value)}
                                onBlur={() => persistMrpChange(line.id)}
                                onFocus={(e) => e.target.select()}
                                data-pos-field="mrp"
                                onKeyDown={(e) => handlePosCellKeyDown(e, "mrp", index, line.id)}
                                title="Editable Line MRP (Permanently syncs to Master)"
                                className="w-full min-h-[38px] pl-5 pr-1.5 py-1 text-right font-mono font-bold text-base rounded border border-transparent hover:border-slate-300 bg-transparent hover:bg-slate-100/60 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                              />
                            </div>
                          </div>
                        </td>

                        {/* Rate */}
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-100">
                          <div className="relative inline-flex items-center justify-end w-26">
                            <span className="absolute left-1.5 text-slate-500 font-mono text-xs pointer-events-none font-bold">₹</span>
                            <input
                              type="text" inputMode="decimal"
                              value={line.customRateInput !== undefined ? line.customRateInput : (ratePerUnitPaise > 0 ? (ratePerUnitPaise / 100).toFixed(2) : "")}
                              placeholder="0.00"
                              onChange={(e) => updateLineRate(line.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              data-pos-field="rate"
                              onKeyDown={(e) => handlePosCellKeyDown(e, "rate", index, line.id)}
                              title="Selling rate manually"
                              className="w-full min-h-[38px] pl-5 pr-1.5 py-1 text-right font-mono font-black text-base rounded border border-transparent hover:border-slate-300 bg-transparent hover:bg-slate-100/60 text-slate-900 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Disc % */}
                        <td className="py-1.5 px-1.5 text-center border-r border-slate-100">
                          <div className="relative inline-flex items-center justify-center w-20">
                            <input
                              type="text" inputMode="decimal"
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
                              onKeyDown={(e) => handlePosCellKeyDown(e, "disc", index, line.id)}
                              title="Discount % off MRP. Changing this automatically calculates selling rate."
                              className="w-full min-h-[38px] pl-1 pr-4 py-1 text-center font-mono font-bold text-base rounded border border-transparent hover:border-slate-300 bg-transparent hover:bg-slate-100/60 text-slate-900 focus:bg-[#FEF3C7] focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                            />
                            <span className="absolute right-1.5 text-slate-500 font-bold text-xs pointer-events-none">%</span>
                          </div>
                        </td>

                        {/* Amount (₹) */}
                        <td className="py-1.5 px-1.5 text-right border-r border-slate-100">
                          <div className="relative inline-flex items-center justify-end w-28">
                            <span className="absolute left-1.5 text-slate-500 font-mono text-xs pointer-events-none font-bold">₹</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              data-pos-field="amount"
                              value={
                                line.customAmountInput !== undefined
                                  ? line.customAmountInput
                                  : lineAmountPaise > 0
                                  ? (lineAmountPaise / 100).toFixed(2)
                                  : ""
                              }
                              placeholder="0.00"
                              onChange={(e) => updateLineAmount(line.id, e.target.value)}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => handlePosCellKeyDown(e, "amount", index, line.id)}
                              title="Line Amount (₹). Changing this derives rate and discount %."
                              className="w-full min-h-[38px] pl-5 pr-1.5 py-1 text-right font-mono font-black text-base rounded border border-transparent hover:border-slate-300 bg-transparent hover:bg-slate-100/60 text-slate-900 focus:bg-[#FEF3C7] focus:text-slate-950 focus:outline-[3px] focus:outline-[#790E11] outline-none transition-colors"
                            />
                          </div>
                        </td>

                        {/* Edit Master & Delete Line */}
                        <td className="py-1 px-1 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditProductMaster(line.product);
                              }}
                              title="Edit Product Master (Alt+M)"
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLine(line.id);
                              }}
                              title="Remove line (F9)"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Empty Guidance Row */}
                  {activeTab.cart.length === 0 && (
                    <tr className="h-10 bg-slate-50/50 border-b border-slate-100">
                      <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-100 font-bold">1</td>
                      <td colSpan={8} className="px-4 text-xs font-medium text-slate-500">
                        Scan item barcode or press <kbd className="font-mono text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-300 shadow-2xs font-bold">[Ctrl+K / F1]</kbd> to search products...
                      </td>
                    </tr>
                  )}
                  {Array.from({ length: Math.max(0, 12 - Math.max(1, activeTab.cart.length)) }).map((_, emptyIdx) => {
                    const rowNum = Math.max(1, activeTab.cart.length) + emptyIdx + 1;
                    return (
                      <tr key={`empty-row-${rowNum}`} className="h-7 hover:bg-slate-50/30 border-b border-slate-100">
                        <td className="text-center font-mono text-[11px] text-slate-300 border-r border-slate-100">{rowNum}</td>
                        <td className="border-r border-slate-100 px-3"></td>
                        <td className="border-r border-slate-100"></td>
                        <td className="border-r border-slate-100"></td>
                        <td className="border-r border-slate-100"></td>
                        <td className="border-r border-slate-100"></td>
                        <td className="border-r border-slate-100"></td>
                        <td className="border-r border-slate-100"></td>
                        <td></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>

          {/* Status Line Under Grid */}
          <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 text-xs font-mono font-medium text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
            {highlightedProduct ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-900 font-sans">
                  {highlightedProduct.name} {highlightedProduct.weight || (highlightedProduct.weightValue ? `${highlightedProduct.weightValue}${highlightedProduct.weightUnit || "g"}` : "")}:
                </span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[11px]">
                  Shop: <strong>{highlightedProduct.shopStockQty} pcs</strong>
                </span>
                <span className="bg-slate-200/80 text-slate-800 border border-slate-300 px-1.5 py-0.2 rounded text-[11px]">
                  Godown: <strong>{highlightedProduct.godownCartons} ctn</strong> ({highlightedProduct.godownStockQty} pcs)
                </span>
                <span className="text-slate-600 text-[11px]">
                  Pack: <strong>{highlightedProduct.packSize}</strong>
                </span>
                <span className="text-slate-400">|</span>
                <span className="text-slate-700 text-[11px]">
                  Last rate: <strong className="font-bold text-blue-900">
                    {lastItemPurchase ? `₹${(lastItemPurchase.ratePaise / 100).toFixed(2)}` : `₹${((highlightedProduct.priceAPaise || highlightedProduct.mrpPaise || 0) / 100).toFixed(2)}`}
                  </strong>
                </span>
              </div>
            ) : (
              <span className="text-slate-500 italic font-sans text-xs">Select an item row to inspect stock &amp; rate. Press [F8] for full diagnostics.</span>
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

        {/* Right Pane: Compact Bill Summary & Sticky Settlement Bar */}
        <aside className="w-full lg:w-96 bg-slate-50/50 flex flex-col justify-between shrink-0 border-l border-slate-200 h-full overflow-hidden">
          {/* Scrollable Upper Section */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {/* Error Message Banner */}
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start justify-between gap-2 shadow-2xs">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-semibold leading-relaxed">{errorMessage}</span>
                </div>
                <button onClick={() => setErrorMessage(null)} className="text-xs font-black text-rose-600 hover:text-rose-900 p-0.5">✕</button>
              </div>
            )}

            {/* Order Discount % */}
            <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
              <label className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-blue-600" />
                <span>Order Discount:</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="order-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={activeTab.orderDiscountPercent}
                  onChange={(e) => updateActiveTab({ orderDiscountPercent: e.target.value })}
                  title="Order discount % (Alt+D)"
                  className="w-16 px-2 py-0.5 text-right font-black text-xs bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-blue-600"
                />
                <span className="text-slate-500 font-bold text-xs">%</span>
              </div>
            </div>

            {/* Financial Breakdown Stack */}
            <div className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200 text-xs shadow-2xs">
              <div className="flex justify-between text-slate-600 font-medium text-[11px]">
                <span>Subtotal (MRP):</span>
                <span className="font-mono font-bold text-slate-800">₹{(subtotalMrpPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                <span>Savings / Discount:</span>
                <span className="font-mono text-emerald-700">-₹{(totalDiscountPaise / 100).toFixed(2)}</span>
              </div>
              {activeTab.documentType === "GST" && (
                <>
                  <div className="flex justify-between text-slate-600 font-medium text-[11px]">
                    <span>Taxable Value:</span>
                    <span className="font-mono font-bold text-slate-800">₹{(taxablePaise / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 font-medium text-[11px]">
                    <span>CGST / SGST:</span>
                    <span className="font-mono font-bold text-slate-800">₹{((cgstPaise + sgstPaise) / 100).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-slate-500 font-medium text-[11px] pt-1 border-t border-slate-100">
                <span>Round-off:</span>
                <span className="font-mono font-bold text-slate-700">
                  {roundoffPaise >= 0 ? `+₹${(roundoffPaise / 100).toFixed(2)}` : `-₹${(Math.abs(roundoffPaise) / 100).toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Grand Total Hero Card (Brand Maroon Highlight Card) */}
            <div className="p-3.5 rounded-xl bg-[#790E11] text-white shadow-md space-y-1 border-2 border-[#FDAF18]">
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-bold uppercase tracking-wider text-amber-100">NET PAYABLE</span>
                <span className="text-xs font-bold bg-white/15 text-[#FDAF18] px-2 py-0.5 rounded uppercase">
                  {activeTab.documentType === "GST" ? "GST Invoice" : "Retail Invoice"}
                </span>
              </div>
              <div className="text-[30px] leading-tight font-black font-mono text-[#FDAF18] tracking-tight">
                ₹{(totalAmountPaise / 100).toFixed(2)}
              </div>
              {amountInWords && (
                <p className="text-xs text-amber-50/90 pt-1 border-t border-white/15 leading-snug">
                  {amountInWords}
                </p>
              )}
            </div>

            {/* Payment Mode Selector Segmented Control */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                Payment Tender Mode
              </label>
              <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CASH })}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab.paymentMode === PaymentMode.CASH
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.UPI })}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab.paymentMode === PaymentMode.UPI
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                  <span>UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateActiveTab({ paymentMode: PaymentMode.CREDIT, paymentCollected: false })}
                  className={`py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    activeTab.paymentMode === PaymentMode.CREDIT
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                  <span>Credit</span>
                </button>
              </div>
            </div>

            {/* Document Type: Retail Bill vs GST Bill (Alt+G) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider">
                Invoice Format (Alt+G)
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateActiveTab({ documentType: "RETAIL" })}
                  className={`py-1 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    (activeTab.documentType ?? "RETAIL") === "RETAIL"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <span>Retail Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateActiveTab({ documentType: "GST" })}
                  className={`py-1 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                    activeTab.documentType === "GST"
                      ? "bg-purple-900 text-white shadow-xs ring-1 ring-purple-500"
                      : "text-slate-700 hover:text-slate-900"
                  }`}
                >
                  <span className="font-mono text-[9px] bg-purple-800 text-purple-200 px-1 rounded">GST</span>
                  <span>GST Bill</span>
                </button>
              </div>
            </div>

            {/* Derived Payment Status Indicator (determined automatically by payment mode) */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs">
              <span className="font-bold text-slate-600">Status (Auto):</span>
              <span className="font-black text-slate-900">
                {activeTab.paymentMode === "CREDIT"
                  ? "Credit (Pending)"
                  : activeTab.paymentMode === "SPLIT"
                  ? "Split Payment"
                  : "Done (Paid)"}
              </span>
            </div>

            {/* Bill Date Selector (Admin Only) */}
            {isAdmin && (
              <div className="p-2 rounded-lg border border-amber-300 bg-amber-50/60 space-y-1 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-amber-950 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-amber-700" />
                    <span>{isEditMode ? "Invoice Bill Date" : "Bill Date (Admin)"}</span>
                  </label>
                  {isEditMode ? (
                    (() => {
                      const origStr = initialEditInvoice ? toIstDateString(initialEditInvoice.invoiceDate || initialEditInvoice.createdAt) : todayStr;
                      const isChanged = activeTab.billDate && activeTab.billDate !== origStr;
                      return isChanged ? (
                        <span className="text-[9px] font-black bg-rose-600 text-white px-1.5 py-0.2 rounded uppercase animate-pulse">
                          Changed
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold bg-emerald-700 text-white px-1.5 py-0.2 rounded uppercase">
                          Original ({origStr})
                        </span>
                      );
                    })()
                  ) : activeTab.billDate && activeTab.billDate > todayStr ? (
                    <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase">
                      Post-dated
                    </span>
                  ) : activeTab.billDate && activeTab.billDate < todayStr ? (
                    <span className="text-[9px] font-bold bg-amber-600 text-white px-1.5 py-0.2 rounded uppercase">
                      Backdated
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    max={maxFutureDateStr}
                    value={
                      isEditMode
                        ? activeTab.billDate || (initialEditInvoice ? toIstDateString(initialEditInvoice.invoiceDate || initialEditInvoice.createdAt) : todayStr)
                        : activeTab.billDate || todayStr
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (isEditMode) {
                        updateActiveTab({ billDate: val });
                      } else {
                        updateActiveTab({ billDate: val === todayStr ? undefined : val });
                      }
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-white border border-amber-300 rounded font-mono text-slate-900 font-bold"
                  />
                  {isEditMode ? (
                    (() => {
                      const origStr = initialEditInvoice ? toIstDateString(initialEditInvoice.invoiceDate || initialEditInvoice.createdAt) : todayStr;
                      return activeTab.billDate && activeTab.billDate !== origStr ? (
                        <button
                          type="button"
                          onClick={() => updateActiveTab({ billDate: origStr })}
                          title="Restore original bill date"
                          className="px-2 py-1 text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-700 rounded shadow-2xs"
                        >
                          Restore
                        </button>
                      ) : null;
                    })()
                  ) : activeTab.billDate && activeTab.billDate !== todayStr ? (
                    <button
                      type="button"
                      onClick={() => updateActiveTab({ billDate: undefined })}
                      title="Reset to real-time today"
                      className="px-2 py-1 text-[10px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 rounded shadow-2xs"
                    >
                      Today
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {/* Remarks Input */}
            <div>
              <input
                type="text"
                placeholder="Remarks (vehicle / notes / po)..."
                value={activeTab.remarks}
                onChange={(e) => updateActiveTab({ remarks: e.target.value })}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Real-time insufficient stock alert indicator */}
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
                  className="p-2 bg-rose-50 border border-rose-300 hover:bg-rose-100 rounded-lg cursor-pointer text-xs space-y-0.5 transition animate-pulse"
                >
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{insufficientCount} Item(s) Short of Stock!</span>
                  </div>
                  <p className="text-rose-700 text-[10px]">Click to review shortage or adjust quantities.</p>
                </div>
              );
            })()}
          </div>

          {/* Sticky Bottom Action Bar: Always Above the Fold at 1366x768 */}
          <div className="p-3 bg-white border-t border-slate-200 shadow-md shrink-0 flex flex-col gap-2">
            <button
              onClick={() => {
                if (activeTab.cart.length > 0) {
                  setIsSaveConfirmOpen(true);
                } else {
                  handleFinalizeBill();
                }
              }}
              disabled={activeTab.cart.length === 0 || isFinalizing}
              className="w-full h-11 rounded-xl font-black text-sm sm:text-base shadow-md hover:shadow-lg disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer bg-slate-900 hover:bg-slate-800 text-white active:scale-[0.99]"
            >
              {isFinalizing ? (
                <span>Finalizing Invoice...</span>
              ) : (
                <>
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Finalize &amp; Print (F2)</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleHoldCurrentBill}
                disabled={activeTab.cart.length === 0}
                className="h-8 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center gap-1 disabled:opacity-40 transition"
                title="Hold bill (F4)"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Hold (F4)</span>
              </button>
              <button
                type="button"
                onClick={handleCreateNewTab}
                className="h-8 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center justify-center gap-1 transition"
                title="New bill (F3)"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>New (F3)</span>
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* 4. Bottom Key Legend Bar */}
      <footer
        data-testid="pos-key-legend"
        className="bg-[#790E11] text-white px-3 py-2 flex items-center justify-between text-xs font-mono font-bold shrink-0 border-t-2 border-[#FDAF18]"
      >
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-wrap">
          <button
            type="button"
            onClick={() => {
              if (activeTab.cart.length > 0) setIsSaveConfirmOpen(true);
              else handleFinalizeBill();
            }}
            disabled={activeTab.cart.length === 0 || isFinalizing}
            className="bg-[#FDAF18] hover:bg-[#FC830D] disabled:opacity-50 px-2 py-0.5 rounded text-slate-950 font-black transition cursor-pointer"
          >
            F2 Finish
          </button>
          <button
            type="button"
            onClick={handleCreateNewTab}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            F3 New
          </button>
          <span className="bg-white/10 px-2 py-0.5 rounded border border-white/15 text-amber-200">
            Alt+F3 New Anywhere
          </span>
          <button
            type="button"
            onClick={handleHoldCurrentBill}
            disabled={activeTab.cart.length === 0}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            F4 Hold
          </button>
          <button
            type="button"
            onClick={() => setShowHeldModal(true)}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            F5 Held
          </button>
          <button
            type="button"
            onClick={() => {
              itemSearchInputRef.current?.focus();
              itemSearchInputRef.current?.select();
            }}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            F6 Add Row
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
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            F7 Repeat
          </button>
          {((isEditMode && canVoidInvoice) || (!isEditMode && canDeleteBill)) && (
            <button
              type="button"
              onClick={() => {
                if (isEditMode && initialEditInvoice) {
                  setVoidEditReason("");
                  setVoidEditError(null);
                  setVoidEditModalOpen(true);
                } else if (activeTab.cart.length === 0) {
                  updateActiveTab({ partyId: "", remarks: "", orderDiscountPercent: "0", walkInName: "", walkInMobile: "", walkInAddress: "" });
                } else {
                  setDiscardConfirmOpen(true);
                }
              }}
              className="bg-rose-900/70 hover:bg-rose-800 px-2 py-0.5 rounded border border-rose-300/40 text-white transition cursor-pointer"
            >
              F8 Del Bill
            </button>
          )}
          <button
            type="button"
            onClick={handleDeleteHighlightedOrLastLine}
            disabled={activeTab.cart.length === 0}
            className="bg-rose-900/70 hover:bg-rose-800 px-2 py-0.5 rounded border border-rose-300/40 text-white transition cursor-pointer"
          >
            F9 Del Row
          </button>
          <button
            type="button"
            onClick={() => {
              setPartyPopupReason("alt_p");
              setIsPartyPopupOpen(true);
            }}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-amber-200 transition cursor-pointer"
          >
            Alt+P Party
          </button>
          <button
            type="button"
            onClick={() => setQuickCustomerModalOpen(true)}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            Alt+N New Party
          </button>
          <button
            type="button"
            onClick={() => updateActiveTab({ documentType: activeTab.documentType === "GST" ? "RETAIL" : "GST" })}
            className="bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded border border-white/20 text-white transition cursor-pointer"
          >
            Alt+G GST
          </button>
          <span className="bg-white/10 px-2 py-0.5 rounded border border-white/15 text-slate-200">
            Ctrl+K Search · Esc Back
          </span>
        </div>
        <div className="hidden lg:flex items-center gap-3 text-[11px] font-sans text-amber-100 shrink-0">
          <span><strong>{locationName}</strong> · <strong>{cashierName}</strong></span>
        </div>
      </footer>

      {/* F8 Discard Unsaved Bill Modal (G10) */}
      {discardConfirmOpen && (
        <div
          data-testid="pos-delete-bill-confirm"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border-2 border-[#790E11] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-[#790E11]">Delete this bill? (Discard unsaved bill)</h3>
            <p className="text-sm text-slate-700">
              All {activeTab.cart.length} unsaved item(s) will be cleared. No stock or party ledger entries will be touched.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDiscardConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold cursor-pointer"
              >
                No, Keep Editing [N / Esc]
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiscardConfirmOpen(false);
                  updateActiveTab({
                    cart: [],
                    partyId: "",
                    orderDiscountPercent: "0",
                    remarks: "",
                    walkInName: "",
                    walkInMobile: "",
                    walkInAddress: "",
                  });
                  setPricingResult(null);
                  setTimeout(() => {
                    itemSearchInputRef.current?.focus();
                    itemSearchInputRef.current?.select();
                  }, 25);
                }}
                className="px-4 py-2 rounded-xl bg-[#790E11] hover:bg-[#5E0A0D] text-white text-sm font-bold cursor-pointer"
              >
                Yes, Discard [Y]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F8 Void Invoice in Edit Mode Modal (G10) */}
      {voidEditModalOpen && initialEditInvoice && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white border-2 border-rose-600 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-rose-700">
              Void / Delete Invoice {initialEditInvoice.number}?
            </h3>
            <p className="text-xs text-slate-600">
              Keeps invoice number, posts SALE_CANCEL stock movements, and reverses party ledger balance.
            </p>
            {voidEditError && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {voidEditError}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {["Wrong party", "Wrong item / rate", "Customer cancelled", "Duplicate bill"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setVoidEditReason(preset)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={voidEditReason}
              onChange={(e) => setVoidEditReason(e.target.value)}
              placeholder="Reason for voiding invoice (min 5 chars)..."
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-rose-500 outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isVoidingEdit}
                onClick={() => setVoidEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isVoidingEdit || voidEditReason.trim().length < 5}
                onClick={async () => {
                  setIsVoidingEdit(true);
                  setVoidEditError(null);
                  try {
                    const res = await cancelInvoiceAction(initialEditInvoice.id, voidEditReason);
                    if (!res.success) {
                      setVoidEditError(res.error || "Permission denied or cancellation failed");
                    } else {
                      setVoidEditModalOpen(false);
                      router.push("/shop/invoices");
                    }
                  } finally {
                    setIsVoidingEdit(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {isVoidingEdit ? "Voiding..." : "Confirm Void"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Counter Sale Details Popup (G5) */}
      {counterDetailsOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-[#790E11] rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-base font-black text-[#790E11]">Walk-in Customer Details (Optional)</h3>
              <button type="button" onClick={() => setCounterDetailsOpen(false)} className="text-slate-500 cursor-pointer">✕</button>
            </div>
            <div className="space-y-2.5 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Customer Name</label>
                <input
                  type="text"
                  value={activeTab.walkInName || ""}
                  onChange={(e) => updateActiveTab({ walkInName: e.target.value })}
                  placeholder="Optional customer name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={activeTab.walkInMobile || ""}
                  onChange={(e) => updateActiveTab({ walkInMobile: e.target.value })}
                  placeholder="Optional 10-digit mobile"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address / Notes</label>
                <input
                  type="text"
                  value={activeTab.walkInAddress || ""}
                  onChange={(e) => updateActiveTab({ walkInAddress: e.target.value })}
                  placeholder="Optional address"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={counterDetailsSaveParty}
                  onChange={(e) => setCounterDetailsSaveParty(e.target.checked)}
                />
                <span>Save as customer (create Party in directory)</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCounterDetailsOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (counterDetailsSaveParty && activeTab.walkInName?.trim()) {
                    const res = await createQuickPartyAction({
                      name: activeTab.walkInName.trim(),
                      phone: activeTab.walkInMobile?.trim() || undefined,
                      address: activeTab.walkInAddress?.trim() || undefined,
                      type: "CUSTOMER",
                    });
                    if (res.party) {
                      const created: PartyItem = {
                        id: res.party.id,
                        name: res.party.name,
                        type: res.party.type,
                        phone: res.party.phone,
                        creditEnabled: res.party.creditEnabled,
                        creditLimitPaise: res.party.creditLimitPaise,
                        currentOutstandingPaise: 0,
                      };
                      setLocalParties((prev) => [created, ...prev]);
                      updateActiveTab({ partyId: created.id, tabTitle: created.name });
                    }
                  }
                  setCounterDetailsSaveParty(false);
                  setCounterDetailsOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#790E11] text-white text-xs font-bold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Info Diagnostics Modal [F8] */}
      <ItemInfoModal
        isOpen={isItemInfoOpen}
        onClose={() => setIsItemInfoOpen(false)}
        product={highlightedProduct}
        lastPartyRatePaise={lastItemPurchase?.ratePaise}
        partyName={selectedParty?.name}
      />

      {/* Prompt #18 Modals */}
      <QuickAddProductModal
        isOpen={showQuickAddModal}
        onClose={() => setShowQuickAddModal(false)}
        companies={companies}
        locationId={locationId}
        onProductCreated={(newProd) => {
          setLiveProducts((prev) => [newProd, ...prev]);
          addItemToCart(newProd, "Pcs", 1);
        }}
      />

      {/* Edit Product Master Modal [Alt+M] */}
      <EditProductMasterModal
        isOpen={editProductModal.isOpen}
        onClose={() => setEditProductModal({ isOpen: false, product: null })}
        product={editProductModal.product}
        allProducts={productsList}
        companies={companies}
        categories={categories}
        onProductUpdated={handleProductMasterUpdated}
      />

      {/* Floating Success Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#12355B] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/20 flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      )}

      {shortStockCorrection && (
        <StockCorrectionModal
          isOpen={Boolean(shortStockCorrection)}
          onClose={() => setShortStockCorrection(null)}
          productId={shortStockCorrection.productId}
          productName={shortStockCorrection.productName}
          locationId={locationId}
          currentStock={shortStockCorrection.currentStock}
          neededStock={shortStockCorrection.neededStock}
          cashierRole={cashierRole}
          onSuccess={(newQty) => {
            setLiveProducts((prev) =>
              prev.map((p) =>
                p.id === shortStockCorrection.productId
                  ? { ...p, shopStockQty: newQty }
                  : p
              )
            );
            setErrorMessage(null);
          }}
        />
      )}

      <PosTodaySalesModal
        isOpen={showTodaySalesModal}
        onClose={() => setShowTodaySalesModal(false)}
        locationId={locationId}
        locationName={locationName}
        canVoidInvoice={canVoidInvoice}
      />

      <RevisionHistoryModal
        isOpen={showRevisionHistory}
        onClose={() => setShowRevisionHistory(false)}
        invoiceNumber={initialEditInvoice?.number || "Invoice"}
        revisions={initialEditInvoice?.revisions || []}
      />

      {/* Save Voucher Confirmation Dialog [F2] */}
      <SaveVoucherDialog
        isOpen={isSaveConfirmOpen}
        onConfirm={(chosenFormat) => {
          setIsSaveConfirmOpen(false);
          handleFinalizeBill(undefined, chosenFormat);
        }}
        onCancel={() => setIsSaveConfirmOpen(false)}
        partyName={selectedParty ? selectedParty.name : (activeTab.walkInName || "Counter Sale (Walk-in)")}
        hasLinkedParty={Boolean(selectedParty)}
        creditEnabled={Boolean(selectedParty) && (effectivePosSettings.creditAllParties || selectedParty?.creditEnabled)}
        creditLimitPaise={selectedParty?.creditLimitPaise ?? 0}
        currentOutstandingPaise={selectedParty?.currentOutstandingPaise ?? 0}
        documentType={activeTab.documentType ?? "RETAIL"}
        itemsCount={activeTab.cart.length}
        totalQtyPcs={activeTab.cart.reduce((sum, item) => sum + (item.unit === "Carton" ? item.qty * Math.max(1, item.product.packSize) : item.qty), 0)}
        totalAmountPaise={totalAmountPaise}
        paymentMode={activeTab.paymentMode as DialogPaymentMode}
        splitCashRupees={activeTab.splitCashPaise}
        splitUpiRupees={activeTab.splitUpiPaise}
        onSplitChange={(cashStr, upiStr) =>
          updateActiveTab({ splitCashPaise: cashStr, splitUpiPaise: upiStr })
        }
        paymentStatus={activeTab.paymentMode === "CREDIT" ? "PENDING" : "PAID"}
        tier={effectiveTier[0]}
        discountPaise={totalDiscountPaise}
        lines={previewLines}
        isSaving={isFinalizing}
        isEditMode={isEditMode}
        editInvoiceNumber={initialEditInvoice?.number}
        editReason={editReason}
        onEditReasonChange={(val) => setEditReason(val)}
        onPaymentModeChange={(mode) => {
          updateActiveTab({
            paymentMode: mode as any,
            paymentCollected: mode === "CREDIT" ? false : true,
          });
        }}
      />

      {/* Centered Party Popup Overlay (G2 / G13) */}
      <PartySearchModal
        isOpen={isPartyPopupOpen}
        parties={localParties}
        currentPartyId={activeTab.partyId}
        onSelectParty={(party) => {
          if (party) {
            updateActiveTab({
              partyId: party.id,
              tabTitle: party.name,
              walkInName: "",
              walkInMobile: "",
              walkInAddress: "",
            });
          } else {
            updateActiveTab({
              partyId: "",
              tabTitle: "Counter Sale",
            });
          }
          setIsPartyPopupOpen(false);
          setTimeout(() => {
            itemSearchInputRef.current?.focus();
            itemSearchInputRef.current?.select();
          }, 20);
        }}
        onAddNewParty={(initialName) => {
          setIsPartyPopupOpen(false);
          setQuickCustomerForm((prev) => ({
            ...prev,
            name: initialName || "",
          }));
          setQuickCustomerModalOpen(true);
        }}
        onClose={() => {
          if (partyPopupReason === "new_bill" && !activeTab.partyId) {
            updateActiveTab({ partyId: "", tabTitle: "Counter Sale" });
          }
          setIsPartyPopupOpen(false);
          setTimeout(() => {
            itemSearchInputRef.current?.focus();
            itemSearchInputRef.current?.select();
          }, 20);
        }}
      />

      {/* Hidden Same-Tab Direct Print Iframe (G3) */}
      <iframe
        ref={printIframeRef}
        id="pos-print-iframe"
        data-pos-print-frame="true"
        title="POS Direct Print Frame"
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          border: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {/* Print Fallback / Reprint Toast */}
      {printFallbackToast && (
        <div
          role="alert"
          className="fixed bottom-16 right-4 z-50 bg-rose-950 text-white px-4 py-3 rounded-xl shadow-2xl border-2 border-amber-400 flex items-center gap-3 text-xs font-bold"
        >
          <span>Print failed for {printFallbackToast.number || "bill"} — bill is saved.</span>
          <button
            type="button"
            onClick={() => {
              if (printFallbackToast.invoice) {
                triggerDirectIframePrint(printFallbackToast.invoice, printFallbackToast.format);
              }
            }}
            className="px-3 py-1 rounded-lg bg-[#FDAF18] text-slate-950 font-black cursor-pointer"
          >
            Reprint (Ctrl+P)
          </button>
          <button
            type="button"
            onClick={() => setPrintFallbackToast(null)}
            className="text-white/70 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

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
                        className="px-2.5 py-1 text-[11px] font-bold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 inline-flex items-center gap-1 shadow-xs"
                      >
                        <Printer className="w-3 h-3" />
                        Thermal Slip
                      </Link>
                      <Link
                        href={`/shop/invoices/${inv.id}/print?format=a4`}
                        className="px-2.5 py-1 text-[11px] font-bold bg-[#12355B] hover:bg-[#0E2843] text-white rounded-lg inline-flex items-center gap-1 shadow-xs"
                      >
                        <Printer className="w-3 h-3" />
                        Print A4
                      </Link>
                      <Link
                        href={`/shop/invoices/${inv.id}`}
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

            <BillMessagingCard
              invoiceId={finalizedInvoice.id}
              invoiceNumber={finalizedInvoice.number}
              defaultPhone={finalizedInvoice.targetPhone}
              billUrl={finalizedInvoice.billUrl}
              waMeUrl={finalizedInvoice.waMeUrl}
              initialSkipped={finalizedInvoice.messagingSkipped}
              initialReason={finalizedInvoice.messagingReason}
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Link
                ref={thermalBtnRef}
                href={`/shop/invoices/${finalizedInvoice.id}/print`}
                onFocus={() => setFinalizedModalFocusIndex(0)}
                className={`py-3 px-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 transition-all outline-none cursor-pointer ${
                  finalizedModalFocusIndex === 0
                    ? "bg-slate-900 text-white ring-4 ring-[#FC830D] ring-offset-2 scale-[1.03] shadow-xl"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-[#FC830D]" />
                  <span>Thermal Slip (3&quot;)</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">
                  {finalizedModalFocusIndex === 0 ? "↵ Enter / [1]" : "[1]"}
                </span>
              </Link>

              <Link
                ref={a4BtnRef}
                href={`/shop/invoices/${finalizedInvoice.id}/print?format=a4`}
                onFocus={() => setFinalizedModalFocusIndex(1)}
                className={`py-3 px-3 rounded-xl font-black text-xs flex flex-col items-center justify-center gap-1 transition-all outline-none cursor-pointer ${
                  finalizedModalFocusIndex === 1
                    ? "bg-[#0E2843] text-white ring-4 ring-[#FC830D] ring-offset-2 scale-[1.03] shadow-xl"
                    : "bg-[#12355B] hover:bg-[#0E2843] text-white border border-[#0E2843]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-[#FC830D]" />
                  <span>Print A4 Bill</span>
                </div>
                <span className="text-[10px] font-mono text-blue-200">
                  {finalizedModalFocusIndex === 1 ? "↵ Enter / [2]" : "[2]"}
                </span>
              </Link>
            </div>

            <button
              ref={nextBillBtnRef}
              type="button"
              onFocus={() => setFinalizedModalFocusIndex(2)}
              onClick={handleStartNextBill}
              className={`w-full py-3 rounded-xl font-black text-xs text-white transition-all outline-none cursor-pointer flex items-center justify-center gap-2 ${
                finalizedModalFocusIndex === 2
                  ? "bg-[#e57406] ring-4 ring-blue-600 ring-offset-2 scale-[1.03] shadow-xl"
                  : "bg-[#FC830D] hover:bg-[#e57406]"
              }`}
            >
              <span>Start Next Bill (F3 / Esc)</span>
              <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/20 text-white">
                {finalizedModalFocusIndex === 2 ? "↵ Enter" : "F3"}
              </kbd>
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
