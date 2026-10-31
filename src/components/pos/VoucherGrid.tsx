"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { SearchableProduct } from "@/lib/search/smart-search";

export interface VoucherGridLine {
  id: string;
  productId: string;
  product: SearchableProduct;
  qty: number;
  unit: "Pcs" | "Carton" | "Dozen" | "Bag" | string;
  mrpPaise?: number | null;
  customMrpInput?: string;
  ratePaise: number;
  customRateInput?: string;
  discPct?: number;
  amountPaise: number;
  gstRateBp?: number;
  isCustomRate?: boolean;
  isStockSufficient?: boolean;
  availablePieces?: number;
  availableCartons?: number;
}

export interface VoucherGridProps {
  lines: VoucherGridLine[];
  columns?: {
    showMrp?: boolean;
    showDisc?: boolean;
    showGst?: boolean;
    rateLabel?: string;
  };
  highlightedLineId?: string | null;
  onSelectLine: (productId: string) => void;
  onUpdateQty: (lineId: string, qty: number) => void;
  onUpdateUnit: (lineId: string, unit: any) => void;
  onUpdateMrp?: (lineId: string, val: string) => void;
  onUpdateRate: (lineId: string, val: string) => void;
  onUpdateDisc?: (lineId: string, val: string) => void;
  onRemoveLine: (lineId: string) => void;
  onJumpToSearch?: () => void;
  emptyPromptText?: string;
}

export function VoucherGrid({
  lines,
  columns = { showMrp: true, showDisc: true, rateLabel: "Rate (₹)" },
  highlightedLineId,
  onSelectLine,
  onUpdateQty,
  onUpdateUnit,
  onUpdateMrp,
  onUpdateRate,
  onUpdateDisc,
  onRemoveLine,
  onJumpToSearch,
  emptyPromptText = "👉 Press [Ctrl+K / F1] or type above to add items to bill...",
}: VoucherGridProps) {
  const showMrp = columns.showMrp ?? true;
  const showDisc = columns.showDisc ?? true;
  const showGst = columns.showGst ?? false;

  return (
    <div className="w-full overflow-x-auto select-none font-sans">
      <table className="w-full text-left border-collapse">
        <thead className="bg-[#f1f5f9] text-slate-700 text-xs uppercase tracking-wider font-extrabold sticky top-0 z-10 border-b-2 border-slate-300">
          <tr>
            <th className="py-2.5 px-3 w-12 text-center border-r border-slate-200">S.N.</th>
            <th className="py-2.5 px-3 min-w-[240px] border-r border-slate-200">Item Description</th>
            <th className="py-2.5 px-2 w-20 text-center border-r border-slate-200">Qty</th>
            <th className="py-2.5 px-2 w-28 text-center border-r border-slate-200">Unit</th>
            {showMrp && (
              <th className="py-2.5 px-2 w-24 text-right border-r border-slate-200">List Price</th>
            )}
            {showDisc && (
              <th className="py-2.5 px-2 w-20 text-right border-r border-slate-200">Disc %</th>
            )}
            <th className="py-2.5 px-2 w-28 text-right border-r border-slate-200">
              {columns.rateLabel || "Rate (₹)"}
            </th>
            {showGst && (
              <th className="py-2.5 px-2 w-16 text-center border-r border-slate-200">GST</th>
            )}
            <th className="py-2.5 px-3 w-32 text-right border-r border-slate-200">Amount (₹)</th>
            <th className="py-2.5 px-2 w-10 text-center">✕</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 text-xs sm:text-sm bg-white">
          {lines.map((line, idx) => {
            const isHighlighted = line.productId === highlightedLineId || line.id === highlightedLineId;
            const weightText = line.product.weight || (line.product.weightValue ? ` ${line.product.weightValue}${line.product.weightUnit || "g"}` : "");
            const fullTitle = `${line.product.name}${weightText}`;
            const isStockSufficient = line.isStockSufficient ?? true;

            return (
              <tr
                key={line.id}
                data-line-id={line.id}
                onClick={() => onSelectLine(line.productId)}
                className={`transition-colors cursor-pointer ${
                  !isStockSufficient
                    ? "bg-rose-50/70 hover:bg-rose-100/60 border-l-4 border-l-rose-500"
                    : isHighlighted
                    ? "bg-amber-50/70 hover:bg-amber-100/50 border-l-4 border-l-[#0f172a] font-medium"
                    : "hover:bg-slate-50/80"
                }`}
              >
                {/* S.N. */}
                <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-xs font-bold border-r border-slate-200">
                  {idx + 1}
                </td>

                {/* Item Description (Minimal Busy Style: plain text Name + Weight only) */}
                <td className="py-2.5 px-3 border-r border-slate-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                      {fullTitle}
                    </span>
                    {!isStockSufficient && (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded shrink-0">
                        Low Stock
                      </span>
                    )}
                  </div>
                </td>

                {/* Qty */}
                <td className="py-2 px-1 text-center border-r border-slate-200">
                  <input
                    data-pos-field="qty"
                    type="number"
                    min="1"
                    value={line.qty}
                    onChange={(e) => onUpdateQty(line.id, parseInt(e.target.value, 10) || 1)}
                    onFocus={(e) => {
                      e.target.select();
                      onSelectLine(line.productId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const row = (e.target as HTMLElement).closest("tr");
                        const unitSelect = row?.querySelector<HTMLSelectElement>("select[data-pos-field='unit']");
                        if (unitSelect) {
                          unitSelect.focus();
                        } else {
                          onJumpToSearch?.();
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        onJumpToSearch?.();
                      }
                    }}
                    className="w-16 px-1 py-1 text-center font-mono font-black text-sm bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#0f172a] focus:border-[#0f172a]"
                  />
                </td>

                {/* Unit */}
                <td className="py-2 px-1 text-center border-r border-slate-200">
                  <select
                    data-pos-field="unit"
                    value={line.unit}
                    onChange={(e) => onUpdateUnit(line.id, e.target.value)}
                    onKeyDown={(e) => {
                      const k = e.key.toLowerCase();
                      if (k === "p") {
                        e.preventDefault();
                        onUpdateUnit(line.id, "Pcs");
                      } else if (k === "c") {
                        e.preventDefault();
                        onUpdateUnit(line.id, "Carton");
                      } else if (k === "d") {
                        e.preventDefault();
                        onUpdateUnit(line.id, "Dozen");
                      } else if (k === "b") {
                        e.preventDefault();
                        onUpdateUnit(line.id, "Bag");
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const row = (e.target as HTMLElement).closest("tr");
                        const nextField = row?.querySelector<HTMLInputElement>(
                          "input[data-pos-field='mrp'], input[data-pos-field='rate']"
                        );
                        if (nextField) {
                          nextField.focus();
                          nextField.select();
                        } else {
                          onJumpToSearch?.();
                        }
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        onJumpToSearch?.();
                      }
                    }}
                    className="w-24 px-1 py-1 text-xs font-bold bg-white border border-slate-300 rounded focus:ring-2 focus:ring-[#0f172a] cursor-pointer"
                  >
                    <option value="Pcs">Pcs</option>
                    <option value="Carton">Carton (Crt)</option>
                    <option value="Dozen">Dozen</option>
                    <option value="Bag">Bag</option>
                  </select>
                </td>

                {/* List Price (MRP) */}
                {showMrp && (
                  <td className="py-2 px-2 text-right border-r border-slate-200">
                    <input
                      type="number"
                      step="0.01"
                      value={
                        line.customMrpInput !== undefined
                          ? line.customMrpInput
                          : line.mrpPaise
                          ? (line.mrpPaise / 100).toFixed(2)
                          : ""
                      }
                      onChange={(e) => onUpdateMrp?.(line.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      data-pos-field="mrp"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const row = (e.target as HTMLElement).closest("tr");
                          const rateInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='rate']");
                          if (rateInput) {
                            rateInput.focus();
                            rateInput.select();
                          }
                        }
                      }}
                      className="w-20 px-1 py-1 text-right font-mono text-xs rounded border border-slate-300 bg-white"
                    />
                  </td>
                )}

                {/* Disc % */}
                {showDisc && (
                  <td className="py-2 px-2 text-right border-r border-slate-200">
                    <input
                      type="number"
                      step="0.1"
                      value={line.discPct !== undefined ? line.discPct : ""}
                      onChange={(e) => onUpdateDisc?.(line.id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      data-pos-field="disc"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const row = (e.target as HTMLElement).closest("tr");
                          const rateInput = row?.querySelector<HTMLInputElement>("input[data-pos-field='rate']");
                          if (rateInput) {
                            rateInput.focus();
                            rateInput.select();
                          } else {
                            onJumpToSearch?.();
                          }
                        }
                      }}
                      className="w-16 px-1 py-1 text-right font-mono text-xs rounded border border-slate-300 bg-white"
                    />
                  </td>
                )}

                {/* Rate */}
                <td className="py-2 px-2 text-right border-r border-slate-200">
                  <input
                    type="number"
                    step="0.01"
                    value={
                      line.customRateInput !== undefined
                        ? line.customRateInput
                        : (line.ratePaise / 100).toFixed(2)
                    }
                    onChange={(e) => onUpdateRate(line.id, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    data-pos-field="rate"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onJumpToSearch?.();
                      }
                    }}
                    className="w-24 px-1 py-1 text-right font-mono font-bold text-xs rounded border border-slate-300 bg-white focus:ring-2 focus:ring-[#0f172a]"
                  />
                </td>

                {/* GST (Optional) */}
                {showGst && (
                  <td className="py-2 px-2 text-center font-mono text-xs border-r border-slate-200 text-slate-500">
                    {((line.gstRateBp || 0) / 100).toFixed(0)}%
                  </td>
                )}

                {/* Amount */}
                <td className="py-2.5 px-3 text-right font-mono font-black text-xs sm:text-sm text-slate-900 border-r border-slate-200">
                  ₹{(line.amountPaise / 100).toFixed(2)}
                </td>

                {/* Delete button */}
                <td className="py-2 px-2 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLine(line.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 transition"
                    title="Remove line [F9]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}

          {/* Empty Ledger Grid Rows (Busy style continuous matrix) */}
          {lines.length === 0 && (
            <tr className="h-10 bg-blue-50/20 border-b border-slate-200">
              <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-200 font-bold">1</td>
              <td colSpan={showMrp ? 8 : 7} className="px-4 text-xs font-semibold text-slate-500">
                {emptyPromptText}
              </td>
            </tr>
          )}
          {Array.from({ length: Math.max(0, 8 - Math.max(1, lines.length)) }).map((_, emptyIdx) => {
            const rowNum = Math.max(1, lines.length) + emptyIdx + 1;
            return (
              <tr key={`empty-row-${rowNum}`} className="h-9 hover:bg-slate-50/40 border-b border-slate-200/80">
                <td className="text-center font-mono text-xs text-slate-400 border-r border-slate-200 font-bold">{rowNum}</td>
                <td className="border-r border-slate-200 px-3"></td>
                <td className="border-r border-slate-200"></td>
                <td className="border-r border-slate-200"></td>
                {showMrp && <td className="border-r border-slate-200"></td>}
                {showDisc && <td className="border-r border-slate-200"></td>}
                <td className="border-r border-slate-200"></td>
                {showGst && <td className="border-r border-slate-200"></td>}
                <td className="border-r border-slate-200"></td>
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
