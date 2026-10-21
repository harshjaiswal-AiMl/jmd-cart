"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  enterOpeningStockAction,
  setStockCountAction,
  adjustStockAction,
  bulkStockCsvAction,
  uploadStockExcelAction,
  undoStockUploadBatchAction,
  downloadCurrentStockExcelAction,
} from "./actions";

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
  userRole?: string;
  recentBatches?: RecentBatchItem[];
}

export function UpdateStockClient({
  locations,
  products,
  userRole = "SUPER_ADMIN",
  recentBatches = [],
}: UpdateStockClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "opening" | "count" | "adjust" | "csv"
  >("opening");

  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  // Common selections
  const [locationId, setLocationId] = useState<string>(locations[0]?.id || "");
  const [productId, setProductId] = useState<string>(products[0]?.id || "");
  const [inputMode, setInputMode] = useState<"pieces" | "carton_loose">("carton_loose");

  // Quantities
  const [piecesInput, setPiecesInput] = useState<number>(0);
  const [cartonsInput, setCartonsInput] = useState<number>(0);
  const [looseInput, setLooseInput] = useState<number>(0);
  const [adjustDirection, setAdjustDirection] = useState<"add" | "subtract">("add");
  const [reason, setReason] = useState<string>("Initial physical opening stock entry");

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

  const handleTabSwitch = (tab: "opening" | "count" | "adjust" | "csv") => {
    setActiveTab(tab);
    setMessage(null);
    if (tab === "opening") setReason("Initial physical opening stock entry");
    if (tab === "count") setReason("Physical stock count reconciliation");
    if (tab === "adjust") setReason("Stock count / manual adjustment");
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
            onClick={() => handleTabSwitch("csv")}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === "csv"
                ? "bg-[#FC830D] text-white shadow-xs"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            4. Instant Excel / CSV Stock Upload
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

      {activeTab !== "csv" ? (
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
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium"
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      [{prod.shortCode}] {prod.name} (1 Carton = {prod.packSize} pcs)
                    </option>
                  ))}
                </select>
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
