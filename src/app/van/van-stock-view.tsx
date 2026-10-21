"use client";

import React, { useState } from "react";
import { Search, Package, Box, Layers, ArrowUpRight } from "lucide-react";
import Link from "next/link";

interface VanInventoryItem {
  product: {
    id: string;
    name: string;
    shortCode: string;
    packSize: number;
    packLabel: string;
    mrpPaise: number | null;
    company?: { name: string } | null;
  };
  qty: number;
  cartons: number;
  loosePieces: number;
}

interface VanStockViewProps {
  inventory: VanInventoryItem[];
  vanName: string;
  hasActiveLoad: boolean;
}

export function VanStockView({
  inventory,
  vanName,
  hasActiveLoad,
}: VanStockViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = inventory.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.product.name.toLowerCase().includes(term) ||
      item.product.shortCode.toLowerCase().includes(term) ||
      (item.product.company?.name && item.product.company.name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-4">
      {/* Mobile-optimized Quick Action Row */}
      <div className="grid grid-cols-2 gap-3 sm:hidden">
        <Link
          href="/van/billing"
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-all ${
            hasActiveLoad
              ? "bg-emerald-600 active:bg-emerald-700 text-white shadow-emerald-950"
              : "bg-slate-800 text-slate-400 border border-slate-700"
          }`}
        >
          <span>⚡ New Bill</span>
        </Link>
        <Link
          href="/van/bills"
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 active:bg-slate-700 text-slate-200 border border-slate-700 shadow-md"
        >
          <span>📄 Today&apos;s Bills</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search items by name, brand, or code..."
          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-inner"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {/* Inventory Cards on Mobile / Table on Desktop */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              On-Van Physical Stock
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            {filtered.length} of {inventory.length} items
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-medium">
              {inventory.length === 0
                ? "No inventory loaded on van. Check morning dispatch sheet."
                : `No products matching "${searchTerm}"`}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs text-emerald-400 hover:underline"
              >
                Reset search filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile View: High-contrast Card List */}
            <div className="divide-y divide-slate-800/80 sm:hidden">
              {filtered.map((item) => (
                <div key={item.product.id} className="p-4 hover:bg-slate-800/40 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-white leading-tight">
                        {item.product.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {item.product.company?.name ? `${item.product.company.name} • ` : ""}
                        <span className="font-mono text-slate-300">
                          {item.product.shortCode}
                        </span>
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-400">
                        ₹{((item.product.mrpPaise ?? 0) / 100).toFixed(2)}
                      </span>
                      <p className="text-[10px] text-slate-400">MRP/pc</p>
                    </div>
                  </div>

                  {/* Quantity Breakdown Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs">
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-300 font-medium">
                        {item.cartons} ctn
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        ({item.product.packSize}/ctn)
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-slate-300 font-medium">
                        {item.loosePieces} loose
                      </span>
                    </div>

                    <div className="ml-auto flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-xs text-emerald-300 font-bold">
                      <span>{item.qty} pcs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / Tablet View: Tabular Matrix */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-300 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Product Name</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Item Code</th>
                    <th className="px-4 py-3">Pack Config</th>
                    <th className="px-4 py-3 text-center">Cartons</th>
                    <th className="px-4 py-3 text-center">Loose Pcs</th>
                    <th className="px-4 py-3 text-right">Available Pcs</th>
                    <th className="px-4 py-3 text-right">MRP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filtered.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white">
                        {item.product.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.product.company?.name || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {item.product.shortCode}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.product.packSize} pcs / {item.product.packLabel}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-300">
                        {item.cartons > 0 ? `${item.cartons} ctn` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-300 font-medium">
                        {item.loosePieces > 0 ? `${item.loosePieces} pcs` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-400 text-sm">
                        {item.qty} pcs
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-300">
                        ₹{((item.product.mrpPaise ?? 0) / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
