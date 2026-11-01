"use client";

import React, { useState } from "react";
import { formatDmy } from "@/lib/datetime";
import { CheckCircle2, Clock, ShieldAlert, User, Package, ArrowRight } from "lucide-react";
import { markStockCorrectionReviewedAction } from "./actions";

interface CorrectionItem {
  id: string;
  createdAt: string | Date;
  oldQty: number;
  newQty: number;
  deltaQty: number;
  reason: string;
  invoiceId: string | null;
  reviewed: boolean;
  product: {
    id: string;
    name: string;
    shortCode: string;
  };
  location: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    name: string | null;
    role: string;
  };
  reviewer?: {
    id: string;
    name: string | null;
  } | null;
}

interface Props {
  corrections: CorrectionItem[];
}

export function StockCorrectionsClient({ corrections: initialData }: Props) {
  const [corrections, setCorrections] = useState(initialData);
  const [filter, setFilter] = useState<"ALL" | "UNREVIEWED">("UNREVIEWED");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filtered = corrections.filter((c) => {
    if (filter === "UNREVIEWED") return !c.reviewed;
    return true;
  });

  const handleMarkReviewed = async (id: string) => {
    setPendingId(id);
    const res = await markStockCorrectionReviewedAction(id);
    setPendingId(null);
    if (res.success) {
      setCorrections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, reviewed: true } : c))
      );
    }
  };

  const unreviewedCount = corrections.filter((c) => !c.reviewed).length;

  return (
    <div className="space-y-4">
      {/* Filter Tabs & Badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("UNREVIEWED")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
              filter === "UNREVIEWED"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Unreviewed ({unreviewedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              filter === "ALL"
                ? "bg-[#12355B] text-white shadow-xs"
                : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
            }`}
          >
            All Corrections ({corrections.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-bold text-slate-800 text-sm">All caught up!</p>
            <p>No unreviewed stock corrections pending review.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs font-sans">
              <thead className="bg-slate-50 text-slate-700 font-bold">
                <tr>
                  <th className="py-3 px-4">Timestamp &amp; Staff</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-center">Before</th>
                  <th className="py-3 px-4 text-center">Added</th>
                  <th className="py-3 px-4 text-center">After</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4 text-right">Status / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-slate-900">{formatDmy(item.createdAt)}</div>
                      <div className="text-[11px] text-slate-500 font-sans flex items-center gap-1 mt-0.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>{item.user.name || "Cashier"} ({item.user.role})</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.product.name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{item.product.shortCode}</div>
                    </td>

                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {item.location.name}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                      {item.oldQty}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                      +{item.deltaQty}
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                      {item.newQty}
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium max-w-[200px] truncate">
                      {item.reason}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {item.reviewed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Reviewed</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleMarkReviewed(item.id)}
                          disabled={pendingId === item.id}
                          className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition disabled:opacity-50"
                        >
                          {pendingId === item.id ? "Saving..." : "Mark Reviewed"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
