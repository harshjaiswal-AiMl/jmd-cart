"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StoreProductItem } from "@/modules/store/store.service";

interface ProductDetailClientProps {
  product: StoreProductItem;
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const router = useRouter();
  const allImages = product.images && product.images.length > 0
    ? product.images.map((img) => img.url)
    : product.imageUrl
    ? [product.imageUrl]
    : [];

  const [selectedImage, setSelectedImage] = useState(allImages[0] || "/brand/placeholder.png");
  const [qty, setQty] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [addedToast, setAddedToast] = useState(false);

  // Calculate price based on selected qty & slabs
  const unitPrice = (product.unitPricePaise ?? product.mrpPaise) / 100;
  const mrp = product.mrpPaise / 100;

  // Find active slab for the selected qty
  let activeUnitPrice = unitPrice;
  let activeSavingsPerUnit = mrp - unitPrice;
  if (product.slabs && product.slabs.length > 0) {
    const applicableSlab = [...product.slabs]
      .sort((a, b) => b.minQty - a.minQty)
      .find((s) => qty >= s.minQty);
    if (applicableSlab) {
      activeUnitPrice = applicableSlab.unitPricePaise / 100;
      activeSavingsPerUnit = mrp - activeUnitPrice;
    }
  }

  const totalPrice = activeUnitPrice * qty;
  const totalSavings = activeSavingsPerUnit * qty;

  const handleQtyChange = (delta: number) => {
    setQty((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (product.totalAvailableQty > 0 && next > product.totalAvailableQty) {
        return product.totalAvailableQty;
      }
      return next;
    });
  };

  const handleSlabClick = (minQty: number) => {
    setQty(minQty);
  };

  const addToCart = async (redirectCheckout: boolean = false) => {
    if (!product.isAvailable) return;
    setIsAdding(true);
    try {
      const res = await fetch("/api/store/v1/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          qty,
          quantity: qty,
        }),
      });

      if (res.ok) {
        window.dispatchEvent(new Event("cart-updated"));
        if (redirectCheckout) {
          router.push("/checkout");
        } else {
          setAddedToast(true);
          setTimeout(() => setAddedToast(false), 3000);
        }
      }
    } catch (e) {
      console.error("Failed to add to cart", e);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleWishlist = async () => {
    try {
      const method = isWishlisted ? "DELETE" : "POST";
      const res = await fetch("/api/store/v1/wishlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (res.ok) {
        setIsWishlisted(!isWishlisted);
        window.dispatchEvent(new Event("wishlist-updated"));
      }
    } catch (e) {
      console.error("Failed to toggle wishlist", e);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
      {/* Toast Notification */}
      {addedToast && (
        <div className="fixed top-20 right-4 z-50 bg-primary text-on-primary px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-green-300">check_circle</span>
          <div>
            <div className="font-bold text-sm">Added {qty} item(s) to Cart!</div>
            <Link href="/cart" className="text-xs text-secondary-container underline">
              View Cart &amp; Checkout →
            </Link>
          </div>
        </div>
      )}

      {/* Left: Product Media Gallery (5 cols) */}
      <div className="lg:col-span-5 flex flex-col gap-4">
        <div className="relative aspect-square w-full rounded-2xl bg-surface-container-low border border-outline-variant/30 overflow-hidden flex items-center justify-center p-6 shadow-sm group">
          {/* Badges */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
            {product.isAvailable ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary text-on-tertiary text-xs font-bold shadow-sm">
                <span className="material-symbols-outlined text-sm">speed</span>
                30 Mins Dispatch
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error text-on-error text-xs font-bold shadow-sm">
                Out of Stock
              </span>
            )}

            {mrp > unitPrice && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold shadow-sm">
                {Math.round(((mrp - unitPrice) / mrp) * 100)}% OFF
              </span>
            )}
          </div>

          {/* Wishlist Button */}
          <button
            onClick={toggleWishlist}
            aria-label="Save to Wishlist"
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-surface-container-lowest/90 backdrop-blur-sm text-on-surface hover:text-primary flex items-center justify-center shadow-md transition-colors"
          >
            <span className={`material-symbols-outlined text-xl ${isWishlisted ? "text-error fill-current" : ""}`}>
              {isWishlisted ? "favorite" : "favorite_border"}
            </span>
          </button>

          {/* Main Packshot */}
          <img
            src={selectedImage}
            alt={product.name}
            className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        {/* Thumbnail Strip */}
        {allImages.length > 1 && (
          <div className="flex items-center gap-3 overflow-x-auto pb-2">
            {allImages.map((imgUrl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedImage(imgUrl)}
                className={`relative w-20 h-20 rounded-xl bg-surface-container-low border-2 shrink-0 p-1 overflow-hidden transition-all ${
                  selectedImage === imgUrl ? "border-primary shadow-sm" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={imgUrl} alt={`Thumbnail ${i + 1}`} className="w-full h-full object-contain" />
              </button>
            ))}
          </div>
        )}

        {/* Godown Batch & Warehouse Trust Card */}
        <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/20 shadow-sm text-xs text-on-surface-variant space-y-2">
          <div className="flex items-center justify-between text-on-surface font-semibold">
            <span className="flex items-center gap-1.5 text-tertiary">
              <span className="material-symbols-outlined text-base">verified</span>
              100% Genuine Mandi Stock
            </span>
            <span className="font-mono">HSN: {product.hsn}</span>
          </div>
          <p>Direct miller dispatch with moisture-proof food-grade packaging suited for Kosi regional climate.</p>
        </div>
      </div>

      {/* Right: Product Details & Buying Actions (7 cols) */}
      <div className="lg:col-span-7 flex flex-col gap-6">
        <div>
          {/* Brand & Pack weight */}
          <div className="flex items-center gap-2 mb-2">
            {product.companyName && (
              <Link
                href={`/brand/${product.companySlug || product.companyId}`}
                className="text-xs font-bold uppercase tracking-wider text-primary hover:underline bg-primary-fixed/20 px-2.5 py-0.5 rounded-full"
              >
                {product.companyName}
              </Link>
            )}
            {product.weight && (
              <span className="text-xs font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                {product.weight}
              </span>
            )}
            {product.categoryName && (
              <Link
                href={`/category/${product.categorySlug || product.categoryId}`}
                className="text-xs text-on-surface-variant hover:text-primary"
              >
                • {product.categoryName}
              </Link>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface leading-tight">
            {product.name}
          </h1>

          {/* Stock Availability Info */}
          <div className="mt-3 flex items-center gap-2">
            {product.isAvailable ? (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-tertiary bg-tertiary-fixed/30 px-3 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                In Stock at Saharsa Central Godown
                {product.godownCartonsCount !== undefined && product.godownCartonsCount > 0 && (
                  <span className="text-on-surface font-normal">
                    ({product.godownCartonsCount} cartons + {product.godownLooseQty} loose)
                  </span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-error bg-error-container/20 px-3 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm">cancel</span>
                Currently Out of Stock
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Price Block */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-sm space-y-3">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-black font-mono text-primary">
              ₹{activeUnitPrice.toFixed(2)}
            </span>
            {mrp > activeUnitPrice && (
              <span className="text-base sm:text-lg text-outline line-through font-mono">
                MRP ₹{mrp.toFixed(2)}
              </span>
            )}
            {activeSavingsPerUnit > 0 && (
              <span className="bg-secondary-container text-on-secondary-container text-xs font-bold px-3 py-1 rounded-full">
                Save ₹{activeSavingsPerUnit.toFixed(2)}/unit (Instant JMD Discount)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-on-surface-variant">
            <span>Inclusive of all taxes</span>
            <span>•</span>
            <span className="text-tertiary font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              {(product.gstRateBp / 100).toFixed(0)}% GST Included (Input Tax Credit Eligible)
            </span>
          </div>

          {/* Wholesale Volume Slabs */}
          {product.slabs && product.slabs.length > 1 && (
            <div className="mt-4 pt-4 border-t border-outline-variant/15">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
                  <span className="material-symbols-outlined text-secondary text-lg">layers</span>
                  Wholesale Volume Slabs:
                </div>
                <span className="text-xs font-bold text-tertiary bg-tertiary-fixed/30 px-2 py-0.5 rounded">
                  Kirana &amp; Bulk Rates
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.slabs.map((slab, i) => {
                  const slabPrice = slab.unitPricePaise / 100;
                  const isCurrent = qty >= slab.minQty;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSlabClick(slab.minQty)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? "bg-primary-fixed/20 border-primary shadow-sm"
                          : "bg-surface-container-low border-outline-variant/30 hover:border-outline"
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-on-surface">{slab.minQty}+ Units</span>
                        <span className="text-tertiary font-bold">
                          {((slab.discountBp / 10000) * 100).toFixed(0)}% OFF
                        </span>
                      </div>
                      <div className="mt-1 text-base font-bold font-mono text-primary">
                        ₹{slabPrice.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-on-surface-variant">
                        Click to set {slab.minQty} units
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stepper + Actions */}
          <div className="mt-6 pt-4 border-t border-outline-variant/15 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Quantity Stepper */}
            <div className="flex items-center justify-between bg-surface-container-low rounded-xl p-1 sm:w-36 shrink-0 border border-outline-variant/20">
              <button
                type="button"
                onClick={() => handleQtyChange(-1)}
                disabled={qty <= 1 || !product.isAvailable}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-lowest text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">remove</span>
              </button>
              <span className="w-12 text-center font-mono font-bold text-lg text-on-surface">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => handleQtyChange(1)}
                disabled={!product.isAvailable || (product.totalAvailableQty > 0 && qty >= product.totalAvailableQty)}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-surface-container-lowest text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary hover:text-on-primary transition-colors active:scale-95 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">add</span>
              </button>
            </div>

            {/* Total summary snippet on mobile */}
            <div className="sm:hidden flex items-center justify-between text-xs px-2 text-on-surface-variant">
              <span>Total: <strong className="text-on-surface font-mono">₹{totalPrice.toFixed(2)}</strong></span>
              {totalSavings > 0 && <span className="text-tertiary font-bold">Total Savings: ₹{totalSavings.toFixed(2)}</span>}
            </div>

            {/* Add to Cart Button */}
            <button
              type="button"
              onClick={() => addToCart(false)}
              disabled={!product.isAvailable || isAdding}
              className="flex-1 py-3 px-6 rounded-xl bg-primary text-on-primary font-bold text-sm sm:text-base hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
            >
              <span className="material-symbols-outlined text-xl">shopping_cart</span>
              {isAdding ? "Adding..." : "Add to Cart"}
            </button>

            {/* Buy Now Button */}
            <button
              type="button"
              onClick={() => addToCart(true)}
              disabled={!product.isAvailable || isAdding}
              className="py-3 px-6 rounded-xl bg-secondary-container text-on-secondary-container font-bold text-sm sm:text-base hover:bg-secondary-container/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-98 shrink-0"
            >
              <span className="material-symbols-outlined text-xl">flash_on</span>
              Buy Now
            </button>
          </div>
        </div>

        {/* 4 Assurances Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15 text-center">
            <span className="material-symbols-outlined text-primary text-2xl">local_shipping</span>
            <div className="font-bold text-xs text-on-surface mt-1">Express Dispatch</div>
            <div className="text-[10px] text-on-surface-variant">30 Min - 2 Hr in Saharsa</div>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15 text-center">
            <span className="material-symbols-outlined text-primary text-2xl">payments</span>
            <div className="font-bold text-xs text-on-surface mt-1">Cash / UPI</div>
            <div className="text-[10px] text-on-surface-variant">Pay on Delivery</div>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15 text-center">
            <span className="material-symbols-outlined text-primary text-2xl">verified_user</span>
            <div className="font-bold text-xs text-on-surface mt-1">Original Quality</div>
            <div className="text-[10px] text-on-surface-variant">Direct Mill Pack</div>
          </div>
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/15 text-center">
            <span className="material-symbols-outlined text-primary text-2xl">support_agent</span>
            <div className="font-bold text-xs text-on-surface mt-1">Mandi Helpline</div>
            <div className="text-[10px] text-on-surface-variant">WhatsApp 9am - 9pm</div>
          </div>
        </div>

        {/* Tabs: Highlights, Description & Specs */}
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/20 shadow-sm space-y-6">
          {product.highlights && product.highlights.length > 0 && (
            <div>
              <h2 className="font-bold text-base text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                Key Product Highlights
              </h2>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                {product.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-tertiary text-base shrink-0 mt-0.5">
                      arrow_right
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {product.description && (
            <div>
              <h2 className="font-bold text-base text-on-surface mb-2">Description</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>
          )}

          {/* Specifications Table */}
          <div>
            <h2 className="font-bold text-base text-on-surface mb-3">Specifications</h2>
            <div className="rounded-xl border border-outline-variant/20 overflow-hidden divide-y divide-outline-variant/20 text-xs sm:text-sm">
              {product.companyName && (
                <div className="grid grid-cols-2 p-3 bg-surface-container-lowest">
                  <span className="text-on-surface-variant font-medium">Brand</span>
                  <span className="text-on-surface font-semibold">{product.companyName}</span>
                </div>
              )}
              {product.categoryName && (
                <div className="grid grid-cols-2 p-3 bg-surface-container-low">
                  <span className="text-on-surface-variant font-medium">Category</span>
                  <span className="text-on-surface font-semibold">{product.categoryName}</span>
                </div>
              )}
              {product.weight && (
                <div className="grid grid-cols-2 p-3 bg-surface-container-lowest">
                  <span className="text-on-surface-variant font-medium">Net Weight</span>
                  <span className="text-on-surface font-semibold">{product.weight}</span>
                </div>
              )}
              <div className="grid grid-cols-2 p-3 bg-surface-container-low">
                <span className="text-on-surface-variant font-medium">Pack Type</span>
                <span className="text-on-surface font-semibold">{product.packLabel} ({product.packSize} units/carton)</span>
              </div>
              <div className="grid grid-cols-2 p-3 bg-surface-container-lowest">
                <span className="text-on-surface-variant font-medium">HSN Code</span>
                <span className="text-on-surface font-mono font-semibold">{product.hsn}</span>
              </div>
              <div className="grid grid-cols-2 p-3 bg-surface-container-low">
                <span className="text-on-surface-variant font-medium">GST Rate</span>
                <span className="text-on-surface font-semibold">{(product.gstRateBp / 100).toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-2 p-3 bg-surface-container-lowest">
                <span className="text-on-surface-variant font-medium">Dispatch Hub</span>
                <span className="text-on-surface font-semibold">Saharsa Central Godown, Bihar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
