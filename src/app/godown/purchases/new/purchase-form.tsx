"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordPurchaseAction, PurchaseActionResult } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PurchaseItemState {
  productId: string;
  qty: number;
  rateRupees: number;
  gstRateBp: number;
}

interface PurchaseFormProps {
  suppliers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  products: { id: string; name: string; shortCode: string; gstRateBp: number; mrpPaise: number }[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Recording GRN..." : "Confirm & Post Stock Receipt"}
    </button>
  );
}

export function PurchaseForm({ suppliers, locations, products }: PurchaseFormProps) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [locationId, setLocationId] = useState<string>(
    locations.find((l) => l.name.toLowerCase().includes("godown"))?.id || locations[0]?.id || ""
  );

  const [items, setItems] = useState<PurchaseItemState[]>([
    {
      productId: products[0]?.id || "",
      qty: 10,
      rateRupees: products[0] ? (products[0].mrpPaise * 0.7) / 100 : 50,
      gstRateBp: products[0]?.gstRateBp || 500,
    },
  ]);

  const [state, formAction] = useFormState<PurchaseActionResult | undefined, FormData>(
    async (prev, formData) => {
      const res = await recordPurchaseAction(prev, formData);
      if (res?.success) {
        router.push("/godown/purchases");
      }
      return res;
    },
    undefined
  );

  const handleProductChange = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        productId: prodId,
        gstRateBp: prod ? prod.gstRateBp : copy[index].gstRateBp,
        rateRupees: prod ? Math.round(prod.mrpPaise * 0.7) / 100 : copy[index].rateRupees,
      };
      return copy;
    });
  };

  const handleFieldChange = (index: number, field: keyof PurchaseItemState, value: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addItem = () => {
    const defaultProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: defaultProd?.id || "",
        qty: 10,
        rateRupees: defaultProd ? (defaultProd.mrpPaise * 0.7) / 100 : 50,
        gstRateBp: defaultProd?.gstRateBp || 500,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // Compute live totals
  let totalTaxableRupees = 0;
  let totalTaxRupees = 0;

  for (const it of items) {
    const lineTaxable = it.qty * it.rateRupees;
    const lineTax = (lineTaxable * it.gstRateBp) / 10000;
    totalTaxableRupees += lineTaxable;
    totalTaxRupees += lineTax;
  }
  const grandTotalRupees = totalTaxableRupees + totalTaxRupees;

  // Prepare submission payload
  const purchasePayload = {
    supplierId: supplierId || null,
    billNo,
    billDate,
    locationId,
    items: items.map((it) => ({
      productId: it.productId,
      qty: Number(it.qty),
      ratePaise: Math.round(Number(it.rateRupees) * 100),
      gstRateBp: Number(it.gstRateBp),
    })),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/godown/purchases"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Back to Purchases List
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Record Goods Receipt Note (GRN)</h2>
          <p className="text-sm text-gray-500">
            Confirm items received from supplier. Stock ledger will be updated immediately.
          </p>
        </div>

        {state?.error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {state.error}
          </div>
        )}

        {/* Invoice & Supplier Header */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50/75 rounded-lg border border-gray-100">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Supplier / Company
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">-- Direct / Unlisted Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Supplier Invoice / Bill No
            </label>
            <input
              type="text"
              required
              value={billNo}
              onChange={(e) => setBillNo(e.target.value)}
              placeholder="e.g. INV-2026-9921"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Bill Date
            </label>
            <input
              type="date"
              required
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
              Receiving Destination
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Received Product Line Items
            </h3>
            <button
              type="button"
              onClick={addItem}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              + Add Another Line
            </button>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 w-32 text-right">Quantity (Pcs)</th>
                  <th className="px-4 py-3 w-36 text-right">Purchase Rate (₹)</th>
                  <th className="px-4 py-3 w-28 text-center">GST Slab</th>
                  <th className="px-4 py-3 w-36 text-right">Line Total (₹)</th>
                  <th className="px-2 py-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((it, idx) => {
                  const lineTaxable = it.qty * it.rateRupees;
                  const lineTotal = lineTaxable * (1 + it.gstRateBp / 10000);

                  return (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <select
                          value={it.productId}
                          onChange={(e) => handleProductChange(idx, e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.shortCode})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={it.qty}
                          onChange={(e) => handleFieldChange(idx, "qty", parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={it.rateRupees}
                          onChange={(e) => handleFieldChange(idx, "rateRupees", parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="font-mono text-xs text-gray-700">
                          {(it.gstRateBp / 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-gray-900">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 text-sm font-bold"
                          >
                            ✕
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

        {/* Totals Summary */}
        <div className="flex justify-end">
          <div className="w-72 bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Value:</span>
              <span className="font-mono">₹{totalTaxableRupees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST Total:</span>
              <span className="font-mono">₹{totalTaxRupees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200 text-base">
              <span>Grand Total:</span>
              <span className="font-mono text-blue-700">₹{grandTotalRupees.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Hidden Form for Submission */}
        <form action={formAction}>
          <input type="hidden" name="purchaseData" value={JSON.stringify(purchasePayload)} />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Link
              href="/godown/purchases"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
