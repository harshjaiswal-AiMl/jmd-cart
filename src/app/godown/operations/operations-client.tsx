"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  transferStockAction,
  cartonBreakAction,
  recordDamageAction,
  adjustStockAction,
  OperationActionResult,
} from "./actions";

interface OperationsClientProps {
  locations: { id: string; name: string }[];
  products: { id: string; name: string; shortCode: string; packSize: number; packLabel: string }[];
}

function ActionButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Executing..." : label}
    </button>
  );
}

export function OperationsClient({ locations, products }: OperationsClientProps) {
  const [activeTab, setActiveTab] = useState<"transfer" | "break" | "damage" | "adjust">("transfer");

  const [transferState, transferFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    transferStockAction,
    undefined
  );
  const [breakState, breakFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    cartonBreakAction,
    undefined
  );
  const [damageState, damageFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    recordDamageAction,
    undefined
  );
  const [adjustState, adjustFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    adjustStockAction,
    undefined
  );

  const godownLoc = locations.find((l) => l.name.toLowerCase().includes("godown")) || locations[0];
  const shopLoc = locations.find((l) => l.name.toLowerCase().includes("shop")) || locations[1];

  const [breakProdId, setBreakProdId] = useState(products[0]?.id || "");
  const [cartons, setCartons] = useState(5);
  const selectedBreakProd = products.find((p) => p.id === breakProdId) || products[0];

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex gap-2 overflow-x-auto shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("transfer")}
          className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "transfer"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Inter-Location Transfer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("break")}
          className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "break"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Carton Break (Godown → Shop)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("damage")}
          className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "damage"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Record Damage / Spoilage
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("adjust")}
          className={`py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "adjust"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          Manual Adjustment
        </button>
      </div>

      {/* Tab 1: Inter-Location Transfer */}
      {activeTab === "transfer" && (
        <form action={transferFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Transfer Stock Between Locations</h3>
            <p className="text-sm text-gray-500">Move inventory between Godown, Shop, or Sales Vans in pieces.</p>
          </div>

          {transferState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{transferState.error}</div>
          )}
          {transferState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Stock transferred successfully!</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <select name="productId" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.shortCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Source Location (From)</label>
              <select name="fromLocationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Destination Location (To)</label>
              <select name="toLocationId" defaultValue={shopLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Quantity (Pieces)</label>
              <input type="number" name="qty" min="1" defaultValue={10} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Reason / Reference Note</label>
              <input type="text" name="reason" placeholder="e.g. Regular shop restocking" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Transfer Stock" />
          </div>
        </form>
      )}

      {/* Tab 2: Carton Break */}
      {activeTab === "break" && (
        <form action={breakFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Carton Break (Godown → Shop Loose)</h3>
            <p className="text-sm text-gray-500">
              Unpack cartons stored at Godown into loose units available for retail sale at the Shop.
            </p>
          </div>

          {breakState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{breakState.error}</div>
          )}
          {breakState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Cartons broken into pieces successfully!</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <select
                name="productId"
                value={breakProdId}
                onChange={(e) => setBreakProdId(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Pack: {p.packSize} pcs/{p.packLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Source (Godown)</label>
              <select name="fromLocationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value={godownLoc?.id}>{godownLoc?.name}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Destination (Shop)</label>
              <select name="toLocationId" defaultValue={shopLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value={shopLoc?.id}>{shopLoc?.name}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Number of Cartons to Break
              </label>
              <input
                type="number"
                name="cartons"
                min="1"
                value={cartons}
                onChange={(e) => setCartons(parseInt(e.target.value, 10) || 1)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-700 block uppercase font-semibold">Total Loose Pieces Added to Shop</span>
                <span className="text-xl font-bold text-blue-900 font-mono">
                  {cartons * (selectedBreakProd?.packSize || 1)} pieces
                </span>
              </div>
              <span className="text-xs text-blue-600 font-mono">
                {cartons} x {selectedBreakProd?.packSize || 1}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Break Cartons" />
          </div>
        </form>
      )}

      {/* Tab 3: Damage / Spoilage */}
      {activeTab === "damage" && (
        <form action={damageFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Record Damage / Spoilage</h3>
            <p className="text-sm text-gray-500">Deduct ruined, broken, or spoiled goods from inventory with justification.</p>
          </div>

          {damageState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{damageState.error}</div>
          )}
          {damageState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Damage recorded and stock deducted.</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <select name="productId" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.shortCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Location</label>
              <select name="locationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Damaged Quantity (Pieces)</label>
              <input type="number" name="qty" min="1" defaultValue={1} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Damage Reason</label>
              <input type="text" name="reason" required placeholder="e.g. Water leak, transit breakage, rodents" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Deduct Damaged Stock" />
          </div>
        </form>
      )}

      {/* Tab 4: Manual Adjustment */}
      {activeTab === "adjust" && (
        <form action={adjustFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Manual Stock Adjustment</h3>
            <p className="text-sm text-gray-500">Correct discrepancies found outside formal stock audits (+ to add, - to subtract).</p>
          </div>

          {adjustState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{adjustState.error}</div>
          )}
          {adjustState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Stock adjusted successfully!</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <select name="productId" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.shortCode})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Location</label>
              <select name="locationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Adjustment Quantity (+/- Pieces)
              </label>
              <input type="number" name="adjustmentQty" placeholder="+5 or -3" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              <p className="mt-1 text-xs text-gray-500">Positive number increases stock; negative number decreases stock.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Reason</label>
              <input type="text" name="reason" required placeholder="e.g. Packing discrepancy count correction" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Apply Adjustment" />
          </div>
        </form>
      )}
    </div>
  );
}
