"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { StoreProductItem } from "@/modules/store/store.service";
import { QuantityStepper } from "./QuantityStepper";

interface ProductCardProps {
  product: StoreProductItem;
  initialInWishlist?: boolean;
}

export function ProductCard({
  product,
  initialInWishlist = false,
}: ProductCardProps) {
  const [inWishlist, setInWishlist] = useState(initialInWishlist);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  const priceRupees = (product.unitPricePaise || product.mrpPaise) / 100;
  const mrpRupees = product.mrpPaise / 100;
  const savingsRupees = Math.max(0, mrpRupees - priceRupees);
  const discountPercent =
    mrpRupees > 0 ? Math.round((savingsRupees / mrpRupees) * 100) : 0;

  const productUrl = `/product/${product.slug || product.id}`;

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setWishlistLoading(true);
    try {
      const res = await fetch("/api/store/v1/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setInWishlist(json.data.inWishlist);
        }
      }
    } catch {
      // ignore
    } finally {
      setWishlistLoading(false);
    }
  };

  return (
    <article className="group bg-surface-container-lowest rounded-xl p-3 shadow-xs hover:shadow-md border border-surface-container-high transition-all flex flex-col justify-between relative overflow-hidden">
      {/* Top Badges & Wishlist */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex flex-col gap-1 items-start">
          {discountPercent > 0 && (
            <span className="px-2 py-0.5 bg-secondary text-on-secondary rounded-full font-label-sm text-[11px] font-bold shadow-xs">
              {discountPercent}% OFF
            </span>
          )}
          {product.slabs && product.slabs.length > 1 && (
            <span className="px-1.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed rounded font-label-sm text-[10px] font-bold">
              Bulk Slab
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className={`pointer-events-auto w-8 h-8 rounded-full flex items-center justify-center transition-all ${
            inWishlist
              ? "bg-primary-container text-on-primary shadow-sm"
              : "bg-surface-container-lowest/80 text-outline hover:text-primary hover:bg-surface-container-lowest shadow-xs"
          }`}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={inWishlist ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            {inWishlist ? "favorite" : "favorite"}
          </span>
        </button>
      </div>

      {/* Product Image */}
      <Link href={productUrl} className="block relative w-full aspect-square bg-surface-container-low rounded-lg mb-2.5 overflow-hidden">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={`${product.name} ${product.weight || ""}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-outline/60">
            <span className="material-symbols-outlined text-[36px]">inventory_2</span>
            <span className="text-[11px] font-medium mt-1">JMD Cart</span>
          </div>
        )}
      </Link>

      {/* Details */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & Weight */}
          <div className="flex items-center justify-between text-[11px] font-medium text-outline mb-1">
            <span className="uppercase tracking-wider font-bold truncate max-w-[120px]">
              {product.companyName || "Kirana Staple"}
            </span>
            {product.weight && <span>{product.weight}</span>}
          </div>

          {/* Product Name */}
          <Link href={productUrl}>
            <h3 className="font-headline-sm text-sm font-bold text-on-surface line-clamp-2 hover:text-primary transition-colors leading-snug mb-1.5">
              {product.name}
            </h3>
          </Link>

          {/* Slabs Callout if configured */}
          {product.slabs && product.slabs.length > 1 && (
            <div className="text-[11px] text-tertiary-container font-semibold mb-2 line-clamp-1">
              Buy {product.slabs[1].minQty}+ at ₹{(product.slabs[1].unitPricePaise / 100).toFixed(0)}/pc
            </div>
          )}
        </div>

        {/* Pricing & Add To Cart Button */}
        <div className="pt-2 border-t border-surface-container-high/60 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-price-lg text-base font-bold text-primary">
                ₹{priceRupees.toFixed(0)}
              </span>
              {mrpRupees > priceRupees && (
                <span className="text-xs text-outline line-through">
                  ₹{mrpRupees.toFixed(0)}
                </span>
              )}
            </div>
            {product.packSize > 1 && (
              <div className="text-[10px] text-on-surface-variant">
                1 {product.packLabel} = {product.packSize} pcs
              </div>
            )}
          </div>

          <QuantityStepper
            productId={product.id}
            isAvailable={product.isAvailable}
            packLabel={product.packLabel}
          />
        </div>
      </div>
    </article>
  );
}
