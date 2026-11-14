"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Package,
  HelpCircle,
  X,
  ArrowLeft,
  Calendar,
  Building2,
  Clock,
  Layers,
  ChevronDown,
  Info,
  RotateCcw,
  Store,
  Warehouse,
  ExternalLink,
  Edit3,
} from "lucide-react";
import { recordPurchaseAction } from "../actions";
import { searchItems, SearchableProduct } from "@/lib/search/smart-search";
import { paiseToIndianWords } from "@/lib/number-to-words";
import { ItemInfoModal } from "@/components/pos/ItemInfoModal";
import { QuickAddProductModal } from "@/components/pos/QuickAddProductModal";
import { EditProductMasterModal } from "@/components/pos/EditProductMasterModal";

export type UnitType = "Pcs" | "Carton" | "Dozen" | "Bag" | "Jar" | "Hanger";

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
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  payableBalancePaise?: number;
}

export interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  gstRateBp: number;
  mrpPaise: number;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  packSize?: number;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  bagSize?: number | null;
  shopStockQty?: number;
  godownStockQty?: number;
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
  const [remarks, setRemarks] = useState("");

  // Product Search Bar State
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [allProductsToggle, setAllProductsToggle] = useState(true);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchSelectedIndex, setSearchSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active / Selected row for Status Line diagnostics
  const [activeLineId, setActiveLineId] = useState<string>("");
  const [activeCellColumn, setActiveCellColumn] = useState<"qty" | "unit" | "rate" | "disc" | "gst">("qty");

  // Modals & Drawers State
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [supplierFilterQuery, setSupplierFilterQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editMasterOpen, setEditMasterOpen] = useState(false);
  const [heldDrawerOpen, setHeldDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmPostOpen, setConfirmPostOpen] = useState(false);
  const [infoModalProduct, setInfoModalProduct] = useState<SearchableProduct | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Undo stack for row deletion
  const [undoStack, setUndoStack] = useState<GrnLineItem[]>([]);

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

  // Set initial active row
  useEffect(() => {
    if (lines.length > 0 && !activeLineId) {
      setActiveLineId(lines[0].id);
    }
  }, [lines, activeLineId]);

  // Current selected supplier
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === supplierId),
    [suppliers, supplierId]
  );

  // Filtered suppliers for Alt+P modal
  const filteredSuppliers = useMemo(() => {
    const q = supplierFilterQuery.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.phone && s.phone.includes(q)) ||
        (s.company?.name && s.company.name.toLowerCase().includes(q))
    );
  }, [suppliers, supplierFilterQuery]);

  // Companies for Quick Add Modal
  const companies = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) {
      if (p.companyId && p.company?.name) {
        map.set(p.companyId, p.company.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [catalog]);

  // Filtered products for full-width search bar
  const filteredSearchResults = useMemo(() => {
    const q = productSearchQuery.trim();
    if (!q) return [];

    let pool = catalog;
    // If allProductsToggle is OFF and supplier is linked to a company, filter to supplier's company
    if (!allProductsToggle && selectedSupplier?.companyId) {
      pool = catalog.filter((p) => p.companyId === selectedSupplier.companyId);
    }

    const lower = q.toLowerCase();
    return pool
      .filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.shortCode.toLowerCase().includes(lower) ||
          (p.company?.name && p.company.name.toLowerCase().includes(lower))
      )
      .slice(0, 8);
  }, [catalog, productSearchQuery, allProductsToggle, selectedSupplier]);

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

      return {
        totalPieces,
        grossAmount,
        discountAmount,
        taxable,
        tax,
        total,
        ratePerPiece: totalPieces > 0 ? taxable / totalPieces : 0,
      };
    });
  }, [lines, catalog]);

  // Financial Breakdown & Grand Totals
  const subtotal = lineCalculations.reduce((sum, l) => sum + l.grossAmount, 0);
  const lineDiscounts = lineCalculations.reduce((sum, l) => sum + l.discountAmount, 0);

  const billDiscPct = Math.max(0, Math.min(100, parseFloat(billDiscountPercent) || 0));
  const billDiscountAmt = (subtotal - lineDiscounts) * (billDiscPct / 100);
  const totalDiscount = lineDiscounts + billDiscountAmt;

  const grandTaxable = Math.max(0, subtotal - totalDiscount);
  // Proportional tax after bill discount
  const grandTax = lineCalculations.reduce((sum, l) => {
    const effectiveLineTaxable = l.taxable * (1 - billDiscPct / 100);
    return sum + effectiveLineTaxable * ((l.tax > 0 ? (l.tax / (l.taxable || 1)) : 0));
  }, 0);

  const rawGrandTotal = grandTaxable + grandTax;
  const roundedGrandTotal = Math.round(rawGrandTotal);
  const roundOff = roundedGrandTotal - rawGrandTotal;
  const grandTotalPaise = roundedGrandTotal * 100;
  const totalQtyPieces = lineCalculations.reduce((sum, l) => sum + l.totalPieces, 0);

  // Active line for diagnostics status bar
  const activeLine = useMemo(() => {
    return lines.find((l) => l.id === activeLineId) || lines[0];
  }, [lines, activeLineId]);

  const activeProduct = useMemo(() => {
    if (!activeLine) return null;
    return catalog.find((p) => p.id === activeLine.productId) || null;
  }, [activeLine, catalog]);

  // Line Handlers
  const handleUpdateProduct = (lineId: string, prodId: string) => {
    const p = catalog.find((x) => x.id === prodId);
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const ratePerPc = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
        const multiplier = l.unit === "Carton" ? (p?.packSize || 1) : 1;
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
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const p = catalog.find((x) => x.id === l.productId);
        const ratePerPc = p ? ((p.mrpPaise || 0) * 0.7) / 100 : 50;
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
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, gstRateBp: bp } : l))
    );
  };

  const handleRemoveLine = (lineId: string) => {
    const toRemove = lines.find((l) => l.id === lineId);
    if (toRemove) {
      setUndoStack((prev) => [...prev, toRemove]);
    }
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyLine()];
      }
      const next = prev.filter((l) => l.id !== lineId);
      if (activeLineId === lineId && next[0]) {
        setActiveLineId(next[0].id);
      }
      return next;
    });
  };

  const handleUndoRemove = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setLines((prev) => [...prev, last]);
    setActiveLineId(last.id);
  };

  const handleAddLine = () => {
    const newLine = createEmptyLine();
    setLines((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  const handleRepeatLine = () => {
    if (!activeLine) return;
    const newLine: GrnLineItem = {
      ...activeLine,
      id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    setLines((prev) => [...prev, newLine]);
    setActiveLineId(newLine.id);
  };

  // Add product from Search Bar directly
  const handleSelectProductFromSearch = (product: ProductItem) => {
    // If the active line has default first product and hasn't been modified, replace it
    if (lines.length === 1 && lines[0].productId === catalog[0]?.id && lines[0].qtyInput === "1") {
      handleUpdateProduct(lines[0].id, product.id);
    } else {
      const newLine = createEmptyLine(product);
      setLines((prev) => [...prev, newLine]);
      setActiveLineId(newLine.id);
    }
    setProductSearchQuery("");
    setSearchDropdownOpen(false);
  };

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
  };

  const handleResumeHeld = (voucher: HeldGrnVoucher) => {
    setSupplierId(voucher.supplierId);
    setBillNo(voucher.billNo === "DRAFT" ? "" : voucher.billNo);
    setBillDate(voucher.billDate);
    setLocationId(voucher.locationId);
    setNarration(voucher.narration);
    setLines(voucher.items);
    // Remove from held
    const updated = heldVouchers.filter((h) => h.id !== voucher.id);
    saveHeldVouchersToStorage(updated);
    setHeldDrawerOpen(false);
  };

  const handleDeleteHeld = (voucherId: string) => {
    const updated = heldVouchers.filter((h) => h.id !== voucherId);
    saveHeldVouchersToStorage(updated);
  };

  // Post Submission
  const handleConfirmAndPost = async () => {
    if (lines.length === 0) return;
    if (!billNo.trim()) {
      setFormError("Please enter Supplier Invoice / Bill No.");
      setConfirmPostOpen(false);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      supplierId: supplierId || null,
      billNo: billNo.trim(),
      billDate,
      locationId,
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
      router.push("/godown/purchases");
    } else {
      setFormError(res?.error || "Failed to record GRN receipt.");
      setConfirmPostOpen(false);
    }
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";

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
        if (activeLineId) {
          handleRemoveLine(activeLineId);
        }
      } else if (e.ctrlKey && (e.key === "k" || e.key === "K") || e.key === "F1") {
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
      } else if (e.altKey && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.ctrlKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        handleUndoRemove();
      } else if (e.key === "Escape") {
        if (supplierModalOpen) {
          setSupplierModalOpen(false);
        } else if (heldDrawerOpen) {
          setHeldDrawerOpen(false);
        } else if (helpOpen) {
          setHelpOpen(false);
        } else if (confirmPostOpen) {
          setConfirmPostOpen(false);
        } else if (discardConfirmOpen) {
          setDiscardConfirmOpen(false);
        } else if (searchDropdownOpen) {
          setSearchDropdownOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    lines,
    billNo,
    activeLineId,
    activeProduct,
    supplierModalOpen,
    heldDrawerOpen,
    helpOpen,
    confirmPostOpen,
    discardConfirmOpen,
    searchDropdownOpen,
    undoStack,
    createEmptyLine,
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
    setActiveLineId(newLine.id);
    setQuickAddOpen(false);
  };

  // 12 empty rows baseline
  const minRows = 12;
  const emptyRowCount = Math.max(0, minRows - lines.length);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#FAFAF7] font-sans select-none overflow-hidden text-slate-900 text-sm">
      {/* 1. TOP BAR (Shop POS twin style: 48px height) */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between h-12 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/godown/purchases"
            className="text-slate-400 hover:text-slate-700 text-xs font-medium flex items-center gap-1"
          >
            <span>Purchases / Record GRN</span>
          </Link>
          <span className="bg-[#790E11] text-white font-black text-[11px] px-2 py-0.5 rounded uppercase tracking-wider">
            PURCHASE GRN
          </span>
          <span className="bg-slate-100 text-slate-700 font-bold text-[11px] px-2 py-0.5 rounded border border-slate-200">
            GODOWN RECEIPT
          </span>
          <span className="text-slate-500 font-medium text-xs hidden md:inline">
            Receiver: Godown In-Charge
          </span>
          <div className="bg-[#790E11] text-white text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 shadow-xs">
            <Building2 className="w-3 h-3 text-[#FDAF18]" />
            <span className="truncate max-w-[140px]">{selectedSupplier?.name || "No Supplier"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
            className="bg-[#FC830D] hover:bg-[#e07205] text-slate-950 font-black text-xs px-3 py-1.5 rounded-md shadow-xs transition"
          >
            + New (F3)
          </button>
          <button
            type="button"
            onClick={handleHold}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            Hold (F4)
          </button>
          <button
            type="button"
            onClick={() => setHeldDrawerOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition relative"
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
            onClick={() => setQuickAddOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            + Product (Alt+N)
          </button>
          <button
            type="button"
            onClick={() => setEditMasterOpen(true)}
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            Master (Alt+M)
          </button>
          <Link
            href="/godown/purchases"
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            Purchases
          </Link>
          <Link
            href="/godown/stock"
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            Stock
          </Link>
          <Link
            href="/godown"
            className="bg-white border border-slate-300 text-slate-800 font-bold text-xs px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* 2. INFO ROW (Twin of POS party bar: 44px height) */}
      <div className="bg-white border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 text-xs shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-500 uppercase text-[10px]">Date:</span>
          <input
            type="date"
            value={billDate}
            onChange={(e) => setBillDate(e.target.value)}
            className="border border-slate-300 rounded px-2 py-0.5 text-xs font-semibold focus:outline-none focus:border-[#790E11]"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="font-bold text-slate-500 uppercase text-[10px]">GRN No:</span>
          <span className="font-mono font-bold text-[#790E11] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">
            GRN-AUTO
          </span>
        </div>

        {/* Supplier Bar (same slot as POS Party Bar) */}
        <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1">
          <span className="font-bold text-slate-600 text-[11px] uppercase">Supplier:</span>
          <span className="font-bold text-slate-900 truncate">
            {selectedSupplier?.name || "No supplier linked"}
          </span>
          {selectedSupplier?.company?.name && (
            <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
              Brand: {selectedSupplier.company.name}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            Bal: ₹{(((selectedSupplier?.payableBalancePaise || 0)) / 100).toFixed(2)}
          </span>
          <button
            type="button"
            onClick={() => setSupplierModalOpen(true)}
            className="ml-auto bg-white border border-slate-300 hover:border-[#790E11] text-[#790E11] font-bold text-[11px] px-2 py-0.5 rounded shadow-2xs transition"
          >
            Supplier (Alt+P)
          </button>
        </div>

        {/* Supplier Bill / Invoice No */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-700 uppercase text-[10px]">
            Bill No <span className="text-red-500">*</span>:
          </span>
          <input
            type="text"
            placeholder="INV-9982"
            value={billNo}
            onChange={(e) => setBillNo(e.target.value)}
            className="border border-slate-300 rounded px-2 py-0.5 text-xs font-mono font-bold focus:outline-none focus:border-[#790E11] w-28 bg-white"
          />
        </div>

        {/* Destination Location */}
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-slate-500 uppercase text-[10px]">Dest:</span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-bold text-[11px]">
            Main Godown
          </span>
        </div>

        {/* Narration */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
          <span className="font-bold text-slate-500 uppercase text-[10px]">Note:</span>
          <input
            type="text"
            placeholder="Challan / vehicle / terms..."
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            className="w-full border border-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#790E11] bg-white"
          />
        </div>
      </div>

      {/* 3. ITEM SEARCH BAR (Full Width directly under info row with Alt+B toggle) */}
      <div className="bg-[#FAFAF7] border-b border-slate-200 px-4 py-1.5 flex items-center gap-3 shrink-0 relative">
        <div className="flex-1 relative">
          <div className="flex items-center bg-white border border-slate-300 rounded-md px-3 py-1 focus-within:ring-2 focus-within:ring-[#790E11] focus-within:border-[#790E11] transition shadow-2xs">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode or search product name / code (Ctrl+K / F1)..."
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
                  setSearchSelectedIndex((prev) =>
                    prev < filteredSearchResults.length - 1 ? prev + 1 : 0
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSearchSelectedIndex((prev) =>
                    prev > 0 ? prev - 1 : filteredSearchResults.length - 1
                  );
                } else if (e.key === "Enter" && filteredSearchResults[searchSelectedIndex]) {
                  e.preventDefault();
                  handleSelectProductFromSearch(filteredSearchResults[searchSelectedIndex]);
                } else if (e.key === "Escape") {
                  setSearchDropdownOpen(false);
                }
              }}
              className="w-full text-xs font-semibold text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-400"
            />
            {productSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  setProductSearchQuery("");
                  setSearchDropdownOpen(false);
                }}
                className="p-0.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Autocomplete Search Dropdown */}
          {searchDropdownOpen && filteredSearchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {filteredSearchResults.map((prod, idx) => {
                const isSelected = idx === searchSelectedIndex;
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleSelectProductFromSearch(prod)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between text-xs transition ${
                      isSelected ? "bg-amber-100 font-bold text-slate-950" : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#790E11] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-[11px]">
                        {prod.shortCode}
                      </span>
                      <span className="font-semibold">{prod.name}</span>
                      {prod.company?.name && (
                        <span className="text-[10px] text-slate-500">({prod.company.name})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px]">
                        Stock: G-{prod.godownStockQty || 0} / S-{prod.shopStockQty || 0}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        MRP ₹{((prod.mrpPaise || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setAllProductsToggle((prev) => !prev)}
          className={`px-2.5 py-1 rounded text-xs font-bold border transition flex items-center gap-1.5 ${
            allProductsToggle
              ? "bg-[#790E11] text-white border-[#790E11]"
              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
          }`}
          title="Toggle brand filter for supplier (Alt+B)"
        >
          <Layers className="w-3.5 h-3.5" />
          All products (Alt+B)
        </button>

        <span className="text-[11px] font-mono text-slate-400 hidden xl:inline">
          Ctrl+K / F1 to search
        </span>
      </div>

      {/* 4. MAIN BODY (Grid Left + Totals Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Grid Pane */}
        <div className="flex-1 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-[#F8FAFC] border-b-2 border-slate-300 text-slate-700 font-extrabold uppercase text-[11px] select-none z-10">
                <tr>
                  <th className="py-2 px-2 text-center w-10 border-r border-slate-200">#</th>
                  <th className="py-2 px-3 border-r border-slate-200">Item Description</th>
                  <th className="py-2 px-2 text-right w-20 border-r border-slate-200">Qty</th>
                  <th className="py-2 px-2 text-center w-24 border-r border-slate-200">Unit</th>
                  <th className="py-2 px-2 text-right w-24 border-r border-slate-200">MRP</th>
                  <th className="py-2 px-2 text-right w-28 border-r border-slate-200">Purchase Rate</th>
                  <th className="py-2 px-2 text-right w-20 border-r border-slate-200">Disc %</th>
                  <th className="py-2 px-2 text-center w-20 border-r border-slate-200">GST %</th>
                  <th className="py-2 px-3 text-right w-28 border-r border-slate-200">Amount (₹)</th>
                  <th className="py-2 px-2 text-center w-12">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {lines.map((line, idx) => {
                  const calc = lineCalculations[idx];
                  const prod = catalog.find((p) => p.id === line.productId);
                  const isActive = line.id === activeLineId;

                  return (
                    <tr
                      key={line.id}
                      onClick={() => setActiveLineId(line.id)}
                      className={`hover:bg-slate-50 transition ${
                        isActive ? "bg-amber-50/60 font-semibold" : ""
                      }`}
                    >
                      {/* # */}
                      <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px] border-r border-slate-100">
                        {idx + 1}
                      </td>

                      {/* Product Description */}
                      <td className="py-1 px-3 border-r border-slate-100">
                        <div className="flex items-center justify-between gap-1">
                          <div className="truncate">
                            <span className="font-mono font-bold text-[#790E11] mr-1.5">
                              {prod?.shortCode || "---"}
                            </span>
                            <span className="text-slate-900 font-bold">{prod?.name || "Select item..."}</span>
                            {prod?.company?.name && (
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                ({prod.company.name})
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 shrink-0">
                            P-{prod?.packSize || 1}
                          </span>
                        </div>
                      </td>

                      {/* Qty */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <input
                          type="number"
                          step="any"
                          min="1"
                          value={line.qtyInput}
                          onChange={(e) => handleUpdateQty(line.id, e.target.value)}
                          onFocus={() => {
                            setActiveLineId(line.id);
                            setActiveCellColumn("qty");
                          }}
                          className={`w-full text-right font-mono font-bold px-1.5 py-0.5 rounded text-xs focus:outline-none ${
                            isActive && activeCellColumn === "qty"
                              ? "outline-2 outline-[#790E11] bg-[#FEF3C7]"
                              : "border border-slate-200 bg-white"
                          }`}
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-1 px-1 text-center border-r border-slate-100">
                        <select
                          value={line.unit}
                          onChange={(e) => handleUpdateUnit(line.id, e.target.value as UnitType)}
                          onFocus={() => {
                            setActiveLineId(line.id);
                            setActiveCellColumn("unit");
                          }}
                          className={`w-full text-center font-bold px-1 py-0.5 rounded text-xs focus:outline-none ${
                            isActive && activeCellColumn === "unit"
                              ? "outline-2 outline-[#790E11] bg-[#FEF3C7]"
                              : "border border-slate-200 bg-white"
                          }`}
                        >
                          <option value="Carton">Carton</option>
                          <option value="Pcs">Pcs</option>
                          <option value="Dozen">Dozen</option>
                          <option value="Bag">Bag</option>
                          <option value="Jar">Jar</option>
                          <option value="Hanger">Hanger</option>
                        </select>
                      </td>

                      {/* MRP */}
                      <td className="py-1.5 px-2 text-right font-mono text-slate-600 border-r border-slate-100">
                        ₹{(((prod?.mrpPaise || 0)) / 100).toFixed(2)}
                      </td>

                      {/* Purchase Rate per selected unit */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.rateInput}
                          onChange={(e) => handleUpdateRate(line.id, e.target.value)}
                          onFocus={() => {
                            setActiveLineId(line.id);
                            setActiveCellColumn("rate");
                          }}
                          className={`w-full text-right font-mono font-bold px-1.5 py-0.5 rounded text-xs focus:outline-none ${
                            isActive && activeCellColumn === "rate"
                              ? "outline-2 outline-[#790E11] bg-[#FEF3C7]"
                              : "border border-slate-200 bg-white"
                          }`}
                        />
                      </td>

                      {/* Disc % */}
                      <td className="py-1 px-1 text-right border-r border-slate-100">
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={line.discPercentInput}
                          onChange={(e) => handleUpdateDisc(line.id, e.target.value)}
                          onFocus={() => {
                            setActiveLineId(line.id);
                            setActiveCellColumn("disc");
                          }}
                          className={`w-full text-right font-mono font-bold px-1.5 py-0.5 rounded text-xs focus:outline-none ${
                            isActive && activeCellColumn === "disc"
                              ? "outline-2 outline-[#790E11] bg-[#FEF3C7]"
                              : "border border-slate-200 bg-white"
                          }`}
                        />
                      </td>

                      {/* GST % */}
                      <td className="py-1 px-1 text-center border-r border-slate-100">
                        <select
                          value={line.gstRateBp}
                          onChange={(e) => handleUpdateGst(line.id, parseInt(e.target.value))}
                          onFocus={() => {
                            setActiveLineId(line.id);
                            setActiveCellColumn("gst");
                          }}
                          className={`w-full text-center font-bold px-1 py-0.5 rounded text-xs focus:outline-none ${
                            isActive && activeCellColumn === "gst"
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
                      <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 border-r border-slate-100">
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
                    <td className="py-2 px-2 text-center font-mono text-[11px] border-r border-slate-100">
                      {lines.length + i + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-100 italic text-slate-300">
                      {lines.length === 0 && i === 0
                        ? "Scan or search a product (Ctrl+K / F1)"
                        : ""}
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
          <div className="bg-[#F8FAFC] border-t border-slate-200 px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-600 shrink-0">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-900">
                Active: {activeProduct ? activeProduct.name : "None"}
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
                Effective Rate:{" "}
                <b className="text-slate-900 font-mono">
                  ₹{((lineCalculations.find((_, i) => lines[i]?.id === activeLineId)?.ratePerPiece || 0)).toFixed(2)}/pc
                </b>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {undoStack.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoRemove}
                  className="flex items-center gap-1 text-[11px] text-[#790E11] font-bold hover:underline"
                >
                  <RotateCcw className="w-3 h-3" /> Undo delete (Ctrl+Z)
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (activeProduct) setInfoModalProduct(activeProduct as any);
                }}
                disabled={!activeProduct}
                className="bg-white border border-slate-300 hover:border-[#790E11] text-slate-700 font-bold px-2.5 py-1 rounded text-xs flex items-center gap-1 disabled:opacity-50 shadow-2xs"
              >
                <Info className="w-3.5 h-3.5 text-[#790E11]" />
                [F8 Info]
              </button>
            </div>
          </div>
        </div>

        {/* Right Totals Panel (Shop POS twin style: 340px width) */}
        <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col justify-between shrink-0 select-none">
          <div className="p-4 space-y-3 overflow-y-auto">
            {/* Bill Discount % */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Bill Discount (%):</span>
              <div className="flex items-center gap-1 w-24">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={billDiscountPercent}
                  onChange={(e) => setBillDiscountPercent(e.target.value)}
                  className="w-full text-right font-mono font-bold border border-slate-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#790E11]"
                />
                <span className="text-slate-500 font-bold">%</span>
              </div>
            </div>

            {/* Financial Breakdown Table */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({lines.length} items, {totalQtyPieces} pcs):</span>
                <span className="font-mono font-semibold">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Discount:</span>
                <span className="font-mono text-emerald-700 font-semibold">
                  -₹{totalDiscount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value:</span>
                <span className="font-mono font-semibold">₹{grandTaxable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (CGST + SGST):</span>
                <span className="font-mono font-semibold">₹{grandTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-[11px]">
                <span>Round-off:</span>
                <span className="font-mono">{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>
            </div>

            {/* Dark Maroon NET PAYABLE Hero Card (Twin of POS) */}
            <div className="bg-[#790E11] text-white p-4 rounded-xl border-2 border-[#FDAF18] shadow-lg mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-200">
                  NET PAYABLE
                </span>
                <span className="bg-[#FDAF18] text-[#790E11] text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                  PURCHASE
                </span>
              </div>
              <div className="text-3xl font-black font-mono text-[#FDAF18] mt-1 tracking-tight">
                ₹{roundedGrandTotal.toLocaleString("en-IN")}
              </div>
              <div className="text-[11px] text-slate-200 mt-1 capitalize italic leading-tight">
                {paiseToIndianWords(grandTotalPaise)}
              </div>
            </div>

            {/* Destination Note & Status */}
            <div className="pt-2 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                <span>Stock will be posted to: <b>Main Godown</b></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Status (Auto): <b>Draft Ready</b></span>
              </div>
            </div>

            {/* Remarks / Internal Note */}
            <div className="pt-2">
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                Remarks / GRN Note
              </label>
              <textarea
                rows={2}
                placeholder="Transporter name, LR number, notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full border border-slate-300 rounded p-1.5 text-xs focus:outline-none focus:border-[#790E11] resize-none"
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
              type="button"
              disabled={isSubmitting}
              onClick={() => setConfirmPostOpen(true)}
              className="w-full bg-[#790E11] hover:bg-[#5e0a0d] text-white font-black text-sm py-3 px-4 rounded-lg shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4 text-[#FDAF18]" />
              <span>Confirm & Post Stock (F2)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleHold}
                className="w-full bg-white border border-slate-300 text-slate-800 font-bold text-xs py-2 rounded-md hover:bg-slate-100 transition"
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
                className="w-full bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs py-2 rounded-md hover:bg-amber-100 transition"
              >
                New (F3)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. LEGEND BAR (Bottom sticky bar: Shop POS twin style) */}
      <footer className="bg-[#790E11] text-white px-4 py-1.5 text-[11px] font-mono font-bold flex items-center gap-2 overflow-x-auto border-t-2 border-[#FDAF18] shrink-0 select-none">
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F2 Post</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F3 New</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F4 Hold</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F5 Held</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F6 Add row</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F7 Repeat line</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F8 Info</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">F9 Delete row</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Alt+P Supplier</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Alt+N New prod</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Alt+M Modify prod</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Alt+B All prods</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Alt+E Search</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Ctrl+Z Undo</span>
        <span className="bg-white/20 px-1.5 py-0.5 rounded text-white border border-white/20">Esc Back</span>
      </footer>

      {/* 6. MODALS & POPUPS */}

      {/* S1b (1) Supplier Modal (Alt+P) */}
      {supplierModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3 flex items-center justify-between">
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
                type="text"
                placeholder="Search supplier by name, brand, phone..."
                value={supplierFilterQuery}
                onChange={(e) => setSupplierFilterQuery(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#790E11] mb-2"
              />
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">No matching suppliers</div>
                ) : (
                  filteredSuppliers.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setSupplierId(s.id);
                        setSupplierModalOpen(false);
                      }}
                      className={`w-full text-left p-2.5 hover:bg-amber-50 transition flex items-center justify-between text-xs ${
                        s.id === supplierId ? "bg-amber-100 font-bold" : ""
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
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
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* S1b (2) Confirm and Post Stock Popup (F2) */}
      {confirmPostOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#FDAF18]" />
                <h3 className="font-bold text-sm">Confirm & Post Purchase GRN (F2)</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfirmPostOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {/* Summary Stats */}
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
                  <span className="font-bold text-slate-900">{lines.length} items ({totalQtyPieces} pieces)</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Net Payable Amount</span>
                  <span className="font-mono font-bold text-[#790E11] text-sm">
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

              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-[11px] text-amber-900">
                <b>Note:</b> Confirming will post <b>{totalQtyPieces} pieces</b> into Main Godown stock ledger immediately and credit the supplier ledger.
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

      {/* S1b (4) Held GRNs Drawer (F5) */}
      {heldDrawerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right">
            <div>
              <div className="bg-[#790E11] text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[#FDAF18]" />
                  <h3 className="font-bold text-sm">Held GRN Vouchers (F5)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setHeldDrawerOpen(false)}
                  className="text-white/80 hover:text-white"
                >
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
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded"
              >
                Discard & New
              </button>
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

      {/* S1b (3) Quick Add Product Modal (Alt+N) */}
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
