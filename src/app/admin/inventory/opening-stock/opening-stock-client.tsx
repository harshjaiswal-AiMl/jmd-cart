"use client";

import React, { useState, useMemo, useTransition } from "react";
import {
  PackageCheck,
  Search,
  Filter,
  Boxes,
  Store,
  Warehouse,
  IndianRupee,
  Pencil,
  Plus,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { OpeningStockItemDto, OpeningStockSummary } from "@/modules/stock/opening-stock.service";
import { updateOpeningStockAction } from "./actions";

interface Props {
  initialItems: OpeningStockItemDto[];
  initialSummary: OpeningStockSummary;
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  allProductsList: Array<{ id: string; name: string; shortCode: string; packSize: number; packLabel: string; mrpPaise: number | null }>;
}

export function OpeningStockClient({
  initialItems,
  initialSummary,
  companies,
  categories,
  allProductsList,
}: Props) {
  const [items, setItems] = useState<OpeningStockItemDto[]>(initialItems);
  const [summary, setSummary] = useState<OpeningStockSummary>(initialSummary);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [onlyWithStock, setOnlyWithStock] = useState(false);

  // Modals
  const [editingItem, setEditingItem] = useState<OpeningStockItemDto | null>(null);
  const [editGodownCartons, setEditGodownCartons] = useState<number>(0);
  const [editGodownLoose, setEditGodownLoose] = useState<number>(0);
  const [editShopPieces, setEditShopPieces] = useState<number>(0);
  const [editReason, setEditReason] = useState<string>("Opening Stock as of 18-10-2026");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAddProductId, setSelectedAddProductId] = useState("");
  const [addSearch, setAddSearch] = useState("");
  const [addGodownCartons, setAddGodownCartons] = useState<number>(0);
  const [addGodownLoose, setAddGodownLoose] = useState<number>(0);
  const [addShopPieces, setAddShopPieces] = useState<number>(0);

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (search) {
        const q = search.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesCode = item.shortCode.toLowerCase().includes(q);
        const matchesCompany = item.companyName?.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesCompany) return false;
      }
      if (selectedCompanyId) {
        const comp = companies.find((c) => c.id === selectedCompanyId);
        if (comp && item.companyName !== comp.name) return false;
      }
      if (selectedCategoryId) {
        const cat = categories.find((c) => c.id === selectedCategoryId);
        if (cat && item.categoryName !== cat.name) return false;
      }
      if (onlyWithStock && item.openingStockQty <= 0) {
        return false;
      }
      return true;
    });
  }, [items, search, selectedCompanyId, selectedCategoryId, onlyWithStock, companies, categories]);

  // Open Edit Modal
  const handleOpenEdit = (item: OpeningStockItemDto) => {
    setEditingItem(item);
    setEditGodownCartons(item.godownCartons);
    setEditGodownLoose(item.godownLoose);
    setEditShopPieces(item.openingStockShopQty);
    setEditReason("Opening Stock as of 18-10-2026");
    setStatusMessage(null);
  };

  // Submit Edit
  const handleSaveEdit = () => {
    if (!editingItem) return;
    startTransition(async () => {
      const res = await updateOpeningStockAction({
        productId: editingItem.id,
        godownCartons: Number(editGodownCartons) || 0,
        godownLoose: Number(editGodownLoose) || 0,
        shopPieces: Number(editShopPieces) || 0,
        reason: editReason,
      });

      if (res.success && res.data) {
        const packSize = Math.max(1, editingItem.packSize);
        const newGodownQty = res.data.godownTotalPieces;
        const newShopQty = res.data.shopPieces;
        const newTotalQty = res.data.totalOpeningQty;
        const newCtn = Math.floor(newGodownQty / packSize);
        const newLoose = newGodownQty % packSize;
        const newVal = newTotalQty * (editingItem.mrpPaise || 0);

        setItems((prev) =>
          prev.map((it) =>
            it.id === editingItem.id
              ? {
                  ...it,
                  openingStockGodownQty: newGodownQty,
                  openingStockShopQty: newShopQty,
                  openingStockQty: newTotalQty,
                  godownCartons: newCtn,
                  godownLoose: newLoose,
                  openingValuePaise: newVal,
                  liveGodownQty: newGodownQty,
                  liveShopQty: newShopQty,
                }
              : it
          )
        );

        setStatusMessage({
          type: "success",
          text: `Updated opening stock for ${editingItem.name}: Godown ${newGodownQty} pcs, Shop ${newShopQty} pcs (Total: ${newTotalQty} pcs).`,
        });
        setEditingItem(null);
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to update opening stock",
        });
      }
    });
  };

  // Submit Add
  const handleSaveAdd = () => {
    if (!selectedAddProductId) {
      setStatusMessage({ type: "error", text: "Please select a product first" });
      return;
    }

    const prod = allProductsList.find((p) => p.id === selectedAddProductId);
    if (!prod) return;

    startTransition(async () => {
      const res = await updateOpeningStockAction({
        productId: selectedAddProductId,
        godownCartons: Number(addGodownCartons) || 0,
        godownLoose: Number(addGodownLoose) || 0,
        shopPieces: Number(addShopPieces) || 0,
        reason: "Opening Stock added as of 18-10-2026",
      });

      if (res.success && res.data) {
        const packSize = Math.max(1, prod.packSize);
        const newGodownQty = res.data.godownTotalPieces;
        const newShopQty = res.data.shopPieces;
        const newTotalQty = res.data.totalOpeningQty;
        const newCtn = Math.floor(newGodownQty / packSize);
        const newLoose = newGodownQty % packSize;
        const newVal = newTotalQty * (prod.mrpPaise || 0);

        setItems((prev) => {
          const exists = prev.some((it) => it.id === prod.id);
          if (exists) {
            return prev.map((it) =>
              it.id === prod.id
                ? {
                    ...it,
                    openingStockGodownQty: newGodownQty,
                    openingStockShopQty: newShopQty,
                    openingStockQty: newTotalQty,
                    godownCartons: newCtn,
                    godownLoose: newLoose,
                    openingValuePaise: newVal,
                  }
                : it
            );
          } else {
            return [
              ...prev,
              {
                id: prod.id,
                name: prod.name,
                shortCode: prod.shortCode,
                weight: null,
                packSize,
                packLabel: prod.packLabel,
                mrpPaise: prod.mrpPaise,
                companyName: null,
                categoryName: null,
                openingStockGodownQty: newGodownQty,
                openingStockShopQty: newShopQty,
                openingStockQty: newTotalQty,
                openingStockDate: "18-10-2026",
                godownCartons: newCtn,
                godownLoose: newLoose,
                openingValuePaise: newVal,
                liveGodownQty: newGodownQty,
                liveShopQty: newShopQty,
              },
            ];
          }
        });

        setStatusMessage({
          type: "success",
          text: `Added opening stock for ${prod.name}: ${newTotalQty} pcs (Godown: ${newGodownQty}, Shop: ${newShopQty}).`,
        });
        setIsAddModalOpen(false);
        setSelectedAddProductId("");
      } else {
        setStatusMessage({
          type: "error",
          text: res.error || "Failed to add opening stock",
        });
      }
    });
  };

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Product Name",
      "Short Code",
      "Brand",
      "Category",
      "Pack Size",
      "Godown Cartons",
      "Godown Loose Pcs",
      "Godown Total Pcs",
      "Shop Pcs",
      "Total Opening Pcs",
      "MRP (Rupees)",
      "Total Opening Value (Rupees)",
      "Opening Date",
    ];

    const rows = filteredItems.map((it) => [
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.shortCode}"`,
      `"${it.companyName || ""}"`,
      `"${it.categoryName || ""}"`,
      it.packSize,
      it.godownCartons,
      it.godownLoose,
      it.openingStockGodownQty,
      it.openingStockShopQty,
      it.openingStockQty,
      ((it.mrpPaise || 0) / 100).toFixed(2),
      (it.openingValuePaise / 100).toFixed(2),
      it.openingStockDate,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Opening_Stock_18_10_2026_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl">
              <PackageCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Opening Stock Management
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                  <Calendar className="w-3 h-3 text-amber-700" />
                  Baseline: 18-10-2026 (Fixed)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Fixed baseline inventory as of 18 October 2026. Editable & locked for all stock statements, day-ends, and financial audits.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddModalOpen(true);
              setStatusMessage(null);
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Opening Stock
          </button>
        </div>
      </div>

      {/* Status Message Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border shadow-xs ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-rose-50 border-rose-300 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-black text-slate-400 hover:text-slate-600 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <Boxes className="w-3.5 h-3.5 text-blue-600" />
            Total Products
          </p>
          <p className="text-xl font-black text-slate-900 mt-1">
            {summary.totalItems}{" "}
            <span className="text-xs font-medium text-slate-500">
              ({summary.itemsWithStock} in stock)
            </span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <PackageCheck className="w-3.5 h-3.5 text-amber-600" />
            Total Opening Pcs
          </p>
          <p className="text-xl font-black text-amber-950 mt-1">
            {summary.totalOpeningPcs.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-medium text-amber-700">pcs</span>
          </p>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
            ≈ {summary.totalOpeningCartons} cartons
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <Warehouse className="w-3.5 h-3.5 text-purple-600" />
            Godown Opening
          </p>
          <p className="text-xl font-black text-purple-950 mt-1">
            {summary.godownOpeningPcs.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-medium text-purple-700">pcs</span>
          </p>
          <p className="text-[10px] text-purple-700 font-semibold mt-0.5">
            Main Godown Bulk
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            Shop Opening
          </p>
          <p className="text-xl font-black text-emerald-950 mt-1">
            {summary.shopOpeningPcs.toLocaleString("en-IN")}{" "}
            <span className="text-xs font-medium text-emerald-700">pcs</span>
          </p>
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            Retail Counter Shelf
          </p>
        </div>

        <div className="col-span-2 md:col-span-1 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
            Opening Valuation
          </p>
          <p className="text-xl font-black text-slate-900 mt-1">
            ₹{(summary.totalOpeningValuePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
            at Retail MRP
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 w-full md:w-auto relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by product name, code, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-700"
          >
            <option value="">All Brands ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-700"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyWithStock}
              onChange={(e) => setOnlyWithStock(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>In-Stock Only</span>
          </label>
        </div>
      </div>

      {/* Main Opening Stock Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10.5px] border-b border-slate-200">
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Product Name & Code</th>
                <th className="p-3">Brand / Category</th>
                <th className="p-3 text-right">Pack Size</th>
                <th className="p-3 text-right">MRP</th>
                <th className="p-3 text-right bg-purple-50/50">Godown Opening</th>
                <th className="p-3 text-right bg-emerald-50/50">Shop Opening</th>
                <th className="p-3 text-right font-black bg-amber-50/50">Total Opening Qty</th>
                <th className="p-3 text-right">Opening Value (₹)</th>
                <th className="p-3 text-center">As of Date</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400 font-medium italic">
                    No products matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                    <td className="p-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{item.shortCode}</span>
                        {item.weight && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1 rounded">
                            {item.weight}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{item.companyName || "—"}</div>
                      <div className="text-[11px] text-slate-500">{item.categoryName || "—"}</div>
                    </td>
                    <td className="p-3 text-right font-semibold text-slate-700">
                      1 {item.packLabel} = {item.packSize} pcs
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900">
                      {item.mrpPaise ? `₹${(item.mrpPaise / 100).toFixed(2)}` : "—"}
                    </td>

                    {/* Godown Opening */}
                    <td className="p-3 text-right bg-purple-50/30">
                      <span className="font-bold text-purple-900 font-mono text-xs">
                        {item.openingStockGodownQty.toLocaleString("en-IN")} pcs
                      </span>
                      {item.packSize > 1 && (
                        <div className="text-[10px] text-purple-700 font-semibold">
                          {item.godownCartons} ctn {item.godownLoose > 0 && `+ ${item.godownLoose} pcs`}
                        </div>
                      )}
                    </td>

                    {/* Shop Opening */}
                    <td className="p-3 text-right bg-emerald-50/30 font-bold text-emerald-900 font-mono text-xs">
                      {item.openingStockShopQty.toLocaleString("en-IN")} pcs
                    </td>

                    {/* Total Opening Qty */}
                    <td className="p-3 text-right bg-amber-50/30 font-mono">
                      <span className="font-black text-amber-950 text-xs">
                        {item.openingStockQty.toLocaleString("en-IN")} pcs
                      </span>
                      {item.packSize > 1 && (
                        <div className="text-[10px] text-amber-800 font-semibold">
                          ≈ {Math.floor(item.openingStockQty / item.packSize)} ctn
                        </div>
                      )}
                    </td>

                    {/* Total Value */}
                    <td className="p-3 text-right font-mono font-semibold text-slate-900">
                      ₹{(item.openingValuePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Date */}
                    <td className="p-3 text-center">
                      <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {item.openingStockDate}
                      </span>
                    </td>

                    {/* Edit Action */}
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit Opening Stock"
                        className="px-2.5 py-1 bg-amber-50 text-amber-800 hover:bg-amber-600 hover:text-white rounded-lg font-bold text-xs inline-flex items-center gap-1 border border-amber-300 transition shadow-2xs"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Opening Stock Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Edit Opening Stock</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {editingItem.shortCode} • 1 {editingItem.packLabel} = {editingItem.packSize} pcs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="font-extrabold text-slate-900 text-sm">{editingItem.name}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                Brand: <strong className="text-slate-800">{editingItem.companyName || "—"}</strong> | MRP:{" "}
                <strong className="text-slate-800">₹{((editingItem.mrpPaise || 0) / 100).toFixed(2)}</strong>
              </div>
            </div>

            <div className="space-y-3">
              {/* Godown Opening Stock */}
              <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-2">
                <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <Warehouse className="w-3.5 h-3.5 text-purple-700" />
                  Godown Opening Stock
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-purple-900">Cartons</label>
                    <input
                      type="number"
                      min="0"
                      value={editGodownCartons}
                      onChange={(e) => setEditGodownCartons(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10.5px] font-bold text-purple-900">Loose Pieces</label>
                    <input
                      type="number"
                      min="0"
                      value={editGodownLoose}
                      onChange={(e) => setEditGodownLoose(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-mono font-bold text-purple-950 focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-[10.5px] font-semibold text-purple-800 text-right">
                  Total Godown: <strong>{editGodownCartons * editingItem.packSize + editGodownLoose} pcs</strong>
                </p>
              </div>

              {/* Shop Opening Stock */}
              <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-1.5">
                <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-700" />
                  Shop Retail Shelf Pieces
                </label>
                <input
                  type="number"
                  min="0"
                  value={editShopPieces}
                  onChange={(e) => setEditShopPieces(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-mono font-bold text-emerald-950 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Combined Total */}
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-300 flex items-center justify-between text-xs">
                <span className="font-bold text-amber-900">Combined Opening Total:</span>
                <span className="font-black text-amber-950 font-mono text-sm">
                  {editGodownCartons * editingItem.packSize + editGodownLoose + editShopPieces} pcs
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">Audit Reason / Note</label>
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Opening Stock verification as of 18-10-2026"
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isPending}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Opening Stock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Opening Stock for New Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">Add Opening Stock for Item</h3>
                  <p className="text-[11px] text-slate-500">Pick any active catalog product to establish its baseline.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Product Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800">Select Product</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter products list below..."
                  value={addSearch}
                  onChange={(e) => setAddSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg mb-1.5"
                />
              </div>
              <select
                value={selectedAddProductId}
                onChange={(e) => setSelectedAddProductId(e.target.value)}
                className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Choose a Product --</option>
                {allProductsList
                  .filter((p) => {
                    if (!addSearch) return true;
                    const q = addSearch.toLowerCase();
                    return p.name.toLowerCase().includes(q) || p.shortCode.toLowerCase().includes(q);
                  })
                  .slice(0, 100)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.shortCode}) — 1 {p.packLabel} = {p.packSize} pcs
                    </option>
                  ))}
              </select>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-purple-900">Godown Ctn</label>
                <input
                  type="number"
                  min="0"
                  value={addGodownCartons}
                  onChange={(e) => setAddGodownCartons(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-purple-900">Godown Loose</label>
                <input
                  type="number"
                  min="0"
                  value={addGodownLoose}
                  onChange={(e) => setAddGodownLoose(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-purple-300 rounded-lg font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-emerald-900">Shop Pcs</label>
                <input
                  type="number"
                  min="0"
                  value={addShopPieces}
                  onChange={(e) => setAddShopPieces(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg font-mono font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAdd}
                disabled={isPending || !selectedAddProductId}
                className="px-4 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition disabled:opacity-50"
              >
                {isPending ? "Adding..." : "Add Opening Stock"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
