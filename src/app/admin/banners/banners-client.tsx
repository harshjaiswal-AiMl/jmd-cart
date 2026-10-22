"use client";

import React, { useState, useTransition } from "react";
import { StoreBanner } from "@/modules/banners/banner.types";
import { saveBannersAction } from "./actions";
import Link from "next/link";

interface BannersClientProps {
  initialBanners: StoreBanner[];
}

const GRADIENT_PRESETS = [
  { label: "Classic Maroon (Brand)", value: "from-[#5c0c1e] via-[#420815] to-[#24040b]" },
  { label: "Mandi Gold / Amber", value: "from-[#914d00] via-[#6d3900] to-[#3d2000]" },
  { label: "Commercial Navy / Steel", value: "from-[#1e3a5f] via-[#12243b] to-[#0a1420]" },
  { label: "Emerald Wholesale", value: "from-[#0f5132] via-[#093520] to-[#041d11]" },
];

export function BannersClient({ initialBanners }: BannersClientProps) {
  const [banners, setBanners] = useState<StoreBanner[]>(initialBanners);
  const [editingBanner, setEditingBanner] = useState<StoreBanner | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileUpload = async (file: File) => {
    if (!editingBanner || !file) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Upload failed");
      }
      setEditingBanner((prev) => (prev ? { ...prev, imageUrl: data.url } : null));
      setStatusMessage({ type: "ok", text: "Banner image uploaded successfully!" });
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err.message || "Failed to upload image" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveModal = () => {
    if (!editingBanner) return;
    setBanners((prev) =>
      prev.map((b) => (b.id === editingBanner.id ? editingBanner : b))
    );
    setEditingBanner(null);
  };

  const handleAddNew = () => {
    const newId = `banner-${Date.now()}`;
    const newBanner: StoreBanner = {
      id: newId,
      badge: "Festive Wholesale Slabs",
      title: "New Seasonal Kirana Campaign",
      subtitle: "Direct godown dispatch for high-demand FMCG cartons. Special bulk savings applied at checkout.",
      ctaText: "Shop Groceries",
      ctaLink: "/store",
      secondaryCtaText: "Explore Wholesale",
      secondaryCtaLink: "/store/wholesale",
      stat1Value: "Special",
      stat1Label: "Festive Slab",
      stat2Value: "₹0 Charge",
      stat2Label: "Free Delivery",
      stat3Value: "Direct",
      stat3Label: "Depot Loading",
      imageUrl: "/brand/jmd-cart-logo.png",
      bgGradient: "from-[#5c0c1e] via-[#420815] to-[#24040b]",
      active: true,
      order: banners.length + 1,
    };
    setBanners((prev) => [...prev, newBanner]);
    setEditingBanner(newBanner);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to remove this banner slide?")) {
      setBanners((prev) => prev.filter((b) => b.id !== id));
      if (editingBanner?.id === id) setEditingBanner(null);
    }
  };

  const handleToggleActive = (id: string) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, active: !b.active } : b))
    );
  };

  const handleSaveAll = () => {
    startTransition(async () => {
      const res = await saveBannersAction(banners);
      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setStatusMessage({ type: "ok", text: "All carousel banners saved & updated in storefront!" });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span>🖼️</span> Storefront Promotional Banners Carousel
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Manage sliding promotional banners on the E-Commerce Storefront (`/store`). Add slides, edit headlines, and re-upload custom artwork.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAddNew}
            className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 border border-gray-300"
          >
            <span>+</span> Add New Slide
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSaveAll}
            className="px-4 py-2 bg-[#790E11] hover:bg-[#5E0A0D] text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            <span>💾</span> {isPending ? "Saving..." : "Save All Banners"}
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex justify-between items-center ${
            statusMessage.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="underline ml-4">
            Dismiss
          </button>
        </div>
      )}

      {/* Banners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`bg-white rounded-2xl border ${
              banner.active ? "border-gray-300 shadow-sm" : "border-gray-200 opacity-70"
            } overflow-hidden flex flex-col justify-between transition-all hover:shadow-md`}
          >
            {/* Visual Real Wide Banner Graphic Preview */}
            <div className="relative w-full aspect-[21/9] bg-gray-100 overflow-hidden border-b border-gray-100">
              {banner.imageUrl ? (
                <img
                  src={banner.imageUrl}
                  alt={banner.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                  <span className="text-3xl">🖼️</span>
                  <span className="text-xs">No banner image uploaded</span>
                </div>
              )}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                <span className="text-xs font-mono bg-black/75 backdrop-blur-xs px-2.5 py-0.5 rounded-md text-white font-bold">
                  Slide #{index + 1}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold text-white ${
                    banner.active ? "bg-emerald-600" : "bg-gray-600"
                  }`}
                >
                  {banner.active ? "● Live on Storefront" : "○ Paused"}
                </span>
              </div>
            </div>

            {/* Bottom Actions Card */}
            <div className="p-4 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <h3 className="font-bold text-sm text-gray-900 truncate">
                    {banner.title || `Slide #${index + 1}`}
                  </h3>
                  <p className="text-xs text-gray-500 font-mono mt-0.5 truncate">
                    Target: <span className="text-primary font-semibold">{banner.ctaLink || "/store"}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(banner.id)}
                    className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-colors ${
                      banner.active
                        ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                        : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                    }`}
                  >
                    {banner.active ? "Pause" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBanner({ ...banner })}
                    className="px-3 py-1.5 bg-primary text-white hover:bg-primary-container rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-xs"
                  >
                    <span>✏️ Edit / Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(banner.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
                    title="Delete slide"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Banner Modal */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">
                Edit Carousel Banner Slide
              </h2>
              <button
                type="button"
                onClick={() => setEditingBanner(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Wide Banner Image Live Preview */}
              <div className="w-full aspect-[21/9] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-inner relative flex items-center justify-center">
                {editingBanner.imageUrl ? (
                  <img
                    src={editingBanner.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-1">
                    <span className="text-3xl">🖼️</span>
                    <span className="text-xs font-semibold">No banner graphic selected yet</span>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                    <span className="text-sm font-bold">Uploading Banner Graphic...</span>
                  </div>
                )}
              </div>

              {/* Artwork Re-upload Section */}
              <div className="bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Upload Banner Graphic (JPG, PNG, WebP)
                    </label>
                    <span className="text-[11px] text-gray-500">
                      Recommended: 16:9 or Wide Commercial Graphic Banner (e.g. 1376x768 or 1200x450)
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-bold transition-colors shadow-xs">
                    <span>📁 Choose Image from PC / Phone</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                  <span className="text-xs text-gray-400">or Direct URL:</span>
                  <input
                    type="text"
                    value={editingBanner.imageUrl || ""}
                    onChange={(e) =>
                      setEditingBanner({ ...editingBanner, imageUrl: e.target.value })
                    }
                    placeholder="/brand/... or https://..."
                    className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-mono bg-white"
                  />
                  {editingBanner.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setEditingBanner({ ...editingBanner, imageUrl: "" })}
                      className="text-xs text-red-600 hover:underline px-1 font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    Banner Title / Internal Name
                  </label>
                  <input
                    type="text"
                    value={editingBanner.title}
                    onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                    placeholder="e.g. Kitchen Essentials & Staples"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">
                    Click Destination Link (CTA URL)
                  </label>
                  <input
                    type="text"
                    value={editingBanner.ctaLink}
                    onChange={(e) => setEditingBanner({ ...editingBanner, ctaLink: e.target.value })}
                    placeholder="e.g. /store or /store/wholesale or /store/products/[id]"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-primary font-semibold"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    When customers click this banner on the storefront, they will be taken to this link.
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingBanner(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 bg-primary hover:bg-primary-container text-white rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
