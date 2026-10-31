"use client";

import React, { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { DiwaliStoreConfig, DiwaliShelfKey } from "@/modules/diwali/diwali.types";
import { ProductWithDetails } from "@/modules/catalog/catalog.types";
import { formatPaise } from "@/lib/format-price";
import { saveDiwaliConfigAction } from "./actions";

interface DiwaliAdminClientProps {
  initialConfig: DiwaliStoreConfig;
  availableProducts: ProductWithDetails[];
  categories: Array<{ id: string; name: string }>;
}

const SHELF_DEFINITIONS: Array<{
  key: DiwaliShelfKey;
  label: string;
  badgeDefault: string;
  icon: string;
  fallbackKeywords: string[];
}> = [
  {
    key: "gifts",
    label: "🎁 Diwali Gift Hampers",
    badgeDefault: "🎁 Royal Gifting",
    icon: "redeem",
    fallbackKeywords: ["gift", "hamper", "box", "pack"],
  },
  {
    key: "sweets",
    label: "🪔 Festive Sweets & Mithai",
    badgeDefault: "🪔 Shubh Mithai",
    icon: "bakery_dining",
    fallbackKeywords: ["sweet", "mithai", "soan", "gulab", "rasgulla", "bikaji"],
  },
  {
    key: "dryFruits",
    label: "🥜 Premium Dry Fruits & Nuts",
    badgeDefault: "🥜 100% Royal Quality",
    icon: "nutrition",
    fallbackKeywords: ["dry fruit", "kaju", "badam", "cashew", "almond", "kismis", "pista"],
  },
];

export function DiwaliAdminClient({
  initialConfig,
  availableProducts,
  categories,
}: DiwaliAdminClientProps) {
  const [config, setConfig] = useState<DiwaliStoreConfig>(initialConfig);
  const [activeTab, setActiveTab] = useState<DiwaliShelfKey>("gifts");
  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Modal state for searching and adding / replacing a product
  const [pickerModal, setPickerModal] = useState<{
    open: boolean;
    shelfKey: DiwaliShelfKey;
    slotIndex: number; // -1 for adding a new product
  }>({
    open: false,
    shelfKey: "gifts",
    slotIndex: -1,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("");

  // Map products by ID for fast slot lookup
  const productMap = useMemo(() => {
    const map = new Map<string, ProductWithDetails>();
    for (const p of availableProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [availableProducts]);

  // Filter products for the modal
  const filteredModalProducts = useMemo(() => {
    let list = availableProducts;
    if (selectedCategoryFilter) {
      list = list.filter((p) => p.categoryId === selectedCategoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortCode.toLowerCase().includes(q) ||
          p.company?.name.toLowerCase().includes(q)
      );
    }
    return list.slice(0, 50);
  }, [availableProducts, selectedCategoryFilter, searchQuery]);

  // Save handler
  const handleSave = () => {
    startTransition(async () => {
      const res = await saveDiwaliConfigAction(config);
      if (res.success) {
        setStatusMessage({
          type: "ok",
          text: "✨ Diwali Store Showcase configuration saved successfully! Storefront is updated.",
        });
        if (res.config) setConfig(res.config);
      } else {
        setStatusMessage({
          type: "err",
          text: res.error || "Failed to save configuration.",
        });
      }
    });
  };

  // Replace or Add Product into a shelf slot
  const handleSelectProductForSlot = (productId: string) => {
    const { shelfKey, slotIndex } = pickerModal;
    setConfig((prev) => {
      const currentShelf = prev.shelves[shelfKey];
      const newProductIds = [...currentShelf.productIds];

      if (slotIndex >= 0 && slotIndex < newProductIds.length) {
        // Replace existing slot
        newProductIds[slotIndex] = productId;
      } else {
        // Add new slot if not already in list
        if (!newProductIds.includes(productId)) {
          newProductIds.push(productId);
        }
      }

      return {
        ...prev,
        shelves: {
          ...prev.shelves,
          [shelfKey]: {
            ...currentShelf,
            productIds: newProductIds.slice(0, 5),
          },
        },
      };
    });

    setPickerModal({ open: false, shelfKey: "gifts", slotIndex: -1 });
    setSearchQuery("");
  };

  // Remove a product from a shelf
  const handleRemoveSlot = (shelfKey: DiwaliShelfKey, index: number) => {
    setConfig((prev) => {
      const currentShelf = prev.shelves[shelfKey];
      const newProductIds = currentShelf.productIds.filter((_, i) => i !== index);
      return {
        ...prev,
        shelves: {
          ...prev.shelves,
          [shelfKey]: {
            ...currentShelf,
            productIds: newProductIds,
          },
        },
      };
    });
  };

  // Reorder product slots
  const handleMoveSlot = (
    shelfKey: DiwaliShelfKey,
    fromIdx: number,
    toIdx: number
  ) => {
    setConfig((prev) => {
      const currentShelf = prev.shelves[shelfKey];
      const ids = [...currentShelf.productIds];
      if (toIdx < 0 || toIdx >= ids.length) return prev;
      const [moved] = ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, moved);
      return {
        ...prev,
        shelves: {
          ...prev.shelves,
          [shelfKey]: {
            ...currentShelf,
            productIds: ids,
          },
        },
      };
    });
  };

  // Auto-Fill 5 products matching the shelf category/keywords
  const handleAutoFillShelf = (shelfKey: DiwaliShelfKey) => {
    const def = SHELF_DEFINITIONS.find((d) => d.key === shelfKey);
    if (!def) return;

    // Filter available products matching the keywords
    const matches: ProductWithDetails[] = [];
    for (const p of availableProducts) {
      const name = p.name.toLowerCase();
      const cat = (p.category?.name || "").toLowerCase();
      const comp = (p.company?.name || "").toLowerCase();

      const isMatch = def.fallbackKeywords.some(
        (kw) => name.includes(kw) || cat.includes(kw) || comp.includes(kw)
      );

      if (isMatch && !matches.some((m) => m.id === p.id)) {
        matches.push(p);
      }
      if (matches.length >= 5) break;
    }

    // If fewer than 5, supplement with other top products
    if (matches.length < 5) {
      for (const p of availableProducts) {
        if (!matches.some((m) => m.id === p.id)) {
          matches.push(p);
        }
        if (matches.length >= 5) break;
      }
    }

    const newIds = matches.slice(0, 5).map((m) => m.id);

    setConfig((prev) => ({
      ...prev,
      shelves: {
        ...prev.shelves,
        [shelfKey]: {
          ...prev.shelves[shelfKey],
          productIds: newIds,
        },
      },
    }));

    setStatusMessage({
      type: "ok",
      text: `Auto-filled 5 products for ${def.label}. Remember to click "Save Changes"!`,
    });
  };

  const currentShelfCfg = config.shelves[activeTab];

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28">
      {/* Top Banner Header */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#4a0511] via-[#6d1322] to-[#914d00] text-white p-6 shadow-md border border-amber-500/30 overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 text-xs font-bold uppercase tracking-wider mb-2">
              <span>🪔</span>
              <span>Festive Storefront Manager</span>
              <span>✨</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black font-headline text-amber-100 tracking-tight">
              Diwali Store Showcase Manager
            </h1>
            <p className="text-xs md:text-sm text-amber-100/80 mt-1 max-w-2xl">
              Curate and manage 5 products for each of the 3 festive aisles (Gifts, Sweets, and Dry Fruits). Displayed right between the Banner Carousel and Categories on the storefront!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/store#diwali-store"
              target="_blank"
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95"
            >
              <span>Preview Storefront</span>
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 border transition-all ${
            statusMessage.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-rose-50 text-rose-800 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{statusMessage.type === "ok" ? "✓" : "⚠"}</span>
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-stone-400 hover:text-stone-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* Section 1: Master Storefront Controls */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900 font-headline">
              Master Showcase Settings
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Control showcase visibility and header text on the main /store page.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, enabled: e.target.checked }))
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            <span className="ml-2.5 text-xs font-bold text-stone-700">
              {config.enabled ? "Active on Store" : "Hidden"}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Banner Heading
            </label>
            <input
              type="text"
              value={config.bannerTitle}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, bannerTitle: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              placeholder="e.g. 🪔 Shubh Deepawali Maha Store"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Promo Badge Tag
            </label>
            <input
              type="text"
              value={config.bannerTag}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, bannerTag: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              placeholder="e.g. DIWALI SPECIAL • LIVE WAREHOUSE DISPATCH"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Subtitle
            </label>
            <input
              type="text"
              value={config.bannerSubtitle}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, bannerSubtitle: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              placeholder="Description shown on banner"
            />
          </div>
        </div>
      </div>

      {/* Section 2: 3 Shelves Manager (Gifts, Sweets, Dry Fruits) */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {/* Shelf Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 overflow-x-auto scrollbar-none">
          {SHELF_DEFINITIONS.map((shelf) => {
            const isCurrent = activeTab === shelf.key;
            const count = config.shelves[shelf.key].productIds.length;
            const isShelfEnabled = config.shelves[shelf.key].enabled;

            return (
              <button
                key={shelf.key}
                type="button"
                onClick={() => setActiveTab(shelf.key)}
                className={`py-3.5 px-5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  isCurrent
                    ? "border-amber-600 text-amber-900 bg-white"
                    : "border-transparent text-stone-600 hover:text-stone-900 hover:bg-stone-100/50"
                }`}
              >
                <span>{shelf.label}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    isShelfEnabled
                      ? "bg-amber-100 text-amber-900"
                      : "bg-stone-200 text-stone-600 line-through"
                  }`}
                >
                  {count}/5
                </span>
              </button>
            );
          })}
        </div>

        {/* Shelf Content */}
        <div className="p-5 space-y-5">
          {/* Shelf Details & Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentShelfCfg.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      shelves: {
                        ...prev.shelves,
                        [activeTab]: {
                          ...currentShelfCfg,
                          enabled: e.target.checked,
                        },
                      },
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
              <div>
                <div className="text-xs font-bold text-stone-900">
                  {currentShelfCfg.enabled ? "Shelf Visible" : "Shelf Disabled"}
                </div>
                <div className="text-[11px] text-stone-500">
                  {currentShelfCfg.productIds.length} of 5 curated products assigned
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAutoFillShelf(activeTab)}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs border border-amber-300 shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                title="Automatically select 5 available products matching this aisle"
              >
                <span>⚡ Auto-Fill 5 Products</span>
              </button>

              {currentShelfCfg.productIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      shelves: {
                        ...prev.shelves,
                        [activeTab]: {
                          ...currentShelfCfg,
                          productIds: [],
                        },
                      },
                    }))
                  }
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-colors cursor-pointer"
                >
                  Clear Shelf
                </button>
              )}
            </div>
          </div>

          {/* Shelf Metadata Edit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Shelf Title</label>
              <input
                type="text"
                value={currentShelfCfg.title}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    shelves: {
                      ...prev.shelves,
                      [activeTab]: {
                        ...currentShelfCfg,
                        title: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Badge Tag</label>
              <input
                type="text"
                value={currentShelfCfg.badge}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    shelves: {
                      ...prev.shelves,
                      [activeTab]: {
                        ...currentShelfCfg,
                        badge: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Subtitle</label>
              <input
                type="text"
                value={currentShelfCfg.subtitle}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    shelves: {
                      ...prev.shelves,
                      [activeTab]: {
                        ...currentShelfCfg,
                        subtitle: e.target.value,
                      },
                    },
                  }))
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
              />
            </div>
          </div>

          {/* 5 Curated Product Slots Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider font-headline">
                Curated Products (Slot 1 to 5)
              </h3>
              <span className="text-[11px] text-stone-500">
                You can replace, reorder, or remove any product below
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {[0, 1, 2, 3, 4].map((slotIndex) => {
                const productId = currentShelfCfg.productIds[slotIndex];
                const product = productId ? productMap.get(productId) : null;

                if (!product) {
                  return (
                    <div
                      key={`empty-slot-${slotIndex}`}
                      className="border-2 border-dashed border-stone-200 hover:border-amber-400 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-2 min-h-[220px] bg-stone-50 hover:bg-amber-50/40 transition-all group cursor-pointer"
                      onClick={() =>
                        setPickerModal({
                          open: true,
                          shelfKey: activeTab,
                          slotIndex: slotIndex,
                        })
                      }
                    >
                      <div className="w-10 h-10 rounded-full bg-stone-200 group-hover:bg-amber-500 group-hover:text-white text-stone-500 flex items-center justify-center font-black transition-colors">
                        +
                      </div>
                      <div className="text-xs font-bold text-stone-700 group-hover:text-amber-900">
                        Slot {slotIndex + 1}: Add Product
                      </div>
                      <p className="text-[10px] text-stone-400 max-w-[140px]">
                        Click to choose from product catalog
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl border border-stone-200 shadow-2xs hover:shadow-md p-3 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      {/* Slot Header with Reorder arrows */}
                      <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mb-1.5">
                        <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-mono">
                          Slot {slotIndex + 1}
                        </span>

                        <div className="flex items-center gap-1">
                          {slotIndex > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleMoveSlot(activeTab, slotIndex, slotIndex - 1)
                              }
                              className="w-5 h-5 rounded hover:bg-stone-100 flex items-center justify-center text-stone-600"
                              title="Move left"
                            >
                              ←
                            </button>
                          )}
                          {slotIndex < currentShelfCfg.productIds.length - 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                handleMoveSlot(activeTab, slotIndex, slotIndex + 1)
                              }
                              className="w-5 h-5 rounded hover:bg-stone-100 flex items-center justify-center text-stone-600"
                              title="Move right"
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Product Thumbnail */}
                      <div className="aspect-square rounded-xl bg-stone-50 border border-stone-100 p-2 flex items-center justify-center overflow-hidden mb-2">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-3xl text-stone-300">
                            inventory_2
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="text-[10px] text-stone-400 font-mono">
                        {product.shortCode} • {product.weight || "1 unit"}
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 line-clamp-2 min-h-[32px] mt-0.5">
                        {product.name}
                      </h4>
                      <div className="text-xs font-bold text-amber-900 font-mono mt-1">
                        MRP: ₹{formatPaise(product.mrpPaise)}
                      </div>
                    </div>

                    {/* Actions: Replace & Remove */}
                    <div className="pt-2.5 mt-2 border-t border-stone-100 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setPickerModal({
                            open: true,
                            shelfKey: activeTab,
                            slotIndex: slotIndex,
                          })
                        }
                        className="flex-1 py-1 px-2 rounded-lg bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-900 text-[11px] font-bold text-center transition-colors cursor-pointer"
                      >
                        Replace
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveSlot(activeTab, slotIndex)}
                        className="py-1 px-2 rounded-lg hover:bg-rose-50 text-stone-400 hover:text-rose-600 text-[11px] font-bold transition-colors cursor-pointer"
                        title="Remove product from slot"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="text-xs text-stone-600 hidden sm:block">
            Managing <strong>{config.bannerTitle}</strong> • Changes will apply live on Storefront.
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/admin/catalog"
              className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900"
            >
              Cancel
            </Link>

            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">save</span>
              <span>{isPending ? "Saving..." : "Save All Changes"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Selection Modal */}
      {pickerModal.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <div>
                <h3 className="font-headline font-bold text-sm text-stone-900">
                  Select Product for Slot {pickerModal.slotIndex + 1}
                </h3>
                <p className="text-[11px] text-stone-500">
                  Aisle: {SHELF_DEFINITIONS.find((s) => s.key === pickerModal.shelfKey)?.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerModal({ open: false, shelfKey: "gifts", slotIndex: -1 })}
                className="w-8 h-8 rounded-full hover:bg-stone-200 text-stone-600 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Search Controls */}
            <div className="p-3 border-b border-stone-100 bg-white flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search product by name, code or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-amber-600"
                  autoFocus
                />
                <span className="material-symbols-outlined text-stone-400 text-[18px] absolute left-2.5 top-2.5">
                  search
                </span>
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="text-xs border border-stone-300 rounded-xl px-3 py-2 focus:outline-none focus:border-amber-600 bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Product List */}
            <div className="p-3 overflow-y-auto flex-1 divide-y divide-stone-100 space-y-1">
              {filteredModalProducts.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-500">
                  No products matched your search. Try typing a different keyword or category.
                </div>
              ) : (
                filteredModalProducts.map((p) => {
                  const isAlreadySelected = currentShelfCfg.productIds.includes(p.id);

                  return (
                    <div
                      key={p.id}
                      className="p-2.5 flex items-center justify-between gap-3 hover:bg-amber-50/50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-12 h-12 rounded-lg bg-stone-50 border border-stone-200 p-1 flex items-center justify-center shrink-0">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-stone-300 text-[20px]">
                              inventory_2
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-stone-400">
                              {p.shortCode}
                            </span>
                            {p.weight && (
                              <span className="text-[10px] bg-stone-100 text-stone-600 px-1 rounded font-mono">
                                {p.weight}
                              </span>
                            )}
                          </div>
                          <h4 className="text-xs font-bold text-stone-900 truncate">
                            {p.name}
                          </h4>
                          <div className="text-[11px] text-stone-500">
                            {p.category?.name || "No Category"} •{" "}
                            <span className="text-amber-900 font-bold font-mono">
                              MRP ₹{formatPaise(p.mrpPaise)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectProductForSlot(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                          isAlreadySelected
                            ? "bg-stone-200 text-stone-700 hover:bg-amber-600 hover:text-white"
                            : "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        }`}
                      >
                        {isAlreadySelected ? "In Shelf (Pick Again)" : "Select Product"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-stone-100 bg-stone-50 flex items-center justify-between text-xs text-stone-500">
              <span>Showing up to 50 items. Use search to refine.</span>
              <button
                type="button"
                onClick={() => setPickerModal({ open: false, shelfKey: "gifts", slotIndex: -1 })}
                className="px-3 py-1 bg-white border border-stone-300 rounded-lg font-bold text-stone-700 hover:bg-stone-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
