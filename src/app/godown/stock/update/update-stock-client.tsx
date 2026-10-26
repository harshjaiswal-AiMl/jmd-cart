"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import {
  enterOpeningStockAction,
  setStockCountAction,
  adjustStockAction,
  bulkStockCsvAction,
  uploadStockExcelAction,
  undoStockUploadBatchAction,
  downloadCurrentStockExcelAction,
  bulkUpdateStockAction,
  updateProductStockBothLocationsAction,
  bulkUpdateProductsStockBothLocationsAction,
} from "./actions";
import {
  Search,
  Plus,
  Trash2,
  Layers,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Package,
  Building2,
  Store,
  Save,
  RotateCcw,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RefreshCw,
} from "lucide-react";

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

interface ProductOption {
  id: string;
  shortCode: string;
  name: string;
  packSize: number;
  unitType: string;
  companyId?: string;
  companyName?: string;
  categoryName?: string;
  balancesByLocation: Record<string, number>;
}

interface RecentBatchItem {
  id: string;
  filename: string;
  locationId: string | null;
  mode: string;
  rowsTotal: number;
  rowsApplied: number;
  rowsSkipped: number;
  status: string;
  createdAt: string;
  userName: string;
}

interface UpdateStockClientProps {
  locations: LocationOption[];
  products: ProductOption[];
  companies?: Array<{ id: string; name: string }>;
  userRole?: string;
  recentBatches?: RecentBatchItem[];
}

export function UpdateStockClient({
  locations,
  products,
  companies = [],
  userRole = "SUPER_ADMIN",
  recentBatches = [],
}: UpdateStockClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "opening" | "count" | "adjust" | "multi" | "csv"
  >("multi");

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Common selections
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || "");
  const [productId, setProductId] = useState<string>(products[0]?.id || "");
  const [inputMode, setInputMode] = useState<"pieces" | "carton_loose">("carton_loose");

  const singleProductOptions = useMemo(() => {
    return products.map((prod) => {
      const currentBal = prod.balancesByLocation[locationId] ?? 0;
      return {
        value: prod.id,
        label: `[${prod.shortCode}] ${prod.name}`,
        subLabel: `1 Carton = ${prod.packSize} pcs (${prod.unitType})`,
        badge: currentBal > 0 ? `Current: ${currentBal} pcs` : "0 pcs",
        badgeColor: currentBal > 0 ? ("green" as const) : ("gray" as const),
        inStock: currentBal > 0,
      };
    });
  }, [products, locationId]);

  // Quantities
  const [piecesInput, setPiecesInput] = useState<number>(0);
  const [cartonsInput, setCartonsInput] = useState<number>(0);
  const [looseInput, setLooseInput] = useState<number>(0);
  const [adjustDirection, setAdjustDirection] = useState<"add" | "subtract">("add");
  const [reason, setReason] = useState<string>("Initial physical opening stock entry");

  // Full Catalog Stock Editor (Godown & Shop) State
  const godownLocation = useMemo(
    () => locations.find((l) => l.type === "GODOWN") || locations[0],
    [locations]
  );
  const shopLocation = useMemo(
    () => locations.find((l) => l.type === "SHOP") || locations.find((l) => l.id !== godownLocation?.id),
    [locations, godownLocation]
  );

  const [tableSearch, setTableSearch] = useState<string>("");
  const [tableCompanyFilter, setTableCompanyFilter] = useState<string>("");
  const [showOnlyModified, setShowOnlyModified] = useState<boolean>(false);
  const [tablePage, setTablePage] = useState<number>(1);
  const [tablePageSize, setTablePageSize] = useState<number>(100);
  const [tableAuditReason, setTableAuditReason] = useState<string>("Physical stock count verification (Godown & Shop)");
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // tableEdits: Record<productId, { godownCartons?: number; godownLoose?: number; shopCartons?: number; shopLoose?: number }>
  const [tableEdits, setTableEdits] = useState<
    Record<
      string,
      {
        godownCartons?: number;
        godownLoose?: number;
        shopCartons?: number;
        shopLoose?: number;
      }
    >
  >({});

  const getProductGodownCartons = (p: ProductOption): number => {
    if (tableEdits[p.id]?.godownCartons !== undefined) {
      return tableEdits[p.id]!.godownCartons!;
    }
    const bal = p.balancesByLocation[godownLocation?.id || ""] || 0;
    const pSize = p.packSize || 1;
    return Math.floor(bal / pSize);
  };

  const getProductGodownLoose = (p: ProductOption): number => {
    if (tableEdits[p.id]?.godownLoose !== undefined) {
      return tableEdits[p.id]!.godownLoose!;
    }
    const bal = p.balancesByLocation[godownLocation?.id || ""] || 0;
    const pSize = p.packSize || 1;
    return bal % pSize;
  };

  const getProductShopCartons = (p: ProductOption): number => {
    if (tableEdits[p.id]?.shopCartons !== undefined) {
      return tableEdits[p.id]!.shopCartons!;
    }
    const bal = shopLocation ? p.balancesByLocation[shopLocation.id] || 0 : 0;
    const pSize = p.packSize || 1;
    return Math.floor(bal / pSize);
  };

  const getProductShopLoose = (p: ProductOption): number => {
    if (tableEdits[p.id]?.shopLoose !== undefined) {
      return tableEdits[p.id]!.shopLoose!;
    }
    const bal = shopLocation ? p.balancesByLocation[shopLocation.id] || 0 : 0;
    const pSize = p.packSize || 1;
    return bal % pSize;
  };

  const handleGodownCartonsChange = (prodId: string, val: string) => {
    const num = val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    setTableEdits((prev) => ({
      ...prev,
      [prodId]: {
        godownCartons: num,
        godownLoose: prev[prodId]?.godownLoose ?? getProductGodownLoose(prod),
        shopCartons: prev[prodId]?.shopCartons ?? getProductShopCartons(prod),
        shopLoose: prev[prodId]?.shopLoose ?? getProductShopLoose(prod),
      },
    }));
  };

  const handleGodownLooseChange = (prodId: string, val: string) => {
    const num = val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    setTableEdits((prev) => ({
      ...prev,
      [prodId]: {
        godownCartons: prev[prodId]?.godownCartons ?? getProductGodownCartons(prod),
        godownLoose: num,
        shopCartons: prev[prodId]?.shopCartons ?? getProductShopCartons(prod),
        shopLoose: prev[prodId]?.shopLoose ?? getProductShopLoose(prod),
      },
    }));
  };

  const handleShopCartonsChange = (prodId: string, val: string) => {
    const num = val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    setTableEdits((prev) => ({
      ...prev,
      [prodId]: {
        godownCartons: prev[prodId]?.godownCartons ?? getProductGodownCartons(prod),
        godownLoose: prev[prodId]?.godownLoose ?? getProductGodownLoose(prod),
        shopCartons: num,
        shopLoose: prev[prodId]?.shopLoose ?? getProductShopLoose(prod),
      },
    }));
  };

  const handleShopLooseChange = (prodId: string, val: string) => {
    const num = val === "" ? 0 : Math.max(0, parseInt(val, 10) || 0);
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    setTableEdits((prev) => ({
      ...prev,
      [prodId]: {
        godownCartons: prev[prodId]?.godownCartons ?? getProductGodownCartons(prod),
        godownLoose: prev[prodId]?.godownLoose ?? getProductGodownLoose(prod),
        shopCartons: prev[prodId]?.shopCartons ?? getProductShopCartons(prod),
        shopLoose: num,
      },
    }));
  };

  const isRowModified = (p: ProductOption): boolean => {
    const curG = p.balancesByLocation[godownLocation?.id || ""] || 0;
    const curS = shopLocation ? p.balancesByLocation[shopLocation.id] || 0 : 0;
    const pSize = p.packSize || 1;

    const newG = getProductGodownCartons(p) * pSize + getProductGodownLoose(p);
    const newS = getProductShopCartons(p) * pSize + getProductShopLoose(p);

    return newG !== curG || (shopLocation ? newS !== curS : false);
  };

  const modifiedProducts = useMemo(() => {
    return products.filter((p) => isRowModified(p));
  }, [products, tableEdits, godownLocation?.id, shopLocation?.id]);

  const modifiedCount = modifiedProducts.length;

  // Filtered and paginated products for table
  const companyOptions = useMemo(() => {
    if (companies && companies.length > 0) return companies;
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.companyId && p.companyName) {
        map.set(p.companyId, p.companyName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [companies, products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (showOnlyModified && !isRowModified(p)) return false;
      if (tableCompanyFilter && p.companyId !== tableCompanyFilter) return false;
      if (tableSearch.trim()) {
        const term = tableSearch.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(term);
        const matchesCode = p.shortCode.toLowerCase().includes(term);
        const matchesComp = p.companyName ? p.companyName.toLowerCase().includes(term) : false;
        if (!matchesName && !matchesCode && !matchesComp) return false;
      }
      return true;
    });
  }, [products, tableSearch, tableCompanyFilter, showOnlyModified, tableEdits, godownLocation?.id, shopLocation?.id]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / tablePageSize));
  const paginatedProducts = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredProducts.slice(start, start + tablePageSize);
  }, [filteredProducts, tablePage, tablePageSize]);

  const handleSaveSingleRow = (p: ProductOption) => {
    if (!godownLocation) return;
    setSavingRowId(p.id);

    startTransition(async () => {
      const pSize = p.packSize || 1;
      const gQty = getProductGodownCartons(p) * pSize + getProductGodownLoose(p);
      const sQty = shopLocation
        ? getProductShopCartons(p) * pSize + getProductShopLoose(p)
        : undefined;

      const res = await updateProductStockBothLocationsAction({
        productId: p.id,
        godownLocationId: godownLocation.id,
        godownQty: gQty,
        shopLocationId: shopLocation?.id,
        shopQty: sQty,
        reason: tableAuditReason.trim() || undefined,
      });

      setSavingRowId(null);
      if (res.success) {
        p.balancesByLocation[godownLocation.id] = gQty;
        if (shopLocation && sQty !== undefined) {
          p.balancesByLocation[shopLocation.id] = sQty;
        }
        setTableEdits((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
        setMessage({
          type: "success",
          text: `Stock successfully updated for "${p.name}"!`,
        });
      } else {
        setMessage({
          type: "error",
          text: res.error || "Failed to update stock.",
        });
      }
    });
  };

  const handleSaveAllModified = () => {
    if (!godownLocation || modifiedProducts.length === 0) return;

    startTransition(async () => {
      const updates = modifiedProducts.map((p) => {
        const pSize = p.packSize || 1;
        const gQty = getProductGodownCartons(p) * pSize + getProductGodownLoose(p);
        const sQty = shopLocation
          ? getProductShopCartons(p) * pSize + getProductShopLoose(p)
          : null;
        return {
          productId: p.id,
          godownQty: gQty,
          shopQty: sQty,
        };
      });

      const res = await bulkUpdateProductsStockBothLocationsAction({
        godownLocationId: godownLocation.id,
        shopLocationId: shopLocation?.id,
        reason: tableAuditReason.trim() || undefined,
        updates,
      });

      if (res.success) {
        updates.forEach((u) => {
          const prod = products.find((p) => p.id === u.productId);
          if (prod) {
            if (u.godownQty != null) {
              prod.balancesByLocation[godownLocation.id] = u.godownQty;
            }
            if (shopLocation && u.shopQty != null) {
              prod.balancesByLocation[shopLocation.id] = u.shopQty;
            }
          }
        });
        setTableEdits({});
        setMessage({
          type: "success",
          text: `Successfully updated stock across Godown & Shop for ${res.count} products!`,
        });
      } else {
        setMessage({
          type: "error",
          text: res.error || "Failed to bulk update stock.",
        });
      }
    });
  };

  const handleResetAllEdits = () => {
    if (confirm("Reset all unsaved stock changes back to system balances?")) {
      setTableEdits({});
    }
  };

  // Multi-Product batch state
  const [multiMode, setMultiMode] = useState<"COUNT" | "OPENING" | "ADJUST">("COUNT");
  const [multiAdjustDir, setMultiAdjustDir] = useState<"add" | "subtract">("add");
  const [multiReason, setMultiReason] = useState<string>("Multi-product physical stock count");
  const [multiSearch, setMultiSearch] = useState<string>("");
  const [multiItems, setMultiItems] = useState<Record<string, { cartons: number; loose: number }>>({});

  const addMultiProduct = (prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return;
    const curBal = prod.balancesByLocation[locationId] || 0;
    const pSize = prod.packSize || 1;
    const defaultCartons = multiMode === "COUNT" ? Math.floor(curBal / pSize) : 0;
    const defaultLoose = multiMode === "COUNT" ? curBal % pSize : 0;

    setMultiItems((prev) => ({
      ...prev,
      [prodId]: prev[prodId] || { cartons: defaultCartons, loose: defaultLoose },
    }));
  };

  const removeMultiProduct = (prodId: string) => {
    setMultiItems((prev) => {
      const next = { ...prev };
      delete next[prodId];
      return next;
    });
  };

  const updateMultiItem = (prodId: string, cartons: number, loose: number) => {
    setMultiItems((prev) => ({
      ...prev,
      [prodId]: { cartons: Math.max(0, cartons), loose: Math.max(0, loose) },
    }));
  };

  const addAllFilteredMulti = (matchingProds: ProductOption[]) => {
    setMultiItems((prev) => {
      const next = { ...prev };
      for (const prod of matchingProds.slice(0, 50)) {
        if (!next[prod.id]) {
          const curBal = prod.balancesByLocation[locationId] || 0;
          const pSize = prod.packSize || 1;
          const defaultCartons = multiMode === "COUNT" ? Math.floor(curBal / pSize) : 0;
          const defaultLoose = multiMode === "COUNT" ? curBal % pSize : 0;
          next[prod.id] = { cartons: defaultCartons, loose: defaultLoose };
        }
      }
      return next;
    });
  };

  const clearMultiBatch = () => {
    setMultiItems({});
  };

  const handleMultiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const itemKeys = Object.keys(multiItems);
    if (itemKeys.length === 0) {
      setMessage({ type: "error", text: "Please add at least one product to the batch list." });
      return;
    }

    const payloadItems = itemKeys.map((pId) => {
      const p = products.find((x) => x.id === pId);
      const pSize = p?.packSize || 1;
      const { cartons, loose } = multiItems[pId];
      const totalPieces = cartons * pSize + loose;
      return {
        productId: pId,
        qty: totalPieces,
      };
    });

    startTransition(async () => {
      const res = await bulkUpdateStockAction({
        locationId,
        mode: multiMode,
        reason: multiReason.trim() || `Multi-product ${multiMode} stock update`,
        adjustDirection: multiAdjustDir,
        items: payloadItems,
      });

      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to bulk update stock" });
      } else {
        setMessage({
          type: "success",
          text: `Successfully updated stock for ${res.count} products at ${
            locations.find((l) => l.id === locationId)?.name || "target location"
          }!`,
        });
        setMultiItems({});
        setMultiSearch("");
        router.refresh();
      }
    });
  };

  // Excel / CSV Instant Upload state
  const [excelMode, setExcelMode] = useState<
    "OPENING_STOCK" | "STOCK_COUNT" | "ADD" | "DEDUCT"
  >("STOCK_COUNT");
  const [excelUploadResult, setExcelUploadResult] = useState<{
    batchId: string;
    filename: string;
    mode: string;
    locationId: string;
    locationName: string;
    rowsTotal: number;
    rowsApplied: number;
    rowsSkipped: number;
    totalCartonsDelta: number;
    totalLooseDelta: number;
    totalPiecesDelta: number;
    appliedRows: Array<{
      rowNumber: number;
      sheetName: string;
      productId: string;
      shortCode: string;
      productName: string;
      packSize: number;
      locationId: string;
      locationName: string;
      beforePieces: number;
      beforeCartons: number;
      beforeLoose: number;
      afterPieces: number;
      afterCartons: number;
      afterLoose: number;
      deltaPieces: number;
    }>;
    skippedRows: Array<{
      rowNumber: number;
      sheetName: string;
      rawItemOrSku: string;
      rawCartons: string;
      rawLoose: string;
      reason: string;
    }>;
    skippedErrorXlsxBase64?: string;
    undone?: boolean;
  } | null>(null);

  // Legacy raw CSV paste fallback state
  const [rawCsv, setRawCsv] = useState<string>("");
  const [csvPreview, setCsvPreview] = useState<{
    errorCount: number;
    rows: Array<{
      rowNumber: number;
      shortCode: string;
      productName?: string;
      packSize?: number;
      cartons: number;
      loosePieces: number;
      inputPieces: number;
      currentBalance: number;
      deltaPieces: number;
      resultingBalance: number;
      reason: string;
      error?: string;
    }>;
  } | null>(null);

  const selectedProduct = products.find((p) => p.id === productId);
  const packSize = selectedProduct?.packSize || 1;
  const currentBalance =
    (selectedProduct && locationId && selectedProduct.balancesByLocation[locationId]) || 0;

  const computedPieces =
    inputMode === "pieces"
      ? piecesInput
      : cartonsInput * packSize + looseInput;

  // Derived previews
  const openingResultBalance = currentBalance + Math.max(0, computedPieces);
  const countDelta = computedPieces - currentBalance;
  const countResultBalance = Math.max(0, computedPieces);
  const signedAdjustment =
    adjustDirection === "add" ? Math.abs(computedPieces) : -Math.abs(computedPieces);
  const adjustResultBalance = currentBalance + signedAdjustment;

  const handleTabSwitch = (tab: "opening" | "count" | "adjust" | "multi" | "csv") => {
    setActiveTab(tab);
    setMessage(null);
    if (tab === "opening") setReason("Initial physical opening stock entry");
    if (tab === "count") setReason("Physical stock count reconciliation");
    if (tab === "adjust") setReason("Stock count / manual adjustment");
    if (tab === "multi") {
      if (multiMode === "OPENING") setMultiReason("Initial physical opening stock entry");
      else if (multiMode === "COUNT") setMultiReason("Multi-product physical stock count");
      else setMultiReason("Multi-product stock adjustment");
    }
  };

  const downloadBase64File = (base64: string, filename: string) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCurrentStockExcel = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await downloadCurrentStockExcelAction(locationId);
      if (!res.success || !res.base64) {
        setMessage({
          type: "error",
          text: res.error || "Failed to download current stock Excel",
        });
      } else {
        downloadBase64File(res.base64, res.filename || "jmd_current_stock.xlsx");
      }
    });
  };

  const handleInstantExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      startTransition(async () => {
        const res = await uploadStockExcelAction({
          base64Data,
          filename: file.name,
          locationId,
          mode: excelMode,
        });

        if (!res.success || !res.result) {
          setMessage({
            type: "error",
            text: res.error || "Failed to upload and apply stock Excel",
          });
        } else {
          setExcelUploadResult(res.result);
          setMessage({
            type: "success",
            text: `Applied ${res.result.rowsApplied} of ${res.result.rowsTotal} rows (${res.result.rowsSkipped} skipped) from ${file.name}.`,
          });
          router.refresh();
        }
      });
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleUndoBatch = (batchId: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await undoStockUploadBatchAction(batchId);
      if (!res.success) {
        setMessage({
          type: "error",
          text: res.error || "Failed to undo stock upload batch",
        });
      } else {
        setMessage({
          type: "success",
          text: `Reversed ${(res as { reversedCount?: number }).reversedCount ?? 0} stock movements from batch ${batchId.slice(0, 8)}. Balances restored to prior values.`,
        });
        if (excelUploadResult && excelUploadResult.batchId === batchId) {
          setExcelUploadResult({ ...excelUploadResult, undone: true });
        }
        router.refresh();
      }
    });
  };

  const handleOpeningSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (computedPieces <= 0) {
      setMessage({ type: "error", text: "Quantity must be greater than 0 pieces." });
      return;
    }

    startTransition(async () => {
      const res = await enterOpeningStockAction({
        productId,
        locationId,
        qty: computedPieces,
        reason,
      });
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to enter opening stock" });
      } else {
        setMessage({
          type: "success",
          text: `Opening stock posted (+${computedPieces} pcs). Resulting balance: ${res.resultingBalance} pcs.`,
        });
        setPiecesInput(0);
        setCartonsInput(0);
        setLooseInput(0);
        router.refresh();
      }
    });
  };

  const handleCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (computedPieces < 0) {
      setMessage({ type: "error", text: "Counted quantity cannot be negative." });
      return;
    }

    startTransition(async () => {
      const res = await setStockCountAction({
        productId,
        locationId,
        countedQty: computedPieces,
        reason,
      });
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to set stock count" });
      } else {
        setMessage({
          type: "success",
          text: `Stock count updated (System: ${res.systemQty} → Counted: ${res.countedQty}, Delta: ${
            (res.delta ?? 0) >= 0 ? `+${res.delta}` : res.delta
          } pcs).`,
        });
        router.refresh();
      }
    });
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (signedAdjustment === 0) {
      setMessage({ type: "error", text: "Adjustment quantity cannot be zero." });
      return;
    }
    if (adjustResultBalance < 0) {
      setMessage({
        type: "error",
        text: `Resulting balance (${adjustResultBalance} pcs) cannot be negative.`,
      });
      return;
    }

    startTransition(async () => {
      const res = await adjustStockAction({
        productId,
        locationId,
        adjustmentQty: signedAdjustment,
        reason,
      });
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to adjust stock" });
      } else {
        setMessage({
          type: "success",
          text: `Stock adjustment posted (${
            signedAdjustment > 0 ? `+${signedAdjustment}` : signedAdjustment
          } pcs).`,
        });
        setPiecesInput(0);
        setCartonsInput(0);
        setLooseInput(0);
        router.refresh();
      }
    });
  };

  const handleCsvPreview = () => {
    setMessage(null);
    const mappedMode =
      excelMode === "OPENING_STOCK"
        ? "OPENING_STOCK"
        : excelMode === "STOCK_COUNT"
        ? "STOCK_COUNT"
        : "ADJUSTMENT";
    startTransition(async () => {
      const res = await bulkStockCsvAction({
        locationId,
        mode: mappedMode,
        rawCsv,
        previewOnly: true,
      });
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to preview CSV" });
      } else if ("rows" in res && res.rows) {
        setCsvPreview({
          errorCount: res.errorCount ?? 0,
          rows: res.rows,
        });
      }
    });
  };

  const handleCsvApply = () => {
    setMessage(null);
    const mappedMode =
      excelMode === "OPENING_STOCK"
        ? "OPENING_STOCK"
        : excelMode === "STOCK_COUNT"
        ? "STOCK_COUNT"
        : "ADJUSTMENT";
    startTransition(async () => {
      const res = await bulkStockCsvAction({
        locationId,
        mode: mappedMode,
        rawCsv,
        previewOnly: false,
      });
      if (!res.success) {
        setMessage({ type: "error", text: res.error || "Failed to apply CSV" });
      } else if ("applied" in res && res.applied) {
        setMessage({
          type: "success",
          text: `Successfully posted ${res.rows?.length || 0} stock movements from CSV.`,
        });
        setCsvPreview(null);
        setRawCsv("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-1.5 rounded-xl border border-gray-200 shadow-xs">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleTabSwitch("opening")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "opening"
                ? "bg-[#790E11] text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            1. Opening Stock
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("count")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "count"
                ? "bg-[#790E11] text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            2. Stock Count (Set Quantity)
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("adjust")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "adjust"
                ? "bg-[#790E11] text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            3. Adjust (+/-)
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("multi")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "multi"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            4. Multi-Product Batch Entry
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("csv")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "csv"
                ? "bg-[#FC830D] text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            5. Instant Excel / CSV Upload
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownloadCurrentStockExcel}
          disabled={isPending || !locationId}
          className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition disabled:opacity-50"
        >
          ⬇ Download Current Stock as Excel
        </button>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            message.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {activeTab === "multi" ? (
        <div className="space-y-4">
          {/* Controls Card: Filter, Search, Audit Reason, Page Size */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-700" />
                  <span>All Products Stock Editor</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Godown &amp; Shop Stock
                  </span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  View and update cartons &amp; loose pieces for <strong>Main Godown</strong> and <strong>Retail Shop</strong> across all products.
                </p>
              </div>

              {/* Status Indicator & Modified Count */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{products.length} Products Active</span>
                </div>
                {modifiedCount > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500 text-white shadow-xs">
                    {modifiedCount} Unsaved Change{modifiedCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              {/* Search */}
              <div className="lg:col-span-4 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setTablePage(1);
                  }}
                  placeholder="Search products by name or SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Brand / Company Filter */}
              <div className="lg:col-span-3">
                <select
                  value={tableCompanyFilter}
                  onChange={(e) => {
                    setTableCompanyFilter(e.target.value);
                    setTablePage(1);
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 text-xs text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">All Brands / Companies ({products.length})</option>
                  {companyOptions.map((comp) => (
                    <option key={comp.id} value={comp.id}>
                      {comp.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Audit Reason */}
              <div className="lg:col-span-3">
                <input
                  type="text"
                  value={tableAuditReason}
                  onChange={(e) => setTableAuditReason(e.target.value)}
                  placeholder="Audit reason (min 3 chars)..."
                  className="w-full py-2 px-3 rounded-xl border border-gray-300 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  title="Mandatory reason logged in ledger for stock count changes"
                />
              </div>

              {/* Page Size & Toggle */}
              <div className="lg:col-span-2 flex items-center gap-2">
                <select
                  value={tablePageSize}
                  onChange={(e) => {
                    setTablePageSize(Number(e.target.value));
                    setTablePage(1);
                  }}
                  className="py-2 px-2.5 rounded-xl border border-gray-300 text-xs text-gray-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                >
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                  <option value={200}>200 / page</option>
                  <option value={10000}>All Products</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowOnlyModified(!showOnlyModified)}
                  className={`p-2 rounded-xl border text-xs font-bold transition shrink-0 ${
                    showOnlyModified
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                  title="Toggle to show only modified items"
                >
                  <Filter className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Floating / Sticky Action Bar when products are modified */}
            {modifiedCount > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs text-amber-900 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    You have modified stock for <strong>{modifiedCount} product{modifiedCount > 1 ? "s" : ""}</strong>.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetAllEdits}
                    disabled={isPending}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset All</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAllModified}
                    disabled={isPending}
                    className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving {modifiedCount} Products...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save All Changes ({modifiedCount})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-4 min-w-[220px]">Product / SKU</th>
                    <th className="py-3 px-3 text-center min-w-[100px]">Pack Size</th>
                    {/* Main Godown Column Header */}
                    <th className="py-3 px-4 min-w-[200px] bg-blue-50/50 border-l border-r border-blue-100">
                      <div className="flex items-center gap-1.5 text-blue-900 font-black">
                        <Building2 className="w-3.5 h-3.5 text-blue-700" />
                        <span>Main Godown Stock</span>
                      </div>
                      <div className="text-[10px] text-blue-600 font-normal normal-case">
                        Cartons + Loose Pieces
                      </div>
                    </th>
                    {/* Retail Shop Column Header */}
                    <th className="py-3 px-4 min-w-[200px] bg-emerald-50/50 border-r border-emerald-100">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-black">
                        <Store className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Retail Shop Stock</span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-normal normal-case">
                        Cartons + Loose Pieces
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center min-w-[90px]">Total Pcs</th>
                    <th className="py-3 px-4 text-center min-w-[100px]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500">
                        <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No products found matching filters.</p>
                        <p className="text-xs text-gray-400 mt-0.5">Try clearing your search query or brand filter.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedProducts.map((p, idx) => {
                      const rowNum = (tablePage - 1) * tablePageSize + idx + 1;
                      const pSize = p.packSize || 1;

                      const curG = p.balancesByLocation[godownLocation?.id || ""] || 0;
                      const curS = shopLocation ? p.balancesByLocation[shopLocation.id] || 0 : 0;

                      const editGCartons = getProductGodownCartons(p);
                      const editGLoose = getProductGodownLoose(p);
                      const newGTotal = editGCartons * pSize + editGLoose;
                      const deltaG = newGTotal - curG;

                      const editSCartons = getProductShopCartons(p);
                      const editSLoose = getProductShopLoose(p);
                      const newSTotal = editSCartons * pSize + editSLoose;
                      const deltaS = newSTotal - curS;

                      const totalCombined = newGTotal + (shopLocation ? newSTotal : 0);
                      const isModified = deltaG !== 0 || (shopLocation ? deltaS !== 0 : false);
                      const isSaving = savingRowId === p.id;

                      return (
                        <tr
                          key={p.id}
                          className={`transition ${
                            isModified ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-gray-50/50"
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center font-mono text-gray-400 text-xs">
                            {rowNum}
                          </td>

                          {/* Product Info */}
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-gray-900 leading-tight">{p.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {p.shortCode && (
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                  {p.shortCode}
                                </span>
                              )}
                              {p.companyName && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {p.companyName}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Pack Size */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono text-xs font-semibold text-gray-700">
                              {pSize > 1 ? `${pSize} pcs/crt` : "Loose (1)"}
                            </span>
                          </td>

                          {/* Main Godown Inputs */}
                          <td className="py-2.5 px-4 bg-blue-50/20 border-l border-r border-blue-100">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1">
                                <div className="text-[9px] uppercase font-bold text-blue-800 mb-0.5">Cartons</div>
                                <input
                                  type="number"
                                  min={0}
                                  value={editGCartons}
                                  onChange={(e) => handleGodownCartonsChange(p.id, e.target.value)}
                                  className="w-full px-2 py-1 text-center font-mono text-xs font-bold border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                              <span className="text-gray-300 font-black mt-3">+</span>
                              <div className="flex-1">
                                <div className="text-[9px] uppercase font-bold text-blue-800 mb-0.5">Loose Pcs</div>
                                <input
                                  type="number"
                                  min={0}
                                  value={editGLoose}
                                  onChange={(e) => handleGodownLooseChange(p.id, e.target.value)}
                                  className="w-full px-2 py-1 text-center font-mono text-xs font-bold border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] mt-1 text-blue-900 font-mono">
                              <span>Total: <strong>{newGTotal} pcs</strong></span>
                              {deltaG !== 0 && (
                                <span className={`font-bold ${deltaG > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                  {deltaG > 0 ? `+${deltaG}` : deltaG} pcs
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Retail Shop Inputs */}
                          <td className="py-2.5 px-4 bg-emerald-50/20 border-r border-emerald-100">
                            {shopLocation ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1">
                                    <div className="text-[9px] uppercase font-bold text-emerald-800 mb-0.5">Cartons</div>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editSCartons}
                                      onChange={(e) => handleShopCartonsChange(p.id, e.target.value)}
                                      className="w-full px-2 py-1 text-center font-mono text-xs font-bold border border-emerald-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                  <span className="text-gray-300 font-black mt-3">+</span>
                                  <div className="flex-1">
                                    <div className="text-[9px] uppercase font-bold text-emerald-800 mb-0.5">Loose Pcs</div>
                                    <input
                                      type="number"
                                      min={0}
                                      value={editSLoose}
                                      onChange={(e) => handleShopLooseChange(p.id, e.target.value)}
                                      className="w-full px-2 py-1 text-center font-mono text-xs font-bold border border-emerald-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] mt-1 text-emerald-900 font-mono">
                                  <span>Total: <strong>{newSTotal} pcs</strong></span>
                                  {deltaS !== 0 && (
                                    <span className={`font-bold ${deltaS > 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                      {deltaS > 0 ? `+${deltaS}` : deltaS} pcs
                                    </span>
                                  )}
                                </div>
                              </>
                            ) : (
                              <span className="text-gray-400 text-[10px]">No shop location</span>
                            )}
                          </td>

                          {/* Combined Total */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono text-xs font-black text-gray-900 block">
                              {totalCombined}
                            </span>
                            <span className="text-[10px] text-gray-400">pcs</span>
                          </td>

                          {/* Row Save Action */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleSaveSingleRow(p)}
                              disabled={!isModified || isSaving || isPending}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 w-full ${
                                isModified
                                  ? "bg-[#075828] hover:bg-emerald-900 text-white shadow-xs"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              {isSaving ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              <span>{isSaving ? "Saving..." : "Save"}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-gray-600">
                  Showing <strong>{(tablePage - 1) * tablePageSize + 1}</strong> to{" "}
                  <strong>{Math.min(tablePage * tablePageSize, filteredProducts.length)}</strong> of{" "}
                  <strong>{filteredProducts.length}</strong> products
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTablePage(1)}
                    disabled={tablePage === 1}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    disabled={tablePage === 1}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-semibold text-gray-800">
                    Page {tablePage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                    disabled={tablePage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTablePage(totalPages)}
                    disabled={tablePage === totalPages}
                    className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeTab !== "csv" ? (
        products.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-4">
            <h2 className="text-lg font-bold text-gray-900">No products in catalog yet</h2>
            <p className="text-sm text-gray-600 max-w-md mx-auto">
              Add or import products into your catalog first, or switch to Tab 4 (Instant Excel Upload) after importing your catalog.
            </p>
            <div className="flex justify-center gap-3">
              {userRole !== "GODOWN" && (
                <>
                  <Link
                    href="/admin/catalog"
                    className="bg-[#790E11] hover:bg-[#5f0b0d] text-white text-xs font-bold px-4 py-2.5 rounded-lg"
                  >
                    + Add Product in Catalog
                  </Link>
                  <Link
                    href="/admin/catalog/import"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold px-4 py-2.5 rounded-lg"
                  >
                    Import Brand Catalog (.xlsx)
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <form
            onSubmit={
              activeTab === "opening"
                ? handleOpeningSubmit
                : activeTab === "count"
                ? handleCountSubmit
                : handleAdjustSubmit
            }
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Location {userRole === "GODOWN" ? "(Godown Only)" : "(Godown / Shop / Van)"} *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Product *
                </label>
                <SearchableSelect
                  options={singleProductOptions}
                  value={productId}
                  onChange={(val) => setProductId(val)}
                  placeholder="Select product..."
                  searchPlaceholder="Search product by code, name..."
                  popoverWidthClass="w-full min-w-[360px]"
                />
              </div>
            </div>

            {/* Input Unit Mode Toggle */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div>
                <span className="text-xs font-bold uppercase text-gray-500 block">
                  Current System Balance at Location
                </span>
                <span className="text-lg font-black text-gray-900">
                  {currentBalance} pieces{" "}
                  <span className="text-xs font-medium text-gray-500">
                    ({Math.floor(currentBalance / packSize)} cartons + {currentBalance % packSize} loose)
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode("carton_loose")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    inputMode === "carton_loose"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  Cartons + Loose Pieces
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("pieces")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                    inputMode === "pieces"
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  Total Pieces Only
                </button>
              </div>
            </div>

            {activeTab === "adjust" && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustDirection("add")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border ${
                    adjustDirection === "add"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  + Add Stock (Found / Surplus)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustDirection("subtract")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold border ${
                    adjustDirection === "subtract"
                      ? "bg-red-600 text-white border-red-600"
                      : "bg-white text-gray-700 border-gray-300"
                  }`}
                >
                  - Deduct Stock (Shortage / Write-off)
                </button>
              </div>
            )}

            {inputMode === "carton_loose" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Cartons (1 carton = {packSize} pcs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={cartonsInput}
                    onChange={(e) => setCartonsInput(Math.max(0, parseInt(e.target.value || "0", 10)))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                    Loose Pieces
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={looseInput}
                    onChange={(e) => setLooseInput(Math.max(0, parseInt(e.target.value || "0", 10)))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Quantity (in Pieces)
                </label>
                <input
                  type="number"
                  min={0}
                  value={piecesInput}
                  onChange={(e) => setPiecesInput(Math.max(0, parseInt(e.target.value || "0", 10)))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            )}

            {/* Resulting Balance Preview */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-blue-900 space-y-0.5">
                <p className="font-bold uppercase tracking-wider">Ledger Movement Preview</p>
                {activeTab === "opening" && (
                  <p>
                    Posts <code className="font-mono font-bold">OPENING_STOCK</code> (+{computedPieces} pcs) → Resulting Balance:{" "}
                    <strong>{openingResultBalance} pcs</strong>
                  </p>
                )}
                {activeTab === "count" && (
                  <p>
                    System: <strong>{currentBalance} pcs</strong> | Counted:{" "}
                    <strong>{computedPieces} pcs</strong> | Computed{" "}
                    <code className="font-mono font-bold">ADJUSTMENT</code> Delta:{" "}
                    <strong>{countDelta >= 0 ? `+${countDelta}` : countDelta} pcs</strong> → Resulting Balance:{" "}
                    <strong>{countResultBalance} pcs</strong>
                  </p>
                )}
                {activeTab === "adjust" && (
                  <p>
                    Posts <code className="font-mono font-bold">ADJUSTMENT</code> (
                    {signedAdjustment >= 0 ? `+${signedAdjustment}` : signedAdjustment} pcs) → Resulting Balance:{" "}
                    <strong className={adjustResultBalance < 0 ? "text-red-600" : ""}>
                      {adjustResultBalance} pcs
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                Mandatory Reason / Audit Note *
              </label>
              <input
                type="text"
                required
                minLength={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for stock entry or adjustment"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="bg-[#075828] hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-sm transition"
              >
                {isPending
                  ? "Posting to Ledger..."
                  : activeTab === "opening"
                  ? "Post Opening Stock"
                  : activeTab === "count"
                  ? "Save Stock Count & Post Delta"
                  : "Post Stock Adjustment"}
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="space-y-6">
          {/* Instant 1-Step Excel Upload Card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Instant 1-Step Excel / CSV Stock Upload
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Select a location and mode, then pick an <code className="font-mono">.xlsx</code> or{" "}
                  <code className="font-mono">.csv</code> file. Valid rows are applied immediately in one transaction; invalid rows are skipped with a downloadable error report.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCurrentStockExcel}
                disabled={isPending || !locationId}
                className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition"
              >
                ⬇ Download Current Stock (.xlsx)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Target Location *
                </label>
                <select
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Upload Mode *
                </label>
                <select
                  value={excelMode}
                  onChange={(e) =>
                    setExcelMode(
                      e.target.value as "OPENING_STOCK" | "STOCK_COUNT" | "ADD" | "DEDUCT"
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium"
                >
                  <option value="STOCK_COUNT">Stock Count (Set Exact Balance)</option>
                  <option value="OPENING_STOCK">Opening Stock (+ Add Opening)</option>
                  <option value="ADD">Add (+ Increase Stock)</option>
                  <option value="DEDUCT">Deduct (- Reduce Stock)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-gray-600 mb-1">
                  Upload Excel (.xlsx) or CSV File *
                </label>
                <label className="flex items-center justify-center w-full rounded-xl border-2 border-dashed border-[#FC830D] bg-orange-50/40 hover:bg-orange-50 px-4 py-2.5 text-xs font-bold text-[#790E11] cursor-pointer transition">
                  <span>{isPending ? "Applying Stock Upload..." : "📂 Choose .xlsx / .csv to Apply Immediately"}</span>
                  <input
                    type="file"
                    accept=".xlsx,.csv"
                    disabled={isPending}
                    onChange={handleInstantExcelUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
              <strong>Accepted columns:</strong> <code className="font-mono">SKU / Short Code</code> (or{" "}
              <code className="font-mono">Brand + Product Name</code>),{" "}
              <code className="font-mono">Cartons / Cases</code>,{" "}
              <code className="font-mono">Loose Pieces</code>, or{" "}
              <code className="font-mono">Total Pieces</code>, optional{" "}
              <code className="font-mono">Location</code> and <code className="font-mono">Reason</code>.{" "}
              <span className="font-semibold">
                Tip: Click &ldquo;Download Current Stock (.xlsx)&rdquo;, edit Cartons / Loose Pieces in Excel, and upload it back!
              </span>
            </div>

            {/* Instant Upload Result Summary + Undo */}
            {excelUploadResult && (
              <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="bg-gray-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-amber-400 font-bold block">
                      Batch #{excelUploadResult.batchId.slice(0, 8)} • {excelUploadResult.mode} • Net Δ:{" "}
                      {excelUploadResult.totalCartonsDelta >= 0
                        ? `+${excelUploadResult.totalCartonsDelta}`
                        : excelUploadResult.totalCartonsDelta}
                      c /{" "}
                      {excelUploadResult.totalLooseDelta >= 0
                        ? `+${excelUploadResult.totalLooseDelta}`
                        : excelUploadResult.totalLooseDelta}
                      l ({excelUploadResult.totalPiecesDelta >= 0 ? `+${excelUploadResult.totalPiecesDelta}` : excelUploadResult.totalPiecesDelta} pcs)
                    </span>
                    <h3 className="text-sm font-bold">
                      {excelUploadResult.filename}: Applied {excelUploadResult.rowsApplied} of{" "}
                      {excelUploadResult.rowsTotal} rows ({excelUploadResult.rowsSkipped} skipped)
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {excelUploadResult.skippedErrorXlsxBase64 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadBase64File(
                            excelUploadResult.skippedErrorXlsxBase64!,
                            `skipped_stock_rows_${excelUploadResult.batchId.slice(0, 8)}.xlsx`
                          )
                        }
                        className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold text-xs px-3.5 py-2 rounded-lg transition"
                      >
                        ⬇ Download Skipped Rows (.xlsx)
                      </button>
                    )}

                    {!excelUploadResult.undone ? (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleUndoBatch(excelUploadResult.batchId)}
                        className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
                      >
                        ↩ Undo This Upload
                      </button>
                    ) : (
                      <span className="bg-gray-700 text-gray-200 text-xs font-bold px-3 py-1.5 rounded-lg">
                        ✓ Upload Undone
                      </span>
                    )}
                  </div>
                </div>

                {excelUploadResult.appliedRows.length > 0 && (
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                          <th className="py-2 px-3">Row</th>
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">Product</th>
                          <th className="py-2 px-3 text-right">Pack Size</th>
                          <th className="py-2 px-3 text-right">Before</th>
                          <th className="py-2 px-3 text-right">Delta</th>
                          <th className="py-2 px-3 text-right">After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {excelUploadResult.appliedRows.map((r, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="py-2 px-3 font-mono">{r.rowNumber}</td>
                            <td className="py-2 px-3 font-mono font-bold">{r.shortCode}</td>
                            <td className="py-2 px-3">{r.productName}</td>
                            <td className="py-2 px-3 text-right font-mono">{r.packSize}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {r.beforeCartons}c + {r.beforeLoose}l ({r.beforePieces} pcs)
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                              {r.deltaPieces >= 0 ? `+${r.deltaPieces}` : r.deltaPieces} pcs
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {r.afterCartons}c + {r.afterLoose}l ({r.afterPieces} pcs)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {excelUploadResult.skippedRows.length > 0 && (
                  <div className="border-t border-gray-200 bg-red-50/40 p-3">
                    <p className="text-xs font-bold text-red-800 mb-2">
                      Skipped Rows ({excelUploadResult.skippedRows.length}):
                    </p>
                    <ul className="space-y-1 text-xs text-red-700 max-h-40 overflow-y-auto">
                      {excelUploadResult.skippedRows.map((s, idx) => (
                        <li key={idx}>
                          • Row {s.rowNumber} ({s.rawItemOrSku || "Unknown"}): {s.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recent Stock Upload Batches History */}
            {recentBatches.length > 0 && (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 text-xs font-bold text-gray-700">
                  Recent Stock Upload Batches
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50 text-gray-500">
                        <th className="py-2 px-3">File</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3 text-right">Applied / Total</th>
                        <th className="py-2 px-3 text-right">Skipped</th>
                        <th className="py-2 px-3">By</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="py-2 px-3 font-medium">{b.filename}</td>
                          <td className="py-2 px-3 font-mono">{b.mode}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {b.rowsApplied} / {b.rowsTotal}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{b.rowsSkipped}</td>
                          <td className="py-2 px-3">{b.userName}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                b.status === "APPLIED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {b.status === "APPLIED" && b.rowsApplied > 0 && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleUndoBatch(b.id)}
                                className="text-red-700 hover:text-red-900 font-bold underline disabled:opacity-50"
                              >
                                Undo Upload
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Paste Raw CSV Fallback */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <label className="block text-xs font-bold uppercase text-gray-600">
              Or Paste Raw CSV Text (<code className="font-mono">shortCode,cartons,loosePieces,reason</code>)
            </label>
            <textarea
              rows={4}
              value={rawCsv}
              onChange={(e) => {
                setRawCsv(e.target.value);
                setCsvPreview(null);
              }}
              placeholder={"shortCode,cartons,loosePieces,reason"}
              className="w-full rounded-lg border border-gray-300 p-3 text-xs font-mono"
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isPending || !rawCsv.trim()}
                onClick={handleCsvPreview}
                className="bg-gray-800 hover:bg-gray-900 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
              >
                Preview Pasted CSV
              </button>
              {csvPreview && csvPreview.errorCount === 0 && csvPreview.rows.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleCsvApply}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
                >
                  Confirm &amp; Post {csvPreview.rows.length} Movements
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
