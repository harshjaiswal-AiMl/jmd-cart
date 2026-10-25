"use client";

import Link from "next/link";
import { SplitPickLists } from "@/modules/order/order.types";

interface PickListClientViewProps {
  pickLists: SplitPickLists;
  orderId: string;
}

export function PickListClientView({ pickLists, orderId }: PickListClientViewProps) {
  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      {/* Controls Bar (Hidden during printing) */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/admin/orders/${orderId}`}
          className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
        >
          ← Back to Order #{pickLists.orderNumber}
        </Link>

        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
        >
          <span>🖨️ Print Split Pick Lists</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Summary Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-300 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Fulfilment Pick Sheet
              </span>
              <h1 className="text-2xl font-black text-slate-900 font-mono mt-1">
                Order #{pickLists.orderNumber}
              </h1>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-semibold text-slate-800">{pickLists.customerName}</span> ({pickLists.customerPhone})
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-1">
              <div>
                <span className="text-slate-400">Destination:</span>{" "}
                <span className="font-semibold text-slate-800">{pickLists.deliveryZoneName}</span>
              </div>
              <div className="text-slate-500 font-mono">
                {new Date(pickLists.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-700">Delivery Address:</span> {pickLists.deliveryAddress}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex gap-6 text-xs font-bold">
            <div className="text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
              Godown Full Packs: {pickLists.totalCartons} Cartons
            </div>
            <div className="text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
              Shop Loose Pieces: {pickLists.totalLoosePieces} Pieces
            </div>
          </div>
        </div>

        {/* 1. GODOWN PICK LIST: Full cartons/packs */}
        <div className="bg-white rounded-2xl border-2 border-purple-200 overflow-hidden shadow-sm">
          <div className="bg-purple-700 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏭</span>
              <div>
                <h2 className="text-sm font-black tracking-wide uppercase">
                  1. Central Godown Pick List (Full Unbroken Cartons / Bags)
                </h2>
                <p className="text-[11px] text-purple-200">
                  Pick whole factory packaging from Godown floor
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-1 rounded-md">
              {pickLists.godownPackPicks.length} Lines • {pickLists.totalCartons} Cartons
            </span>
          </div>

          {pickLists.godownPackPicks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No full carton packs in this order. Fulfilled completely from shop loose inventory.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-purple-50 text-purple-900 font-bold uppercase tracking-wider border-b border-purple-100">
                  <tr>
                    <th className="p-3 w-10 text-center">Done</th>
                    <th className="p-3">Product Name & Short Code</th>
                    <th className="p-3 text-center">Pack Size</th>
                    <th className="p-3 text-center">Cartons to Pick</th>
                    <th className="p-3 text-right">Total Units</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {pickLists.godownPackPicks.map((item, idx) => (
                    <tr key={idx} className="hover:bg-purple-50/40">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{item.productName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{item.shortCode}</span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {item.packSize} pcs / ctn
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-900 font-black rounded-lg text-xs font-mono">
                          {item.cartonsCount} {item.cartonsCount === 1 ? "Carton" : "Cartons"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800">
                        {item.qty} pcs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 bg-purple-50/50 border-t border-purple-100 flex justify-between items-center text-[11px] text-purple-800">
            <span>Picker Signature: _________________________</span>
            <span>Godown Location Verified ✓</span>
          </div>
        </div>

        {/* 2. SHOP PICK LIST: Loose pieces */}
        <div className="bg-white rounded-2xl border-2 border-blue-200 overflow-hidden shadow-sm">
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏪</span>
              <div>
                <h2 className="text-sm font-black tracking-wide uppercase">
                  2. Shop Counter Pick List (Loose Broken Pieces)
                </h2>
                <p className="text-[11px] text-blue-100">
                  Pick loose piece counts from Shop shelves / counter racks
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-white/20 px-2.5 py-1 rounded-md">
              {pickLists.shopLoosePicks.length} Lines • {pickLists.totalLoosePieces} Pieces
            </span>
          </div>

          {pickLists.shopLoosePicks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No loose pieces in this order. Fulfilled completely in full factory cartons.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-blue-50 text-blue-900 font-bold uppercase tracking-wider border-b border-blue-100">
                  <tr>
                    <th className="p-3 w-10 text-center">Done</th>
                    <th className="p-3">Product Name & Short Code</th>
                    <th className="p-3 text-center">Pack Size</th>
                    <th className="p-3 text-right">Loose Pieces to Pick</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50">
                  {pickLists.shopLoosePicks.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/40">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 block">{item.productName}</span>
                        <span className="font-mono text-[11px] text-slate-500">{item.shortCode}</span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {item.packSize} pcs / ctn
                      </td>
                      <td className="p-3 text-right font-mono font-black text-blue-700 text-sm">
                        {item.looseCount} pcs
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-3 bg-blue-50/50 border-t border-blue-100 flex justify-between items-center text-[11px] text-blue-800">
            <span>Picker Signature: _________________________</span>
            <span>Shop Shelves Count Verified ✓</span>
          </div>
        </div>

        {/* Combined Fulfilment Sign-off */}
        <div className="bg-white p-5 rounded-xl border border-slate-300 text-xs text-slate-600 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <span className="font-bold block text-slate-800">Dispatch Staging Bay:</span>
            <span>Assemble Godown Cartons + Shop Loose polybags at Loading Dock #1 for Van Delivery.</span>
          </div>
          <div className="text-right">
            <span>Dispatcher Sign-off: _________________________</span>
          </div>
        </div>
      </div>
    </div>
  );
}
