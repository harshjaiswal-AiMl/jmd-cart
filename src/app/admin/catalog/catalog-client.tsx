"use client";

import { useState } from "react";
import { ProductWithDetails } from "@/modules/catalog/catalog.types";
import { createProductAction, CatalogActionResult } from "./actions";
import { useFormState, useFormStatus } from "react-dom";

interface CatalogClientProps {
  initialProducts: ProductWithDetails[];
  companies: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Saving..." : "Save Product"}
    </button>
  );
}

export function CatalogClient({
  initialProducts,
  companies,
  categories,
}: CatalogClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [createState, formAction] = useFormState<CatalogActionResult | undefined, FormData>(
    async (prev, formData) => {
      const res = await createProductAction(prev, formData);
      if (res?.success) {
        setIsAddOpen(false);
      }
      return res;
    },
    undefined
  );

  const filteredProducts = initialProducts.filter((product) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      product.name.toLowerCase().includes(term) ||
      product.shortCode.toLowerCase().includes(term) ||
      (product.company?.name && product.company.name.toLowerCase().includes(term));

    const matchesCompany = !selectedCompany || product.companyId === selectedCompany;
    const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;

    return matchesSearch && matchesCompany && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Top Controls: Search, Filters, Add Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by product name, short code, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              🔍
            </div>
          </div>

          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() => setIsAddOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Add New Master Product</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            {createState?.error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {createState.error}
              </div>
            )}

            <form action={formAction} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product Name</label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Bikaji Bhujia 400g"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Short Code (Unique)</label>
                  <input
                    type="text"
                    name="shortCode"
                    required
                    placeholder="e.g. BIK-BHUJ-400G"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Company / Brand</label>
                  <select
                    name="companyId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Select Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Category</label>
                  <select
                    name="categoryId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">HSN Code (4-8 digits)</label>
                  <input
                    type="text"
                    name="hsn"
                    required
                    placeholder="21069099"
                    maxLength={8}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">GST Slab</label>
                  <select
                    name="gstRateBp"
                    defaultValue={1200}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={500}>5%</option>
                    <option value={1200}>12%</option>
                    <option value={1800}>18%</option>
                    <option value={2800}>28%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">MRP (in ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    name="mrpRupees"
                    required
                    placeholder="120.00"
                    min="0.01"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Pack Size (Pieces/Carton)</label>
                  <input
                    type="number"
                    name="packSize"
                    defaultValue={24}
                    min={1}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Pack Label</label>
                  <input
                    type="text"
                    name="packLabel"
                    defaultValue="Carton"
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Reorder Alert Level (Pcs)</label>
                  <input
                    type="number"
                    name="reorderLevel"
                    defaultValue={48}
                    min={0}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
          <span className="text-sm font-medium text-gray-700">
            Showing {filteredProducts.length} of {initialProducts.length} products
          </span>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">No products found matching your search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Product / Short Code</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">MRP (₹)</th>
                  <th className="px-4 py-3 text-right">Pack Size</th>
                  <th className="px-4 py-3">HSN (GST)</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div>{p.name}</div>
                      <div className="text-xs font-mono text-gray-500">{p.shortCode}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.company?.name || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{p.category?.name || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      ₹{(p.mrpPaise / 100).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.packSize} pcs / {p.packLabel}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {p.hsn} ({(p.gstRateBp / 100).toFixed(0)}%)
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </span>
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
