"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Clock,
  Layers,
  ChevronDown,
  Info,
  RotateCcw,
  Warehouse,
  ExternalLink,
  Edit3,
  Barcode,
  Sparkles,
  Paperclip,
  Calculator,
  X,
  History,
  TrendingUp,
  FileText,
} from "lucide-react";
import {
  recordPurchaseAction,
  checkDuplicateSupplierBillAction,
  getSupplierPreviousPurchasesAction,
  getSupplierRateHistoryAction,
  getSupplierReorderItemsAction,
} from "../actions";
import { searchItems, SearchableProduct, SearchIndexItem, buildProductSearchIndex, splitHighlightSegments } from "@/lib/search/smart-search";
import { searchParties, SearchableParty } from "@/lib/search/party-search";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { ItemInfoModal } from "@/components/pos/ItemInfoModal";
import { QuickAddProductModal } from "@/components/pos/QuickAddProductModal";
import { EditProductMasterModal } from "@/components/pos/EditProductMasterModal";
import {
  useRovingFocus,
  useListboxKeyboard,
  calculateNextListIndex,
  calculateNextGridPosition,
  isAtCaretBoundary,
  evaluateMathExpression,
  GridPosition,
} from "@/lib/keyboard/navigation";
import {
  AccessibleDateInput,
  AccessibleUnitSelect,
  AccessibleNumberInput,
  UnitOption,
} from "@/components/common/keyboard/AccessibleInputs";

export type UnitType = UnitOption;

export interface GrnLineItem {
  id: string;
  productId: string;
  product?: SearchableProduct | null;
  qtyInput: string;
  unit: UnitType;
  rateInput: string; // Rate per selected unit
  discPercentInput: string; // Discount %
  gstRateBp: number;
}

export interface SupplierItem {
  id: string;
  name: string;
  phone?: string | null;
  gstin?: string | null;
  address?: string | null;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  payableBalancePaise?: number;
}

export interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  barcode?: string | null;
  gstRateBp: number;
  mrpPaise: number;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  packSize?: number;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  weightBase?: number | null;
  bagSize?: number | null;
  shopStockQty?: number;
  godownStockQty?: number;
  reorderLevel?: number;
}

export interface HeldGrnVoucher {
  id: string;
  timestamp: number;
  dateStr: string;
  supplierId: string;
  supplierName: string;
  billNo: string;
  billDate: string;
  locationId: string;
  narration: string;
  items: GrnLineItem[];
  netPayablePaise: number;
}

export interface PurchaseFormProps {
  suppliers: SupplierItem[];
  locations: { id: string; name: string }[];
  products: ProductItem[];
}

export function PurchaseForm({ suppliers, locations, products: initialProducts }: PurchaseFormProps) {
  const router = useRouter();

  // Master product catalog state (supports instant addition via Quick Add Alt+N)
  const [catalog, setCatalog] = useState<ProductItem[]>(initialProducts);

  // Pre-build search index for fast smart search (<5ms)
  const searchIndex: SearchIndexItem[] = useMemo(() => {
    return buildProductSearchIndex(catalog as any);
  }, [catalog]);

  // Header State
  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(() => {
    try {
      const d = new Date();
      return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  });
  const [locationId, setLocationId] = useState<string>(
    locations.find((l) => l.name.toLowerCase().includes("godown"))?.id || locations[0]?.id || ""
  );
  const [narration, setNarration] = useState("");
  const [billDiscountPercent, setBillDiscountPercent] = useState<string>("0");
  const [freightChargesInput, setFreightChargesInput] = useState<string>("0");
  const [loadingChargesInput, setLoadingChargesInput] = useState<string>("0");
  const [supplierBillTotalInput, setSupplierBillTotalInput] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [attachedBillName, setAttachedBillName] = useState<string | null>(null);

  // Duplicate Bill State
  const [duplicateWarning, setDuplicateWarning] = useState<{
    existingId: string;
    existingBillNo: string;
    billDate: string;
    totalPaise: number;
  } | null>(null);

  // Supplier Rate History Map: { [productId]: { lastRatePaise: number, lastDate: string } }
  const [supplierRates, setSupplierRates] = useState<Record<string, { lastRatePaise: number; lastDate: string }>>({});

  // Product Search Bar State (Shop POS Twin)
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [allProductsToggle, setAllProductsToggle] = useState(true);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownContainerRef = useRef<HTMLDivElement>(null);

  // Barcode Scanner Fast-Keystroke Tracking
  const lastKeyTimeRef = useRef<number>(0);
  const barcodeBufferRef = useRef<string>("");

  // Grid Navigation State (Two-Mode Spreadsheet)
  // Grid columns: 0: Qty, 1: Unit, 2: Rate, 3: Disc%, 4: GST, 5: Del
  const [gridFocus, setGridFocus] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [gridMode, setGridMode] = useState<"navigate" | "edit">("navigate");

  // Region Focus Targets for Alt+1, Alt+2, Alt+3, Alt+4
  const billNoInputRef = useRef<HTMLInputElement>(null);
  const summaryPanelRef = useRef<HTMLDivElement>(null);
  const postButtonRef = useRef<HTMLButtonElement>(null);

  // Modals & Drawers State
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierFilterQuery, setSupplierFilterQuery] = useState("");
  const [supplierSelectedIndex, setSupplierSelectedIndex] = useState(0);
  const supplierSearchInputRef = useRef<HTMLInputElement>(null);
  const supplierListContainerRef = useRef<HTMLDivElement>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editMasterOpen, setEditMasterOpen] = useState(false);
  const [heldDrawerOpen, setHeldDrawerOpen] = useState(false);
  const [previousGrnsOpen, setPreviousGrnsOpen] = useState(false);
  const [previousGrns, setPreviousGrns] = useState<any[]>([]);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [reorderItems, setReorderItems] = useState<any[]>([]);
  const [reorderCheckedIds, setReorderCheckedIds] = useState<Set<string>>(new Set());
  const [priceHelperOpen, setPriceHelperOpen] = useState(false);
  const [priceUpdatesChecked, setPriceUpdatesChecked] = useState<Record<string, boolean>>({});
  const [barcodeMapOpen, setBarcodeMapOpen] = useState(false);
  const [unrecognizedBarcode, setUnrecognizedBarcode] = useState<string>("");

  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const [infoModalProduct, setInfoModalProduct] = useState<SearchableProduct | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Undo / Redo Stacks (Ctrl+Z / Ctrl+Y)
  const [undoStack, setUndoStack] = useState<GrnLineItem[][]>([]);
  const [redoStack, setRedoStack] = useState<GrnLineItem[][]>([]);

  // Draft autosave banner state
  const [hasUnsavedDraft, setHasUnsavedDraft] = useState(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string>("");

  // Top Bar Roving Focus (New, Hold, Held, + Product, Master, Purchases, Stock, Dashboard)
  const topBarFocus = useRovingFocus(8);

  // Held vouchers in LocalStorage
  const [heldVouchers, setHeldVouchers] = useState<HeldGrnVoucher[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem("jmd_held_grns");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const saveHeldVouchersToStorage = (updated: HeldGrnVoucher[]) => {
    setHeldVouchers(updated);
    try {
      localStorage.setItem("jmd_held_grns", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist held GRNs", e);
    }
  };

  // Helper to construct a new line
  const createEmptyLine = useCallback(
    (defaultProd?: ProductItem): GrnLineItem => {
      const p = defaultProd || catalog[0];
      const rate = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
      return {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: p?.id || "",
        product: p as any,
        qtyInput: "1",
        unit: "Carton",
        rateInput: rate > 0 ? (rate * (p?.packSize || 1)).toFixed(2) : "100.00",
        discPercentInput: "0",
        gstRateBp: p?.gstRateBp ?? 500,
      };
    },
    [catalog]
  );

  // Grid Lines State
  const [lines, setLines] = useState<GrnLineItem[]>(() => [createEmptyLine()]);

  // Current selected supplier
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Load supplier rate history on supplier change
  useEffect(() => {
    if (!supplierId) return;
    getSupplierRateHistoryAction(supplierId).then((rates) => {
      setSupplierRates(rates);
    });
  }, [supplierId]);

  // Debounced check for duplicate Bill No for this supplier
  useEffect(() => {
    if (!supplierId || !billNo.trim()) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(() => {
      checkDuplicateSupplierBillAction(supplierId, billNo).then((res) => {
        if (res.isDuplicate && res.existingId) {
          setDuplicateWarning({
            existingId: res.existingId,
            existingBillNo: res.existingBillNo || billNo,
            billDate: res.billDate || "",
            totalPaise: res.totalPaise || 0,
          });
        } else {
          setDuplicateWarning(null);
        }
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [supplierId, billNo]);

  // Draft Autosave (debounced 2s)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (lines.length === 1 && !billNo.trim() && lines[0].productId === catalog[0]?.id && lines[0].qtyInput === "1") {
      return;
    }
    const timer = setTimeout(() => {
      const draftData = {
        supplierId,
        billNo,
        billDate,
        locationId,
        narration,
        billDiscountPercent,
        freightChargesInput,
        loadingChargesInput,
        lines,
        savedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      localStorage.setItem("jmd_grn_draft_autosave", JSON.stringify(draftData));
    }, 2000);

    return () => clearTimeout(timer);
  }, [supplierId, billNo, billDate, locationId, narration, billDiscountPercent, freightChargesInput, loadingChargesInput, lines, catalog]);

  // Check for unsaved autosaved draft on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("jmd_grn_draft_autosave");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lines && parsed.lines.length > 0) {
          setHasUnsavedDraft(true);
          setDraftTimestamp(parsed.savedAt || "Earlier Session");
        }
      }
    } catch (e) {
      console.error("Draft read error", e);
    }
  }, []);

  const handleResumeAutosavedDraft = () => {
    try {
      const saved = localStorage.getItem("jmd_grn_draft_autosave");
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed.supplierId) setSupplierId(parsed.supplierId);
      if (parsed.billNo) setBillNo(parsed.billNo);
      if (parsed.billDate) setBillDate(parsed.billDate);
      if (parsed.locationId) setLocationId(parsed.locationId);
      if (parsed.narration) setNarration(parsed.narration);
      if (parsed.billDiscountPercent) setBillDiscountPercent(parsed.billDiscountPercent);
      if (parsed.freightChargesInput) setFreightChargesInput(parsed.freightChargesInput);
      if (parsed.loadingChargesInput) setLoadingChargesInput(parsed.loadingChargesInput);
      if (parsed.lines && parsed.lines.length > 0) setLines(parsed.lines);
      setHasUnsavedDraft(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiscardAutosavedDraft = () => {
    localStorage.removeItem("jmd_grn_draft_autosave");
    setHasUnsavedDraft(false);
  };

  // Filtered suppliers for Alt+P modal (Token-prefix matching with junk supplier flagging)
  const isJunkSupplier = (s: SupplierItem) => {
    const hasNoBrand = !s.companyId && !s.company?.name;
    const isSuspicious = /^[a-z0-9_-]{1,6}$/.test(s.name.trim()) || s.name.toLowerCase().includes("test");
    return hasNoBrand && isSuspicious;
  };

  const filteredSuppliers = useMemo(() => {
    const q = supplierFilterQuery.trim();
    let matches: SupplierItem[];
    if (!q) {
      matches = [...suppliers];
    } else {
      matches = searchParties(q, suppliers as any) as any;
    }

    // Sort valid suppliers first, junk suppliers (like `vbn`) flagged and at bottom
    return matches.sort((a, b) => {
      const aJunk = isJunkSupplier(a) ? 1 : 0;
      const bJunk = isJunkSupplier(b) ? 1 : 0;
      return aJunk - bJunk;
    });
  }, [suppliers, supplierFilterQuery]);

  // Pre-highlight first supplier & scroll into view
  useEffect(() => {
    setSupplierSelectedIndex(0);
  }, [filteredSuppliers.length]);

  useEffect(() => {
    if (!supplierModalOpen || filteredSuppliers.length === 0) return;
    const container = supplierListContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-supplier-index="${supplierSelectedIndex}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [supplierSelectedIndex, supplierModalOpen, filteredSuppliers.length]);

  // Companies list for Quick Add
  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) {
      if (p.companyId && p.company?.name) {
        map.set(p.companyId, p.company.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [catalog]);

  // Filtered products for full-width search bar using shared smart search (Shop POS Twin)
  const searchResults = useMemo(() => {
    const q = productSearchQuery.trim();
    if (!q) return [];

    let pool = catalog;
    // If allProductsToggle is OFF and supplier is linked to a company, filter to supplier's company
    if (!allProductsToggle && selectedSupplier?.companyId) {
      pool = catalog.filter((p) => p.companyId === selectedSupplier.companyId);
    }

    return searchItems(q, searchIndex, {
      limit: 12,
      context: "purchase",
      supplierCompanyId: selectedSupplier?.companyId || null,
    }) as ProductItem[];
  }, [catalog, productSearchQuery, allProductsToggle, selectedSupplier, searchIndex]);

  // Scroll active search dropdown item into view
  useEffect(() => {
    if (!searchDropdownOpen || searchResults.length === 0) return;
    const container = searchDropdownContainerRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-search-index="${searchSelectedIndex}"]`) as HTMLElement;
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [searchSelectedIndex, searchDropdownOpen, searchResults.length]);

  // Calculation of Line Totals
  const lineCalculations = useMemo(() => {
    return lines.map((line) => {
      const prod = catalog.find((p) => p.id === line.productId);
      const packSize = Math.max(1, prod?.packSize || 1);
      const rawQty = parseFloat(line.qtyInput) || 0;

      let multiplier = 1;
      if (line.unit === "Carton") multiplier = packSize;
      else if (line.unit === "Dozen") multiplier = 12;
      else if (line.unit === "Bag") multiplier = prod?.bagSize || packSize;
      else if (line.unit === "Hanger") multiplier = 60;
      else if (line.unit === "Jar") multiplier = packSize;
      else multiplier = 1;

      const totalPieces = Math.round(rawQty * multiplier);
      const unitRateVal = parseFloat(line.rateInput) || 0;
      const discPct = Math.max(0, Math.min(100, parseFloat(line.discPercentInput) || 0));

      const grossAmount = rawQty * unitRateVal;
      const discountAmount = grossAmount * (discPct / 100);
      const taxable = grossAmount - discountAmount;
      const tax = taxable * ((line.gstRateBp || 0) / 10000);
      const total = taxable + tax;

      // Rate variance vs last purchase rate
      const lastInfo = supplierRates[line.productId];
      const lastRateUnit = lastInfo ? (lastInfo.lastRatePaise / 100) * multiplier : null;
      let variancePct: number | null = null;
      if (lastRateUnit && lastRateUnit > 0) {
        variancePct = Math.round(((unitRateVal - lastRateUnit) / lastRateUnit) * 100);
      }

      // Weight calculation
      const weightBaseGrams = prod?.weightBase || (prod?.weightValue ? (prod.weightUnit?.toLowerCase() === "kg" || prod.weightUnit?.toLowerCase() === "l" ? prod.weightValue * 1000 : prod.weightValue) : 0);
      const lineWeightGrams = totalPieces * weightBaseGrams;

      return {
        totalPieces,
        grossAmount,
        discountAmount,
        taxable,
        tax,
        total,
        ratePerPiece: totalPieces > 0 ? taxable / totalPieces : 0,
        lastRateUnit,
        lastRateDate: lastInfo?.lastDate,
        variancePct,
        lineWeightGrams,
      };
    });
  }, [lines, catalog, supplierRates]);

  // Financial Breakdown & Grand Totals
  const subtotal = lineCalculations.reduce((sum, l) => sum + l.grossAmount, 0);
  const lineDiscounts = lineCalculations.reduce((sum, l) => sum + l.discountAmount, 0);

  const billDiscPct = Math.max(0, Math.min(100, parseFloat(billDiscountPercent) || 0));
  const billDiscountAmt = (subtotal - lineDiscounts) * (billDiscPct / 100);
  const totalDiscount = lineDiscounts + billDiscountAmt;

  const freightAmt = Math.max(0, parseFloat(freightChargesInput) || 0);
  const loadingAmt = Math.max(0, parseFloat(loadingChargesInput) || 0);
  const extraCharges = freightAmt + loadingAmt;

  const grandTaxable = Math.max(0, subtotal - totalDiscount);
  const grandTax = lineCalculations.reduce((sum, l) => {
    const effectiveLineTaxable = l.taxable * (1 - billDiscPct / 100);
    return sum + effectiveLineTaxable * (l.tax > 0 ? l.tax / (l.taxable || 1) : 0);
  }, 0);

  const rawGrandTotal = grandTaxable + grandTax + extraCharges;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundedGrandTotal - rawGrandTotal;
  const grandTotalPaise = roundedGrandTotal * 100;
  const totalQtyPieces = lineCalculations.reduce((sum, l) => sum + l.totalPieces, 0);
  const totalCartons = lines.reduce((sum, l) => sum + (l.unit === "Carton" ? parseFloat(l.qtyInput) || 0 : 0), 0);

  // Total weight in Kg
  const totalWeightKg = lineCalculations.reduce((sum, l) => sum + l.lineWeightGrams, 0) / 1000;

  // Supplier Bill Total Difference Indicator
  const billTotalEntered = parseFloat(supplierBillTotalInput) || 0;
  const billTotalDiff = billTotalEntered > 0 ? billTotalEntered - roundedGrandTotal : 0;

  // Tax Clarity (CGST + SGST for intra-state Bihar '10', IGST for others)
  const isInterState = useMemo(() => {
    if (!selectedSupplier?.gstin) return false;
    const stateCode = selectedSupplier.gstin.substring(0, 2);
    return stateCode !== "10"; // 10 is Bihar
  }, [selectedSupplier]);

  // Active line for diagnostics status bar
  const activeLineIndex = Math.min(gridFocus.row, lines.length - 1);
  const activeLine = lines[activeLineIndex] || lines[0];
  const activeProduct = useMemo(() => {
    if (!activeLine) return null;
    return catalog.find((p) => p.id === activeLine.productId) || null;
  }, [activeLine, catalog]);

  // Push to Undo Stack before state modification
  const recordUndo = () => {
    setUndoStack((prev) => [...prev.slice(-20), JSON.parse(JSON.stringify(lines))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, JSON.parse(JSON.stringify(lines))]);
    setLines(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, JSON.parse(JSON.stringify(lines))]);
    setLines(next);
  };

  // Line Handlers
  const handleUpdateProduct = (lineId: string, prodId: string) => {
    recordUndo();
    const p = catalog.find((x) => x.id === prodId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const multiplier = l.unit === "Carton" ? p?.packSize || 1 : 1;
        // Check if supplier rate history exists for this product
        const histRate = supplierRates[prodId];
        const ratePerPc = histRate ? histRate.lastRatePaise / 100 : (p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50);

        return {
          ...l,
          productId: prodId,
          product: p as any,
          gstRateBp: p?.gstRateBp ?? l.gstRateBp,
          rateInput: (ratePerPc * multiplier).toFixed(2),
        };
      })
    );
  };

  const handleUpdateQty = (lineId: string, val: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, qtyInput: val } : l))
    );
  };

  const handleUpdateUnit = (lineId: string, newUnit: UnitType) => {
    recordUndo();
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const p = catalog.find((x) => x.id === l.productId);
        const histRate = supplierRates[l.productId];
        const ratePerPc = histRate ? histRate.lastRatePaise / 100 : (p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50);

        let mult = 1;
        if (newUnit === "Carton") mult = p?.packSize || 1;
        else if (newUnit === "Dozen") mult = 12;
        else if (newUnit === "Bag") mult = p?.bagSize || p?.packSize || 1;
        else if (newUnit === "Hanger") mult = 60;

        return {
          ...l,
          unit: newUnit,
          rateInput: (ratePerPc * mult).toFixed(2),
        };
      })
    );
  };

  const handleUpdateRate = (lineId: string, val: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, rateInput: val } : l))
    );
  };

  const handleUpdateDisc = (lineId: string, val: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, discPercentInput: val } : l))
    );
  };

  const handleUpdateGst = (lineId: string, bp: number) => {
    recordUndo();
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, gstRateBp: bp } : l))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    recordUndo();
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyLine()];
      }
      return prev.filter((l) => l.id !== lineId);
    });
  };

  const handleAddLine = () => {
    recordUndo();
    const newLine = createEmptyLine();
    setLines((prev) => [...prev, newLine]);
    setGridFocus({ row: lines.length, col: 0 });
  };

  const handleRepeatLine = () => {
    if (!activeLine) return;
    recordUndo();
    const newLine: GrnLineItem = {
      ...activeLine,
      id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setLines((prev) => [...prev, newLine]);
    setGridFocus({ row: lines.length, col: 0 });
  };

  // Add product from Search Bar directly
  const handleSelectProductFromSearch = (product: ProductItem) => {
    recordUndo();
    if (lines.length === 1 && lines[0].productId === catalog[0]?.id && lines[0].qtyInput === "1") {
      handleUpdateProduct(lines[0].id, product.id);
    } else {
      const newLine = createEmptyLine(product);
      setLines((prev) => [...prev, newLine]);
      setGridFocus({ row: lines.length, col: 0 });
    }
    setProductSearchQuery("");
    setSearchDropdownOpen(false);
  };

  // Barcode Scanner Fast-Keystroke Detection
  useEffect(() => {
    const handleScannerKeystroke = (e: KeyboardEvent) => {
      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Enter") {
        const rawCode = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = "";
        if (rawCode.length >= 4 && interval < 60) {
          // Rapid keystrokes ending in Enter => Barcode Scanner!
          e.preventDefault();
          const match = catalog.find(
            (p) =>
              p.shortCode.toLowerCase() === rawCode.toLowerCase() ||
              (p.barcode && p.barcode.toLowerCase() === rawCode.toLowerCase())
          );
          if (match) {
            handleSelectProductFromSearch(match);
          } else {
            // Unknown barcode => Open map dialog
            setUnrecognizedBarcode(rawCode);
            setBarcodeMapOpen(true);
          }
        }
      } else if (e.key.length === 1) {
        if (interval < 60) {
          barcodeBufferRef.current += e.key;
        } else {
          barcodeBufferRef.current = e.key;
        }
      }
    };

    window.addEventListener("keydown", handleScannerKeystroke);
    return () => window.removeEventListener("keydown", handleScannerKeystroke);
  }, [catalog]);

  // Hold / Resume
  const handleHold = () => {
    if (!billNo.trim() && lines.length === 1 && !lines[0].productId) {
      return;
    }
    const newHeld: HeldGrnVoucher = {
      id: `held_${Date.now()}`,
      timestamp: Date.now(),
      dateStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      supplierId,
      supplierName: selectedSupplier?.name || "Unassigned Supplier",
      billNo: billNo.trim() || "DRAFT",
      billDate,
      locationId,
      narration,
      items: lines,
      netPayablePaise: grandTotalPaise,
    };
    const updated = [newHeld, ...heldVouchers];
    saveHeldVouchersToStorage(updated);

    // Reset to fresh voucher
    setBillNo("");
    setNarration("");
    setLines([createEmptyLine()]);
    setBillDiscountPercent("0");
    setFreightChargesInput("0");
    setLoadingChargesInput("0");
    localStorage.removeItem("jmd_grn_draft_autosave");
  };

  const handleResumeHeld = (voucher: HeldGrnVoucher) => {
    setSupplierId(voucher.supplierId);
    setBillNo(voucher.billNo === "DRAFT" ? "" : voucher.billNo);
    setBillDate(voucher.billDate);
    setLocationId(voucher.locationId);
    setNarration(voucher.narration);
    setLines(voucher.items);
    const updated = heldVouchers.filter((h) => h.id !== voucher.id);
    saveHeldVouchersToStorage(updated);
    setHeldDrawerOpen(false);
  };

  const handleDeleteHeld = (voucherId: string) => {
    const updated = heldVouchers.filter((h) => h.id !== voucherId);
    saveHeldVouchersToStorage(updated);
  };

  // Load Previous GRNs (Alt+L)
  const handleOpenPreviousGrns = async () => {
    if (!supplierId) return;
    const history = await getSupplierPreviousPurchasesAction(supplierId);
    setPreviousGrns(history);
    setPreviousGrnsOpen(true);
  };

  const handleApplyPreviousGrn = (grn: any) => {
    recordUndo();
    const newLines: GrnLineItem[] = grn.items.map((it: any) => {
      const p = catalog.find((x) => x.id === it.productId);
      const packSize = Math.max(1, p?.packSize || 1);
      const cartons = (it.qty / packSize).toFixed(1);

      return {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: it.productId,
        product: p as any,
        qtyInput: cartons.endsWith(".0") ? cartons.replace(".0", "") : cartons,
        unit: "Carton",
        rateInput: ((it.ratePaise / 100) * packSize).toFixed(2),
        discPercentInput: "0",
        gstRateBp: it.gstRateBp,
      };
    });

    if (newLines.length > 0) {
      setLines(newLines);
    }
    setPreviousGrnsOpen(false);
  };

  // Open Suggested Reorder Items (Alt+R)
  const handleOpenReorderItems = async () => {
    if (!selectedSupplier?.companyId) return;
    const items = await getSupplierReorderItemsAction(selectedSupplier.companyId);
    setReorderItems(items);
    setReorderCheckedIds(new Set(items.map((i) => i.id)));
    setReorderModalOpen(true);
  };

  const handleAddReorderItems = () => {
    recordUndo();
    const toAdd = reorderItems.filter((i) => reorderCheckedIds.has(i.id));
    const newLines: GrnLineItem[] = toAdd.map((item) => {
      const p = catalog.find((x) => x.id === item.id);
      const packSize = Math.max(1, p?.packSize || 1);
      const rate = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
      return {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: item.id,
        product: p as any,
        qtyInput: String(item.suggestedQtyCartons || 1),
        unit: "Carton",
        rateInput: (rate * packSize).toFixed(2),
        discPercentInput: "0",
        gstRateBp: item.gstRateBp,
      };
    });

    if (lines.length === 1 && lines[0].productId === catalog[0]?.id && lines[0].qtyInput === "1") {
      setLines(newLines);
    } else {
      setLines((prev) => [...prev, ...newLines]);
    }
    setReorderModalOpen(false);
  };

  // Post Submission
  const handleConfirmAndPost = async () => {
    if (lines.length === 0) return;
    if (!billNo.trim()) {
      setFormError("Please enter Supplier Invoice / Bill No.");
      setConfirmPostOpen(false);
      billNoInputRef.current?.focus();
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      supplierId: supplierId || null,
      billNo: billNo.trim(),
      billDate,
      locationId,
      billTotalPaise: billTotalEntered > 0 ? Math.round(billTotalEntered * 100) : null,
      items: lines.map((line, idx) => {
        const calc = lineCalculations[idx];
        const safePieces = Math.max(1, calc?.totalPieces || 1);
        const taxablePaise = Math.round((calc?.taxable || 0) * 100);
        const ratePaise = Math.max(1, Math.round(taxablePaise / safePieces));

        return {
          productId: line.productId,
          qty: safePieces,
          ratePaise,
          gstRateBp: Number(line.gstRateBp),
        };
      }),
    };

    const formData = new FormData();
    formData.append("purchaseData", JSON.stringify(payload));
    formData.append("payload", JSON.stringify(payload));

    const res = await recordPurchaseAction(undefined, formData);
    setIsSubmitting(false);

    if (res?.success) {
      localStorage.removeItem("jmd_grn_draft_autosave");
      router.push("/godown/purchases");
    } else {
      setFormError(res?.error || "Failed to record GRN receipt.");
      setConfirmPostOpen(false);
    }
  };

  // Global Keyboard Navigation & Region Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Region Jumps
      if (e.altKey && e.key === "1") {
        e.preventDefault();
        billNoInputRef.current?.focus();
        return;
      }
      if (e.altKey && e.key === "2") {
        e.preventDefault();
        setGridMode("navigate");
        setGridFocus((prev) => ({ ...prev, col: 0 }));
        return;
      }
      if (e.altKey && e.key === "3") {
        e.preventDefault();
        summaryPanelRef.current?.focus();
        return;
      }
      if (e.altKey && e.key === "4") {
        e.preventDefault();
        postButtonRef.current?.focus();
        return;
      }

      // Undo / Redo
      if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.ctrlKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Functional Keys
      if (e.key === "F2" || (e.ctrlKey && e.key === "Enter")) {
        e.preventDefault();
        setConfirmPostOpen(true);
      } else if (e.key === "F3") {
        e.preventDefault();
        if (lines.length > 1 || billNo.trim()) {
          setDiscardConfirmOpen(true);
        } else {
          setLines([createEmptyLine()]);
          setBillNo("");
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHold();
      } else if (e.key === "F5") {
        e.preventDefault();
        setHeldDrawerOpen(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        handleAddLine();
      } else if (e.key === "F7") {
        e.preventDefault();
        handleRepeatLine();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (activeProduct) {
          setInfoModalProduct(activeProduct as any);
        }
      } else if (e.key === "F9") {
        e.preventDefault();
        if (lines[gridFocus.row]) {
          handleRemoveLine(lines[gridFocus.row].id);
        }
      } else if ((e.ctrlKey && (e.key === "k" || e.key === "K")) || e.key === "F1") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        setSupplierModalOpen(true);
      } else if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setQuickAddOpen(true);
      } else if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        setEditMasterOpen(true);
      } else if (e.altKey && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setAllProductsToggle((prev) => !prev);
      } else if (e.altKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        handleOpenReorderItems();
      } else if (e.altKey && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        handleOpenPreviousGrns();
      } else if (e.altKey && (e.key === "u" || e.key === "U")) {
        e.preventDefault();
        setPriceHelperOpen(true);
      } else if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        const fileInput = document.getElementById("grn-bill-attachment") as HTMLInputElement;
        fileInput?.click();
      } else if (e.key === "?") {
        const target = e.target as HTMLElement;
        const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
        if (!isInput) {
          e.preventDefault();
          setHelpOpen(true);
        }
      } else if (e.key === "Escape") {
        if (supplierModalOpen) setSupplierModalOpen(false);
        else if (heldDrawerOpen) setHeldDrawerOpen(false);
        else if (previousGrnsOpen) setPreviousGrnsOpen(false);
        else if (reorderModalOpen) setReorderModalOpen(false);
        else if (priceHelperOpen) setPriceHelperOpen(false);
        else if (barcodeMapOpen) setBarcodeMapOpen(false);
        else if (helpOpen) setHelpOpen(false);
        else if (confirmPostOpen) setConfirmPostOpen(false);
        else if (discardConfirmOpen) setDiscardConfirmOpen(false);
        else if (searchDropdownOpen) setSearchDropdownOpen(false);
        else if (gridMode === "edit") setGridMode("navigate");
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    lines,
    billNo,
    gridFocus,
    gridMode,
    activeProduct,
    supplierModalOpen,
    heldDrawerOpen,
    previousGrnsOpen,
    reorderModalOpen,
    priceHelperOpen,
    barcodeMapOpen,
    helpOpen,
    confirmPostOpen,
    discardConfirmOpen,
    searchDropdownOpen,
    selectedSupplier,
  ]);

  // Handle Quick Add Product Success
  const handleProductCreated = (newProduct: any) => {
    const formatted: ProductItem = {
      id: newProduct.id,
      name: newProduct.name,
      shortCode: newProduct.shortCode || "NEW",
      gstRateBp: newProduct.gstRateBp ?? 500,
      mrpPaise: newProduct.mrpPaise ?? 0,
      companyId: newProduct.companyId || null,
      company: newProduct.company || null,
      packSize: newProduct.packSize || 1,
      shopStockQty: 0,
      godownStockQty: 0,
    };
    setCatalog((prev) => [formatted, ...prev]);
    const newLine = createEmptyLine(formatted);
    setLines((prev) => [...prev, newLine]);
    setGridFocus({ row: lines.length, col: 0 });
    setQuickAddOpen(false);
  };

  // 12 empty rows baseline
  const minRows = 12;
  const emptyRowCount = Math.max(0, minRows - lines.length);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#FAFAF7] font-sans select-none overflow-hidden text-slate-900 text-sm">
      {/* Draft Autosave Recovery Banner */}
      {hasUnsavedDraft && (
        <div className="bg-amber-100 border-b border-amber-300 px-4 py-1.5 flex items-center justify-between text-xs text-amber-900 shrink-0 font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>Unsaved purchase draft found from <b>{draftTimestamp}</b>. Would you like to resume it?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardAutosavedDraft}
              className="px-2 py-0.5 text-xs text-amber-800 hover:underline"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleResumeAutosavedDraft}
              className="bg-[#790E11] text-white font-bold text-xs px-2.5 py-0.5 rounded shadow-2xs hover:bg-[#5e0a0d]"
            >
              Resume Draft
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP BAR (Shop POS twin style: 48px height with Roving Tabindex) */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between h-12 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/godown/purchases"
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center gap-1"
          >
            <span>Purchases / Record GRN</span>
          </Link>
          <span className="bg-[#790E11] text-white font-black text-xs px-2 py-0.5 rounded uppercase tracking-wider">
            PURCHASE GRN
          </span>
          <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-0.5 rounded border border-slate-200">
            GODOWN RECEIPT
          </span>
          <span className="text-slate-500 font-semibold text-xs hidden md:inline">
            Receiver: Godown In-Charge
          </span>
          <div className="bg-[#790E11] text-white text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 shadow-xs">
            <Building2 className="w-3.5 h-3.5 text-[#FDAF18]" />
            <span className="truncate max-w-[150px]">{selectedSupplier?.name || "No Supplier"}</span>
          </div>
        </div>

        {/* Toolbar with Arrow Key Roving Tabindex */}
        <div
          role="toolbar"
          aria-label="GRN Top Actions"
          onKeyDown={topBarFocus.handleKeyDown}
          className="flex items-center gap-2"
        >
          <button
            type="button"
            tabIndex={topBarFocus.getTabIndex(0)}
            onClick={() => {
              if (lines.length > 1 || billNo.trim()) {
                setDiscardConfirmOpen(true);
              } else {
                setLines([createEmptyLine()]);
                setBillNo("");
              }
            }}
            className="bg-[#FC830D] hover:bg-[#e07205] text-slate-950 font-black text-xs px-3 py-1.5 rounded-md shadow-xs transition focus:ring-2 focus:ring-[#790E11]"
          >
            + New (F3)
          </button>
          <button
            type="button"
            tabIndex={topBarFocus.getTabIndex(1)}
            onClick={handleHold}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            Hold (F4)
          </button>
          <button
            type="button"
            tabIndex={topBarFocus.getTabIndex(2)}
            onClick={() => setHeldDrawerOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition relative focus:ring-2 focus:ring-[#790E11]"
          >
            Held (F5)
            {heldVouchers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-[#790E11] text-white text-[10px] rounded-full font-bold">
                {heldVouchers.length}
              </span>
            )}
          </button>
          <button
            type="button"
            tabIndex={topBarFocus.getTabIndex(3)}
            onClick={() => setQuickAddOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            + Product (Alt+N)
          </button>
          <button
            type="button"
            tabIndex={topBarFocus.getTabIndex(4)}
            onClick={() => setEditMasterOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            Master (Alt+M)
          </button>
          <Link
            href="/godown/purchases"
            tabIndex={topBarFocus.getTabIndex(5)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            Purchases
          </Link>
          <Link
            href="/godown/stock"
            tabIndex={topBarFocus.getTabIndex(6)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            Stock
          </Link>
          <Link
            href="/godown"
            tabIndex={topBarFocus.getTabIndex(7)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition focus:ring-2 focus:ring-[#790E11]"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* 2. INFO ROW (Readable Header >=12px labels & PROMINENT Bill No. >= 220px x 44px) */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-3 text-xs shrink-0">
        {/* Date Field */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-700 uppercase text-xs">Date:</span>
          <AccessibleDateInput
            value={billDate}
            onChange={setBillDate}
            onNavigateRight={() => billNoInputRef.current?.focus()}
          />
        </div>

        {/* GRN No (Auto) */}
        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-700 uppercase text-xs">GRN No:</span>
          <span className="font-mono font-bold text-[#790E11] bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-xs">
            GRN-AUTO
          </span>
        </div>

        {/* Supplier Bar (same slot as POS Party Bar) */}
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-md px-3 py-1.5">
          <span className="font-bold text-slate-700 text-xs uppercase">Supplier:</span>
          <span className="font-black text-slate-900 text-xs truncate">
            {selectedSupplier?.name || "No supplier linked"}
          </span>
          {selectedSupplier?.company?.name && (
            <span className="text-xs text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded font-semibold">
              Brand: {selectedSupplier.company.name}
            </span>
          )}
          <span className="text-xs text-slate-500 font-medium">
            Bal: <b>₹{(((selectedSupplier?.payableBalancePaise || 0)) / 100).toFixed(2)}</b>
          </span>
          <button
            type="button"
            onClick={() => setSupplierModalOpen(true)}
            className="ml-auto bg-white border border-slate-300 hover:border-[#790E11] text-[#790E11] font-bold text-xs px-2.5 py-1 rounded shadow-2xs transition"
          >
            Supplier (Alt+P)
          </button>
        </div>

        {/* PROMINENT Bill No. (>= 220px wide, >= 44px tall, 16px bold text) */}
        <div className="flex items-center gap-2 relative">
          <label className="font-black text-slate-900 uppercase text-xs shrink-0">
            Bill No <span className="text-red-500 font-black text-sm">*</span>:
          </label>
          <div className="relative">
            <input
              ref={billNoInputRef}
              type="text"
              placeholder="e.g. INV-9982"
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchInputRef.current?.focus();
                }
              }}
              className={`w-[220px] h-[40px] px-3 font-mono font-bold text-base text-slate-950 bg-white border-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-[#790E11] shadow-2xs ${
                duplicateWarning
                  ? "border-amber-500 bg-amber-50"
                  : !billNo.trim()
                  ? "border-slate-300 focus:border-[#790E11]"
                  : "border-emerald-600"
              }`}
            />
            {/* Inline Duplicate Bill Warning */}
            {duplicateWarning && (
              <div className="absolute left-0 top-full mt-1 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-md text-[11px] shadow-lg z-50 whitespace-nowrap flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>
                  Bill #{duplicateWarning.existingBillNo} already recorded on {duplicateWarning.billDate} (₹{(duplicateWarning.totalPaise / 100).toFixed(2)})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Destination Location */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-700 uppercase text-xs">Dest:</span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded font-bold text-xs">
            Main Godown
          </span>
        </div>

        {/* Note / Challan */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <span className="font-bold text-slate-700 uppercase text-xs">Note:</span>
          <input
            type="text"
            placeholder="Challan / LR / vehicle..."
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="w-full border border-slate-300 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] bg-white font-medium"
          />
        </div>
      </div>

      {/* 3. ITEM SEARCH BAR (Shared Smart Search, Weight Normalization e.g. 'bhuj 400', Barcode & Brand Boost) */}
      <div className="bg-[#FAFAF7] border-b border-slate-200 px-4 py-2 flex items-center gap-3 shrink-0 relative">
        <div className="flex-1 relative">
          <div className="flex items-center bg-white border-2 border-slate-300 rounded-lg px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#790E11] focus-within:border-[#790E11] transition shadow-xs">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode or search product name / code / weight (e.g. 'bhuj 400') [Ctrl+K / F1]..."
              value={productSearchQuery}
              onChange={(e) => {
                setProductSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
                setSearchSelectedIndex(0);
              }}
              onFocus={() => {
                if (productSearchQuery.trim()) setSearchDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSearchSelectedIndex((prev) => calculateNextListIndex(prev, "ArrowDown", searchResults.length));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchSelectedIndex((prev) => calculateNextListIndex(prev, "ArrowUp", searchResults.length));
                } else if (e.key === "Home") {
                  e.preventDefault();
                  setSearchSelectedIndex(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  setSearchSelectedIndex(Math.max(0, searchResults.length - 1));
                } else if (e.key === "Enter" && searchResults[searchSelectedIndex]) {
                  e.preventDefault();
                  handleSelectProductFromSearch(searchResults[searchSelectedIndex]);
                } else if (e.key === "Escape") {
                  setSearchDropdownOpen(false);
                }
              }}
              className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400"
            />
            {productSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setProductSearchQuery("");
                  setSearchDropdownOpen(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block font-mono text-[10px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
              Ctrl+K
            </kbd>
          </div>

          {/* Autocomplete Search Dropdown (Shop POS Twin with Last Purchase Rate) */}
          {searchDropdownOpen && searchResults.length > 0 && (
            <div
              ref={searchDropdownContainerRef}
              className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 font-sans"
            >
              {searchResults.map((prod, idx) => {
                const isSelected = idx === searchSelectedIndex;
                const lastRateInfo = supplierRates[prod.id];
                const isSupplierBrand = selectedSupplier?.companyId && prod.companyId === selectedSupplier.companyId;

                return (
                  <div
                    key={prod.id}
                    data-search-index={idx}
                    onMouseEnter={() => setSearchSelectedIndex(idx)}
                    onClick={() => handleSelectProductFromSearch(prod)}
                    className={`px-3 py-2.5 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition ${
                      isSelected
                        ? "bg-[#790E11] text-white font-semibold"
                        : "bg-white text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                        isSelected ? "bg-white/20 text-[#FDAF18]" : "bg-slate-100 text-[#790E11]"
                      }`}>
                        {prod.shortCode}
                      </span>
                      <span className="truncate">{prod.name} {prod.weight || ""}</span>
                      {prod.company?.name && (
                        <span className={`text-[11px] ${isSelected ? "text-slate-200" : "text-slate-500"}`}>
                          ({prod.company.name})
                        </span>
                      )}
                      {isSupplierBrand && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                          isSelected ? "bg-[#FDAF18] text-[#790E11]" : "bg-amber-100 text-amber-800"
                        }`}>
                          Supplier Brand
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      {lastRateInfo ? (
                        <div className="text-right">
                          <span className={`block text-[10px] uppercase font-bold ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}>
                            Last Purchase Rate
                          </span>
                          <span className={`font-mono font-black text-xs ${
                            isSelected ? "text-[#FDAF18]" : "text-emerald-700"
                          }`}>
                            ₹{(lastRateInfo.lastRatePaise / 100).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className={`block text-[10px] uppercase font-bold ${
                            isSelected ? "text-slate-300" : "text-slate-400"
                          }`}>
                            Est. Purchase
                          </span>
                          <span className={`font-mono font-bold text-xs ${
                            isSelected ? "text-slate-200" : "text-slate-600"
                          }`}>
                            ₹{(((prod.mrpPaise || 0) * 0.7) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="text-right pl-2 border-l border-slate-200">
                        <span className={`block text-[10px] uppercase font-bold ${
                          isSelected ? "text-slate-300" : "text-slate-400"
                        }`}>
                          MRP
                        </span>
                        <span className={`font-mono font-bold text-xs ${
                          isSelected ? "text-slate-100" : "text-slate-800"
                        }`}>
                          ₹{((prod.mrpPaise || 0) / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Reorder Suggestions (Alt+R) & Previous GRN (Alt+L) */}
        <button
          type="button"
          onClick={handleOpenReorderItems}
          disabled={!selectedSupplier?.companyId}
          className="bg-white border border-slate-300 hover:border-[#790E11] text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md shadow-2xs transition flex items-center gap-1 disabled:opacity-40"
          title="Suggested items to reorder (Alt+R)"
        >
          <TrendingUp className="w-3.5 h-3.5 text-[#790E11]" />
          <span>Reorder (Alt+R)</span>
        </button>

        <button
          type="button"
          onClick={handleOpenPreviousGrns}
          disabled={!supplierId}
          className="bg-white border border-slate-300 hover:border-[#790E11] text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md shadow-2xs transition flex items-center gap-1 disabled:opacity-40"
          title="Load previous supplier GRN (Alt+L)"
        >
          <History className="w-3.5 h-3.5 text-[#790E11]" />
          <span>Repeat GRN (Alt+L)</span>
        </button>

        {/* All Products Toggle (Alt+B) */}
        <button
          type="button"
          onClick={() => setAllProductsToggle((prev) => !prev)}
          className={`px-3 py-1.5 rounded-md text-xs font-bold border transition flex items-center gap-1.5 shadow-2xs ${
            allProductsToggle
              ? "bg-[#790E11] text-white border-[#790E11]"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
          }`}
          title="Toggle brand filter for supplier (Alt+B)"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All products (Alt+B)</span>
        </button>
      </div>

      {/* 4. MAIN BODY (Spreadsheet Grid on Left + Summary Panel on Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Grid Pane */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table
              role="grid"
              aria-label="GRN Line Items"
              className="w-full border-collapse text-left text-xs"
            >
              <thead className="sticky top-0 bg-[#F8FAFC] border-b-2 border-slate-300 text-slate-700 font-extrabold uppercase text-xs select-none z-10">
                <tr>
                  <th className="py-2.5 px-2 text-center w-12 border-r border-slate-200">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Item Description</th>
                  <th className="py-2.5 px-2 text-right w-24 border-r border-slate-200">Qty</th>
                  <th className="py-2.5 px-2 text-center w-28 border-r border-slate-200">Unit</th>
                  <th className="py-2.5 px-2 text-right w-24 border-r border-slate-200">MRP</th>
                  <th className="py-2.5 px-2 text-right w-32 border-r border-slate-200">Purchase Rate</th>
                  <th className="py-2.5 px-2 text-right w-20 border-r border-slate-200">Disc %</th>
                  <th className="py-2.5 px-2 text-center w-20 border-r border-slate-200">GST %</th>
                  <th className="py-2.5 px-3 text-right w-28 border-r border-slate-200">Amount (₹)</th>
                  <th className="py-2.5 px-2 text-center w-12">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {lines.map((line, rIdx) => {
                  const calc = lineCalculations[rIdx];
                  const prod = catalog.find((p) => p.id === line.productId);
                  const isCurrentRow = rIdx === gridFocus.row;

                  return (
                    <tr
                      key={line.id}
                      onClick={() => setGridFocus({ row: rIdx, col: gridFocus.col })}
                      className={`hover:bg-slate-50 transition ${
                        isCurrentRow ? "bg-amber-50/70 font-semibold" : ""
                      }`}
                    >
                      {/* # */}
                      <td className="py-2 px-2 text-center text-slate-400 font-mono text-xs border-r border-slate-100">
                        {rIdx + 1}
                      </td>

                      {/* Product Description */}
                      <td className="py-1 px-3 border-r border-slate-100">
                        <div className="flex items-center justify-between gap-1">
                          <div className="truncate">
                            <span className="font-mono font-bold text-[#790E11] mr-1.5">
                              {prod?.shortCode || "---"}
                            </span>
                            <span className="text-slate-900 font-bold">{prod?.name || "Select item..."}</span>
                            {prod?.weight && (
                              <span className="text-slate-600 font-semibold ml-1">({prod.weight})</span>
                            )}
                            {prod?.company?.name && (
                              <span className="text-slate-400 text-xs ml-1.5">
                                • {prod.company.name}
                              </span>
                            )}
                          </div>

                          {/* Rate Variance Alert Chip (>5%) */}
                          {calc.variancePct !== null && Math.abs(calc.variancePct) > 5 && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                calc.variancePct > 0
                                  ? "bg-red-100 text-red-800 border border-red-200"
                                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              }`}
                              title={`Rate changed ${calc.variancePct > 0 ? "+" : ""}${calc.variancePct}% vs last purchase (₹${calc.lastRateUnit?.toFixed(2)} on ${calc.lastRateDate})`}
                            >
                              {calc.variancePct > 0 ? `▲ +${calc.variancePct}%` : `▼ ${calc.variancePct}%`}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Qty (Accessible Number Input with Inline Math) */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <AccessibleNumberInput
                          value={line.qtyInput}
                          onChange={(val) => handleUpdateQty(line.id, val)}
                          isFocused={isCurrentRow && gridFocus.col === 0}
                          onCommitNext={() => setGridFocus({ row: rIdx, col: 1 })}
                          onNavigateUp={() => setGridFocus({ row: Math.max(0, rIdx - 1), col: 0 })}
                          onNavigateDown={() => {
                            if (rIdx === lines.length - 1) {
                              handleAddLine();
                            } else {
                              setGridFocus({ row: rIdx + 1, col: 0 });
                            }
                          }}
                          onNavigateRight={() => setGridFocus({ row: rIdx, col: 1 })}
                        />
                      </td>

                      {/* Unit (Accessible Unit Select with Single-Letter Keys) */}
                      <td className="py-1 px-1 text-center border-r border-slate-100">
                        <AccessibleUnitSelect
                          value={line.unit}
                          onChange={(newUnit) => handleUpdateUnit(line.id, newUnit)}
                          isFocused={isCurrentRow && gridFocus.col === 1}
                          onCommitNext={() => setGridFocus({ row: rIdx, col: 2 })}
                          onNavigateLeft={() => setGridFocus({ row: rIdx, col: 0 })}
                          onNavigateRight={() => setGridFocus({ row: rIdx, col: 2 })}
                          onNavigateUp={() => setGridFocus({ row: Math.max(0, rIdx - 1), col: 1 })}
                          onNavigateDown={() => {
                            if (rIdx === lines.length - 1) {
                              handleAddLine();
                            } else {
                              setGridFocus({ row: rIdx + 1, col: 1 });
                            }
                          }}
                        />
                      </td>

                      {/* MRP */}
                      <td className="py-2 px-2 text-right font-mono text-slate-700 font-semibold border-r border-slate-100">
                        ₹{(((prod?.mrpPaise || 0)) / 100).toFixed(2)}
                      </td>

                      {/* Purchase Rate per selected unit */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <AccessibleNumberInput
                          value={line.rateInput}
                          onChange={(val) => handleUpdateRate(line.id, val)}
                          isFocused={isCurrentRow && gridFocus.col === 2}
                          onCommitNext={() => setGridFocus({ row: rIdx, col: 3 })}
                          onNavigateLeft={() => setGridFocus({ row: rIdx, col: 1 })}
                          onNavigateRight={() => setGridFocus({ row: rIdx, col: 3 })}
                          onNavigateUp={() => setGridFocus({ row: Math.max(0, rIdx - 1), col: 2 })}
                          onNavigateDown={() => {
                            if (rIdx === lines.length - 1) {
                              handleAddLine();
                            } else {
                              setGridFocus({ row: rIdx + 1, col: 2 });
                            }
                          }}
                        />
                      </td>

                      {/* Disc % */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <AccessibleNumberInput
                          value={line.discPercentInput}
                          onChange={(val) => handleUpdateDisc(line.id, val)}
                          isFocused={isCurrentRow && gridFocus.col === 3}
                          min={0}
                          max={100}
                          onCommitNext={() => setGridFocus({ row: rIdx, col: 4 })}
                          onNavigateLeft={() => setGridFocus({ row: rIdx, col: 2 })}
                          onNavigateRight={() => setGridFocus({ row: rIdx, col: 4 })}
                          onNavigateUp={() => setGridFocus({ row: Math.max(0, rIdx - 1), col: 3 })}
                          onNavigateDown={() => {
                            if (rIdx === lines.length - 1) {
                              handleAddLine();
                            } else {
                              setGridFocus({ row: rIdx + 1, col: 3 });
                            }
                          }}
                        />
                      </td>

                      {/* GST % */}
                      <td className="py-1 px-1 text-center border-r border-slate-100">
                        <select
                          value={line.gstRateBp}
                          onChange={(e) => handleUpdateGst(line.id, parseInt(e.target.value))}
                          onFocus={() => setGridFocus({ row: rIdx, col: 4 })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Tab") {
                              e.preventDefault();
                              if (rIdx === lines.length - 1) {
                                handleAddLine();
                              } else {
                                setGridFocus({ row: rIdx + 1, col: 0 });
                              }
                            } else if (e.key === "ArrowLeft") {
                              e.preventDefault();
                              setGridFocus({ row: rIdx, col: 3 });
                            } else if (e.key === "ArrowRight") {
                              e.preventDefault();
                              // Move to summary panel
                              summaryPanelRef.current?.focus();
                            }
                          }}
                          className={`w-full text-center font-bold px-1 py-1 rounded text-xs focus:outline-none ${
                            isCurrentRow && gridFocus.col === 4
                              ? "outline-2 outline-[#790E11] bg-[#FEF3C7]"
                              : "border border-slate-200 bg-white"
                          }`}
                        >
                          <option value={0}>0%</option>
                          <option value={500}>5%</option>
                          <option value={1200}>12%</option>
                          <option value={1800}>18%</option>
                          <option value={2800}>28%</option>
                        </select>
                      </td>

                      {/* Amount */}
                      <td className="py-2 px-3 text-right font-mono font-black text-slate-950 border-r border-slate-100">
                        ₹{(calc?.total || 0).toFixed(2)}
                      </td>

                      {/* Delete */}
                      <td className="py-1 px-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                          title="Delete row (F9)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty rows to ensure min 12 rows aesthetic */}
                {Array.from({ length: emptyRowCount }).map((_, i) => (
                  <tr key={`empty_${i}`} className="text-slate-300">
                    <td className="py-2 px-2 text-center font-mono text-xs border-r border-slate-100">
                      {lines.length + i + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 italic text-slate-300">
                      {lines.length === 0 && i === 0 ? "Scan or search a product (Ctrl+K / F1)" : ""}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-2 border-r border-slate-100"></td>
                    <td className="py-2 px-3 border-r border-slate-100"></td>
                    <td className="py-2 px-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Status Line: Product diagnostics under grid */}
          <div className="bg-[#F8FAFC] border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs font-semibold text-slate-600 shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-900">
                Active: <b>{activeProduct ? activeProduct.name : "None"}</b>
              </span>
              <span>
                Godown: <b className="text-slate-900">{activeProduct?.godownStockQty || 0} pcs</b>
              </span>
              <span>
                Shop: <b className="text-slate-900">{activeProduct?.shopStockQty || 0} pcs</b>
              </span>
              <span>
                Pack: <b className="text-slate-900">{activeProduct?.packSize || 1} pcs/ctn</b>
              </span>
              <span>
                Rate/pc:{" "}
                <b className="text-slate-900 font-mono">
                  ₹{((lineCalculations[activeLineIndex]?.ratePerPiece || 0)).toFixed(2)}
                </b>
              </span>
              {lineCalculations[activeLineIndex]?.lastRateUnit !== null && (
                <span className="text-emerald-700 font-medium">
                  Last: <b>₹{lineCalculations[activeLineIndex]?.lastRateUnit?.toFixed(2)}</b> ({lineCalculations[activeLineIndex]?.lastRateDate})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {undoStack.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndo}
                  className="flex items-center gap-1 text-xs text-[#790E11] font-bold hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Undo (Ctrl+Z)
                </button>
              )}
              <button
                type="button"
                onClick={() => setPriceHelperOpen(true)}
                className="bg-white border border-slate-300 hover:border-[#790E11] text-slate-800 font-bold px-2 py-1 rounded text-xs flex items-center gap-1 shadow-2xs"
                title="Selling price update helper (Alt+U)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-[#790E11]" />
                [Alt+U Price Helper]
              </button>
              <button
                type="button"
                onClick={() => {
                  if (activeProduct) setInfoModalProduct(activeProduct as any);
                }}
                disabled={!activeProduct}
                className="bg-white border border-slate-300 hover:border-[#790E11] text-slate-800 font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50 shadow-2xs"
              >
                <Info className="w-3.5 h-3.5 text-[#790E11]" />
                [F8 Info]
              </button>
            </div>
          </div>
        </div>

        {/* Right Summary Panel (Shop POS Twin: 340px Width) */}
        <div
          ref={summaryPanelRef}
          tabIndex={0}
          className="w-[340px] bg-white border-l border-slate-200 flex flex-col justify-between shrink-0 select-none focus:outline-none focus:ring-1 focus:ring-[#790E11]"
        >
          <div className="p-4 space-y-2.5 overflow-y-auto">
            {/* Bill Discount % */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Bill Discount (%):</span>
              <div className="flex items-center gap-1 w-24">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={billDiscountPercent}
                  onChange={(e) => setBillDiscountPercent(e.target.value)}
                  className="w-full text-right font-mono font-bold border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11]"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            </div>

            {/* Freight & Loading Charges Lines (Part D.4) */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Freight Charges (₹):</span>
              <input
                type="number"
                step="1"
                min="0"
                value={freightChargesInput}
                onChange={(e) => setFreightChargesInput(e.target.value)}
                className="w-24 text-right font-mono font-bold border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11]"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Loading Charges (₹):</span>
              <input
                type="number"
                step="1"
                min="0"
                value={loadingChargesInput}
                onChange={(e) => setLoadingChargesInput(e.target.value)}
                className="w-24 text-right font-mono font-bold border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11]"
              />
            </div>

            {/* Supplier Bill Total Cross-Check Field (Part D.3) */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-700">Supplier Bill Total:</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="₹ on physical bill"
                  value={supplierBillTotalInput}
                  onChange={(e) => setSupplierBillTotalInput(e.target.value)}
                  className="w-28 text-right font-mono font-bold border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11]"
                />
              </div>
              {billTotalEntered > 0 && (
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="text-slate-500">Cross-Check Diff:</span>
                  <span className={`font-mono px-1.5 py-0.2 rounded ${
                    Math.abs(billTotalDiff) < 1
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900"
                  }`}>
                    {Math.abs(billTotalDiff) < 1
                      ? "✓ Matches Bill"
                      : billTotalDiff > 0
                      ? `+₹${billTotalDiff.toFixed(2)} (Bill higher)`
                      : `-₹${Math.abs(billTotalDiff).toFixed(2)} (Voucher higher)`}
                  </span>
                </div>
              )}
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-1 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({lines.length} items, {totalQtyPieces} pcs):</span>
                <span className="font-mono font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Discount:</span>
                <span className="font-mono text-emerald-700 font-semibold">-₹{totalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono font-semibold">₹{grandTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isInterState ? "IGST (Inter-State):" : "GST (CGST + SGST):"}</span>
                <span className="font-mono font-semibold">₹{grandTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Round-off:</span>
                <span className="font-mono">{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>
            </div>

            {/* Dark Maroon NET PAYABLE Hero Card (Shop POS Twin) */}
            <div className="bg-[#790E11] text-white p-3.5 rounded-xl border-2 border-[#FDAF18] shadow-lg mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  NET PAYABLE
                </span>
                <span className="bg-[#FDAF18] text-[#790E11] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  PURCHASE
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-[#FDAF18] mt-1 tracking-tight">
                ₹{roundedGrandTotal.toLocaleString("en-IN")}
              </div>
              <div className="text-xs text-slate-200 mt-1 capitalize italic leading-tight">
                {paiseToIndianWords(grandTotalPaise)}
              </div>
            </div>

            {/* Summary Quantities & Total Weight (Part D.8) */}
            <div className="pt-2 text-xs grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 font-medium">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Weight</span>
                <span className="font-mono font-bold text-slate-900">{totalWeightKg.toFixed(2)} kg</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Quantity</span>
                <span className="font-bold text-slate-900">{totalCartons} ctns / {totalQtyPieces} pcs</span>
              </div>
            </div>

            {/* Attach Bill Trigger (Part D.9) */}
            <div className="pt-1 flex items-center justify-between text-xs">
              <input
                id="grn-bill-attachment"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setAttachedBillName(file.name);
                }}
              />
              <button
                type="button"
                onClick={() => document.getElementById("grn-bill-attachment")?.click()}
                className="text-slate-700 hover:text-[#790E11] font-bold flex items-center gap-1.5 text-xs py-1"
              >
                <Paperclip className="w-3.5 h-3.5 text-[#790E11]" />
                <span>{attachedBillName ? `Attached: ${attachedBillName}` : "Attach Bill Photo/PDF (Alt+A)"}</span>
              </button>
              {attachedBillName && (
                <button
                  type="button"
                  onClick={() => setAttachedBillName(null)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Remarks / GRN Note */}
            <div className="pt-1">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Remarks / Transporter Notes
              </label>
              <textarea
                rows={2}
                placeholder="LR No, Vehicle No, Transporter..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#790E11] resize-none"
              />
            </div>

            {formError && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{formError}</span>
              </div>
            )}
          </div>

          {/* Sticky Bottom Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-2">
            <button
              ref={postButtonRef}
              type="button"
              disabled={isSubmitting}
              onClick={() => setConfirmPostOpen(true)}
              className="w-full bg-[#790E11] hover:bg-[#5e0a0d] text-white font-black text-sm py-3 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition focus:ring-2 focus:ring-[#FDAF18] disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-[#FDAF18]" />
              <span>Confirm & Post Stock (F2)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleHold}
                className="w-full bg-white border border-slate-300 text-slate-800 font-bold text-xs py-2 rounded-md hover:bg-slate-100 transition focus:ring-2 focus:ring-[#790E11]"
              >
                Hold (F4)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lines.length > 1 || billNo.trim()) {
                    setDiscardConfirmOpen(true);
                  } else {
                    setLines([createEmptyLine()]);
                    setBillNo("");
                  }
                }}
                className="w-full bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs py-2 rounded-md hover:bg-amber-100 transition focus:ring-2 focus:ring-[#790E11]"
              >
                New (F3)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. LEGEND BAR (Bottom sticky bar: Shop POS twin style) */}
      <footer className="bg-[#790E11] text-white px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-2 overflow-x-auto border-t-2 border-[#FDAF18] shrink-0 select-none">
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F2 Post</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F3 New</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F4 Hold</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F5 Held</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F6 Add row</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F7 Repeat</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F8 Info</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">F9 Delete</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+P Supplier</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+N +Prod</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+R Reorder</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+L Repeat</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+U Price</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+1 Header</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Alt+2 Grid</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Ctrl+Z Undo</span>
        <span className="bg-white/20 px-2 py-0.5 rounded text-white border border-white/20">Esc Back</span>
      </footer>

      {/* 6. MODALS & POPUPS */}

      {/* Supplier Modal (Alt+P) with Up/Down Arrow Key Control Everywhere */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Select Supplier (Alt+P)</h3>
              </div>
              <button
                type="button"
                onClick={() => setSupplierModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3">
              <input
                autoFocus
                ref={supplierSearchInputRef}
                type="text"
                placeholder="Search supplier by name, brand, phone (↑/↓ to choose, Enter to select)..."
                value={supplierFilterQuery}
                onChange={(e) => setSupplierFilterQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSupplierSelectedIndex((prev) => calculateNextListIndex(prev, "ArrowDown", filteredSuppliers.length));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSupplierSelectedIndex((prev) => calculateNextListIndex(prev, "ArrowUp", filteredSuppliers.length));
                  } else if (e.key === "Enter" && filteredSuppliers[supplierSelectedIndex]) {
                    e.preventDefault();
                    setSupplierId(filteredSuppliers[supplierSelectedIndex].id);
                    setSupplierModalOpen(false);
                    billNoInputRef.current?.focus();
                  } else if (e.key === "Escape") {
                    setSupplierModalOpen(false);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#790E11] mb-2"
              />
              <div
                ref={supplierListContainerRef}
                className="max-h-72 overflow-y-auto divide-y divide-slate-100"
              >
                {filteredSuppliers.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No matching suppliers</div>
                ) : (
                  filteredSuppliers.map((s, sIdx) => {
                    const isSelected = sIdx === supplierSelectedIndex;
                    const isJunk = isJunkSupplier(s);

                    return (
                      <div
                        key={s.id}
                        data-supplier-index={sIdx}
                        onMouseEnter={() => setSupplierSelectedIndex(sIdx)}
                        onClick={() => {
                          setSupplierId(s.id);
                          setSupplierModalOpen(false);
                          billNoInputRef.current?.focus();
                        }}
                        className={`p-2.5 transition flex items-center justify-between text-xs cursor-pointer ${
                          isSelected
                            ? "bg-amber-100 font-bold border-l-4 border-[#790E11]"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{s.name}</span>
                            {isJunk && (
                              <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold">
                                Review Supplier
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            {s.company?.name && (
                              <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[10px] text-slate-700">
                                Brand: {s.company.name}
                              </span>
                            )}
                            {s.phone && <span>Tel: {s.phone}</span>}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Balance</span>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{(((s.payableBalancePaise || 0)) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested Reorder Items Modal (Alt+R) */}
      {reorderModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Suggested Reorder Items for {selectedSupplier?.company?.name || "Supplier"}</h3>
              </div>
              <button type="button" onClick={() => setReorderModalOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Products currently at or below reorder level in Main Godown. Press <b>Space</b> to tick/untick, <b>Enter</b> to add.
              </p>
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                {reorderItems.length === 0 ? (
                  <div className="p-4 text-center text-slate-400">All brand items currently have healthy stock levels.</div>
                ) : (
                  reorderItems.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={reorderCheckedIds.has(item.id)}
                          onChange={(e) => {
                            const next = new Set(reorderCheckedIds);
                            if (e.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            setReorderCheckedIds(next);
                          }}
                          className="w-4 h-4 text-[#790E11] rounded"
                        />
                        <div>
                          <span className="font-bold text-slate-900 block">{item.name}</span>
                          <span className="text-[11px] text-slate-500">
                            Code: {item.shortCode} • Stock: {item.godownStockQty} pcs (Reorder at {item.reorderLevel})
                          </span>
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-slate-800">
                        Suggest: +{item.suggestedQtyCartons} Ctns
                      </div>
                    </label>
                  ))
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReorderModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                >
                  Cancel [Esc]
                </button>
                <button
                  type="button"
                  onClick={handleAddReorderItems}
                  className="px-4 py-1.5 text-xs font-black text-white bg-[#790E11] hover:bg-[#5e0a0d] rounded shadow-md"
                >
                  Add Ticked Items [Enter]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Previous GRNs Modal (Alt+L) */}
      {previousGrnsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Previous GRNs from {selectedSupplier?.name}</h3>
              </div>
              <button type="button" onClick={() => setPreviousGrnsOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 divide-y divide-slate-100 max-h-72 overflow-y-auto text-xs">
              {previousGrns.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No previous recorded GRNs for this supplier.</div>
              ) : (
                previousGrns.map((g) => (
                  <div key={g.id} className="p-3 hover:bg-slate-50 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">Bill #{g.billNo}</div>
                      <div className="text-[11px] text-slate-500">
                        Date: {g.billDate} • {g.itemCount} items
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-800">
                        ₹{(g.totalPaise / 100).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplyPreviousGrn(g)}
                        className="bg-[#790E11] text-white text-xs font-bold px-2.5 py-1 rounded hover:bg-[#5e0a0d]"
                      >
                        Copy Items
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selling Price Update Helper Modal (Alt+U - Part D.2) */}
      {priceHelperOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Selling Price Update Helper (Alt+U)</h3>
              </div>
              <button type="button" onClick={() => setPriceHelperOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Preview suggested selling prices and MRPs from new purchase rates. <b>Off by default</b>; check rows to apply price updates on posting.
              </p>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 font-bold sticky top-0 text-[11px] uppercase">
                    <tr>
                      <th className="p-2 text-center w-8">Apply</th>
                      <th className="p-2">Product</th>
                      <th className="p-2 text-right">Cost Rate/pc</th>
                      <th className="p-2 text-right">Current MRP</th>
                      <th className="p-2 text-right">Suggested MRP</th>
                      <th className="p-2 text-right">Suggested Tiers (A/B/C)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, i) => {
                      const calc = lineCalculations[i];
                      const p = catalog.find((x) => x.id === line.productId);
                      const costPerPc = calc.ratePerPiece;
                      const suggestedMrp = costPerPc > 0 ? (costPerPc / 0.8).toFixed(2) : "0.00";
                      const tierA = (costPerPc / 0.85).toFixed(2);
                      const tierB = (costPerPc / 0.9).toFixed(2);

                      return (
                        <tr key={line.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={!!priceUpdatesChecked[line.productId]}
                              onChange={(e) =>
                                setPriceUpdatesChecked((prev) => ({
                                  ...prev,
                                  [line.productId]: e.target.checked,
                                }))
                              }
                              className="rounded text-[#790E11]"
                            />
                          </td>
                          <td className="p-2 font-medium">{p?.name}</td>
                          <td className="p-2 text-right font-mono font-bold">₹{costPerPc.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">₹{(((p?.mrpPaise || 0)) / 100).toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-black text-emerald-700">₹{suggestedMrp}</td>
                          <td className="p-2 text-right font-mono text-[11px]">A: ₹{tierA} | B: ₹{tierB}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPriceHelperOpen(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
                >
                  Close [Esc]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm & Post Popup (F2) */}
      {confirmPostOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Confirm & Post Purchase GRN (F2)</h3>
              </div>
              <button type="button" onClick={() => setConfirmPostOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Supplier</span>
                  <span className="font-bold text-slate-900">{selectedSupplier?.name || "None"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Bill No / Date</span>
                  <span className="font-bold text-slate-900">{billNo || "No Bill No"} / {billDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Items & Qty</span>
                  <span className="font-bold text-slate-900">{lines.length} items ({totalQtyPieces} pieces, {totalWeightKg.toFixed(1)} kg)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Net Payable Amount</span>
                  <span className="font-mono font-black text-[#790E11] text-base">
                    ₹{roundedGrandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Items Summary Table */}
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto text-xs">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0 text-[10px] uppercase">
                    <tr>
                      <th className="p-1.5">Product</th>
                      <th className="p-1.5 text-right">Qty</th>
                      <th className="p-1.5 text-right">Unit Rate</th>
                      <th className="p-1.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((l, i) => {
                      const c = lineCalculations[i];
                      const p = catalog.find((x) => x.id === l.productId);
                      return (
                        <tr key={l.id}>
                          <td className="p-1.5 font-medium">{p?.name || "Item"}</td>
                          <td className="p-1.5 text-right font-mono">{l.qtyInput} {l.unit} ({c.totalPieces} pcs)</td>
                          <td className="p-1.5 text-right font-mono">₹{l.rateInput}</td>
                          <td className="p-1.5 text-right font-mono font-bold">₹{c.total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900">
                <b>Note:</b> Confirming will post <b>{totalQtyPieces} pieces ({totalWeightKg.toFixed(1)} kg)</b> into Main Godown stock ledger immediately and credit the supplier ledger.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmPostOpen(false)}
                  className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition"
                >
                  Back [Esc]
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmAndPost}
                  className="px-4 py-2 text-xs font-black text-white bg-[#790E11] hover:bg-[#5e0a0d] rounded-md transition flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FDAF18]" />
                  <span>{isSubmitting ? "Posting..." : "Post & Receive Stock [Enter]"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Held GRNs Drawer (F5) */}
      {heldDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right">
            <div>
              <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#FDAF18]" />
                  <h3 className="font-bold text-sm">Held GRN Vouchers (F5)</h3>
                </div>
                <button type="button" onClick={() => setHeldDrawerOpen(false)} className="text-white/80 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 divide-y divide-slate-100 max-h-[calc(100vh-120px)] overflow-y-auto">
                {heldVouchers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No held purchase GRN vouchers currently.
                  </div>
                ) : (
                  heldVouchers.map((h) => (
                    <div key={h.id} className="py-3 px-2 hover:bg-slate-50 transition flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs">{h.supplierName}</span>
                        <span className="font-mono text-[10px] text-slate-400">{h.dateStr}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Bill #{h.billNo} • {h.items.length} items</span>
                        <span className="font-mono font-bold text-[#790E11]">
                          ₹{(h.netPayablePaise / 100).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteHeld(h.id)}
                          className="px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResumeHeld(h)}
                          className="px-3 py-1 text-xs font-bold bg-[#790E11] text-white rounded hover:bg-[#5e0a0d]"
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setHeldDrawerOpen(false)}
                className="w-full py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded hover:bg-slate-300"
              >
                Close Drawer [Esc]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard / New Confirmation Modal */}
      {discardConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden p-4">
            <h3 className="font-bold text-slate-900 text-sm mb-2">Discard Current GRN?</h3>
            <p className="text-xs text-slate-600 mb-4">
              You have unsaved items or bill details. Starting a new voucher will clear them.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDiscardConfirmOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setLines([createEmptyLine()]);
                  setBillNo("");
                  setNarration("");
                  setDiscardConfirmOpen(false);
                  localStorage.removeItem("jmd_grn_draft_autosave");
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Discard & New
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help Overlay (?) */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden p-4 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-3">
              <h3 className="font-bold text-sm text-[#790E11]">Keyboard Navigation & Shortcuts</h3>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div>
                <p className="font-bold text-slate-900 mb-1 uppercase text-[10px]">Spreadsheet Grid</p>
                <ul className="space-y-1 font-mono text-[11px]">
                  <li><b>↑ ↓ ← →</b>: Navigate cells & rows</li>
                  <li><b>Enter</b>: Commit & next cell</li>
                  <li><b>+ / -</b>: Step quantity</li>
                  <li><b>C, P, D, B</b>: Unit shortcuts</li>
                  <li><b>12*5</b>: Safe inline math</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1 uppercase text-[10px]">Voucher Actions</p>
                <ul className="space-y-1 font-mono text-[11px]">
                  <li><b>F2</b>: Confirm & Post GRN</li>
                  <li><b>F3</b>: New voucher</li>
                  <li><b>F4</b>: Hold voucher</li>
                  <li><b>F5</b>: Held vouchers list</li>
                  <li><b>F6</b>: Add row</li>
                  <li><b>F8</b>: Item diagnostics</li>
                  <li><b>F9</b>: Delete line</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1 uppercase text-[10px]">Popups & Helpers</p>
                <ul className="space-y-1 font-mono text-[11px]">
                  <li><b>Alt+P</b>: Select Supplier (arrows to pick)</li>
                  <li><b>Alt+N</b>: Quick add product</li>
                  <li><b>Alt+R</b>: Suggested reorder items</li>
                  <li><b>Alt+L</b>: Repeat previous GRN</li>
                  <li><b>Alt+U</b>: Selling price helper</li>
                  <li><b>Alt+B</b>: Toggle all products</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-slate-900 mb-1 uppercase text-[10px]">Region Jumps</p>
                <ul className="space-y-1 font-mono text-[11px]">
                  <li><b>Alt+1</b>: Jump to Header (Bill No)</li>
                  <li><b>Alt+2</b>: Jump to Grid</li>
                  <li><b>Alt+3</b>: Jump to Summary panel</li>
                  <li><b>Alt+4</b>: Jump to Post button</li>
                  <li><b>Ctrl+Z / Y</b>: Undo / Redo</li>
                  <li><b>Esc</b>: Close / Go back</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Info Modal (F8) */}
      <ItemInfoModal
        isOpen={!!infoModalProduct}
        onClose={() => setInfoModalProduct(null)}
        product={infoModalProduct}
        partyName={selectedSupplier?.name}
      />

      {/* Quick Add Product Modal (Alt+N) */}
      <QuickAddProductModal
        isOpen={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onProductCreated={handleProductCreated}
        companies={companies}
        locationId={locationId}
      />

      {/* Edit Product Master Modal (Alt+M) */}
      <EditProductMasterModal
        isOpen={editMasterOpen}
        onClose={() => setEditMasterOpen(false)}
        product={activeProduct}
        companies={companies}
        onProductUpdated={(updated) => {
          setCatalog((prev) =>
            prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
          );
          setEditMasterOpen(false);
        }}
      />
    </div>
  );
}
