"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction } from "@/app/store/cart/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";

interface WholesaleClientProps {
  products: StoreProductItem[];
  categories: Array<{ id: string; name: string }>;
  isLoggedIn?: boolean;
  userName?: string;
  cartSummary?: {
    totalPieces: number;
    itemsCount: number;
    totalPaise: number;
    savingsPaise: number;
  };
}

interface SkuSlot {
  sku: string;
  qty: number;
}

export function WholesaleClient({
  products,
  categories,
  isLoggedIn = false,
  userName = "",
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0, savingsPaise: 0 },
}: WholesaleClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [tableQuantities, setTableQuantities] = useState<Record<string, number>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartState, setCartState] = useState(cartSummary);

  // Fast SKU Matrix slots (default 4 prefilled with popular product shortCodes)
  const defaultSkus = products.slice(0, 3).map((p) => p.shortCode);
  const [matrixSlots, setMatrixSlots] = useState<SkuSlot[]>([
    { sku: defaultSkus[0] || "", qty: 2 },
    { sku: defaultSkus[1] || "", qty: 4 },
    { sku: defaultSkus[2] || "", qty: 10 },
    { sku: "", qty: 1 },
  ]);

  const filteredProducts = products.filter((p) => {
    if (selectedCategory === "ALL") return true;
    return p.categoryId === selectedCategory;
  });

  const getRowQty = (p: StoreProductItem) => {
    return tableQuantities[p.id] ?? Math.max(1, p.packSize);
  };

  const setRowQty = (p: StoreProductItem, delta: number) => {
    const current = getRowQty(p);
    const updated = Math.max(1, current + delta);
    setTableQuantities((prev) => ({ ...prev, [p.id]: updated }));
  };

  const handleAddRowToCart = (p: StoreProductItem) => {
    const qty = getRowQty(p);
    const unitPrice = p.unitPricePaise || p.mrpPaise;

    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem("jmd_local_cart");
        const parsed = saved ? JSON.parse(saved) : {};
        parsed[p.id] = (parsed[p.id] || 0) + qty;
        window.localStorage.setItem("jmd_local_cart", JSON.stringify(parsed));
      } catch (e) {
        // ignore
      }
    }

    setCartState((prev) => ({
      totalPieces: prev.totalPieces + qty,
      itemsCount: prev.itemsCount + 1,
      totalPaise: prev.totalPaise + unitPrice * qty,
      savingsPaise: prev.savingsPaise + (p.mrpPaise - unitPrice) * qty,
    }));
    setToastMessage(`✓ Added ${qty}x ${p.name} to wholesale cart!`);
    setTimeout(() => setToastMessage(null), 3000);

    if (isLoggedIn) {
      startTransition(async () => {
        try {
          await addToCartAction(p.id, qty);
        } catch (e) {
          // ignore
        }
      });
    }
  };

  const handlePushMatrixToCart = () => {
    const validSlots = matrixSlots.filter((s) => s.sku.trim() && s.qty > 0);
    if (validSlots.length === 0) {
      alert("Please enter at least one valid product SKU and quantity.");
      return;
    }

    let addedCount = 0;
    let totalQty = 0;
    let totalAmountAddedPaise = 0;

    for (const slot of validSlots) {
      const found = products.find(
        (p) => p.shortCode.toLowerCase() === slot.sku.trim().toLowerCase()
      );
      if (found) {
        addedCount++;
        totalQty += slot.qty;
        totalAmountAddedPaise += (found.unitPricePaise || found.mrpPaise) * slot.qty;

        if (typeof window !== "undefined") {
          try {
            const saved = window.localStorage.getItem("jmd_local_cart");
            const parsed = saved ? JSON.parse(saved) : {};
            parsed[found.id] = (parsed[found.id] || 0) + slot.qty;
            window.localStorage.setItem("jmd_local_cart", JSON.stringify(parsed));
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (addedCount > 0) {
      setCartState((prev) => ({
        totalPieces: prev.totalPieces + totalQty,
        itemsCount: prev.itemsCount + addedCount,
        totalPaise: prev.totalPaise + totalAmountAddedPaise,
        savingsPaise: prev.savingsPaise + totalAmountAddedPaise * 0.15,
      }));
      setToastMessage(`✓ Added ${addedCount} SKU matrix items to wholesale cart!`);
      setTimeout(() => setToastMessage(null), 3500);

      if (isLoggedIn) {
        startTransition(async () => {
          for (const slot of validSlots) {
            const found = products.find(
              (p) => p.shortCode.toLowerCase() === slot.sku.trim().toLowerCase()
            );
            if (found) {
              await addToCartAction(found.id, slot.qty);
            }
          }
        });
      }
    } else {
      alert("None of the specified SKUs were matched. Please verify the SKU codes.");
    }
  };

  const handleApplyPreset = (presetName: string) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store/wholesale`);
      return;
    }

    // Pick top items according to preset
    const presetItems = products.slice(0, 4);
    if (presetItems.length === 0) return;

    startTransition(async () => {
      for (const item of presetItems) {
        await addToCartAction(item.id, item.packSize);
      }
      setToastMessage(`✓ Loaded ${presetName} bundle into wholesale cart!`);
      setTimeout(() => setToastMessage(null), 3500);
      router.refresh();
    });
  };

  // Delivery meter calculations (Threshold: ₹5,000)
  const freeThresholdPaise = 500000;
  const isFreeDelivery = cartState.totalPaise >= freeThresholdPaise;
  const progressPercent = Math.min(100, Math.round((cartState.totalPaise / freeThresholdPaise) * 100));
  const deficitPaise = Math.max(0, freeThresholdPaise - cartState.totalPaise);

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <StoreHeader
        cartCount={cartState.itemsCount}
        cartTotalRupees={Math.round(cartState.totalPaise / 100)}
        userName={userName}
        isLoggedIn={isLoggedIn}
        categories={categories}
        activeCategory="wholesale"
      />

      {/* Main Content Area - pb-32 on mobile ensures comfortable clearance above floating cart bar & bottom nav */}
      <main className="flex-1 w-full pt-48 md:pt-40 pb-32 sm:pb-24 md:pb-12 bg-surface">
        {/* B2B Strategic Banner & Credential Strip */}
        <section className="w-full bg-surface-container-low py-6 px-4 lg:px-8 border-b border-surface-container-high">
          <div className="max-w-[1280px] mx-auto">
            <div className="relative overflow-hidden bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-2xl p-6 lg:p-8 shadow-md">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 bg-on-primary/15 px-3 py-1 rounded-full text-secondary-fixed">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span className="text-xs uppercase tracking-wider font-bold">Saharsa Mandi Direct Supply Partner</span>
                  </div>
                  <h1 className="font-headline text-2xl lg:text-3xl leading-tight tracking-tight text-on-primary font-bold">
                    JMD Cart Wholesale Hub — Direct Distributor Pricing for Saharsa Retailers
                  </h1>
                  <p className="text-xs md:text-sm text-primary-fixed leading-relaxed">
                    Serving Kiranas, Tea Stalls, Sweetmakers & Caterers across Ward 1–20, Bangaon Road, & Kosi Basin. Same-day commercial tempo dispatch with 100% verified tax-compliant GST invoicing.
                  </p>
                </div>

                {/* Fast-Stat Badge Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-primary-fixed/10 p-4 rounded-xl backdrop-blur-sm shrink-0 border border-on-primary/10">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-secondary-fixed font-bold">GST Invoicing</span>
                    <span className="font-headline text-sm font-bold text-on-primary">100% ITC Claim</span>
                    <span className="text-[10px] text-primary-fixed">Instant GSTR-1 push</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-secondary-fixed font-bold">Saharsa Delivery</span>
                    <span className="font-headline text-sm font-bold text-on-primary">Free tempo ₹5k+</span>
                    <span className="text-[10px] text-primary-fixed">Within 3 hours dispatch</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex flex-col">
                    <span className="text-[11px] text-secondary-fixed font-bold">Payment Tiers</span>
                    <span className="font-headline text-sm font-bold text-on-primary">Cash / UPI / Khata</span>
                    <span className="text-[10px] text-primary-fixed">15-Day Merchant Credit</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Workflow: SKU Fast Matrix + Wholesale Table + Cart Dock */}
        <section className="w-full px-4 lg:px-8 py-6">
          <div className="max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Center & Left Stage: Matrix Entry & Dense Product Grid (9 cols) */}
            <div className="lg:col-span-9 flex flex-col gap-6">
              {/* Quick Order Matrix & SKU Fast-Paste Panel */}
              <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[24px]">electric_bolt</span>
                    <div>
                      <h2 className="text-sm md:text-base font-bold text-on-surface font-headline">Fast Reorder by Code or SKU</h2>
                      <p className="text-xs text-on-surface-variant">Instant matrix for daily store refills without browsing catalog</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMatrixSlots(matrixSlots.map(() => ({ sku: "", qty: 1 })))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-outline text-xs rounded-lg transition-colors font-medium"
                    >
                      Clear Matrix
                    </button>
                  </div>
                </div>

                {/* SKU Matrix Input Grid (Dynamic 4 slots) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {matrixSlots.map((slot, idx) => (
                    <div key={idx} className="bg-surface-container-low p-2.5 rounded-lg flex items-center justify-between gap-2 border border-surface-container-high">
                      <input
                        type="text"
                        placeholder="e.g. MDH-001"
                        value={slot.sku}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMatrixSlots((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], sku: val };
                            return next;
                          });
                        }}
                        className="w-2/3 bg-surface-container-lowest px-2 py-1 rounded text-xs text-on-surface uppercase font-semibold focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/40"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={slot.qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          setMatrixSlots((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], qty: val };
                            return next;
                          });
                        }}
                        className="w-1/3 bg-surface-container-lowest px-2 py-1 rounded text-xs text-on-surface text-center font-bold focus:outline-none focus:ring-1 focus:ring-primary border border-outline-variant/40"
                      />
                    </div>
                  ))}
                </div>

                {/* Bottom Action Row for Matrix */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 text-on-surface-variant text-xs">
                    <span className="material-symbols-outlined text-tertiary text-[18px]">info</span>
                    <span>Bulk SKUs automatically resolve into the highest tier wholesale slab savings.</span>
                  </div>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handlePushMatrixToCart}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/90 text-on-secondary px-5 py-2.5 rounded-lg text-xs font-bold shadow-sm transition-all"
                  >
                    <span className="material-symbols-outlined text-[18px]">playlist_add</span>
                    <span>{isPending ? "Adding SKUs..." : "Add Matrix Items to Cart"}</span>
                  </button>
                </div>
              </div>

              {/* High-Density Wholesale Product Table */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-high p-4 sm:p-5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-on-surface font-headline">Wholesale Stock Ledger & Slab Pricing</h3>
                      <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[11px] px-2 py-0.5 rounded-full font-bold">
                        Saharsa Central Mandi
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant">Live warehouse availability ready for loading from Purab Bazar Fulfillment Dock</p>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("ALL")}
                      className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedCategory === "ALL"
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                      }`}
                    >
                      All Wholesale
                    </button>
                    {categories.slice(0, 4).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                          selectedCategory === cat.id
                            ? "bg-primary text-on-primary"
                            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Table Responsive Container */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface text-xs font-bold border-b border-surface-container-high">
                        <th className="py-3 px-3 rounded-l-lg">Product Description</th>
                        <th className="py-3 px-3">Packaging / Unit</th>
                        <th className="py-3 px-2 text-center">MOQ</th>
                        <th className="py-3 px-3">Standard MRP</th>
                        <th className="py-3 px-3 bg-surface-container/60 text-secondary">Slab 1 (6–11)</th>
                        <th className="py-3 px-3 bg-tertiary-fixed/30 text-tertiary">Slab 2 (12+)</th>
                        <th className="py-3 px-2">Godown Stock</th>
                        <th className="py-3 px-3 text-center rounded-r-lg">Quantity / Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container-high text-xs font-body">
                      {filteredProducts.slice(0, 30).map((p) => {
                        const qty = getRowQty(p);
                        const mrp = Math.round(p.mrpPaise / 100);
                        const s1Rate = Math.round((p.mrpPaise * 0.92) / 100);
                        const s2Rate = Math.round((p.mrpPaise * 0.86) / 100);
                        const effectiveRate = qty >= 12 ? s2Rate : qty >= 6 ? s1Rate : mrp;
                        const rowTotal = effectiveRate * qty;

                        return (
                          <tr key={p.id} className="hover:bg-surface-container-low/50 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="w-10 h-10 object-contain rounded bg-surface-container flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary font-mono text-[10px] font-bold shrink-0">
                                    {p.shortCode.slice(0, 4)}
                                  </div>
                                )}
                                <div>
                                  <Link
                                    href={`/store/products/${p.id}`}
                                    className="font-bold text-on-surface hover:text-primary transition-colors block line-clamp-1"
                                  >
                                    {p.name}
                                  </Link>
                                  <div className="text-[11px] text-outline">
                                    {p.shortCode} • {p.companyName || "Standard FMCG"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3 font-medium text-on-surface">
                              {p.packSize} pcs / {p.packLabel}
                              <span className="text-outline text-[11px] block">{p.weight || "1 unit"}</span>
                            </td>
                            <td className="py-3.5 px-2 text-center font-bold text-on-surface">
                              1 {p.packLabel}
                            </td>
                            <td className="py-3.5 px-3 text-outline line-through">
                              ₹{mrp}
                            </td>
                            <td className="py-3.5 px-3 bg-surface-container-low/50 text-secondary font-bold">
                              ₹{s1Rate} /pc
                            </td>
                            <td className="py-3.5 px-3 bg-tertiary-fixed/20 text-tertiary font-bold">
                              ₹{s2Rate} /pc
                              <div className="text-[10px] text-tertiary font-semibold">Save ₹{mrp - s2Rate}/pc</div>
                            </td>
                            <td className="py-3.5 px-2">
                              {p.isAvailable ? (
                                <span className="inline-flex items-center gap-1 text-tertiary font-bold text-[11px]">
                                  <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                                  {p.totalAvailableQty} units
                                </span>
                              ) : (
                                <span className="text-error font-semibold text-[11px]">Restocking</span>
                              )}
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="flex items-center bg-surface-container rounded-lg p-0.5 shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => setRowQty(p, -1)}
                                    className="w-6 h-6 flex items-center justify-center text-primary hover:bg-surface-container-high rounded font-bold"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min="1"
                                    value={qty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value) || 1;
                                      setTableQuantities((prev) => ({ ...prev, [p.id]: Math.max(1, val) }));
                                    }}
                                    className="w-10 text-center bg-transparent font-bold text-on-surface focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setRowQty(p, 1)}
                                    className="w-6 h-6 flex items-center justify-center text-primary hover:bg-surface-container-high rounded font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  disabled={isPending || !p.isAvailable}
                                  onClick={() => handleAddRowToCart(p)}
                                  className="w-full bg-primary hover:bg-primary-container text-on-primary py-1 px-2 rounded text-[11px] font-bold shadow-sm flex items-center justify-center gap-1"
                                >
                                  <span>+ Add</span>
                                  <span className="opacity-80">₹{rowTotal}</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Saharsa Verified Merchant Credit Policy Box */}
              <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-on-surface font-headline">Saharsa Verified Merchant Credit Policy</h3>
                    <span className="bg-secondary text-on-secondary text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Khata Scheme
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant max-w-xl leading-relaxed">
                    Up to <strong className="text-on-surface">15 Days Zero-Interest Merchant Credit Terms</strong> available for registered shops, kiranas, and halwais with active GST or Saharsa Vyapar Mandal credentials.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-on-surface">
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                      Minimum Order: ₹5,000
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                      Free Truck/Tempo in Saharsa
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
                      Instant WhatsApp PDF Invoice
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
                  <a
                    href="https://wa.me/916278223400?text=I%20want%20wholesale%20credit%20terms%20for%20my%20Saharsa%20shop"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-tertiary hover:bg-tertiary-container text-on-tertiary px-4 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat</span>
                    Chat with Credit Manager
                  </a>
                </div>
              </div>
            </div>

            {/* Right Stage: Saved Order Lists & Live Cart Dock (3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-6 lg:sticky lg:top-40">
              {/* Saved Order Templates */}
              <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">bookmarks</span>
                    <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider font-headline">Saved Order Lists</h3>
                  </div>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Click to populate your wholesale cart with recurring merchant shop baskets.
                </p>

                {/* Preset 1 */}
                <div
                  onClick={() => handleApplyPreset("Weekly Kirana Restock")}
                  className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-1.5 hover:bg-surface-container transition-colors cursor-pointer border border-surface-container-high"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Weekly Kirana Restock</span>
                    <span className="bg-secondary-fixed text-on-secondary-fixed text-[10px] px-2 py-0.2 rounded-full font-bold">
                      14 Items
                    </span>
                  </div>
                  <p className="text-[11px] text-outline">Atta (10kg), Mustard Oil (15L), Rice, Spices</p>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-bold text-primary font-mono">Est. ₹18,450</span>
                    <span className="text-secondary font-bold text-[11px] flex items-center gap-0.5">
                      Load Preset →
                    </span>
                  </div>
                </div>

                {/* Preset 2 */}
                <div
                  onClick={() => handleApplyPreset("Morning Tea Stall Slabs")}
                  className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-1.5 hover:bg-surface-container transition-colors cursor-pointer border border-surface-container-high"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Morning Tea Stall Slabs</span>
                    <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] px-2 py-0.2 rounded-full font-bold">
                      6 Items
                    </span>
                  </div>
                  <p className="text-[11px] text-outline">Tata Tea Gold, Sugar 50kg bag, Bikaji cartons</p>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-bold text-primary font-mono">Est. ₹8,920</span>
                    <span className="text-secondary font-bold text-[11px] flex items-center gap-0.5">
                      Load Preset →
                    </span>
                  </div>
                </div>

                {/* Preset 3 */}
                <div
                  onClick={() => handleApplyPreset("Halwai & Sweetmaker Batch")}
                  className="p-3 bg-surface-container-low rounded-xl flex flex-col gap-1.5 hover:bg-surface-container transition-colors cursor-pointer border border-surface-container-high"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-on-surface">Halwai / Sweetmaker Batch</span>
                    <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-2 py-0.2 rounded-full font-bold">
                      9 Items
                    </span>
                  </div>
                  <p className="text-[11px] text-outline">Ghee 15L tin, Maida 50kg, Elaichi, Refined Oil</p>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="font-bold text-primary font-mono">Est. ₹34,200</span>
                    <span className="text-secondary font-bold text-[11px] flex items-center gap-0.5">
                      Load Preset →
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Wholesale Cart / Dispatch Status Summary */}
              <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-surface-container-high flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-on-surface uppercase tracking-wider font-headline">Wholesale Cart Dock</h3>
                  <span className="material-symbols-outlined text-outline text-[20px]">local_mall</span>
                </div>

                {/* Free Delivery Meter */}
                <div className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 border border-surface-container-high">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-on-surface font-bold">Tempo Delivery Tier</span>
                    <span className={isFreeDelivery ? "text-tertiary font-bold" : "text-secondary font-bold"}>
                      {isFreeDelivery ? "FREE (Unlocked)" : `Add ₹${Math.round(deficitPaise / 100)} more`}
                    </span>
                  </div>
                  <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-tertiary h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">
                    {isFreeDelivery
                      ? "✓ Order qualifies for free commercial tempo dispatch at your shop in Saharsa."
                      : `Wholesale orders above ₹5,000 get free tempo unloading across Saharsa wards.`}
                  </p>
                </div>

                {/* Itemized Breakdown Mini-List */}
                <div className="space-y-2 text-xs text-on-surface-variant pt-1 border-t border-surface-container">
                  <div className="flex justify-between">
                    <span>Active Wholesale Items</span>
                    <span className="font-bold text-on-surface">{cartState.itemsCount} lines ({cartState.totalPieces} pcs)</span>
                  </div>
                  <div className="flex justify-between text-tertiary font-medium">
                    <span>Wholesale Slab Savings</span>
                    <span>- ₹{Math.round(cartState.savingsPaise / 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saharsa Town Unloading</span>
                    <span className="text-tertiary font-bold">{isFreeDelivery ? "FREE" : "₹150"}</span>
                  </div>
                  <div className="pt-2 flex justify-between text-sm text-on-surface font-bold border-t border-surface-container">
                    <span>Net Payable</span>
                    <span className="text-primary font-bold font-mono">
                      ₹{Math.round(cartState.totalPaise / 100)}
                    </span>
                  </div>
                </div>

                <Link
                  href="/store/checkout"
                  className="w-full py-3 bg-primary hover:bg-primary-container text-on-primary font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm text-center"
                >
                  <span>Proceed to Wholesale Checkout</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <StoreFooter />
    </div>
  );
}
