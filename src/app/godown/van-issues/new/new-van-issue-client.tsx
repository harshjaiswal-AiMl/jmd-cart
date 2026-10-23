"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Location, Product, User } from "@prisma/client";
import { createVanIssueSheetAction } from "../actions";

interface StockProduct extends Product {
  godownQty: number;
}

interface NewVanIssueClientProps {
  vanLocations: (Location & { assignedUser: User | null })[];
  godownProducts: StockProduct[];
}

export function NewVanIssueClient({ vanLocations, godownProducts }: NewVanIssueClientProps) {
  const router = useRouter();
  const [selectedVanId, setSelectedVanId] = useState<string>(
    vanLocations.length > 0 ? vanLocations[0].id : ""
  );
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected item map: productId -> { cartons, pieces }
  const [loadItems, setLoadItems] = useState<Record<string, { cartons: number; pieces: number }>>({});

  const selectedVan = vanLocations.find((v) => v.id === selectedVanId);

  const handleCartonChange = (productId: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setLoadItems((prev) => ({
      ...prev,
      [productId]: {
        cartons: safeVal,
        pieces: prev[productId]?.pieces || 0,
      },
    }));
  };

  const handlePieceChange = (productId: string, val: number) => {
    const safeVal = Math.max(0, val || 0);
    setLoadItems((prev) => ({
      ...prev,
      [productId]: {
        cartons: prev[productId]?.cartons || 0,
        pieces: safeVal,
      },
    }));
  };

  // Filter products by search
  const filteredProducts = godownProducts.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.shortCode.toLowerCase().includes(q)
    );
  });

  // Calculate totals
  let totalCartons = 0;
  let totalPieces = 0;
  let totalValuationPaise = 0;
  const itemsToSubmit: { productId: string; cartons: number; pieces: number }[] = [];

  Object.entries(loadItems).forEach(([productId, counts]) => {
    const product = godownProducts.find((p) => p.id === productId);
    if (!product) return;

    if (counts.cartons > 0 || counts.pieces > 0) {
      const linePieces = counts.cartons * product.packSize + counts.pieces;
      totalCartons += counts.cartons;
      totalPieces += linePieces;
      totalValuationPaise += linePieces * (product.mrpPaise ?? 0);

      itemsToSubmit.push({
        productId,
        cartons: counts.cartons,
        pieces: counts.pieces,
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVanId) {
      setError("Please select a delivery van.");
      return;
    }

    if (itemsToSubmit.length === 0) {
      setError("Please add at least one product with cartons or pieces to issue.");
      return;
    }

    // Check Godown stock sufficiency
    for (const item of itemsToSubmit) {
      const prod = godownProducts.find((p) => p.id === item.productId);
      if (prod) {
        const requiredPieces = item.cartons * prod.packSize + item.pieces;
        if (requiredPieces > prod.godownQty) {
          setError(
            `Insufficient Godown stock for '${prod.name}'. Available: ${prod.godownQty} pcs, Requested: ${requiredPieces} pcs.`
          );
          return;
        }
      }
    }

    setLoading(true);
    setError(null);

    const res = await createVanIssueSheetAction({
      vanLocationId: selectedVanId,
      notes: notes || undefined,
      items: itemsToSubmit,
    });

    if (res.success && res.data) {
      router.push(`/godown/van-issues/${res.data.id}/print`);
    } else {
      setError(res.error || "Failed to create van issue sheet");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header Selection Card */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-base font-semibold text-gray-900">1. Select Delivery Van & Destination</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Delivery Van Location <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedVanId}
              onChange={(e) => setSelectedVanId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:ring-1 focus:ring-blue-500"
            >
              {vanLocations.map((van) => (
                <option key={van.id} value={van.id}>
                  {van.name} ({van.assignedUser ? `Salesperson: ${van.assignedUser.name}` : "Unassigned"})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Assigned Route Driver / Salesperson
            </label>
            <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-800">
              {selectedVan?.assignedUser ? (
                <span>
                  👤 <strong>{selectedVan.assignedUser.name}</strong> (📞 {selectedVan.assignedUser.phone})
                </span>
              ) : (
                <span className="text-red-600 font-medium">⚠️ No salesperson assigned to this van</span>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Dispatch Notes / Route Remarks (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Saharsa South Rural Route, Morning Dispatch Batch 1"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Product Selection Card - Search and Add One-by-One */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">2. Select Products to Issue</h2>
            <p className="text-xs text-gray-500">
              Search and add products to the van load sheet one by one. Stock will be transferred from Godown to Van.
            </p>
          </div>
          {itemsToSubmit.length > 0 && (
            <button
              type="button"
              onClick={() => setLoadItems({})}
              className="text-xs text-red-600 hover:text-red-800 font-medium self-start md:self-auto"
            >
              Clear All ({itemsToSubmit.length})
            </button>
          )}
        </div>

        {/* Product Search & Dropdown Picker */}
        <div className="relative">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1">
            Search Product to Add (Name or Code)
          </label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type product name, e.g. 'Aashirvad', 'MDH', 'Salt'..."
              className="w-full px-3.5 py-2.5 text-sm border-2 border-blue-200 rounded-lg focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
            />
            {search.trim() && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {search.trim() && (
            <div className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-xl divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500">
                  Koi product nahi mila &quot;{search}&quot; ke liye.
                </div>
              ) : (
                filteredProducts.slice(0, 15).map((p) => {
                  const isAlreadyAdded = !!loadItems[p.id];
                  const ctn = Math.floor(p.godownQty / p.packSize);
                  const loose = p.godownQty % p.packSize;

                  return (
                    <div
                      key={p.id}
                      className="p-3 hover:bg-blue-50/60 flex items-center justify-between gap-3 transition cursor-pointer"
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          handleCartonChange(p.id, p.godownQty >= p.packSize ? 1 : 0);
                        }
                        setSearch("");
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {p.name}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-gray-400">{p.shortCode}</span>
                          <span>•</span>
                          <span>{p.packSize} pcs / {p.packLabel}</span>
                          <span>•</span>
                          <span className="text-gray-700 font-mono font-medium">
                            MRP ₹{((p.mrpPaise ?? 0) / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-medium ${
                            p.godownQty > 0
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-red-50 text-red-600 border border-red-200"
                          }`}
                        >
                          Stock: {p.godownQty} pcs ({ctn} ctn + {loose} loose)
                        </span>

                        <button
                          type="button"
                          className={`text-xs font-semibold px-3 py-1 rounded transition ${
                            isAlreadyAdded
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {isAlreadyAdded ? "Added" : "+ Add"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Selected Products List */}
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          {itemsToSubmit.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-gray-50/50 space-y-1">
              <div className="text-2xl">📦</div>
              <p className="text-sm font-medium text-gray-700">Abhi koi product add nahi hua hai.</p>
              <p className="text-xs text-gray-400">
                Upar search box me product ka naam type karein aur &quot;+ Add&quot; dabayein.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-3 py-2.5">Product & Short Code</th>
                  <th className="px-3 py-2.5">Pack Size</th>
                  <th className="px-3 py-2.5">Godown Available</th>
                  <th className="px-3 py-2.5 text-center">Cartons</th>
                  <th className="px-3 py-2.5 text-center">Loose Pcs</th>
                  <th className="px-3 py-2.5 text-right">Total Pcs</th>
                  <th className="px-3 py-2.5 text-right">MRP Total</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {itemsToSubmit.map((item) => {
                  const p = godownProducts.find((gp) => gp.id === item.productId);
                  if (!p) return null;

                  const lineTotalPieces = item.cartons * p.packSize + item.pieces;
                  const isInsufficient = lineTotalPieces > p.godownQty;
                  const lineMrpPaise = lineTotalPieces * (p.mrpPaise ?? 0);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        isInsufficient ? "bg-red-50/50" : "bg-blue-50/20"
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-gray-900">{p.name}</div>
                        <div className="font-mono text-gray-400 text-[10px]">{p.shortCode}</div>
                      </td>

                      <td className="px-3 py-2.5 text-gray-600">
                        {p.packSize} pcs / {p.packLabel}
                      </td>

                      <td className="px-3 py-2.5">
                        <span
                          className={`font-semibold ${
                            p.godownQty > 0 ? "text-emerald-700" : "text-red-500"
                          }`}
                        >
                          {p.godownQty} pcs
                        </span>
                        <div className="text-[10px] text-gray-400">
                          ({Math.floor(p.godownQty / p.packSize)} ctn + {p.godownQty % p.packSize} pcs)
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.cartons || ""}
                          onChange={(e) => handleCartonChange(p.id, parseInt(e.target.value, 10))}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center font-mono font-bold border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-xs bg-white"
                        />
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="number"
                          min="0"
                          value={item.pieces || ""}
                          onChange={(e) => handlePieceChange(p.id, parseInt(e.target.value, 10))}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-center font-mono border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-xs bg-white"
                        />
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`font-bold ${
                            isInsufficient ? "text-red-600" : "text-blue-700"
                          }`}
                        >
                          {lineTotalPieces} pcs
                        </span>
                        {isInsufficient && (
                          <div className="text-[10px] text-red-500 font-bold">Stock se zyada!</div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right text-gray-800 font-mono font-medium">
                        ₹{(lineMrpPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setLoadItems((prev) => {
                              const copy = { ...prev };
                              delete copy[p.id];
                              return copy;
                            });
                          }}
                          className="text-gray-400 hover:text-red-600 text-sm p-1 rounded transition"
                          title="Remove item"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Summary and Submission */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <p className="text-xs text-gray-500">Products Selected</p>
            <p className="text-xl font-bold text-gray-900">{itemsToSubmit.length}</p>
          </div>

          <div className="bg-blue-50 p-3 rounded border border-blue-200">
            <p className="text-xs text-blue-700 font-medium">Total Cartons</p>
            <p className="text-xl font-bold text-blue-700">{totalCartons} cartons</p>
          </div>

          <div className="bg-purple-50 p-3 rounded border border-purple-200">
            <p className="text-xs text-purple-700 font-medium">Total Aggregate Pieces</p>
            <p className="text-xl font-bold text-purple-700">{totalPieces} pcs</p>
          </div>

          <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
            <p className="text-xs text-emerald-700 font-medium">Total MRP Valuation</p>
            <p className="text-xl font-bold text-emerald-700">
              ₹{(totalValuationPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/godown/van-issues"
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            ← Cancel & Return to Van Issue List
          </Link>

          <button
            type="submit"
            disabled={loading || itemsToSubmit.length === 0}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-semibold shadow-sm disabled:opacity-50"
          >
            {loading ? "Generating Issue Sheet & Posting Stock..." : "Confirm Dispatch & Print Load Sheet →"}
          </button>
        </div>
      </div>
    </form>
  );
}
