"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";
import { addToCartAction } from "@/app/store/cart/actions";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";
import { FloatingCartBar } from "@/components/store/FloatingCartBar";

interface ProductDetailClientProps {
  product: StoreProductItem;
  relatedProducts: StoreProductItem[];
  categories: Array<{ id: string; name: string }>;
  isLoggedIn?: boolean;
  userName?: string;
  cartSummary?: {
    totalPieces: number;
    itemsCount: number;
    totalPaise: number;
  };
}

export function ProductDetailClient({
  product,
  relatedProducts = [],
  categories = [],
  isLoggedIn = false,
  userName = "",
  cartSummary = { totalPieces: 0, itemsCount: 0, totalPaise: 0 },
}: ProductDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedQty, setSelectedQty] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartState, setCartState] = useState(cartSummary);

  const packSize = Math.max(1, product.packSize);
  const mrpRupees = (product.mrpPaise / 100).toFixed(0);

  // Dynamic Slab Calculation:
  // Base slab 1 (Retail 1-3), Slab 2 (Kirana 4-9), Slab 3 (Mandi 10+)
  const slab1DiscountBp = product.slabs[0]?.discountBp || 500;
  const slab2DiscountBp = product.slabs[1]?.discountBp || 1000;
  const slab3DiscountBp = product.slabs[2]?.discountBp || 1500;

  const getSlabDiscountBp = (qty: number) => {
    if (qty >= 10) return slab3DiscountBp;
    if (qty >= 4) return slab2DiscountBp;
    return slab1DiscountBp;
  };

  const currentDiscountBp = getSlabDiscountBp(selectedQty);
  const unitSellingPaise = Math.round((product.mrpPaise * (10000 - currentDiscountBp)) / 10000);
  const unitSellingRupees = (unitSellingPaise / 100).toFixed(0);
  const totalAmountPaise = unitSellingPaise * selectedQty;
  const totalAmountRupees = (totalAmountPaise / 100).toFixed(0);
  const perUnitSavingsRupees = ((product.mrpPaise - unitSellingPaise) / 100).toFixed(0);

  const s1Rate = Math.round((product.mrpPaise * (10000 - slab1DiscountBp)) / 10000 / 100);
  const s2Rate = Math.round((product.mrpPaise * (10000 - slab2DiscountBp)) / 10000 / 100);
  const s3Rate = Math.round((product.mrpPaise * (10000 - slab3DiscountBp)) / 10000 / 100);

  const handleAddToCart = (qtyToAdd: number) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store/products/${product.id}`);
      return;
    }

    startTransition(async () => {
      const res = await addToCartAction(product.id, qtyToAdd);
      if (res.success) {
        setCartState((prev) => ({
          totalPieces: prev.totalPieces + qtyToAdd,
          itemsCount: prev.itemsCount + 1,
          totalPaise: prev.totalPaise + unitSellingPaise * qtyToAdd,
        }));
        setToastMessage(`✓ Added ${qtyToAdd}x ${product.name} to wholesale cart!`);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert(res.error || "Failed to add to cart");
      }
    });
  };

  const handleRelatedQuickAdd = (p: StoreProductItem) => {
    if (!isLoggedIn) {
      router.push(`/login?callbackUrl=/store/products/${product.id}`);
      return;
    }

    startTransition(async () => {
      const res = await addToCartAction(p.id, 1);
      if (res.success) {
        setCartState((prev) => ({
          totalPieces: prev.totalPieces + 1,
          itemsCount: prev.itemsCount + 1,
          totalPaise: prev.totalPaise + (p.unitPricePaise || p.mrpPaise),
        }));
        setToastMessage(`✓ Added ${p.name} to cart!`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    });
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface antialiased flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-4 z-50 bg-tertiary text-on-tertiary px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in text-sm font-semibold border border-tertiary-fixed">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Stitch Header */}
      <StoreHeader
        cartCount={cartState.itemsCount}
        cartTotalRupees={Math.round(cartState.totalPaise / 100)}
        userName={userName}
        isLoggedIn={isLoggedIn}
        categories={categories}
        activeCategory={product.categoryId || ""}
      />

      <main className="flex-1 w-full pt-36 bg-surface">
        {/* Dynamic Saharsa Mandi Notification Strip */}
        <div className="w-full bg-secondary-fixed/40 border-b border-secondary-fixed/60 text-on-secondary-fixed px-4 py-2 text-center">
          <div className="max-w-[1280px] mx-auto flex items-center justify-center gap-2 text-xs md:text-sm font-semibold">
            <span className="material-symbols-outlined text-[18px] text-secondary">store</span>
            <span>Saharsa Purab Bazar Mandi Rate Active: Real-time wholesale price updated today at 09:30 AM</span>
            <span
              className="hidden md:inline font-bold underline cursor-pointer ml-1 text-primary hover:text-primary-container"
              onClick={() => {
                document.getElementById("wholesale-slabs-section")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              View 10+ Unit Slabs
            </span>
          </div>
        </div>

        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 py-6 w-full space-y-8">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-on-surface-variant overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">home</span>Home
            </Link>
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <Link href="/store" className="hover:text-primary transition-colors">
              Catalogue
            </Link>
            {product.categoryName && (
              <>
                <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
                <Link
                  href={`/store?category=${product.categoryId}`}
                  className="hover:text-primary transition-colors"
                >
                  {product.categoryName}
                </Link>
              </>
            )}
            <span className="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <span className="text-on-surface font-semibold truncate max-w-xs">{product.name}</span>
          </nav>

          {/* Main Two-Column Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* LEFT COLUMN: Packshot Gallery & Quality Assurance (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container-high relative flex flex-col items-center">
                {/* Badges on Preview */}
                <div className="w-full flex items-center justify-between z-10 mb-2">
                  <span className="bg-tertiary text-on-tertiary px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                    100% Genuine FMCG
                  </span>
                  <span className="bg-surface-container-high text-primary text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">local_shipping</span> 30 Mins Saharsa
                  </span>
                </div>

                {/* Main Hero Packshot Container */}
                <div className="relative w-full aspect-square bg-surface-container-low rounded-lg overflow-hidden flex items-center justify-center p-6 group">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-outline-variant">
                      <span className="material-symbols-outlined text-7xl text-primary/40 mb-2">inventory_2</span>
                      <span className="text-xs font-bold uppercase tracking-wider text-outline font-mono">
                        {product.shortCode}
                      </span>
                      {product.companyName && (
                        <span className="text-sm font-semibold text-on-surface-variant mt-1">
                          {product.companyName}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Live Central Depot Availability */}
                <div className="mt-3 w-full bg-tertiary-fixed/30 rounded-lg p-2.5 flex items-center gap-2 border border-tertiary-fixed/40">
                  <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${product.isAvailable ? "bg-tertiary animate-pulse" : "bg-error"}`}></span>
                  <span className="text-xs text-tertiary font-medium">
                    <strong>In Stock:</strong> Saharsa Central Godown - Bay 4 (
                    <span className="font-bold">{product.totalAvailableQty.toLocaleString()} units</span> ready for tempo loading)
                  </span>
                </div>

                {/* Pack Info Pills */}
                <div className="grid grid-cols-2 gap-2 mt-3 w-full text-xs text-on-surface-variant">
                  <div className="bg-surface-container-low p-2 rounded text-center">
                    <span className="text-outline text-[11px] block">Unit Weight / Vol</span>
                    <strong className="text-on-surface">{product.weight || "Standard Pack"}</strong>
                  </div>
                  <div className="bg-surface-container-low p-2 rounded text-center">
                    <span className="text-outline text-[11px] block">Master Packaging</span>
                    <strong className="text-on-surface">{packSize} pcs / {product.packLabel}</strong>
                  </div>
                </div>
              </div>

              {/* Trust & Mandi Assurance Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-[24px] mb-1">verified</span>
                  <span className="text-xs font-bold text-on-surface">Direct Mill</span>
                  <span className="text-[11px] text-on-surface-variant leading-tight">100% Genuine</span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-[24px] mb-1">verified_user</span>
                  <span className="text-xs font-bold text-on-surface">Fresh Batch</span>
                  <span className="text-[11px] text-on-surface-variant leading-tight">QC Inspected</span>
                </div>
                <div className="bg-surface-container-lowest rounded-xl p-3 text-center shadow-sm border border-surface-container-high flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-tertiary text-[24px] mb-1">sync</span>
                  <span className="text-xs font-bold text-on-surface">Saharsa Assured</span>
                  <span className="text-[11px] text-on-surface-variant leading-tight">Zero Moisture Swap</span>
                </div>
              </div>

              {/* Kirana Wholesaler Notice Box */}
              <div className="bg-primary-fixed/30 border border-primary-fixed rounded-xl p-4 text-on-primary-fixed">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-[22px] shrink-0 mt-0.5">receipt_long</span>
                  <div>
                    <h4 className="text-sm font-bold text-primary font-headline">Saharsa Kirana & Caterer B2B Billing</h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Buying for retail grocery store, wedding catering, or hotel pantry in Saharsa? Add your GSTIN at checkout to receive automated e-Way bills and 100% GSTR-3B Input Tax Credit.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Details, Pack Variants, Slab Pricing & Action (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-5">
              {/* Header Info */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {product.companyName && (
                    <span className="text-xs font-bold text-primary tracking-wider uppercase">
                      {product.companyName}
                    </span>
                  )}
                  <span className="text-outline text-xs">•</span>
                  <span className="text-xs text-on-surface-variant">HSN: {product.hsn}</span>
                  <span className="text-outline text-xs">•</span>
                  <span className="bg-surface-container-high text-on-surface text-[11px] px-2 py-0.5 rounded font-semibold">
                    SKU: {product.shortCode}
                  </span>
                </div>

                <h1 className="font-headline text-2xl lg:text-3xl text-on-surface font-bold tracking-tight mt-1">
                  {product.name}
                </h1>

                <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                  Authentic FMCG staple direct from manufacturer stockists. Standard packing: {packSize} units per {product.packLabel}. Fast delivery across Saharsa Town Ward 1–20.
                </p>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded text-xs font-bold">
                    <span className="material-symbols-outlined text-[15px] text-tertiary">star</span>
                    <span className="text-tertiary">4.9</span>
                  </div>
                  <span className="text-xs text-on-surface-variant underline cursor-pointer">
                    Saharsa Merchant Rating
                  </span>
                  <span className="text-outline text-xs">•</span>
                  <span className="text-xs text-tertiary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span> 100% Original Guarantee
                  </span>
                </div>
              </div>

              {/* Packaging Format Selector Tabs */}
              <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-surface-container-high">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-bold text-on-surface">Select Packaging Unit / Size:</span>
                  <span className="text-xs font-bold text-secondary">Wholesale Slabs Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Option 1: 1 Piece */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(1)}
                    className={`relative text-left p-3 rounded-lg border transition-all ${
                      selectedQty < packSize
                        ? "bg-primary-fixed/20 border-primary shadow-sm"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-on-surface">Single Unit</div>
                        <div className="text-[11px] text-on-surface-variant">{product.weight || "Standard"}</div>
                      </div>
                      {selectedQty < packSize && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s1Rate} <span className="text-xs text-outline line-through ml-1">₹{mrpRupees}</span>
                    </div>
                  </button>

                  {/* Option 2: 1 Carton */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(packSize)}
                    className={`relative text-left p-3 rounded-lg border transition-all ${
                      selectedQty >= packSize && selectedQty < packSize * 4
                        ? "bg-primary-fixed/20 border-primary shadow-sm"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <span className="absolute -top-2 right-2 bg-secondary text-on-secondary px-1.5 py-0.2 rounded text-[10px] font-bold">
                      Kirana Pack
                    </span>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-on-surface">1 Full {product.packLabel}</div>
                        <div className="text-[11px] text-on-surface-variant">{packSize} pieces</div>
                      </div>
                      {selectedQty >= packSize && selectedQty < packSize * 4 && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s2Rate} <span className="text-[11px] text-on-surface-variant font-normal">/pc</span>
                    </div>
                  </button>

                  {/* Option 3: Bulk 10+ Units */}
                  <button
                    type="button"
                    onClick={() => setSelectedQty(Math.max(10, packSize * 2))}
                    className={`relative text-left p-3 rounded-lg border transition-all ${
                      selectedQty >= 10
                        ? "bg-primary-fixed/20 border-primary shadow-sm"
                        : "bg-surface-container-low border-transparent hover:bg-surface-container"
                    }`}
                  >
                    <span className="absolute -top-2 right-2 bg-tertiary text-on-tertiary px-1.5 py-0.2 rounded text-[10px] font-bold">
                      Mandi Slab
                    </span>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-on-surface">Bulk Wholesale</div>
                        <div className="text-[11px] text-on-surface-variant">10+ units / Bora</div>
                      </div>
                      {selectedQty >= 10 && (
                        <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2 text-sm font-bold text-primary font-mono">
                      ₹{s3Rate} <span className="text-[11px] text-on-surface-variant font-normal">/pc</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Dynamic Price Block */}
              <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-headline text-3xl text-primary font-bold">
                    ₹{unitSellingRupees}
                  </span>
                  <span className="text-base text-outline line-through">MRP ₹{mrpRupees}</span>
                  {Number(perUnitSavingsRupees) > 0 && (
                    <span className="bg-secondary-fixed text-on-secondary-fixed text-xs px-2.5 py-1 rounded-full font-bold">
                      Save ₹{perUnitSavingsRupees}/unit (Instant JMD Mandi Discount)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
                  <span>Inclusive of all taxes</span>
                  <span className="text-outline">•</span>
                  <span className="text-tertiary font-semibold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                    {(product.gstRateBp / 100).toFixed(0)}% GST Included (Input Tax Credit Eligible)
                  </span>
                </div>

                {/* Wholesale Slab Discount Matrix */}
                <div className="mt-2 pt-3 border-t border-surface-container" id="wholesale-slabs-section">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-secondary text-[20px]">layers</span>
                      <span className="text-sm font-bold text-on-surface">Wholesale Volume Slabs:</span>
                    </div>
                    <span className="text-xs text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded font-bold">
                      Kirana & Commercial Slabs
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Tier 1 */}
                    <div
                      className={`p-2.5 rounded-lg border transition-all ${
                        selectedQty < 4
                          ? "bg-primary-fixed/30 border-primary"
                          : "bg-surface-container-low border-transparent"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-on-surface">1 – 3 Units</span>
                        <span className="text-[11px] text-outline">Retail</span>
                      </div>
                      <div className="text-sm font-bold text-primary font-mono">₹{s1Rate} <span className="text-xs font-normal text-on-surface-variant">/ unit</span></div>
                      <span className="text-[11px] text-on-surface-variant">Standard Retail</span>
                    </div>

                    {/* Tier 2 */}
                    <div
                      className={`p-2.5 rounded-lg border transition-all ${
                        selectedQty >= 4 && selectedQty < 10
                          ? "bg-primary-fixed/30 border-primary"
                          : "bg-surface-container-low border-transparent"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-on-surface">4 – 9 Units</span>
                        <span className="text-[11px] text-secondary font-bold">Kirana Restock</span>
                      </div>
                      <div className="text-sm font-bold text-secondary font-mono">₹{s2Rate} <span className="text-xs font-normal text-on-surface-variant">/ unit</span></div>
                      <span className="text-[11px] text-on-surface-variant">Save ₹{Number(mrpRupees) - s2Rate}/unit</span>
                    </div>

                    {/* Tier 3 */}
                    <div
                      className={`p-2.5 rounded-lg border transition-all ${
                        selectedQty >= 10
                          ? "bg-primary-fixed/30 border-primary"
                          : "bg-surface-container-low border-transparent"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-on-surface">10+ Units / Bora</span>
                        <span className="text-[11px] text-tertiary font-bold">Mandi Rate</span>
                      </div>
                      <div className="text-sm font-bold text-tertiary font-mono">₹{s3Rate} <span className="text-xs font-normal text-on-surface-variant">/ unit</span></div>
                      <span className="text-[11px] text-tertiary font-bold">Lowest Mandi Slab</span>
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Cart Call to Action */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
                  {/* Stepper Container */}
                  <div className="flex items-center justify-between bg-surface-container-low rounded-lg p-1 w-full sm:w-36 shrink-0 border border-surface-container-high">
                    <button
                      type="button"
                      onClick={() => setSelectedQty((prev) => Math.max(1, prev - 1))}
                      className="w-9 h-9 flex items-center justify-center rounded bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-sm font-bold text-lg"
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={product.totalAvailableQty || 500}
                      value={selectedQty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        setSelectedQty(Math.max(1, Math.min(val, product.totalAvailableQty || 500)));
                      }}
                      className="w-12 text-center bg-transparent font-mono text-base text-on-surface font-bold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedQty((prev) => Math.min(product.totalAvailableQty || 500, prev + 1))}
                      className="w-9 h-9 flex items-center justify-center rounded bg-surface-container-lowest text-primary hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-sm font-bold text-lg"
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  {/* Primary Add to Cart Action */}
                  <button
                    type="button"
                    disabled={isPending || !product.isAvailable}
                    onClick={() => handleAddToCart(selectedQty)}
                    className="flex-1 bg-primary hover:bg-primary-container text-on-primary font-bold text-sm py-3 px-5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isPending ? "hourglass_top" : "shopping_cart"}
                    </span>
                    <span>{isPending ? "Adding..." : "Add to Cart"}</span>
                    <span className="text-primary-fixed opacity-70">•</span>
                    <span className="font-mono">₹{totalAmountRupees}</span>
                  </button>

                  {/* Quick Bulk Preset Button */}
                  <button
                    type="button"
                    disabled={isPending || !product.isAvailable}
                    onClick={() => {
                      setSelectedQty(10);
                      handleAddToCart(10);
                    }}
                    className="bg-secondary-container hover:bg-secondary text-on-secondary-container hover:text-on-secondary text-xs font-bold py-3 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">inventory_2</span>
                    <span>1-Tap 10 Units</span>
                  </button>
                </div>

                {/* Bulk WhatsApp Desk Button */}
                <div className="pt-1 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <a
                    href={`https://wa.me/916278223400?text=Namaste%2C%20I%20want%20to%20order%20bulk%20${encodeURIComponent(product.name)}%20in%20Saharsa`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-tertiary font-bold hover:underline"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    Need 20+ Bags or Truckload? Chat with Saharsa Grain Desk
                  </a>
                  <span className="text-on-surface-variant font-medium">Free tempo delivery above ₹2,000</span>
                </div>
              </div>

              {/* Saharsa Local Fulfillment Strip */}
              <div className="bg-surface-container-low rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm border border-surface-container-high">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-[22px]">local_shipping</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-on-surface">Delivering from Saharsa Central Godown (Bay 4)</div>
                    <div className="text-[11px] text-on-surface-variant">Ward 1 to 20, DB Road, Purab Bazar, Naya Bazar, Bariyahi Mandi</div>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs font-bold text-tertiary flex items-center sm:justify-end gap-1">
                    <span className="material-symbols-outlined text-[16px]">schedule</span> Today by 6:00 PM
                  </div>
                  <div className="text-[11px] text-outline">Tempo Loading Slot Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Product Deep-Dive & Wholesale Specifications (Tabs Section) */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-surface-container-high">
            {/* Tab Headers */}
            <div className="flex items-center gap-2 border-b border-surface-container-high overflow-x-auto pb-2">
              {[
                { title: "Product Specs & Quality", icon: "check_circle" },
                { title: "Bulk Packaging & Logistics", icon: "inventory_2" },
                { title: "Saharsa Kirana Khata & Commercial Billing", icon: "account_balance" },
                { title: "FSSAI & AGMARK Standards", icon: "verified" },
              ].map((tab, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  className={`text-xs font-bold px-4 py-2.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === idx
                      ? "text-primary bg-primary-fixed/30 border border-primary-fixed"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  <span>{tab.title}</span>
                </button>
              ))}
            </div>

            {/* Tab Content 0: Product Specs */}
            {activeTab === 0 && (
              <div className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-on-surface font-headline">
                      100% Genuine Direct Supply: {product.name}
                    </h3>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Sourced directly from certified FMCG manufacturing plants and central milling facilities. Packaged under rigorous humidity-controlled standards to maintain peak aroma, taste, and freshness across the Bihar Kosi climate.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-surface-container-low p-3 rounded-lg">
                        <span className="text-[10px] text-outline uppercase font-bold">Brand & Origin</span>
                        <div className="text-xs font-bold text-primary mt-1">{product.companyName || "Standard FMCG"}</div>
                        <div className="text-[11px] text-on-surface-variant">Direct authorized distribution</div>
                      </div>
                      <div className="bg-surface-container-low p-3 rounded-lg">
                        <span className="text-[10px] text-outline uppercase font-bold">Storage Purity</span>
                        <div className="text-xs font-bold text-tertiary mt-1">Sealed Depot Storage</div>
                        <div className="text-[11px] text-on-surface-variant">Elevated pallet godown racks</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-surface-container-low rounded-xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                      Highlights for Kiranas & Commercial Kitchens
                    </h4>
                    <ul className="space-y-2 text-xs text-on-surface-variant">
                      <li className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                        <span><strong>Authentic FMCG Seal:</strong> Zero moisture adulteration or package tampering guarantee.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                        <span><strong>Standard Weight:</strong> Every unit is calibrated and checked before gate-pass issuance.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5">check_circle</span>
                        <span><strong>Immediate Restock:</strong> Live synchronized inventory directly tied to Saharsa Central Godown stock ledgers.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 1: Bulk Packaging */}
            {activeTab === 1 && (
              <div className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-lg">
                    <div className="text-[10px] text-outline font-bold uppercase">HSN CODE</div>
                    <div className="text-sm font-bold text-on-surface font-mono mt-1">{product.hsn}</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">
                      GST Rate: {(product.gstRateBp / 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg">
                    <div className="text-[10px] text-outline font-bold uppercase">MASTER PACK SIZE</div>
                    <div className="text-sm font-bold text-on-surface mt-1">{packSize} pcs / {product.packLabel}</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">Outer corrugated carton / poly sack</div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg">
                    <div className="text-[10px] text-outline font-bold uppercase">GODOWN STOCK</div>
                    <div className="text-sm font-bold text-tertiary mt-1 font-mono">
                      {product.godownCartonsCount} {product.packLabel}s ({product.godownLooseQty} loose)
                    </div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">Central Godown Bay 4</div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg">
                    <div className="text-[10px] text-outline font-bold uppercase">DISPATCH MODE</div>
                    <div className="text-sm font-bold text-on-surface mt-1">Tempo / Pickup</div>
                    <div className="text-[11px] text-on-surface-variant mt-0.5">3-Wheel Electric Tempo</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 2: Kirana Khata & Commercial Billing */}
            {activeTab === 2 && (
              <div className="pt-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-primary font-headline">
                      JMD Cart Commercial Credit & Kirana Khata
                    </h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Approved restaurants, caterers, and retail grocery stores in Saharsa town (Purab Bazar, Station Road, Mahavir Chowk, Shankarpur) can activate 7–15 day credit terms on recurring wholesale weekly orders.
                    </p>
                    <div className="flex items-center gap-3">
                      <Link
                        href="/store/wholesale"
                        className="inline-flex items-center gap-1.5 bg-primary text-on-primary text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary-container transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">badge</span>
                        Apply for Wholesale Credit
                      </Link>
                    </div>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-lg space-y-2">
                    <h4 className="text-xs font-bold text-on-surface">Transit Replacement Guarantee</h4>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      Every carton is inspected before leaving Bay 4. If any stitching tear, transit rupture, or leak is discovered during delivery unloading at your shop, our delivery pilot completes an instant on-the-spot replacement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content 3: FSSAI & AGMARK */}
            {activeTab === 3 && (
              <div className="pt-6 space-y-3 text-xs text-on-surface-variant">
                <p>
                  <strong>Manufacturer / Brand:</strong> {product.companyName || "Authorized National FMCG Packager"}
                </p>
                <p>
                  <strong>Local Saharsa Stockist:</strong> JMD Commercial Staples Depot, Bay 4 Rail Goods Yard, Purab Bazar, Saharsa, Bihar - 852201 (FSSAI Lic: 20422119000412)
                </p>
                <p>
                  <strong>Country of Origin:</strong> 100% Indian FMCG Origin. Direct warehouse stock.
                </p>
                <p>
                  <strong>GST Compliance:</strong> GSTIN compliant tax invoice generated with SAC/HSN: {product.hsn}.
                </p>
              </div>
            )}
          </div>

          {/* Related Staples & Cross-Sells Section */}
          {relatedProducts.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-headline text-xl text-on-surface font-bold">
                    Frequently Bought Together
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Wholesale items frequently ordered together by Saharsa retailers and caterers.
                  </p>
                </div>
                <Link
                  href="/store"
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View All Catalogue <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {relatedProducts.map((rel) => {
                  const relMrp = (rel.mrpPaise / 100).toFixed(0);
                  const relPrice = ((rel.unitPricePaise || rel.mrpPaise) / 100).toFixed(0);
                  const relSavings = Number(relMrp) - Number(relPrice);

                  return (
                    <div
                      key={rel.id}
                      className="bg-surface-container-lowest rounded-xl p-3 shadow-sm border border-surface-container-high hover:shadow-md transition-shadow flex flex-col justify-between group"
                    >
                      <div>
                        <Link href={`/store/products/${rel.id}`} className="block relative w-full aspect-square bg-surface-container-low rounded-lg p-2 overflow-hidden mb-2">
                          {relSavings > 0 && (
                            <span className="absolute top-2 left-2 bg-secondary text-on-secondary text-[10px] px-1.5 py-0.2 rounded font-bold z-10">
                              Save ₹{relSavings}
                            </span>
                          )}
                          {rel.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={rel.imageUrl}
                              alt={rel.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-3xl mb-1 text-primary/40">shopping_basket</span>
                              <span className="text-[10px] font-mono">{rel.shortCode}</span>
                            </div>
                          )}
                        </Link>

                        <div className="text-[11px] text-outline font-medium truncate">
                          {rel.companyName || "JMD Cart"} • {rel.weight || "1 unit"}
                        </div>
                        <h3 className="text-xs font-bold text-on-surface line-clamp-1 mt-0.5">
                          <Link href={`/store/products/${rel.id}`} className="hover:text-primary transition-colors">
                            {rel.name}
                          </Link>
                        </h3>
                      </div>

                      <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-primary font-mono">₹{relPrice}</div>
                          {relSavings > 0 && (
                            <div className="text-[11px] text-outline line-through">₹{relMrp}</div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRelatedQuickAdd(rel)}
                          className="bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary text-xs px-3 py-1.5 rounded transition-colors font-bold"
                        >
                          + ADD
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Floating Cart Bar (Appears when items are in cart) */}
      <FloatingCartBar
        totalPieces={cartState.totalPieces}
        totalRupees={Math.round(cartState.totalPaise / 100)}
        savingsRupees={Math.round(cartState.totalPaise * 0.15 / 100)}
      />

      {/* Stitch Footer */}
      <StoreFooter />
    </div>
  );
}
