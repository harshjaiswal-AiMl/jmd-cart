"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReturnReason } from "@/modules/returns/returns.types";
import { createDebitNoteAction } from "../actions";
import {
  ArrowLeft,
  Plus,
  Trash2,
  FileCheck,
  AlertTriangle,
  Building2,
  Package,
} from "lucide-react";
import { SearchableSelect } from "@/components/common/SearchableSelect";

interface SupplierItem {
  id: string;
  name: string;
  type: string;
  gstin: string | null;
  phone: string | null;
}

interface LocationItem {
  id: string;
  name: string;
  type: string;
}

interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  mrpPaise: number;
  packSize: number;
  hsn: string;
  gstRateBp: number;
  company?: { name: string } | null;
  stockBalances: { locationId: string; qty: number }[];
}

interface Props {
  suppliers: SupplierItem[];
  locations: LocationItem[];
  products: ProductItem[];
}

interface FormLine {
  productId: string;
  cartons: number;
  pieces: number;
  rateRupees: number;
  gstRateBp: number;
  batchNo: string;
  reason: string;
}

export function ReturnForm({ suppliers, locations, products }: Props) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || "");
  const [locationId, setLocationId] = useState(locations[0]?.id || "");
  const [reason, setReason] = useState<ReturnReason>("DAMAGE");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierOptions = useMemo(
    () =>
      suppliers.map((s) => ({
        value: s.id,
        label: s.name,
        subLabel: `${s.phone ? `Ph: ${s.phone} · ` : ""}${s.gstin ? `GSTIN: ${s.gstin}` : `[${s.type}]`}`,
        badge: s.type,
      })),
    [suppliers]
  );

  const productOptions = useMemo(() => {
    return products.map((p) => {
      const bal = p.stockBalances.find((b) => b.locationId === locationId)?.qty ?? 0;
      return {
        value: p.id,
        label: `${p.shortCode} - ${p.name}`,
        subLabel: `${p.company?.name ? `${p.company.name} · ` : ""}Pack: ${p.packSize} pcs · MRP ₹${((p.mrpPaise || 0) / 100).toFixed(0)}`,
        badge: bal > 0 ? `In Stock (${bal} pcs)` : "Out of stock",
        badgeColor: bal > 0 ? ("green" as const) : ("red" as const),
        inStock: bal > 0,
      };
    });
  }, [products, locationId]);

  // Line items state
  const [lines, setLines] = useState<FormLine[]>([
    {
      productId: products[0]?.id || "",
      cartons: 1,
      pieces: 0,
      rateRupees: products[0] ? Math.round(products[0].mrpPaise * 0.8) / 100 : 0,
      gstRateBp: products[0]?.gstRateBp || 0,
      batchNo: "",
      reason: "",
    },
  ]);

  const handleAddLine = () => {
    const defaultProduct = products[0];
    if (!defaultProduct) return;
    setLines((prev) => [
      ...prev,
      {
        productId: defaultProduct.id,
        cartons: 1,
        pieces: 0,
        rateRupees: Math.round(defaultProduct.mrpPaise * 0.8) / 100,
        gstRateBp: defaultProduct.gstRateBp,
        batchNo: "",
        reason: "",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductChange = (index: number, newProductId: string) => {
    const prod = products.find((p) => p.id === newProductId);
    if (!prod) return;

    setLines((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: newProductId,
        rateRupees: Math.round(prod.mrpPaise * 0.8) / 100,
        gstRateBp: prod.gstRateBp,
      };
      return copy;
    });
  };

  const handleLineChange = <K extends keyof FormLine>(
    index: number,
    field: K,
    val: FormLine[K]
  ) => {
    setLines((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Helper to get stock balance at selected location
  const getProductStock = (productId: string) => {
    const p = products.find((prod) => prod.id === productId);
    if (!p) return 0;
    const bal = p.stockBalances.find((b) => b.locationId === locationId);
    return bal?.qty ?? 0;
  };

  // Live calculation of financial totals
  const totals = React.useMemo(() => {
    let subtotalPaise = 0;
    let taxPaise = 0;
    let totalPieces = 0;

    for (const l of lines) {
      const prod = products.find((p) => p.id === l.productId);
      const packSize = prod?.packSize || 1;
      const qty = Math.max(0, l.cartons * packSize + l.pieces);
      totalPieces += qty;

      const ratePaise = Math.round(l.rateRupees * 100);
      const lineTaxablePaise = qty * ratePaise;
      const lineTaxPaise = Math.round((lineTaxablePaise * l.gstRateBp) / 10000);

      subtotalPaise += lineTaxablePaise;
      taxPaise += lineTaxPaise;
    }

    const grandUnrounded = subtotalPaise + taxPaise;
    const rounded = Math.round(grandUnrounded / 100) * 100;
    const roundOffPaise = rounded - grandUnrounded;
    const totalPaise = rounded;

    return {
      subtotalPaise,
      taxPaise,
      roundOffPaise,
      totalPaise,
      totalPieces,
    };
  }, [lines, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!supplierId) {
      setError("Please select a supplier");
      return;
    }

    // Validate quantities against stock
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const prod = products.find((p) => p.id === l.productId);
      const packSize = prod?.packSize || 1;
      const qty = l.cartons * packSize + l.pieces;

      if (qty <= 0) {
        setError(`Line #${i + 1}: Returned quantity must be greater than 0`);
        return;
      }

      const available = getProductStock(l.productId);
      if (qty > available) {
        setError(
          `Line #${i + 1} (${prod?.name}): Requested return (${qty} pcs) exceeds available stock (${available} pcs)`
        );
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    const itemsPayload = lines.map((l) => {
      const prod = products.find((p) => p.id === l.productId);
      const packSize = prod?.packSize || 1;
      const qty = l.cartons * packSize + l.pieces;
      return {
        productId: l.productId,
        qty,
        unitPricePaise: Math.round(l.rateRupees * 100),
        gstRateBp: l.gstRateBp,
        batchNo: l.batchNo.trim() || undefined,
        reason: l.reason.trim() || undefined,
      };
    });

    const res = await createDebitNoteAction({
      supplierId,
      locationId: locationId || undefined,
      reason,
      notes: notes.trim() || undefined,
      items: itemsPayload,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      router.push(`/godown/returns/${res.data.id}`);
    } else {
      setError(res.error || "Failed to create debit note");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/godown/returns"
            className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Create Return to Company (Debit Note)
            </h1>
            <p className="text-xs text-slate-500">
              Deduct defective/expired stock from Godown and issue an official GST Debit Note to vendor.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
        >
          <FileCheck className="w-4 h-4" />
          {isSubmitting ? "Finalizing Debit Note..." : "Finalize & Issue Debit Note"}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Details Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          Vendor & Dispatch Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier (Manufacturer / Vendor) *
            </label>
            <SearchableSelect
              options={supplierOptions}
              value={supplierId}
              onChange={(val) => setSupplierId(val)}
              placeholder="Select supplier..."
              searchPlaceholder="Search supplier by name, GSTIN..."
              autoSortInStock={false}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dispatch Location (Stock Source) *
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Primary Return Reason *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
            >
              <option value="DAMAGE">Damaged in Transit / Warehouse</option>
              <option value="EXPIRY">Expired / Near Expiry</option>
              <option value="SLOW_MOVING">Slow Moving Stock</option>
              <option value="RATE_DIFFERENCE">Rate Discrepancy / Overbilling</option>
              <option value="RECALL">Manufacturer Batch Recall</option>
              <option value="QUALITY_REJECTION">Quality Rejection</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-500" />
            Products Returned to Company
          </h2>

          <button
            type="button"
            onClick={handleAddLine}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Another Product
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-2.5 w-60">Product</th>
                <th className="p-2.5 text-center w-24">Godown Stock</th>
                <th className="p-2.5 text-right w-24">Cartons</th>
                <th className="p-2.5 text-right w-24">Loose Pcs</th>
                <th className="p-2.5 text-right w-28">Rate (₹)</th>
                <th className="p-2.5 text-center w-20">GST %</th>
                <th className="p-2.5 w-28">Batch #</th>
                <th className="p-2.5 text-right w-28">Line Total</th>
                <th className="p-2.5 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line, idx) => {
                const prod = products.find((p) => p.id === line.productId);
                const packSize = prod?.packSize || 1;
                const available = getProductStock(line.productId);
                const totalPieces = line.cartons * packSize + line.pieces;
                const isOverStock = totalPieces > available;

                const lineTaxable = totalPieces * line.rateRupees;
                const lineTax = (lineTaxable * line.gstRateBp) / 10000;
                const lineTotal = lineTaxable + lineTax;

                return (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="p-2.5">
                      <SearchableSelect
                        options={productOptions}
                        value={line.productId}
                        onChange={(val) => handleProductChange(idx, val)}
                        placeholder="Select product..."
                        searchPlaceholder="Search product by code, name..."
                        popoverWidthClass="w-full min-w-[360px]"
                      />
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Pack: {packSize} pcs | MRP: ₹{((prod?.mrpPaise || 0) / 100).toFixed(2)}
                      </div>
                    </td>

                    <td className="p-2.5 text-center">
                      <span
                        className={`font-mono font-bold text-xs ${
                          available > 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {available} pcs
                      </span>
                    </td>

                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={line.cartons}
                        onChange={(e) =>
                          handleLineChange(idx, "cartons", parseInt(e.target.value) || 0)
                        }
                        className="w-20 text-xs border border-slate-300 rounded-lg p-1.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        value={line.pieces}
                        onChange={(e) =>
                          handleLineChange(idx, "pieces", parseInt(e.target.value) || 0)
                        }
                        className="w-20 text-xs border border-slate-300 rounded-lg p-1.5 text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {isOverStock && (
                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                          Exceeds stock!
                        </div>
                      )}
                    </td>

                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.rateRupees}
                        onChange={(e) =>
                          handleLineChange(idx, "rateRupees", parseFloat(e.target.value) || 0)
                        }
                        className="w-24 text-xs border border-slate-300 rounded-lg p-1.5 text-right font-mono font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="p-2.5 text-center font-mono text-xs">
                      {(line.gstRateBp / 100).toFixed(0)}%
                    </td>

                    <td className="p-2.5">
                      <input
                        type="text"
                        placeholder="e.g. B-1092"
                        value={line.batchNo}
                        onChange={(e) =>
                          handleLineChange(idx, "batchNo", e.target.value)
                        }
                        className="w-24 text-xs border border-slate-300 rounded-lg p-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                      ₹{lineTotal.toFixed(2)}
                    </td>

                    <td className="p-2.5 text-center">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Remove Line"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary & Remarks Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Debit Note Remarks / Claim Details
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Sealed cartons damaged during heavy rain delivery. Claim agreed by supplier area manager."
            rows={3}
            className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between text-slate-600">
            <span>Total Returned Quantity:</span>
            <span className="font-mono font-bold text-slate-900">
              {totals.totalPieces} pcs
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Taxable):</span>
            <span className="font-mono">
              ₹{(totals.subtotalPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>GST Tax Amount:</span>
            <span className="font-mono">
              ₹{(totals.taxPaise / 100).toFixed(2)}
            </span>
          </div>

          {totals.roundOffPaise !== 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Round Off:</span>
              <span className="font-mono">
                {totals.roundOffPaise > 0 ? "+" : ""}
                {(totals.roundOffPaise / 100).toFixed(2)}
              </span>
            </div>
          )}

          <div className="border-t border-slate-300 pt-2 flex justify-between font-bold text-sm text-slate-900">
            <span>Total Debit Amount:</span>
            <span className="font-mono text-emerald-700 text-base">
              ₹{(totals.totalPaise / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}
