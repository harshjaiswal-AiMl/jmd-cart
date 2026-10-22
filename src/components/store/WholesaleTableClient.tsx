"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";

interface WholesaleTableClientProps {
  products: StoreProductItem[];
}

export function WholesaleTableClient({ products }: WholesaleTableClientProps) {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [addingState, setAddingState] = useState<Record<string, boolean>>({});

  // Categories extraction for filter chips
  const categories = Array.from(
    new Set(products.map((p) => p.categoryName).filter(Boolean) as string[])
  );

  const filteredProducts =
    selectedCategory === "ALL"
      ? products
      : products.filter((p) => p.categoryName === selectedCategory);

  const getQty = (p: StoreProductItem) => {
    return quantities[p.id] !== undefined ? quantities[p.id] : Math.max(1, p.packSize);
  };

  const handleQtyChange = (p: StoreProductItem, delta: number) => {
    const current = getQty(p);
    const next = Math.max(1, current + delta);
    setQuantities((prev) => ({ ...prev, [p.id]: next }));
  };

  const calculateRowPrice = (p: StoreProductItem, qty: number) => {
    const mrp = p.mrpPaise / 100;
    let unitPrice = (p.unitPricePaise ?? p.mrpPaise) / 100;

    if (p.slabs && p.slabs.length > 0) {
      const slab = [...p.slabs].sort((a, b) => b.minQty - a.minQty).find((s) => qty >= s.minQty);
      if (slab) {
        unitPrice = slab.unitPricePaise / 100;
      }
    }

    return {
      unitPrice,
      total: unitPrice * qty,
      savings: Math.max(0, (mrp - unitPrice) * qty),
    };
  };

  const handleAddToCart = async (p: StoreProductItem) => {
    const qty = getQty(p);
    setAddingState((prev) => ({ ...prev, [p.id]: true }));
    try {
      const res = await fetch("/api/store/v1/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: p.id, quantity: qty }),
      });
      if (res.ok) {
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAddingState((prev) => ({ ...prev, [p.id]: false }));
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/20 p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-on-surface">
              Wholesale Stock Ledger &amp; Slab Pricing
            </h2>
            <span className="bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold px-2.5 py-0.5 rounded-full">
              Saharsa Central Godown
            </span>
          </div>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            Live warehouse stock available for dock dispatch at Purab Bazar, Saharsa.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory("ALL")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              selectedCategory === "ALL"
                ? "bg-primary text-on-primary shadow-sm"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            }`}
          >
            All Products ({products.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-on-primary shadow-sm"
                  : "bg-surface-container text-on-surface hover:bg-surface-container-high"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface text-xs font-bold uppercase tracking-wider">
              <th className="py-3.5 px-4 rounded-l-xl">Product Description</th>
              <th className="py-3.5 px-3">Packaging</th>
              <th className="py-3.5 px-3 text-right">Standard Rate</th>
              <th className="py-3.5 px-3 text-right bg-surface-container/60">Wholesale Slab Rate</th>
              <th className="py-3.5 px-3 text-center">Godown Stock</th>
              <th className="py-3.5 px-4 text-center rounded-r-xl">Quantity / Add</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15 text-sm">
            {filteredProducts.map((p) => {
              const qty = getQty(p);
              const { unitPrice, total, savings } = calculateRowPrice(p, qty);
              const isAdding = addingState[p.id];

              return (
                <tr key={p.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-surface-container-low shrink-0 flex items-center justify-center p-1 overflow-hidden">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="material-symbols-outlined text-outline">inventory_2</span>
                        )}
                      </div>
                      <div>
                        <Link
                          href={`/product/${p.slug || p.id}`}
                          className="font-bold text-on-surface hover:text-primary transition-colors leading-tight line-clamp-1"
                        >
                          {p.name}
                        </Link>
                        <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-0.5">
                          {p.companyName && <span>{p.companyName}</span>}
                          <span>•</span>
                          <span className="font-mono">HSN: {p.hsn}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-4 px-3 text-xs text-on-surface">
                    <span className="font-semibold">{p.weight || p.packLabel}</span>
                    <div className="text-on-surface-variant text-[11px]">
                      {p.packSize > 1 ? `Box of ${p.packSize}` : "Single Unit"}
                    </div>
                  </td>

                  <td className="py-4 px-3 text-right">
                    <span className="text-outline line-through text-xs font-mono block">
                      ₹{(p.mrpPaise / 100).toFixed(2)}
                    </span>
                    <span className="font-bold text-on-surface font-mono">
                      ₹{((p.unitPricePaise ?? p.mrpPaise) / 100).toFixed(2)}
                    </span>
                  </td>

                  <td className="py-4 px-3 text-right bg-surface-container/30">
                    <span className="font-bold text-primary font-mono text-base block">
                      ₹{unitPrice.toFixed(2)}
                    </span>
                    {savings > 0 && (
                      <span className="text-[10px] text-tertiary font-bold block">
                        Save ₹{savings.toFixed(0)} total
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-3 text-center">
                    {p.isAvailable ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-tertiary">
                        <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                        {p.totalAvailableQty} Units
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-error">Out of stock</span>
                    )}
                  </td>

                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="flex items-center bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/30">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(p, -1)}
                          className="w-7 h-7 flex items-center justify-center text-primary font-bold hover:bg-surface-container rounded"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-mono font-bold text-xs text-on-surface">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(p, 1)}
                          className="w-7 h-7 flex items-center justify-center text-primary font-bold hover:bg-surface-container rounded"
                        >
                          +
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        disabled={!p.isAvailable || isAdding}
                        className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary-container disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                        {isAdding ? "..." : "Add"}
                      </button>
                    </div>
                    <div className="text-[11px] font-mono font-bold text-primary mt-1">
                      Total: ₹{total.toFixed(2)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
