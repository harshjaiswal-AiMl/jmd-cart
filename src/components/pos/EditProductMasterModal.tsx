"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Save, Edit3, Camera, UploadCloud, Search, CheckCircle2 } from "lucide-react";
import { updateProductMasterFromPosAction } from "@/app/shop/pos/actions";
import { mediaUrl } from "@/lib/media";

interface EditProductMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any | null;
  allProducts?: any[];
  companies: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
  onProductUpdated: (updatedProduct: any) => void;
  onSelectDifferentProduct?: (product: any) => void;
}

export function EditProductMasterModal({
  isOpen,
  onClose,
  product: initialProduct,
  allProducts = [],
  companies,
  categories = [],
  onProductUpdated,
}: EditProductMasterModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<any | null>(initialProduct);
  const [productSearch, setProductSearch] = useState("");
  const [isSearchingProduct, setIsSearchingProduct] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [packSize, setPackSize] = useState("1");
  const [packLabel, setPackLabel] = useState("Pcs");
  const [weight, setWeight] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [hsn, setHsn] = useState("");
  const [gstRateBp, setGstRateBp] = useState<number>(500);
  const [imageUrl, setImageUrl] = useState("");

  // MRP & 3 Pricing Tiers (A, B, C)
  const [mrpRs, setMrpRs] = useState("");
  const [priceARs, setPriceARs] = useState("");
  const [discAPercent, setDiscAPercent] = useState("");

  const [priceBRs, setPriceBRs] = useState("");
  const [discBPercent, setDiscBPercent] = useState("");

  const [priceCRs, setPriceCRs] = useState("");
  const [discCPercent, setDiscCPercent] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Sync state whenever initialProduct or modal open state changes
  useEffect(() => {
    if (isOpen) {
      const prod = initialProduct || (allProducts.length > 0 ? allProducts[0] : null);
      setSelectedProduct(prod);
      populateForm(prod);
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 100);
    }
  }, [isOpen, initialProduct, allProducts]);

  const populateForm = (prod: any | null) => {
    if (!prod) return;
    setName(prod.name || "");
    setShortCode(prod.shortCode || "");
    setPackSize(String(prod.packSize || 1));
    setPackLabel(prod.packLabel || "Pcs");
    setWeight(prod.weight || "");
    setCompanyId(prod.companyId || "");
    setCategoryId(prod.categoryId || "");
    setHsn(prod.hsn || "");
    setGstRateBp(prod.gstRateBp ?? 500);
    setImageUrl(prod.imageUrl || "");

    const mrp = prod.mrpPaise ? (prod.mrpPaise / 100).toFixed(2) : "";
    setMrpRs(mrp);

    const mrpNum = parseFloat(mrp) || 0;

    // Tier A
    if (prod.priceAPaise && prod.priceAPaise > 0) {
      const pA = (prod.priceAPaise / 100).toFixed(2);
      setPriceARs(pA);
      if (mrpNum > 0) {
        setDiscAPercent((((mrpNum - parseFloat(pA)) / mrpNum) * 100).toFixed(1));
      } else {
        setDiscAPercent("");
      }
    } else {
      setPriceARs("");
      setDiscAPercent("");
    }

    // Tier B
    if (prod.priceBPaise && prod.priceBPaise > 0) {
      const pB = (prod.priceBPaise / 100).toFixed(2);
      setPriceBRs(pB);
      if (mrpNum > 0) {
        setDiscBPercent((((mrpNum - parseFloat(pB)) / mrpNum) * 100).toFixed(1));
      } else {
        setDiscBPercent("");
      }
    } else {
      setPriceBRs("");
      setDiscBPercent("");
    }

    // Tier C
    if (prod.priceCPaise && prod.priceCPaise > 0) {
      const pC = (prod.priceCPaise / 100).toFixed(2);
      setPriceCRs(pC);
      if (mrpNum > 0) {
        setDiscCPercent((((mrpNum - parseFloat(pC)) / mrpNum) * 100).toFixed(1));
      } else {
        setDiscCPercent("");
      }
    } else {
      setPriceCRs("");
      setDiscCPercent("");
    }

    setErrorMsg(null);
  };

  // Helper when MRP changes: recalculate all tiers
  const handleMrpChange = (val: string) => {
    setMrpRs(val);
    const mrp = parseFloat(val) || 0;
    if (mrp <= 0) return;

    // Recalculate A
    if (discAPercent && !isNaN(parseFloat(discAPercent))) {
      setPriceARs((mrp * (1 - parseFloat(discAPercent) / 100)).toFixed(2));
    } else if (priceARs && parseFloat(priceARs) > 0) {
      setDiscAPercent((((mrp - parseFloat(priceARs)) / mrp) * 100).toFixed(1));
    }

    // Recalculate B
    if (discBPercent && !isNaN(parseFloat(discBPercent))) {
      setPriceBRs((mrp * (1 - parseFloat(discBPercent) / 100)).toFixed(2));
    } else if (priceBRs && parseFloat(priceBRs) > 0) {
      setDiscBPercent((((mrp - parseFloat(priceBRs)) / mrp) * 100).toFixed(1));
    }

    // Recalculate C
    if (discCPercent && !isNaN(parseFloat(discCPercent))) {
      setPriceCRs((mrp * (1 - parseFloat(discCPercent) / 100)).toFixed(2));
    } else if (priceCRs && parseFloat(priceCRs) > 0) {
      setDiscCPercent((((mrp - parseFloat(priceCRs)) / mrp) * 100).toFixed(1));
    }
  };

  // Tier A handlers
  const handleRateAChange = (val: string) => {
    setPriceARs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscAPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentAChange = (val: string) => {
    setDiscAPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceARs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  // Tier B handlers
  const handleRateBChange = (val: string) => {
    setPriceBRs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscBPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentBChange = (val: string) => {
    setDiscBPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceBRs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  // Tier C handlers
  const handleRateCChange = (val: string) => {
    setPriceCRs(val);
    const mrp = parseFloat(mrpRs) || 0;
    const rate = parseFloat(val) || 0;
    if (mrp > 0 && rate > 0) {
      setDiscCPercent((((mrp - rate) / mrp) * 100).toFixed(1));
    }
  };
  const handlePercentCChange = (val: string) => {
    setDiscCPercent(val);
    const mrp = parseFloat(mrpRs) || 0;
    const pct = parseFloat(val);
    if (mrp > 0 && !isNaN(pct) && pct >= 0 && pct < 100) {
      setPriceCRs((mrp * (1 - pct / 100)).toFixed(2));
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
      } else {
        alert(data.error || "Failed to upload photo");
      }
    } catch (err: any) {
      alert("Photo upload failed: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Submit Handler
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg("Please select a product to edit.");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("Product name is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const mrpNum = parseFloat(mrpRs);
      const mrpPaise = isNaN(mrpNum) || mrpNum <= 0 ? undefined : Math.round(mrpNum * 100);

      const pANum = parseFloat(priceARs);
      const priceAPaise = isNaN(pANum) || pANum < 0 ? undefined : Math.round(pANum * 100);

      const pBNum = parseFloat(priceBRs);
      const priceBPaise = isNaN(pBNum) || pBNum < 0 ? undefined : Math.round(pBNum * 100);

      const pCNum = parseFloat(priceCRs);
      const priceCPaise = isNaN(pCNum) || pCNum < 0 ? undefined : Math.round(pCNum * 100);

      const packSizeNum = parseInt(packSize, 10) || 1;

      const res = await updateProductMasterFromPosAction({
        productId: selectedProduct.id,
        name: name.trim(),
        shortCode: shortCode.trim() || undefined,
        weight: weight.trim() || null,
        packSize: packSizeNum,
        packLabel: packLabel.trim() || "Pcs",
        mrpPaise,
        priceAPaise,
        priceBPaise,
        priceCPaise,
        ratePaise: priceCPaise,
        hsn: hsn.trim() || undefined,
        gstRateBp,
        companyId: companyId || null,
        categoryId: categoryId || null,
        imageUrl: imageUrl.trim() || null,
      });

      if (!res.success || !res.product) {
        setErrorMsg((res as any).error || "Failed to update product details.");
        return;
      }

      onProductUpdated(res.product);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong while saving.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search filter for switcher
  const filteredProducts = productSearch.trim()
    ? allProducts.filter((p) =>
        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.shortCode && p.shortCode.toLowerCase().includes(productSearch.toLowerCase())) ||
        (p.weight && p.weight.toLowerCase().includes(productSearch.toLowerCase()))
      ).slice(0, 8)
    : [];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        } else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          handleSubmit();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#12355B] to-[#1E4E79] text-white px-5 py-3.5 flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/10 text-[#FC830D]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight">Edit Product Master</h3>
                <span className="text-[10px] font-black bg-[#FC830D] text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Alt+M
                </span>
                {selectedProduct?.shortCode && (
                  <span className="text-[11px] font-mono font-bold bg-white/15 text-slate-200 px-2 py-0.5 rounded">
                    {selectedProduct.shortCode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                Changes permanently update the product catalog and sync active bill line immediately
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Product Switcher Bar (if user wants to pick another product) */}
        <div className="px-5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 flex-1 relative">
            <span className="font-bold text-slate-500 shrink-0">Editing:</span>
            {isSearchingProduct ? (
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item to switch..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-[#12355B] outline-none"
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProduct(p);
                          populateForm(p);
                          setIsSearchingProduct(false);
                          setProductSearch("");
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center justify-between text-xs"
                      >
                        <span className="font-bold text-slate-800 truncate">{p.name}</span>
                        <span className="font-mono text-[10px] text-slate-500">₹{(p.mrpPaise ? p.mrpPaise / 100 : 0).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className="font-black text-slate-800 truncate max-w-xs">{name || "No item selected"}</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsSearchingProduct((prev) => !prev)}
            className="text-[11px] font-bold text-[#12355B] hover:text-[#FC830D] underline ml-2 shrink-0 cursor-pointer"
          >
            {isSearchingProduct ? "Done" : "Switch Product"}
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Top Row: Photo Preview + Name & Barcode */}
          <div className="flex gap-4 items-start">
            {/* Photo / Thumbnail Box */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mediaUrl(imageUrl, 160) || imageUrl}
                    alt={name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "/brand/jmd-cart-logo.png";
                    }}
                  />
                ) : (
                  <div className="text-center p-2">
                    <Camera className="w-6 h-6 text-slate-400 mx-auto" />
                    <span className="text-[9px] text-slate-400 block font-semibold mt-1">No Image</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Change Photo"
                className="absolute inset-0 bg-black/50 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] font-bold"
              >
                <UploadCloud className="w-4 h-4 mb-0.5" />
                <span>{isUploading ? "Uploading..." : "Change"}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Name & Barcode */}
            <div className="flex-1 space-y-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Product Name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Bikaji Bhujia 400g"
                  className="w-full px-3 py-1.5 text-sm font-bold bg-white border border-slate-300 rounded-xl focus:border-[#12355B] focus:ring-2 focus:ring-[#12355B]/20 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Item Code (Short Code)</label>
                  <input
                    type="text"
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value.toUpperCase())}
                    placeholder="e.g. P001"
                    className="w-full px-2.5 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Weight / Grammage</label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder="e.g. 400g, 1kg"
                    className="w-full px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pack Size, Brand & Category */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pieces / Carton</label>
              <input
                type="number"
                min="1"
                value={packSize}
                onChange={(e) => setPackSize(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold text-center bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pack Label</label>
              <select
                value={packLabel}
                onChange={(e) => setPackLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none cursor-pointer"
              >
                <option value="Pcs">Pcs</option>
                <option value="Carton">Carton (Crt)</option>
                <option value="Box">Box</option>
                <option value="Pkt">Packet (Pkt)</option>
                <option value="Bag">Bag (Beg)</option>
                <option value="Jar">Jar</option>
                <option value="Tin">Tin</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Company / Brand</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none cursor-pointer truncate"
              >
                <option value="">-- No Company --</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-2 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none cursor-pointer truncate"
              >
                <option value="">-- No Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* HSN & GST */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">HSN Code</label>
              <input
                type="text"
                value={hsn}
                onChange={(e) => setHsn(e.target.value)}
                placeholder="e.g. 21069099"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">GST Rate (%)</label>
              <select
                value={gstRateBp}
                onChange={(e) => setGstRateBp(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:border-[#12355B] outline-none cursor-pointer"
              >
                <option value={0}>0% (Exempt)</option>
                <option value={500}>5% (Standard Grocery)</option>
                <option value={1200}>12% (Food Items / Ghee)</option>
                <option value={1800}>18% (Confectionery / FMCG)</option>
                <option value={2800}>28% (Luxury / Aerated)</option>
              </select>
            </div>
          </div>

          {/* Base MRP Input Header */}
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Base MRP (Printed Price)</span>
              <p className="text-[10px] text-slate-500">Updating MRP auto-recalculates rates for all 3 tiers</p>
            </div>
            <div className="relative inline-flex items-center w-36">
              <span className="absolute left-2.5 text-slate-500 font-bold text-xs pointer-events-none">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={mrpRs}
                onChange={(e) => handleMrpChange(e.target.value)}
                className="w-full pl-6 pr-2.5 py-1.5 text-right font-mono font-black text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#12355B] focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* 3 Dedicated Pricing Tiers (A, B, C) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tier A (Distributor / Mandi Carton) */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-purple-900 uppercase">Tier A: Mandi / Bulk</span>
                <span className="text-[9px] font-bold bg-purple-200 text-purple-800 px-1.5 py-0.2 rounded">Carton</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-purple-700 block">Rate (₹)</span>
                  <div className="relative inline-flex items-center w-full">
                    <span className="absolute left-2 text-purple-600 font-bold text-[10px] pointer-events-none">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={priceARs}
                      onChange={(e) => handleRateAChange(e.target.value)}
                      className="w-full pl-5 pr-2 py-1 text-right font-mono font-black text-xs text-purple-950 bg-white border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-purple-700 block">Discount (%)</span>
                  <div className="relative inline-flex items-center w-full">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={discAPercent}
                      onChange={(e) => handlePercentAChange(e.target.value)}
                      className="w-full pl-2 pr-5 py-1 text-right font-mono font-bold text-xs text-purple-950 bg-white border border-purple-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                    <span className="absolute right-2 text-purple-600 font-bold text-[10px] pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier B (Wholesale / Kirana) */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-900 uppercase">Tier B: Wholesale</span>
                <span className="text-[9px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.2 rounded">Kirana</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-amber-700 block">Rate (₹)</span>
                  <div className="relative inline-flex items-center w-full">
                    <span className="absolute left-2 text-amber-600 font-bold text-[10px] pointer-events-none">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={priceBRs}
                      onChange={(e) => handleRateBChange(e.target.value)}
                      className="w-full pl-5 pr-2 py-1 text-right font-mono font-black text-xs text-amber-950 bg-white border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-amber-700 block">Discount (%)</span>
                  <div className="relative inline-flex items-center w-full">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={discBPercent}
                      onChange={(e) => handlePercentBChange(e.target.value)}
                      className="w-full pl-2 pr-5 py-1 text-right font-mono font-bold text-xs text-amber-950 bg-white border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 outline-none"
                    />
                    <span className="absolute right-2 text-amber-600 font-bold text-[10px] pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tier C (Retail / Counter POS) */}
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-emerald-900 uppercase">Tier C: Retail POS</span>
                <span className="text-[9px] font-bold bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded">Default</span>
              </div>
              <div className="space-y-1.5">
                <div>
                  <span className="text-[10px] font-semibold text-emerald-700 block">Rate (₹)</span>
                  <div className="relative inline-flex items-center w-full">
                    <span className="absolute left-2 text-emerald-600 font-bold text-[10px] pointer-events-none">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={priceCRs}
                      onChange={(e) => handleRateCChange(e.target.value)}
                      className="w-full pl-5 pr-2 py-1 text-right font-mono font-black text-xs text-emerald-950 bg-white border border-emerald-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-emerald-700 block">Discount (%)</span>
                  <div className="relative inline-flex items-center w-full">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="0.0"
                      value={discCPercent}
                      onChange={(e) => handlePercentCChange(e.target.value)}
                      className="w-full pl-2 pr-5 py-1 text-right font-mono font-bold text-xs text-emerald-950 bg-white border border-emerald-300 rounded focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <span className="absolute right-2 text-emerald-600 font-bold text-[10px] pointer-events-none">%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer with Actions */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-medium hidden sm:inline-block">
            Press <kbd className="font-mono bg-white border border-slate-300 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-2xs">Ctrl+Enter</kbd> to save
          </span>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel (Esc)
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-black text-white bg-[#12355B] hover:bg-[#0E2A47] active:scale-98 rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Product Master</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
