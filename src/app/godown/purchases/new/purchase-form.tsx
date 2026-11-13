"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordPurchaseAction, PurchaseActionResult } from "../actions";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import { QuickAddProductModal } from "@/components/pos/QuickAddProductModal";
import { EditProductMasterModal } from "@/components/pos/EditProductMasterModal";
import { searchItems } from "@/lib/search/smart-search";

interface PurchaseItemState {
  productId: string;
  qty: number;
  rateRupees: number;
  mrpRupees: number;
  gstRateBp: number;
}

interface SupplierItem {
  id: string;
  name: string;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
}

interface ProductItem {
  id: string;
  name: string;
  shortCode: string;
  gstRateBp: number;
  mrpPaise: number;
  companyId?: string | null;
  company?: { id: string; name: string } | null;
  packSize?: number;
}

interface PurchaseFormProps {
  suppliers: SupplierItem[];
  locations: { id: string; name: string }[];
  products: ProductItem[];
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

// Searchable Product Combobox Component for GRN Lines
function ProductCombobox({
  products,
  value,
  onChange,
}: {
  products: ProductItem[];
  value: string;
  onChange: (productId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedProduct = products.find((p) => p.id === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchableProducts = useMemo(() => {
    return products.map((p) => ({
      ...p,
      brand: p.company?.name,
    }));
  }, [products]);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 50);
    return searchItems(query, searchableProducts, { limit: 50 });
  }, [searchableProducts, query, products]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-left text-xs bg-white flex items-center justify-between shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <span className="truncate">
          {selectedProduct ? (
            <span className="font-medium text-gray-900">
              <span className="font-bold font-mono text-blue-900 mr-1.5">
                {selectedProduct.shortCode}
              </span>
              {selectedProduct.name}
              {selectedProduct.company?.name && (
                <span className="text-gray-400 text-[10px] ml-1">
                  ({selectedProduct.company.name})
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">Select product...</span>
          )}
        </span>
        <span className="text-gray-400 text-[10px] ml-1">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-[480px] max-w-[90vw] bg-white border border-gray-200 rounded-xl shadow-2xl p-3 space-y-2">
          <input
            type="text"
            placeholder="Search by product name, code, brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            autoFocus
          />

          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto rounded-lg border border-gray-100">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-500 p-4 text-center">
                No matching products found
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={`w-full text-left p-2.5 hover:bg-blue-50/80 transition-colors ${
                    p.id === value ? "bg-blue-50 font-bold border-l-4 border-blue-600" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-blue-900 font-bold">
                      {p.shortCode}
                    </span>
                    <span className="text-xs text-gray-600 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                      MRP ₹{((p.mrpPaise ?? 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{p.name}</div>
                  {p.company?.name && (
                    <div className="text-xs text-gray-500 mt-0.5">Brand: {p.company.name}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function PurchaseForm({ suppliers, locations, products }: PurchaseFormProps) {
  const router = useRouter();

  const [supplierId, setSupplierId] = useState<string>(suppliers[0]?.id || "");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editMasterProduct, setEditMasterProduct] = useState<any | null>(null);
  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);



  const handleCellKeyDown = (e: React.KeyboardEvent, rowIdx: number, field: "qty" | "rate" | "mrp" | "gst") => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (field === "qty") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-rate"]`)?.focus();
      } else if (field === "rate") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-mrp"]`)?.focus();
      } else if (field === "mrp") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-gst"]`)?.focus();
      } else if (field === "gst") {
        if (rowIdx === items.length - 1) {
          addItem();
          setTimeout(() => {
            document.querySelector<HTMLElement>(`[data-cell="${rowIdx + 1}-qty"]`)?.focus();
          }, 50);
        } else {
          document.querySelector<HTMLElement>(`[data-cell="${rowIdx + 1}-qty"]`)?.focus();
        }
      }
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (field === "gst") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-mrp"]`)?.focus();
      } else if (field === "mrp") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-rate"]`)?.focus();
      } else if (field === "rate") {
        document.querySelector<HTMLElement>(`[data-cell="${rowIdx}-qty"]`)?.focus();
      }
    }
  };

  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [locationId, setLocationId] = useState<string>(
    locations.find((l) => l.name.toLowerCase().includes("godown"))?.id || locations[0]?.id || ""
  );

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Filter products by selected supplier's brand unless "showAllProducts" is checked
  const availableProducts = useMemo(() => {
    if (showAllProducts || !selectedSupplier?.companyId) {
      return products;
    }
    const brandProducts = products.filter((p) => p.companyId === selectedSupplier.companyId);
    return brandProducts.length > 0 ? brandProducts : products;
  }, [products, selectedSupplier, showAllProducts]);

  const [items, setItems] = useState<PurchaseItemState[]>([
    {
      productId: availableProducts[0]?.id || products[0]?.id || "",
      qty: 10,
      rateRupees: availableProducts[0] ? Math.round(availableProducts[0].mrpPaise * 0.7) / 100 : 50,
      mrpRupees: availableProducts[0] ? (availableProducts[0].mrpPaise / 100) : 0,
      gstRateBp: availableProducts[0]?.gstRateBp || 500,
    },
  ]);

  // Global Alt+N and Alt+M hotkeys for GRN
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.code === "KeyN" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        setShowQuickAdd(true);
      } else if (e.altKey && (e.code === "KeyM" || e.key.toLowerCase() === "m")) {
        e.preventDefault();
        const curItem = items[activeRowIdx];
        if (curItem) {
          const curProd = products.find((p) => p.id === curItem.productId);
          if (curProd) setEditMasterProduct(curProd);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeRowIdx, items, products]);

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
        mrpRupees: prod ? (prod.mrpPaise / 100) : copy[index].mrpRupees,
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
    const defaultProd = availableProducts[0] || products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: defaultProd?.id || "",
        qty: 10,
        rateRupees: defaultProd ? Math.round(defaultProd.mrpPaise * 0.7) / 100 : 50,
        mrpRupees: defaultProd ? (defaultProd.mrpPaise / 100) : 0,
        gstRateBp: defaultProd?.gstRateBp || 500,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "-- Direct / Unlisted Supplier --", subLabel: "No linked party" },
      ...suppliers.map((s) => ({
        value: s.id,
        label: s.name,
        subLabel: s.company?.name ? `Brand: ${s.company.name}` : undefined,
        badge: s.companyId ? "Brand Supplier" : undefined,
        badgeColor: s.companyId ? ("blue" as const) : undefined,
      })),
    ],
    [suppliers]
  );

  // Reactive line totals
  const lineDetails = items.map((it) => {
    const taxable = it.qty * it.rateRupees;
    const tax = taxable * (it.gstRateBp / 10000);
    return {
      taxable,
      tax,
      total: taxable + tax,
    };
  });

  const grandTaxable = lineDetails.reduce((sum, l) => sum + l.taxable, 0);
  const grandTax = lineDetails.reduce((sum, l) => sum + l.tax, 0);
  const grandTotal = grandTaxable + grandTax;

  const payload = {
    supplierId: supplierId || null,
    billNo,
    billDate,
    locationId,
    items: items.map((it) => ({
      productId: it.productId,
      qty: Number(it.qty),
      ratePaise: Math.round(Number(it.rateRupees) * 100),
      mrpPaise: Math.round(Number(it.mrpRupees) * 100),
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
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Supplier / Brand
              </label>
              {selectedSupplier?.companyId && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                  Brand Supplier
                </span>
              )}
            </div>

            <div className="mt-1">
              <SearchableSelect
                options={supplierOptions}
                value={supplierId}
                onChange={(val) => setSupplierId(val)}
                placeholder="-- Direct / Unlisted Supplier --"
                searchPlaceholder="Search supplier or brand name..."
                popoverWidthClass="w-full min-w-[320px]"
                autoSortInStock={false}
              />
            </div>
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
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white font-medium"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Product Items Table with Searchable Combobox */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold text-gray-900">Items Received</h3>
              {selectedSupplier?.companyId && (
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showAllProducts}
                    onChange={(e) => setShowAllProducts(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Show all catalog products (ignore brand filter)</span>
                </label>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const cur = items[activeRowIdx];
                  const curProd = products.find((p) => p.id === cur?.productId);
                  if (curProd) setEditMasterProduct(curProd);
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 flex items-center gap-1 cursor-pointer"
                title="Edit Master Product [Alt+M]"
              >
                <span>Edit Product [Alt+M]</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-300 flex items-center gap-1 cursor-pointer"
                title="Quick Add New Product [Alt+N]"
              >
                <span>+ New Product [Alt+N]</span>
              </button>
              <button
                type="button"
                onClick={addItem}
                className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 cursor-pointer"
              >
                + Add Another Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-xl min-h-[360px] pb-36">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Product (Searchable)</th>
                  <th className="px-4 py-3 w-28 text-right">Qty (Pcs)</th>
                  <th className="px-4 py-3 w-32 text-right">Rate (₹)</th>
                  <th className="px-4 py-3 w-32 text-right">MRP (₹)</th>
                  <th className="px-4 py-3 w-28 text-center">GST Slab</th>
                  <th className="px-4 py-3 w-32 text-right">Line Total (₹)</th>
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
                        <ProductCombobox
                          products={availableProducts}
                          value={it.productId}
                          onChange={(prodId) => handleProductChange(idx, prodId)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="1"
                          data-cell={`${idx}-qty`}
                          value={it.qty}
                          onFocus={() => setActiveRowIdx(idx)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "qty")}
                          onChange={(e) =>
                            handleFieldChange(idx, "qty", parseInt(e.target.value, 10) || 1)
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-bold"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          data-cell={`${idx}-rate`}
                          value={it.rateRupees}
                          onFocus={() => setActiveRowIdx(idx)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "rate")}
                          onChange={(e) =>
                            handleFieldChange(idx, "rateRupees", parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            data-cell={`${idx}-mrp`}
                            value={it.mrpRupees}
                            onFocus={() => setActiveRowIdx(idx)}
                            onKeyDown={(e) => handleCellKeyDown(e, idx, "mrp")}
                            onChange={(e) =>
                              handleFieldChange(idx, "mrpRupees", parseFloat(e.target.value) || 0)
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right font-mono"
                          />
                          <div className="flex items-center gap-1 mt-0.5">
                            {(() => {
                              const prod = products.find((p) => p.id === it.productId);
                              const isChanged = prod && it.mrpRupees > 0 && Math.round(it.mrpRupees * 100) !== prod.mrpPaise;
                              const isRateOverMrp = it.mrpRupees > 0 && it.rateRupees > it.mrpRupees;
                              return (
                                <>
                                  {isChanged && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-amber-100 text-amber-800">
                                      changed
                                    </span>
                                  )}
                                  {isRateOverMrp && (
                                    <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-rose-100 text-rose-700">
                                      Rate &gt; MRP!
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <select
                          data-cell={`${idx}-gst`}
                          value={it.gstRateBp}
                          onFocus={() => setActiveRowIdx(idx)}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, "gst")}
                          onChange={(e) =>
                            handleFieldChange(idx, "gstRateBp", parseInt(e.target.value, 10))
                          }
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white"
                        >
                          <option value="0">0%</option>
                          <option value="500">5%</option>
                          <option value="1200">12%</option>
                          <option value="1800">18%</option>
                          <option value="2800">28%</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right font-mono font-medium text-gray-900">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="text-red-500 hover:text-red-700 font-bold p-1"
                            title="Remove Line"
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
        <div className="flex justify-end p-4 bg-gray-50 rounded-lg">
          <div className="w-64 space-y-2 text-sm text-right">
            <div className="flex justify-between text-gray-600">
              <span>Taxable Subtotal:</span>
              <span className="font-mono">₹{grandTaxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>GST Total:</span>
              <span className="font-mono">₹{grandTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>Grand Total:</span>
              <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <form action={formAction}>
          <input type="hidden" name="purchaseData" value={JSON.stringify(payload)} />
          <input type="hidden" name="payload" value={JSON.stringify(payload)} />
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
