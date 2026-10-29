"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { VanDayWithDetails } from "@/modules/van/van.types";
import { updateVanIssueSheetAction } from "../../actions";

interface StockProduct {
  id: string;
  name: string;
  shortCode: string;
  packSize: number;
  packLabel: string;
  mrpPaise: number | null;
  godownQty: number;
  vanQty: number;
}

interface EditVanIssueClientProps {
  vanDay: VanDayWithDetails;
  products: StockProduct[];
}

interface EditableLine {
  productId: string;
  cartons: number;
  pieces: number;
  originalIssuedQty: number;
  soldQty: number;
}

export function EditVanIssueClient({ vanDay, products }: EditVanIssueClientProps) {
  const router = useRouter();

  // Map product id to StockProduct
  const productMap = useMemo(() => {
    const map = new Map<string, StockProduct>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  // Initial load lines
  const initialLines = useMemo(() => {
    const lines: Record<string, EditableLine> = {};
    vanDay.lines.forEach((l) => {
      const packSize = l.product.packSize > 0 ? l.product.packSize : 1;
      const cartons = Math.floor(l.issuedQty / packSize);
      const pieces = l.issuedQty % packSize;
      lines[l.productId] = {
        productId: l.productId,
        cartons,
        pieces,
        originalIssuedQty: l.issuedQty,
        soldQty: l.soldQty || 0,
      };
    });
    return lines;
  }, [vanDay]);

  const [loadLines, setLoadLines] = useState<Record<string, EditableLine>>(initialLines);
  const [notes, setNotes] = useState(vanDay.notes || "");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCartonChange = (productId: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setLoadLines((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      return {
        ...prev,
        [productId]: {
          ...existing,
          cartons: safeVal,
        },
      };
    });
  };

  const handlePieceChange = (productId: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setLoadLines((prev) => {
      const existing = prev[productId];
      if (!existing) return prev;
      return {
        ...prev,
        [productId]: {
          ...existing,
          pieces: safeVal,
        },
      };
    });
  };

  const handleRemoveProduct = (productId: string) => {
    const line = loadLines[productId];
    if (line && line.soldQty > 0) {
      setError(`Cannot remove this item because ${line.soldQty} pcs have already been sold from the van!`);
      return;
    }
    setLoadLines((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleAddProduct = (product: StockProduct) => {
    if (loadLines[product.id]) {
      // Focus or alert if already present
      return;
    }
    setLoadLines((prev) => ({
      ...prev,
      [product.id]: {
        productId: product.id,
        cartons: 1,
        pieces: 0,
        originalIssuedQty: 0,
        soldQty: 0,
      },
    }));
  };

  // List of active lines for rendering
  const activeLineList = useMemo(() => {
    return Object.values(loadLines).map((line) => {
      const product = productMap.get(line.productId);
      const packSize = product?.packSize || 1;
      const newTotalPieces = line.cartons * packSize + line.pieces;
      const deltaPieces = newTotalPieces - line.originalIssuedQty;
      return {
        ...line,
        product,
        newTotalPieces,
        deltaPieces,
      };
    });
  }, [loadLines, productMap]);

  // Calculate totals
  const totals = useMemo(() => {
    let originalPieces = 0;
    let newPieces = 0;
    let newCartons = 0;
    let totalValuationPaise = 0;

    activeLineList.forEach((line) => {
      originalPieces += line.originalIssuedQty;
      newPieces += line.newTotalPieces;
      newCartons += line.cartons;
      const mrp = line.product?.mrpPaise || 0;
      totalValuationPaise += line.newTotalPieces * mrp;
    });

    return {
      originalPieces,
      newPieces,
      newCartons,
      netDelta: newPieces - originalPieces,
      totalValuationPaise,
    };
  }, [activeLineList]);

  // Products available to add (not currently in loadLines)
  const availableToAdd = useMemo(() => {
    return products
      .filter((p) => !loadLines[p.id])
      .filter((p) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.shortCode.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const aStock = a.godownQty > 0 ? 1 : 0;
        const bStock = b.godownQty > 0 ? 1 : 0;
        if (aStock !== bStock) return bStock - aStock;
        return a.name.localeCompare(b.name);
      });
  }, [products, loadLines, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (activeLineList.length === 0) {
      setError("Please add at least one product with cartons or pieces to the load sheet.");
      return;
    }

    // Client-side validations
    for (const line of activeLineList) {
      const prod = line.product;
      if (!prod) continue;

      if (line.newTotalPieces <= 0) {
        setError(
          `Product '${prod.name}' has 0 quantity. Please enter a valid quantity or remove the item from the load.`
        );
        return;
      }

      if (line.newTotalPieces < line.soldQty) {
        setError(
          `Cannot reduce '${prod.name}' below sold quantity (${line.soldQty} pcs sold).`
        );
        return;
      }

      // Check godown stock sufficiency for increases
      if (line.deltaPieces > 0) {
        if (line.deltaPieces > prod.godownQty) {
          setError(
            `Insufficient Godown stock for additional ${line.deltaPieces} pcs of '${prod.name}'. Godown only has ${prod.godownQty} pcs available.`
          );
          return;
        }
      }

      // Check van stock sufficiency for decreases
      if (line.deltaPieces < 0) {
        const returnQty = -line.deltaPieces;
        if (returnQty > prod.vanQty) {
          setError(
            `Cannot return ${returnQty} pcs of '${prod.name}' to Godown. Van only has ${prod.vanQty} pcs available in stock.`
          );
          return;
        }
      }
    }

    setLoading(true);

    const itemsToSubmit = activeLineList.map((line) => ({
      productId: line.productId,
      cartons: line.cartons,
      pieces: line.pieces,
    }));

    const res = await updateVanIssueSheetAction({
      vanDayId: vanDay.id,
      notes: notes || undefined,
      items: itemsToSubmit,
    });

    if (res.success && res.data) {
      setSuccess("Van load sheet updated successfully! Redirecting...");
      setTimeout(() => {
        router.push(`/godown/van-issues/${res.data!.id}/print`);
      }, 700);
    } else {
      setError(res.error || "Failed to update van issue sheet.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Informational Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 text-sm text-blue-900">
        <span className="text-xl">ℹ️</span>
        <div className="space-y-1">
          <p className="font-semibold">
            Real-time Load Modification & Stock Ledger Sync
          </p>
          <p className="text-xs text-blue-800">
            • <strong>Increasing Quantity:</strong> Additional pieces are immediately transferred from Central Godown to this Van.
            <br />
            • <strong>Decreasing Quantity / Removing:</strong> Reduced pieces are returned from this Van back into Central Godown stock.
            <br />
            • Items already sold cannot be reduced below the sold quantity.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-lg font-medium">
          ✅ {success}
        </div>
      )}

      {/* Main Table: Currently Loaded Items */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Loaded Items on Van ({activeLineList.length} items)
            </h2>
            <p className="text-xs text-gray-500">
              Edit cartons or loose pieces below, or click remove to return items to Godown.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="px-2.5 py-1 bg-gray-100 rounded text-gray-700 border">
              Original: <strong className="text-gray-900">{totals.originalPieces} pcs</strong>
            </span>
            <span className="px-2.5 py-1 bg-blue-50 rounded text-blue-800 border border-blue-200">
              New: <strong className="text-blue-950">{totals.newPieces} pcs</strong> ({totals.newCartons} crt)
            </span>
            {totals.netDelta !== 0 && (
              <span
                className={`px-2.5 py-1 rounded font-bold border ${
                  totals.netDelta > 0
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                Net: {totals.netDelta > 0 ? `+${totals.netDelta}` : totals.netDelta} pcs
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs border-b">
              <tr>
                <th className="px-4 py-3">Product Name & Code</th>
                <th className="px-3 py-3 text-center">Pack Size</th>
                <th className="px-3 py-3 text-center">Godown Stock</th>
                <th className="px-3 py-3 text-center">Original Load</th>
                <th className="px-3 py-3 text-center">Sold Qty</th>
                <th className="px-3 py-3 text-center w-28">Cartons</th>
                <th className="px-3 py-3 text-center w-24">Loose Pcs</th>
                <th className="px-3 py-3 text-center">New Total</th>
                <th className="px-3 py-3 text-center">Adjustment</th>
                <th className="px-3 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {activeLineList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No items in this load sheet. Add products from the catalog below.
                  </td>
                </tr>
              ) : (
                activeLineList.map((line) => {
                  const prod = line.product;
                  if (!prod) return null;

                  return (
                    <tr
                      key={line.productId}
                      className={
                        line.deltaPieces !== 0
                          ? line.deltaPieces > 0
                            ? "bg-green-50/40"
                            : "bg-amber-50/40"
                          : "hover:bg-gray-50/70"
                      }
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{prod.name}</div>
                        <div className="text-xs text-gray-500">
                          Code: {prod.shortCode} &bull; MRP: ₹
                          {((prod.mrpPaise || 0) / 100).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-xs font-medium text-gray-600">
                        {prod.packSize} pcs / {prod.packLabel || "crt"}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            prod.godownQty > 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-600"
                          }`}
                        >
                          {prod.godownQty} pcs
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-gray-600">
                        {line.originalIssuedQty > 0 ? (
                          <span>
                            {Math.floor(line.originalIssuedQty / prod.packSize)} crt
                            {line.originalIssuedQty % prod.packSize > 0 &&
                              ` + ${line.originalIssuedQty % prod.packSize} pcs`}
                            <br />
                            <span className="text-[11px] text-gray-400">
                              ({line.originalIssuedQty} pcs)
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold">New Item</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-medium text-gray-700">
                        {line.soldQty > 0 ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                            {line.soldQty} pcs
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={line.cartons === 0 ? "" : line.cartons}
                          onChange={(e) =>
                            handleCartonChange(line.productId, parseInt(e.target.value) || 0)
                          }
                          placeholder="0"
                          className="w-20 px-2.5 py-1.5 border border-gray-300 rounded text-center text-sm font-bold focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min="0"
                          value={line.pieces === 0 ? "" : line.pieces}
                          onChange={(e) =>
                            handlePieceChange(line.productId, parseInt(e.target.value) || 0)
                          }
                          placeholder="0"
                          className="w-16 px-2 py-1.5 border border-gray-300 rounded text-center text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="font-bold text-gray-900">
                          {line.newTotalPieces} pcs
                        </span>
                        <div className="text-[11px] text-gray-500">
                          ₹{((line.newTotalPieces * (prod.mrpPaise || 0)) / 100).toFixed(0)}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {line.deltaPieces === 0 ? (
                          <span className="text-xs text-gray-400">No Change</span>
                        ) : line.deltaPieces > 0 ? (
                          <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                            +{line.deltaPieces} pcs
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                            {line.deltaPieces} pcs
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(line.productId)}
                          disabled={line.soldQty > 0}
                          title={
                            line.soldQty > 0
                              ? `Cannot remove (${line.soldQty} pcs already sold)`
                              : "Remove item from load sheet"
                          }
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium px-2 py-1 rounded hover:bg-red-50"
                        >
                          🗑️ Remove
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Products Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Add More Products from Godown</h2>
            <p className="text-xs text-gray-500">
              Search by product name or code, then click &quot;+ Add to Load&quot;.
            </p>
          </div>
          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name or code..."
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto border border-gray-200 rounded divide-y divide-gray-100">
          {availableToAdd.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500">
              {search.trim()
                ? "No matching products found."
                : "All products from the catalog are already added to this load."}
            </div>
          ) : (
            availableToAdd.slice(0, 30).map((prod) => (
              <div
                key={prod.id}
                className="p-3 flex items-center justify-between hover:bg-gray-50 transition"
              >
                <div>
                  <div className="font-semibold text-gray-900 text-xs sm:text-sm">
                    {prod.name}
                  </div>
                  <div className="text-[11px] text-gray-500 space-x-2">
                    <span>Code: {prod.shortCode}</span>
                    <span>&bull;</span>
                    <span>Pack: {prod.packSize} pcs</span>
                    <span>&bull;</span>
                    <span>MRP: ₹{((prod.mrpPaise || 0) / 100).toFixed(2)}</span>
                    <span>&bull;</span>
                    <span
                      className={`font-semibold ${
                        prod.godownQty > 0 ? "text-emerald-700" : "text-red-500"
                      }`}
                    >
                      Godown Stock: {prod.godownQty} pcs
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddProduct(prod)}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded whitespace-nowrap"
                >
                  + Add to Load
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dispatch Notes */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-2">
        <label className="block text-xs font-semibold text-gray-700">
          Modification / Dispatch Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="E.g., Added 2 extra cartons of biscuits on route driver request..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="text-xs text-gray-600">
          Total Valuation:{" "}
          <strong className="text-gray-900 text-sm">
            ₹{(totals.totalValuationPaise / 100).toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}
          </strong>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/godown/van-issues"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Saving Load Changes...
              </>
            ) : (
              "💾 Save Load Sheet Changes"
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
