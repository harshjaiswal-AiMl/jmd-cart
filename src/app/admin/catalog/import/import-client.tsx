"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  previewBrandWorkbookAction,
  commitBrandWorkbookAction,
  downloadBlankCatalogTemplateAction,
  downloadReviewReportAction,
} from "./actions";
import type {
  BrandWorkbookPreview,
  CommitBrandImportResult,
  ImportRowStatus,
  ParsedBrandSheetRow,
  SheetPricingMode,
  DuplicateResolutionAction,
} from "@/modules/catalog/import/brand-sheet-import.service";

function triggerBase64Download(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CatalogImportClient() {
  const [fileBase64, setFileBase64] = useState<string>("");
  const [filename, setFilename] = useState<string>("");
  const [preview, setPreview] = useState<BrandWorkbookPreview | null>(null);
  const [rows, setRows] = useState<ParsedBrandSheetRow[]>([]);
  const [sheetOverrides, setSheetOverrides] = useState<Record<string, SheetPricingMode>>({});
  const [statusFilter, setStatusFilter] = useState<"ALL" | ImportRowStatus>("ALL");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<CommitBrandImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setCommitResult(null);

    const arrayBuf = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    setFileBase64(base64Data);
    setFilename(file.name);

    startTransition(async () => {
      const res = await previewBrandWorkbookAction({
        base64Data,
        filename: file.name,
      });
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.preview) {
        setPreview(res.preview);
        setRows(res.preview.rows);
        const initOverrides: Record<string, SheetPricingMode> = {};
        for (const s of res.preview.sheets) {
          initOverrides[s.sheetName] = s.detectedMode;
        }
        setSheetOverrides(initOverrides);
      }
    });
  };

  const handleSheetModeOverride = (sheetName: string, mode: SheetPricingMode) => {
    const nextOverrides = { ...sheetOverrides, [sheetName]: mode };
    setSheetOverrides(nextOverrides);

    if (!fileBase64) return;
    startTransition(async () => {
      const res = await previewBrandWorkbookAction({
        base64Data: fileBase64,
        filename,
        sheetModeOverrides: nextOverrides,
      });
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.preview) {
        setPreview(res.preview);
        setRows(res.preview.rows);
      }
    });
  };

  const handleDownloadBlankTemplate = () => {
    startTransition(async () => {
      const res = await downloadBlankCatalogTemplateAction();
      if (res.base64 && res.filename) {
        triggerBase64Download(res.base64, res.filename);
      }
    });
  };

  const handleDownloadReviewReport = () => {
    if (rows.length === 0) return;
    startTransition(async () => {
      const res = await downloadReviewReportAction(rows);
      if (res.base64 && res.filename) {
        triggerBase64Download(res.base64, res.filename);
      }
    });
  };

  const updateRowField = (rowId: string, updater: (r: ParsedBrandSheetRow) => ParsedBrandSheetRow) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? updater(r) : r)));
  };

  const handleDuplicateGroupResolution = (
    groupKey: string,
    selectedRowId: string,
    action: DuplicateResolutionAction
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.duplicateGroupKey !== groupKey) return r;
        if (action === "KEEP_THIS") {
          const isChosen = r.rowId === selectedRowId;
          return {
            ...r,
            duplicateResolution: isChosen ? "KEEP_THIS" : "SKIP",
            status: isChosen ? "OK" : r.status,
          };
        }
        if (r.rowId === selectedRowId) {
          return {
            ...r,
            duplicateResolution: action,
            status: action === "KEEP_SEPARATE" ? "OK" : r.status,
          };
        }
        return r;
      })
    );
  };

  const handleCommit = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await commitBrandWorkbookAction({
        filename,
        rows,
      });
      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.result) {
        setCommitResult(res.result);
      }
    });
  };

  const filteredRows = rows.filter((r) =>
    statusFilter === "ALL" ? true : r.status === statusFilter
  );

  const counts = {
    total: rows.length,
    ok: rows.filter((r) => r.status === "OK").length,
    warning: rows.filter((r) => r.status === "WARNING").length,
    needsReview: rows.filter((r) => r.status === "NEEDS_REVIEW").length,
    suspicious: rows.filter(
      (r) => r.status === "SUSPICIOUS" && !r.suspiciousConfirmed
    ).length,
    error: rows.filter(
      (r) =>
        r.status === "ERROR" &&
        !r.importInactiveWithoutPrices &&
        r.duplicateResolution !== "SKIP"
    ).length,
  };

  const canCommit = rows.length > 0 && counts.error === 0 && counts.suspicious === 0;

  return (
    <div className="space-y-6">
      {/* Top Upload & Template Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              1. Upload Brand Excel Workbook (<code>.xlsx</code> / <code>.csv</code>)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Supports multi-tab workbooks (each tab = brand = company) and title headers like{" "}
              <code>JAI MATA DI</code>, <code>SAHARSA</code>, <code>SALONI</code>, <code>MDH</code>,{" "}
              <code>DAWAT</code>. Columns: <code>SL NO</code>, <code>ITEMS</code>,{" "}
              <code>WEIGHT</code> (optional), <code>QTY IN CASE</code> / <code>PCS</code> (1 carton
              = N pcs), <code>MRP</code>, <code>A</code>, <code>B</code>, <code>C</code>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadBlankTemplate}
              disabled={isPending}
              className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              📄 Download Blank Template (.xlsx)
            </button>
            <Link
              href="/admin/catalog/price-lists"
              className="px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              View Price Lists →
            </Link>
          </div>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#790E11] transition-colors bg-gray-50/50">
          <input
            type="file"
            id="brand-sheet-upload"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#790E11] file:text-white hover:file:bg-[#5E0A0D] cursor-pointer"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {commitResult && (
        <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-emerald-900">
              ✅ Catalog &amp; A/B/C Price Import Committed!
            </h3>
            <span className="text-xs font-mono text-emerald-700">
              Batch ID: {commitResult.batchId}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <div className="text-xs text-gray-500">Brands Created</div>
              <div className="text-lg font-bold text-gray-900">
                {commitResult.companiesCreated}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <div className="text-xs text-gray-500">Products Created</div>
              <div className="text-lg font-bold text-emerald-700">
                {commitResult.productsCreated}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <div className="text-xs text-gray-500">Products Updated</div>
              <div className="text-lg font-bold text-blue-700">
                {commitResult.productsUpdated}
              </div>
            </div>
            <div className="bg-white p-3 rounded-lg border border-emerald-100">
              <div className="text-xs text-gray-500">Rows Skipped</div>
              <div className="text-lg font-bold text-gray-600">
                {commitResult.rowsSkipped}
              </div>
            </div>
          </div>
          <div className="pt-2">
            <Link
              href="/admin/catalog/price-lists"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-[#075828] text-white text-xs font-bold hover:bg-emerald-800"
            >
              Go to A/B/C Price Lists →
            </Link>
          </div>
        </div>
      )}

      {/* Sheet Mode Detection & Override */}
      {preview && preview.sheets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                2. Detected Sheets &amp; Pricing Mode Override ({preview.filename})
              </h3>
              <p className="text-xs text-gray-500">
                Auto-detected per tab. You can override between <strong>Absolute ₹</strong> and{" "}
                <strong>% off MRP</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadReviewReport}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100"
            >
              📥 Download Flagged / Review Rows (.xlsx)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {preview.sheets.map((s) => {
              const mode = sheetOverrides[s.sheetName] ?? s.detectedMode;
              return (
                <div
                  key={s.sheetName}
                  className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      Tab: {s.sheetName} →{" "}
                      <span className="text-[#790E11]">{s.detectedBrand}</span>
                    </div>
                    <div className="text-[11px] text-gray-500">{s.rowCount} rows</div>
                  </div>
                  <select
                    value={mode}
                    onChange={(e) =>
                      handleSheetModeOverride(
                        s.sheetName,
                        e.target.value as SheetPricingMode
                      )
                    }
                    className="px-2.5 py-1 text-xs font-semibold border border-gray-300 rounded bg-white"
                  >
                    <option value="ABSOLUTE">Absolute ₹</option>
                    <option value="PERCENT">% off MRP</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Preview Table & Filters */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gray-50">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "ALL"
                    ? "bg-gray-900 text-white"
                    : "bg-white border border-gray-300 text-gray-700"
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("OK")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "OK"
                    ? "bg-emerald-700 text-white"
                    : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                }`}
              >
                OK ({counts.ok})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("WARNING")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "WARNING"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 border border-amber-200 text-amber-800"
                }`}
              >
                Warning ({counts.warning})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("NEEDS_REVIEW")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "NEEDS_REVIEW"
                    ? "bg-blue-700 text-white"
                    : "bg-blue-50 border border-blue-200 text-blue-800"
                }`}
              >
                Needs Review ({counts.needsReview})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("SUSPICIOUS")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "SUSPICIOUS"
                    ? "bg-purple-700 text-white"
                    : "bg-purple-50 border border-purple-200 text-purple-800"
                }`}
              >
                Suspicious ({counts.suspicious})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("ERROR")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  statusFilter === "ERROR"
                    ? "bg-red-700 text-white"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                Error ({counts.error})
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!canCommit || isPending}
                onClick={handleCommit}
                className="px-5 py-2 rounded-lg bg-[#790E11] hover:bg-[#5E0A0D] text-white text-xs font-bold shadow-sm disabled:opacity-50"
              >
                {isPending
                  ? "Committing..."
                  : `Commit Import (${rows.filter((r) => r.duplicateResolution !== "SKIP").length} rows)`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-100 text-gray-700 font-bold uppercase sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left">Row</th>
                  <th className="px-3 py-2.5 text-left">Brand</th>
                  <th className="px-3 py-2.5 text-left">Item &amp; SKU</th>
                  <th className="px-3 py-2.5 text-left">Weight</th>
                  <th className="px-3 py-2.5 text-center">Qty in Case</th>
                  <th className="px-3 py-2.5 text-right">MRP (₹)</th>
                  <th className="px-3 py-2.5 text-right text-emerald-800">A (₹)</th>
                  <th className="px-3 py-2.5 text-right text-blue-800">B (₹)</th>
                  <th className="px-3 py-2.5 text-right text-amber-800">C (₹)</th>
                  <th className="px-3 py-2.5 text-left">Status &amp; Resolution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((r) => (
                  <tr
                    key={r.rowId}
                    className={
                      r.duplicateResolution === "SKIP"
                        ? "bg-gray-100 opacity-60"
                        : r.status === "ERROR"
                        ? "bg-red-50/40"
                        : r.status === "SUSPICIOUS"
                        ? "bg-purple-50/40"
                        : r.status === "NEEDS_REVIEW"
                        ? "bg-blue-50/30"
                        : "hover:bg-gray-50"
                    }
                  >
                    <td className="px-3 py-2 font-mono text-gray-500">
                      {r.sheetName} #{r.rowNumber}
                    </td>
                    <td className="px-3 py-2 font-semibold text-gray-800">
                      {r.brandName}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.rawItemName}
                        onChange={(e) =>
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            rawItemName: e.target.value,
                          }))
                        }
                        className="w-48 px-1.5 py-0.5 border border-gray-300 rounded text-xs font-medium"
                      />
                      <div className="text-[10px] font-mono text-gray-500 mt-0.5">
                        SKU: {r.shortCode}{" "}
                        {r.willUpdateExisting ? (
                          <span className="text-blue-600 font-bold">(Updates Existing)</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">(New)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.weight}
                        onChange={(e) =>
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            weight: e.target.value,
                          }))
                        }
                        className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        min={1}
                        value={r.packSize}
                        onChange={(e) =>
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            packSize: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-center font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.mrpPaise != null ? (r.mrpPaise / 100).toFixed(2) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const num = val ? Number(val) : null;
                          const mrpPaise =
                            num != null && Number.isFinite(num) && num > 0
                              ? Math.round(num * 100)
                              : null;
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            mrpRupees: num,
                            mrpPaise,
                            status:
                              cur.status === "ERROR" && mrpPaise != null
                                ? "OK"
                                : cur.status,
                          }));
                        }}
                        className="w-20 px-1.5 py-0.5 border border-gray-300 rounded text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceAPaise != null ? (r.priceAPaise / 100).toFixed(2) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const paise = val ? Math.round(Number(val) * 100) : null;
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            priceAPaise: paise,
                          }));
                        }}
                        className="w-20 px-1.5 py-0.5 border border-emerald-300 rounded text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceBPaise != null ? (r.priceBPaise / 100).toFixed(2) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const paise = val ? Math.round(Number(val) * 100) : null;
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            priceBPaise: paise,
                          }));
                        }}
                        className="w-20 px-1.5 py-0.5 border border-blue-300 rounded text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={r.priceCPaise != null ? (r.priceCPaise / 100).toFixed(2) : ""}
                        placeholder="—"
                        onChange={(e) => {
                          const val = e.target.value.trim();
                          const paise = val ? Math.round(Number(val) * 100) : null;
                          updateRowField(r.rowId, (cur) => ({
                            ...cur,
                            priceCPaise: paise,
                          }));
                        }}
                        className="w-20 px-1.5 py-0.5 border border-amber-300 rounded text-right font-mono text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            r.status === "OK"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "WARNING"
                              ? "bg-amber-100 text-amber-800"
                              : r.status === "NEEDS_REVIEW"
                              ? "bg-blue-100 text-blue-800"
                              : r.status === "SUSPICIOUS"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      {r.messages.map((m, idx) => (
                        <div key={idx} className="text-[11px] text-gray-600">
                          • {m}
                        </div>
                      ))}

                      {/* Duplicate Resolution Controls */}
                      {r.duplicateGroupKey && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleDuplicateGroupResolution(
                                r.duplicateGroupKey!,
                                r.rowId,
                                "KEEP_SEPARATE"
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              r.duplicateResolution === "KEEP_SEPARATE"
                                ? "bg-blue-700 text-white border-blue-700"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            Keep Separate Variant
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDuplicateGroupResolution(
                                r.duplicateGroupKey!,
                                r.rowId,
                                "KEEP_THIS"
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              r.duplicateResolution === "KEEP_THIS"
                                ? "bg-emerald-700 text-white border-emerald-700"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            Keep Only This
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDuplicateGroupResolution(
                                r.duplicateGroupKey!,
                                r.rowId,
                                "SKIP"
                              )
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              r.duplicateResolution === "SKIP"
                                ? "bg-gray-800 text-white border-gray-800"
                                : "bg-white text-gray-700 border-gray-300"
                            }`}
                          >
                            Skip
                          </button>
                        </div>
                      )}

                      {/* Suspicious Confirmation Checkbox */}
                      {r.status === "SUSPICIOUS" && (
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-purple-800 pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(r.suspiciousConfirmed)}
                            onChange={(e) =>
                              updateRowField(r.rowId, (cur) => ({
                                ...cur,
                                suspiciousConfirmed: e.target.checked,
                              }))
                            }
                            className="rounded border-purple-400"
                          />
                          Confirm suspicious values (or Skip)
                        </label>
                      )}

                      {/* Error Resolution: Import as inactive without prices or Skip */}
                      {r.status === "ERROR" && (
                        <div className="flex items-center gap-2 pt-1">
                          <label className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(r.importInactiveWithoutPrices)}
                              onChange={(e) =>
                                updateRowField(r.rowId, (cur) => ({
                                  ...cur,
                                  importInactiveWithoutPrices: e.target.checked,
                                }))
                              }
                              className="rounded border-red-400"
                            />
                            Import inactive without prices
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              updateRowField(r.rowId, (cur) => ({
                                ...cur,
                                duplicateResolution:
                                  cur.duplicateResolution === "SKIP" ? undefined : "SKIP",
                              }))
                            }
                            className="px-2 py-0.5 rounded border border-gray-300 bg-white text-[10px] font-bold"
                          >
                            {r.duplicateResolution === "SKIP" ? "Unskip" : "Skip Row"}
                          </button>
                        </div>
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
  );
}
