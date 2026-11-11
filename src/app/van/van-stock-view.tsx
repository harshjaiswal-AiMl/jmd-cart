"use client";
import { searchItems } from "@/lib/search/smart-search";

import React, { useState } from "react";
import { Search, Package, Box, Layers, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useVanLanguage } from "@/lib/i18n/van-language-context";
import { tHi } from "@/lib/i18n/messages/hi";

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
  const { t } = useVanLanguage();
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = !searchTerm.trim()
    ? inventory
    : (() => {
        const hits = searchItems(searchTerm, inventory.map((item) => ({ id: item.product.id, name: item.product.name, nameHi: (item.product as any).nameHi, shortCode: item.product.shortCode, companyName: item.product.company?.name })), { limit: inventory.length || 500 });
        const byId = new Map(inventory.map((i) => [i.product.id, i]));
        return hits.map((h) => byId.get(h.id)).filter((x): x is (typeof inventory)[number] => Boolean(x));
      })();

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
          <span>{t("quickNewBill")}</span>
        </Link>
        <Link
          href="/van/bills"
          className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 active:bg-slate-700 text-slate-200 border border-slate-700 shadow-md"
        >
          <span>{t("viewBills")}</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t("searchStockPlaceholder")}
          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700/80 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-inner"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
          >
            {tHi("clearBtn")}
          </button>
        )}
      </div>

      {/* Inventory Cards on Mobile / Table on Desktop */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              {tHi("onVanPhysicalStock")}
            </h3>
          </div>
          <span className="text-sm text-slate-400">
            {tHi("itemsCountOf", { shown: filtered.length, total: inventory.length })}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-medium">
              {inventory.length === 0
                ? tHi("noStockLoaded")
                : tHi("noProductsMatchSearch", { query: searchTerm })}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-sm text-emerald-400 hover:underline"
              >
                {tHi("resetSearchFilter")}
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
                      <h4 className="font-bold text-base text-white leading-tight">
                        {(item.product as any).nameHi || item.product.name}
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
                      <p className="text-xs text-slate-400">{tHi("mrpPerPc")}</p>
                    </div>
                  </div>

                  {/* Quantity Breakdown Chips */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs">
                      <Box className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-slate-300 font-medium">
                        {item.cartons} {tHi("ctnShort")}
                      </span>
                      <span className="text-slate-400 text-xs">
                        ({item.product.packSize}/{tHi("ctnShort")})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs">
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-slate-300 font-medium">
                        {item.loosePieces} {tHi("looseWord")}
                      </span>
                    </div>

                    <div className="ml-auto flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 text-sm text-emerald-300 font-bold">
                      <span>{item.qty} {tHi("pcs")}</span>
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
                    <th className="px-4 py-3">{tHi("colProductName")}</th>
                    <th className="px-4 py-3">{tHi("colCompany")}</th>
                    <th className="px-4 py-3">{tHi("colItemCode")}</th>
                    <th className="px-4 py-3">{tHi("colPackConfig")}</th>
                    <th className="px-4 py-3 text-center">{tHi("colCartons")}</th>
                    <th className="px-4 py-3 text-center">{tHi("colLoosePcs")}</th>
                    <th className="px-4 py-3 text-right">{tHi("colAvailablePcs")}</th>
                    <th className="px-4 py-3 text-right">{tHi("colMrp")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {filtered.map((item) => (
                    <tr key={item.product.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-white text-base">
                        {(item.product as any).nameHi || item.product.name}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.product.company?.name || "-"}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {item.product.shortCode}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {item.product.packSize} {tHi("pcs")} / {tHi("unitCarton")}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-300">
                        {item.cartons > 0 ? `${item.cartons} ${tHi("ctnShort")}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-300 font-medium">
                        {item.loosePieces > 0 ? `${item.loosePieces} ${tHi("pcs")}` : "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-emerald-400 text-base">
                        {item.qty} {tHi("pcs")}
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
