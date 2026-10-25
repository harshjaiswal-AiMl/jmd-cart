"use client";

import { useState, useTransition } from "react";
import { ProductWithDetails } from "@/modules/catalog/catalog.types";
import {
  createProductAction,
  updateProductAction,
  updateProductPricesInlineAction,
  bulkSetPricesPercentOffMrpAction,
  updateProductImageAction,
  deleteProductAction,
  bulkDeleteProductsAction,
  bulkUpdateProductsAction,
  bulkCreateProductsAction,
  CatalogActionResult,
} from "./actions";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { ProductImage } from "@/components/common/ProductImage";
import { PackLabelSelector } from "./PackLabelSelector";

interface CatalogClientProps {
  initialProducts: ProductWithDetails[];
  companies: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  readOnly?: boolean;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-[#790E11] hover:bg-[#5E0A0D] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#790E11] disabled:opacity-50 transition-colors"
    >
      {pending ? "Saving..." : "Save Product"}
    </button>
  );
}

function formatPaiseToInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return (paise / 100).toFixed(2);
}

function parseInputToPaise(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function computeMarginPctHint(mrpPaise: number | null, listPaise: number | null): string | null {
  if (mrpPaise == null || mrpPaise <= 0 || listPaise == null) return null;
  const pct = ((mrpPaise - listPaise) / mrpPaise) * 100;
  const sign = pct >= 0 ? "-" : "+";
  return `${sign}${Math.abs(pct).toFixed(1)}% vs MRP`;
}

function getOrderingWarnings(p: {
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
}): string[] {
  const warnings: string[] = [];
  if (p.priceAPaise != null && p.priceBPaise != null && p.priceAPaise > p.priceBPaise) {
    warnings.push("A > B");
  }
  if (p.priceBPaise != null && p.priceCPaise != null && p.priceBPaise > p.priceCPaise) {
    warnings.push("B > C");
  }
  if (p.mrpPaise != null && p.mrpPaise > 0) {
    if (p.priceCPaise != null && p.priceCPaise > p.mrpPaise) warnings.push("C > MRP");
    if (p.priceBPaise != null && p.priceBPaise > p.mrpPaise) warnings.push("B > MRP");
    if (p.priceAPaise != null && p.priceAPaise > p.mrpPaise) warnings.push("A > MRP");
  }
  return warnings;
}

interface BulkAddRow {
  id: string;
  name: string;
  shortCode: string;
  companyId: string;
  categoryId: string;
  packSize: number;
  packLabel: string;
  mrpRupees: string;
  priceARupees: string;
  priceBRupees: string;
  priceCRupees: string;
  gstRateBp: number;
}

export function CatalogClient({
  initialProducts,
  companies,
  categories,
  readOnly = false,
}: CatalogClientProps) {
  const [products, setProducts] = useState<ProductWithDetails[]>(initialProducts);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Bulk Add Products Modal State
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkAddRows, setBulkAddRows] = useState<BulkAddRow[]>([
    { id: "1", name: "", shortCode: "", companyId: "", categoryId: "", packSize: 1, packLabel: "Carton", mrpRupees: "", priceARupees: "", priceBRupees: "", priceCRupees: "", gstRateBp: 0 },
    { id: "2", name: "", shortCode: "", companyId: "", categoryId: "", packSize: 1, packLabel: "Carton", mrpRupees: "", priceARupees: "", priceBRupees: "", priceCRupees: "", gstRateBp: 0 },
    { id: "3", name: "", shortCode: "", companyId: "", categoryId: "", packSize: 1, packLabel: "Carton", mrpRupees: "", priceARupees: "", priceBRupees: "", priceCRupees: "", gstRateBp: 0 },
    { id: "4", name: "", shortCode: "", companyId: "", categoryId: "", packSize: 1, packLabel: "Carton", mrpRupees: "", priceARupees: "", priceBRupees: "", priceCRupees: "", gstRateBp: 0 },
    { id: "5", name: "", shortCode: "", companyId: "", categoryId: "", packSize: 1, packLabel: "Carton", mrpRupees: "", priceARupees: "", priceBRupees: "", priceCRupees: "", gstRateBp: 0 },
  ]);
  const [bulkAddPctA, setBulkAddPctA] = useState("25");
  const [bulkAddPctB, setBulkAddPctB] = useState("20");
  const [bulkAddPctC, setBulkAddPctC] = useState("15");
  const [bulkAddErrors, setBulkAddErrors] = useState<string[]>([]);

  // Image handling state for new product modal
  const [newProductImageUrl, setNewProductImageUrl] = useState("");
  const [newImageUploading, setNewImageUploading] = useState(false);

  // Quick image edit modal state
  const [editingImageProduct, setEditingImageProduct] = useState<ProductWithDetails | null>(null);
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Full product edit modal state
  const [editingProduct, setEditingProduct] = useState<ProductWithDetails | null>(null);
  const [editProductImageUrl, setEditProductImageUrl] = useState("");
  const [editProductImageUploading, setEditProductImageUploading] = useState(false);
  const [updateProductPending, setUpdateProductPending] = useState(false);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPctA, setBulkPctA] = useState("22");
  const [bulkPctB, setBulkPctB] = useState("21");
  const [bulkPctC, setBulkPctC] = useState("20");
  const [showBulkPercentTools, setShowBulkPercentTools] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Bulk Edit Modal State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState<{
    companyId: string;
    categoryId: string;
    packSize: string;
    packLabel: string;
    gstRateBp: string;
    active: "unchanged" | "active" | "inactive";
    mrpRupees: string;
    priceARupees: string;
    priceBRupees: string;
    priceCRupees: string;
  }>({
    companyId: "",
    categoryId: "",
    packSize: "",
    packLabel: "",
    gstRateBp: "",
    active: "unchanged",
    mrpRupees: "",
    priceARupees: "",
    priceBRupees: "",
    priceCRupees: "",
  });

  // Delete Confirmation Modal State (single or bulk)
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    mode: "single" | "bulk";
    product?: ProductWithDetails;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline edits state map: productId -> { mrp, a, b, c, packSize }
  const [inlineEdits, setInlineEdits] = useState<
    Record<
      string,
      {
        mrp: string;
        a: string;
        b: string;
        c: string;
        packSize: string;
        dirty?: boolean;
      }
    >
  >({});

  const [createState, formAction] = useFormState<CatalogActionResult | undefined, FormData>(
    async (prev, formData) => {
      const res = await createProductAction(prev, formData);
      if (res?.success) {
        setIsAddOpen(false);
        window.location.reload();
      }
      return res;
    },
    undefined
  );

  const filteredProducts = products.filter((product) => {
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

  const getRowValues = (p: ProductWithDetails) => {
    const edit = inlineEdits[p.id];
    if (edit) return edit;
    return {
      mrp: formatPaiseToInput(p.mrpPaise),
      a: formatPaiseToInput(p.priceAPaise),
      b: formatPaiseToInput(p.priceBPaise),
      c: formatPaiseToInput(p.priceCPaise),
      packSize: String(p.packSize ?? 1),
      dirty: false,
    };
  };

  const handleInlineChange = (
    p: ProductWithDetails,
    field: "mrp" | "a" | "b" | "c" | "packSize",
    value: string
  ) => {
    const current = getRowValues(p);
    setInlineEdits((prev) => ({
      ...prev,
      [p.id]: {
        ...current,
        [field]: value,
        dirty: true,
      },
    }));
  };

  const handleSaveRow = (p: ProductWithDetails) => {
    const row = getRowValues(p);
    const mrpPaise = parseInputToPaise(row.mrp);
    const priceAPaise = parseInputToPaise(row.a);
    const priceBPaise = parseInputToPaise(row.b);
    const priceCPaise = parseInputToPaise(row.c);
    const packSize = Math.max(1, parseInt(row.packSize || "1", 10) || 1);

    startTransition(async () => {
      const res = await updateProductPricesInlineAction({
        id: p.id,
        mrpPaise,
        priceAPaise,
        priceBPaise,
        priceCPaise,
        packSize,
      });

      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setProducts((prev) =>
          prev.map((item) =>
            item.id === p.id
              ? {
                  ...item,
                  mrpPaise,
                  priceAPaise,
                  priceBPaise,
                  priceCPaise,
                  packSize,
                }
              : item
          )
        );
        setInlineEdits((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
        setStatusMessage({ type: "ok", text: `Saved prices for ${p.name}` });
      }
    });
  };

  async function handleFileUpload(
    file: File,
    onSuccess: (url: string) => void,
    setLoading: (b: boolean) => void
  ) {
    if (!file) return;
    setLoading(true);
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
      onSuccess(data.url);
      setStatusMessage({ type: "ok", text: "Photo uploaded successfully!" });
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err.message || "Failed to upload photo" });
    } finally {
      setLoading(false);
    }
  }

  const openEditImageModal = (product: ProductWithDetails) => {
    setEditingImageProduct(product);
    setEditImageUrl(product.imageUrl || "");
  };

  const handleSaveProductImage = async () => {
    if (!editingImageProduct) return;
    setIsSavingImage(true);
    try {
      const res = await updateProductImageAction(editingImageProduct.id, editImageUrl || null);
      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingImageProduct.id ? { ...p, imageUrl: editImageUrl ? editImageUrl.trim() : null } : p
          )
        );
        setStatusMessage({ type: "ok", text: `Updated photo for ${editingImageProduct.name}` });
        setEditingImageProduct(null);
      }
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err.message || "Failed to save photo" });
    } finally {
      setIsSavingImage(false);
    }
  };

  const openEditProductModal = (product: ProductWithDetails) => {
    setEditingProduct(product);
    setEditProductImageUrl(product.imageUrl || "");
  };

  const handleUpdateProductSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    setUpdateProductPending(true);
    try {
      const formData = new FormData(e.currentTarget);
      formData.set("id", editingProduct.id);
      formData.set("imageUrl", editProductImageUrl);
      const res = await updateProductAction(undefined, formData);
      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setStatusMessage({ type: "ok", text: `Successfully updated ${editingProduct.name}` });
        setEditingProduct(null);
        window.location.reload();
      }
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err.message || "Failed to update product" });
    } finally {
      setUpdateProductPending(false);
    }
  };

  const handleAddBulkRow = (count: number = 1) => {
    setBulkAddRows((prev) => {
      const newRows = [...prev];
      for (let i = 0; i < count; i++) {
        newRows.push({
          id: Math.random().toString(36).substring(2, 9),
          name: "",
          shortCode: "",
          companyId: "",
          categoryId: "",
          packSize: 1,
          packLabel: "Carton",
          mrpRupees: "",
          priceARupees: "",
          priceBRupees: "",
          priceCRupees: "",
          gstRateBp: 0,
        });
      }
      return newRows;
    });
  };

  const handleUpdateBulkRow = (id: string, field: keyof BulkAddRow, value: any) => {
    setBulkAddRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveBulkRow = (id: string) => {
    setBulkAddRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  };

  const handleAutoCalcBulkRates = () => {
    const pctA = parseFloat(bulkAddPctA) || 0;
    const pctB = parseFloat(bulkAddPctB) || 0;
    const pctC = parseFloat(bulkAddPctC) || 0;

    setBulkAddRows((prev) =>
      prev.map((row) => {
        const mrp = parseFloat(row.mrpRupees);
        if (!isNaN(mrp) && mrp > 0) {
          return {
            ...row,
            priceARupees: (mrp * (1 - pctA / 100)).toFixed(2),
            priceBRupees: (mrp * (1 - pctB / 100)).toFixed(2),
            priceCRupees: (mrp * (1 - pctC / 100)).toFixed(2),
          };
        }
        return row;
      })
    );
  };

  const handleSaveBulkProducts = async () => {
    const activeRows = bulkAddRows.filter(
      (r) => r.name.trim().length > 0 || r.shortCode.trim().length > 0
    );

    if (activeRows.length === 0) {
      setBulkAddErrors(["Please fill in at least one product with name and code."]);
      return;
    }

    const errors: string[] = [];
    const validItems: any[] = [];

    activeRows.forEach((row, idx) => {
      if (!row.name.trim()) {
        errors.push(`Row ${idx + 1}: Name is required`);
        return;
      }
      if (!row.shortCode.trim()) {
        errors.push(`Row ${idx + 1} (${row.name}): Code / SKU is required`);
        return;
      }

      const mrpPaise = row.mrpRupees.trim() ? Math.round(parseFloat(row.mrpRupees) * 100) : null;
      const priceAPaise = row.priceARupees.trim() ? Math.round(parseFloat(row.priceARupees) * 100) : null;
      const priceBPaise = row.priceBRupees.trim() ? Math.round(parseFloat(row.priceBRupees) * 100) : null;
      const priceCPaise = row.priceCRupees.trim() ? Math.round(parseFloat(row.priceCRupees) * 100) : null;

      validItems.push({
        name: row.name.trim(),
        shortCode: row.shortCode.trim().toUpperCase(),
        companyId: row.companyId || undefined,
        categoryId: row.categoryId || undefined,
        packSize: Number(row.packSize) || 1,
        packLabel: row.packLabel.trim() || "Carton",
        mrpPaise,
        priceAPaise,
        priceBPaise,
        priceCPaise,
        gstRateBp: Number(row.gstRateBp) || 0,
        active: true,
      });
    });

    if (errors.length > 0) {
      setBulkAddErrors(errors);
      return;
    }

    setIsBulkCreating(true);
    setBulkAddErrors([]);

    try {
      const res = await bulkCreateProductsAction(validItems);
      if (res.error) {
        setBulkAddErrors([res.error]);
      } else if (res.errors && res.errors.length > 0) {
        setBulkAddErrors(res.errors.map((e) => `${e.name}: ${e.error}`));
        if (res.createdCount && res.createdCount > 0) {
          setStatusMessage({
            type: "ok",
            text: `Successfully created ${res.createdCount} products! Some items had errors below.`,
          });
        }
      } else {
        setStatusMessage({
          type: "ok",
          text: `Successfully created ${res.createdCount} products in catalog!`,
        });
        setIsBulkAddOpen(false);
        window.location.reload();
      }
    } catch (err: any) {
      setBulkAddErrors([err.message || "Failed to save products"]);
    } finally {
      setIsBulkCreating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkPercentApply = () => {
    if (selectedIds.size === 0) return;
    const pctA = Number(bulkPctA);
    const pctB = Number(bulkPctB);
    const pctC = Number(bulkPctC);

    if (!Number.isFinite(pctA) || !Number.isFinite(pctB) || !Number.isFinite(pctC)) {
      setStatusMessage({ type: "err", text: "Enter valid numeric percentages for A, B, and C" });
      return;
    }

    startTransition(async () => {
      const ids = Array.from(selectedIds);
      const res = await bulkSetPricesPercentOffMrpAction({
        productIds: ids,
        pctA,
        pctB,
        pctC,
      });

      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setProducts((prev) =>
          prev.map((item) => {
            if (!selectedIds.has(item.id) || item.mrpPaise == null || item.mrpPaise <= 0) {
              return item;
            }
            const mrp = item.mrpPaise;
            return {
              ...item,
              priceAPaise: Math.round((mrp * (100 - pctA)) / 100),
              priceBPaise: Math.round((mrp * (100 - pctB)) / 100),
              priceCPaise: Math.round((mrp * (100 - pctC)) / 100),
            };
          })
        );
        setInlineEdits({});
        setStatusMessage({
          type: "ok",
          text: `Applied ${pctA}% / ${pctB}% / ${pctC}% off MRP to ${res.updatedCount ?? 0} product(s).`,
        });
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      if (deleteModal.mode === "single" && deleteModal.product) {
        const prodId = deleteModal.product.id;
        const prodName = deleteModal.product.name;
        const res = await deleteProductAction(prodId);
        if (res.error) {
          setStatusMessage({ type: "err", text: res.error });
        } else {
          setProducts((prev) => prev.filter((p) => p.id !== prodId));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(prodId);
            return next;
          });
          setStatusMessage({
            type: "ok",
            text: `Product "${prodName}" deleted / archived successfully.`,
          });
          setDeleteModal(null);
        }
      } else if (deleteModal.mode === "bulk") {
        const ids = Array.from(selectedIds);
        const res = await bulkDeleteProductsAction(ids);
        if (res.error) {
          setStatusMessage({ type: "err", text: res.error });
        } else {
          setProducts((prev) => prev.filter((p) => !selectedIds.has(p.id)));
          setSelectedIds(new Set());
          setStatusMessage({
            type: "ok",
            text: `Bulk delete complete: ${res.deletedCount ?? 0} permanently deleted, ${res.deactivatedCount ?? 0} safely archived.`,
          });
          setDeleteModal(null);
        }
      }
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err?.message || "Failed to delete" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    setIsBulkUpdating(true);
    try {
      const input: any = {
        productIds: Array.from(selectedIds),
      };
      if (bulkEditForm.companyId) {
        input.companyId = bulkEditForm.companyId === "__NONE__" ? null : bulkEditForm.companyId;
      }
      if (bulkEditForm.categoryId) {
        input.categoryId = bulkEditForm.categoryId === "__NONE__" ? null : bulkEditForm.categoryId;
      }
      if (bulkEditForm.packSize.trim()) {
        const sz = parseInt(bulkEditForm.packSize, 10);
        if (Number.isFinite(sz) && sz > 0) input.packSize = sz;
      }
      if (bulkEditForm.packLabel.trim()) {
        input.packLabel = bulkEditForm.packLabel.trim();
      }
      if (bulkEditForm.gstRateBp !== "") {
        const bp = parseInt(bulkEditForm.gstRateBp, 10);
        if (Number.isFinite(bp)) input.gstRateBp = bp;
      }
      if (bulkEditForm.active === "active") input.active = true;
      if (bulkEditForm.active === "inactive") input.active = false;

      if (bulkEditForm.mrpRupees.trim()) {
        input.mrpPaise = parseInputToPaise(bulkEditForm.mrpRupees);
      }
      if (bulkEditForm.priceARupees.trim()) {
        input.priceAPaise = parseInputToPaise(bulkEditForm.priceARupees);
      }
      if (bulkEditForm.priceBRupees.trim()) {
        input.priceBPaise = parseInputToPaise(bulkEditForm.priceBRupees);
      }
      if (bulkEditForm.priceCRupees.trim()) {
        input.priceCPaise = parseInputToPaise(bulkEditForm.priceCRupees);
      }

      const res = await bulkUpdateProductsAction(input);
      if (res.error) {
        setStatusMessage({ type: "err", text: res.error });
      } else {
        setStatusMessage({
          type: "ok",
          text: `Bulk updated ${res.updatedCount ?? selectedIds.size} products successfully!`,
        });
        setIsBulkEditOpen(false);
        // Reset form
        setBulkEditForm({
          companyId: "",
          categoryId: "",
          packSize: "",
          packLabel: "",
          gstRateBp: "",
          active: "unchanged",
          mrpRupees: "",
          priceARupees: "",
          priceBRupees: "",
          priceCRupees: "",
        });
        // Reload to sync fresh relations and tier prices
        window.location.reload();
      }
    } catch (err: any) {
      setStatusMessage({ type: "err", text: err?.message || "Failed to bulk update products" });
    } finally {
      setIsBulkUpdating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Controls: Search, Filters, Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search by product name, SKU, or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg text-sm focus:ring-[#790E11] focus:border-[#790E11]"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              🔍
            </div>
          </div>

          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Brands ({companies.length})</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/catalog/import"
              className="inline-flex items-center justify-center px-3.5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              📥 Import Excel Sheet
            </Link>
            <button
              onClick={() => {
                setBulkAddErrors([]);
                setIsBulkAddOpen(true);
              }}
              className="inline-flex items-center justify-center px-4 py-2 border border-emerald-600 rounded-lg shadow-sm text-sm font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              📑 + Bulk Add Products
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-[#790E11] hover:bg-[#5E0A0D] transition-colors"
            >
              + Add Product
            </button>
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="bg-[#FEFDF7] border border-[#FDAF18] rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#790E11] text-white">
                {selectedIds.size} of {filteredProducts.length} selected
              </span>
              <span className="text-xs text-gray-600 font-medium hidden sm:inline">
                Bulk actions across selected catalog items
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-colors"
                title="Edit common fields across all selected products"
              >
                <span>✏️</span> Bulk Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteModal({ open: true, mode: "bulk" })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors"
                title="Delete or safely archive selected products"
              >
                <span>🗑️</span> Delete Selected
              </button>
              <button
                type="button"
                onClick={() => setShowBulkPercentTools((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm transition-colors"
              >
                <span>⚡</span> {showBulkPercentTools ? "Hide % Off MRP" : "% Off MRP Tool"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold border border-gray-200 transition-colors"
              >
                ✕ Deselect All
              </button>
            </div>
          </div>

          {showBulkPercentTools && (
            <div className="pt-3 border-t border-amber-200/60 flex flex-wrap items-center justify-between gap-3 bg-amber-50/50 p-2.5 rounded-lg">
              <p className="text-xs text-gray-700 font-medium">
                Set Wholesaler (A), Retailer (B), and Customer (C) prices as % discount off MRP:
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">A (% off):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bulkPctA}
                    onChange={(e) => setBulkPctA(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs font-mono text-right bg-white"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">B (% off):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bulkPctB}
                    onChange={(e) => setBulkPctB(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs font-mono text-right bg-white"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-semibold text-gray-700">C (% off):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bulkPctC}
                    onChange={(e) => setBulkPctC(e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-xs font-mono text-right bg-white"
                  />
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleBulkPercentApply}
                  className="px-3.5 py-1.5 rounded-lg bg-[#FC830D] hover:bg-[#e07208] text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Applying..." : "Apply % off MRP"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center justify-between ${
            statusMessage.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Product Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Mustard OilPouch"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    name="weight"
                    placeholder="e.g. 1Ltr, 100g"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Short Code / SKU
                  </label>
                  <input
                    type="text"
                    name="shortCode"
                    required
                    placeholder="e.g. SAL-MOIL-1L"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Company / Brand
                  </label>
                  <select
                    name="companyId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Select Brand --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Category
                  </label>
                  <select
                    name="categoryId"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="mrpRupees"
                    placeholder="225.00"
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Price A — Wholesaler (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceARupees"
                    placeholder="176.25"
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Price B — Retailer (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceBRupees"
                    placeholder="177.25"
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Price C — Customer (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceCRupees"
                    placeholder="178.00"
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Qty in Case (Pcs / Carton)
                  </label>
                  <input
                    type="number"
                    name="packSize"
                    defaultValue={12}
                    min={1}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    name="hsn"
                    defaultValue="0000"
                    required
                    maxLength={8}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    GST Slab
                  </label>
                  <select
                    name="gstRateBp"
                    defaultValue={500}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={500}>5%</option>
                    <option value={1200}>12%</option>
                    <option value={1800}>18%</option>
                    <option value={2800}>28%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Pack Label
                  </label>
                  <PackLabelSelector name="packLabel" defaultValue="Carton" required />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Reorder Level (Pcs)
                  </label>
                  <input
                    type="number"
                    name="reorderLevel"
                    defaultValue={0}
                    min={0}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                {/* Product Image Section */}
                <div className="md:col-span-3 bg-gray-50/80 p-3.5 rounded-lg border border-dashed border-gray-300">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          handleFileUpload(file, setNewProductImageUrl, setNewImageUploading);
                        }
                      }}
                      className="w-20 h-20 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm relative group"
                    >
                      {newProductImageUrl ? (
                        <>
                          <ProductImage
                            src={newProductImageUrl}
                            alt="Preview"
                            className="w-full h-full object-contain p-1"
                          />
                          <button
                            type="button"
                            onClick={() => setNewProductImageUrl("")}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 text-xs hover:bg-red-700 shadow"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs text-center px-1">
                          {newImageUploading ? "Uploading..." : "No Photo"}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                          Product Photo (Packshot)
                        </label>
                        <span className="text-[11px] text-gray-500 font-medium">Square 1:1, White BG, &lt;200KB</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-sm">
                          <span>📁 Browse from Device</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={newImageUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, setNewProductImageUrl, setNewImageUploading);
                              }
                            }}
                          />
                        </label>
                        <span className="text-xs text-gray-400">or enter URL:</span>
                        <input
                          type="text"
                          name="imageUrl"
                          value={newProductImageUrl}
                          onChange={(e) => setNewProductImageUrl(e.target.value)}
                          placeholder="https://... or /uploads/..."
                          className="flex-1 min-w-[200px] px-2.5 py-1.5 border border-gray-300 rounded-md text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <SubmitButton />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product & Price List Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2 bg-gray-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Showing {filteredProducts.length} of {products.length} products
            </span>
            {selectedIds.size > 0 && !readOnly && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#790E11] text-white">
                  {selectedIds.size} selected
                </span>
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(true)}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
                  title="Bulk edit selected products"
                >
                  ✏️ Bulk Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteModal({ open: true, mode: "bulk" })}
                  className="px-2.5 py-1 rounded-md text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm"
                  title="Delete or safely archive selected products"
                >
                  🗑️ Delete Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <strong>List A</strong>: Wholesaler
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <strong>List B</strong>: Retailer
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <strong>List C</strong>: Customer / Walk-in
            </span>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-gray-500 text-sm">
              {products.length === 0
                ? "No products in the catalog yet. Add a product or import a brand price sheet (.xlsx / .csv)."
                : "No products found matching your search query."}
            </p>
            {!readOnly && products.length === 0 && (
              <div className="flex justify-center gap-3 pt-2">
                <Link
                  href="/admin/catalog/import"
                  className="px-4 py-2 rounded-lg bg-[#790E11] text-white text-xs font-bold hover:bg-[#5E0A0D]"
                >
                  Upload Brand Excel Sheet
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs font-semibold uppercase tracking-wider text-left">
                <tr>
                  {!readOnly && (
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          filteredProducts.length > 0 &&
                          selectedIds.size === filteredProducts.length
                        }
                        onChange={toggleSelectAll}
                        aria-label="Select all products"
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 w-14 text-center">Photo</th>
                  <th className="px-3 py-3">Item / SKU</th>
                  <th className="px-3 py-3">Brand</th>
                  <th className="px-3 py-3 text-center">Qty in Case (Pcs/Ctn)</th>
                  <th className="px-3 py-3 text-right">MRP (₹)</th>
                  <th className="px-3 py-3 text-right text-emerald-800">A — Wholesaler (₹)</th>
                  <th className="px-3 py-3 text-right text-blue-800">B — Retailer (₹)</th>
                  <th className="px-3 py-3 text-right text-amber-800">C — Customer (₹)</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  {!readOnly && <th className="px-3 py-3 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts.map((p) => {
                  const row = getRowValues(p);
                  const mrpPaiseVal = parseInputToPaise(row.mrp);
                  const aPaiseVal = parseInputToPaise(row.a);
                  const bPaiseVal = parseInputToPaise(row.b);
                  const cPaiseVal = parseInputToPaise(row.c);

                  const warnings = getOrderingWarnings({
                    mrpPaise: mrpPaiseVal,
                    priceAPaise: aPaiseVal,
                    priceBPaise: bPaiseVal,
                    priceCPaise: cPaiseVal,
                  });

                  const hintA = computeMarginPctHint(mrpPaiseVal, aPaiseVal);
                  const hintB = computeMarginPctHint(mrpPaiseVal, bPaiseVal);
                  const hintC = computeMarginPctHint(mrpPaiseVal, cPaiseVal);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50/75 transition-colors">
                      {!readOnly && (
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelectOne(p.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center justify-center gap-1">
                          {p.imageUrl ? (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditImageModal(p)}
                                title="Click to view/re-upload photo"
                                className="w-11 h-11 rounded-lg border border-gray-200 bg-white p-0.5 hover:border-[#790E11] transition-all shadow-sm flex items-center justify-center overflow-hidden"
                              >
                                <ProductImage
                                  src={p.imageUrl}
                                  alt={p.name}
                                  className="w-full h-full object-contain"
                                />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditImageModal(p)}
                                className="text-[10px] font-semibold text-[#790E11] hover:text-[#5E0A0D] hover:underline flex items-center gap-0.5"
                                title="Re-upload photo"
                              >
                                <span>🔄</span> Re-upload
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEditImageModal(p)}
                              className="px-2 py-1 rounded-md border border-dashed border-gray-300 hover:border-[#790E11] hover:bg-red-50/50 flex items-center gap-1 text-gray-500 hover:text-[#790E11] text-[10px] font-semibold transition-all"
                              title="Upload product photo"
                            >
                              <span>📷</span> +Upload
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.weight && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700 rounded">
                              {p.weight}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-gray-500">{p.shortCode}</div>
                        {warnings.length > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-semibold text-amber-800">
                            ⚠️ Check order: {warnings.join(", ")}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-gray-600 text-xs font-medium">
                        {p.company?.name || "—"}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {readOnly ? (
                          <span className="font-mono text-xs">{p.packSize} pcs</span>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            value={row.packSize}
                            onChange={(e) => handleInlineChange(p, "packSize", e.target.value)}
                            className="w-16 px-2 py-1 text-center font-mono text-xs border border-gray-300 rounded focus:border-[#790E11]"
                          />
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {readOnly ? (
                          <span className="font-mono">
                            {p.mrpPaise != null ? `₹${(p.mrpPaise / 100).toFixed(2)}` : "—"}
                          </span>
                        ) : (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              value={row.mrp}
                              onChange={(e) => handleInlineChange(p, "mrp", e.target.value)}
                              className="w-24 px-2 py-1 text-right font-mono text-xs border border-gray-300 rounded focus:border-[#790E11]"
                            />
                            {mrpPaiseVal == null && (
                              <div className="text-[10px] text-amber-600 font-medium">
                                MRP missing
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {readOnly ? (
                          <span className="font-mono text-emerald-700 font-semibold">
                            {p.priceAPaise != null ? `₹${(p.priceAPaise / 100).toFixed(2)}` : "—"}
                          </span>
                        ) : (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              value={row.a}
                              onChange={(e) => handleInlineChange(p, "a", e.target.value)}
                              className="w-24 px-2 py-1 text-right font-mono text-xs border border-emerald-300 bg-emerald-50/30 rounded focus:border-emerald-600"
                            />
                            {hintA && (
                              <div className="text-[10px] text-emerald-700 font-mono">{hintA}</div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {readOnly ? (
                          <span className="font-mono text-blue-700 font-semibold">
                            {p.priceBPaise != null ? `₹${(p.priceBPaise / 100).toFixed(2)}` : "—"}
                          </span>
                        ) : (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              value={row.b}
                              onChange={(e) => handleInlineChange(p, "b", e.target.value)}
                              className="w-24 px-2 py-1 text-right font-mono text-xs border border-blue-300 bg-blue-50/30 rounded focus:border-blue-600"
                            />
                            {hintB && (
                              <div className="text-[10px] text-blue-700 font-mono">{hintB}</div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {readOnly ? (
                          <span className="font-mono text-amber-700 font-semibold">
                            {p.priceCPaise != null ? `₹${(p.priceCPaise / 100).toFixed(2)}` : "—"}
                          </span>
                        ) : (
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="—"
                              value={row.c}
                              onChange={(e) => handleInlineChange(p, "c", e.target.value)}
                              className="w-24 px-2 py-1 text-right font-mono text-xs border border-amber-300 bg-amber-50/30 rounded focus:border-amber-600"
                            />
                            {hintC && (
                              <div className="text-[10px] text-amber-700 font-mono">{hintC}</div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            p.active
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {p.active ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {!readOnly && (
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditProductModal(p)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors shadow-sm"
                              title="Edit product details & prices"
                            >
                              <span>✏️</span> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModal({ open: true, mode: "single", product: p })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 transition-colors shadow-sm"
                              title="Delete or safely archive product"
                            >
                              <span>🗑️</span> Delete
                            </button>
                            {row.dirty && (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSaveRow(p)}
                                className="px-2.5 py-1 rounded-md text-xs font-bold bg-[#790E11] text-white hover:bg-[#5E0A0D] transition-colors shadow-sm"
                              >
                                Save
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Product Image Modal */}
      {editingImageProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100">
              <div>
                <h3 className="text-base font-bold text-gray-900">Re-upload / Change Photo</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  {editingImageProduct.shortCode} • {editingImageProduct.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingImageProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Preview Card & Drop Zone */}
              <div className="flex justify-center">
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      handleFileUpload(file, setEditImageUrl, setEditImageUploading);
                    }
                  }}
                  className={`w-40 h-40 bg-gray-50 border-2 ${
                    dragOver ? "border-[#790E11] bg-red-50/30 scale-105" : "border-dashed border-gray-300"
                  } rounded-xl flex items-center justify-center p-2 relative overflow-hidden shadow-inner transition-all`}
                >
                  {editImageUrl ? (
                    <ProductImage
                      src={editImageUrl}
                      alt="Product preview"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center text-gray-400 p-2">
                      <span className="text-3xl block">📷</span>
                      <span className="text-[11px] mt-1 block font-medium">Drop photo here or click below</span>
                    </div>
                  )}
                  {editImageUploading && (
                    <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center text-xs font-semibold text-[#790E11] gap-1.5 z-10">
                      <div className="w-5 h-5 border-2 border-[#790E11] border-t-transparent rounded-full animate-spin" />
                      <span>Uploading to R2...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Button & URL */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select New Photo (JPEG, PNG, WebP)
                  </label>
                  <label className="cursor-pointer inline-flex items-center justify-center gap-2 w-full px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 transition-colors shadow-sm">
                    <span>🔄 Re-upload Photo from Device</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={editImageUploading || isSavingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, setEditImageUrl, setEditImageUploading);
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Or Web Image URL
                  </label>
                  <input
                    type="text"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://... or /media/..."
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div className="bg-amber-50 border border-amber-200/60 rounded-lg p-2.5 text-[11px] text-amber-800">
                  💡 <strong>Tip for best look:</strong> 1:1 Square (800×800), clean white or transparent background, &lt; 200KB.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                {editingImageProduct.imageUrl ? (
                  <button
                    type="button"
                    disabled={isSavingImage}
                    onClick={() => setEditImageUrl("")}
                    className="text-xs text-red-600 hover:text-red-700 font-semibold"
                  >
                    Clear Photo
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingImageProduct(null)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSavingImage || editImageUploading}
                    onClick={handleSaveProductImage}
                    className="px-4 py-1.5 bg-[#790E11] text-white rounded-lg text-xs font-bold hover:bg-[#5E0A0D] disabled:opacity-50 transition-colors"
                  >
                    {isSavingImage ? "Saving..." : "Save Image"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Edit Product Master</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  SKU: {editingProduct.shortCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProductSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Product Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingProduct.name}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    name="weight"
                    defaultValue={editingProduct.weight || ""}
                    placeholder="e.g. 1Ltr, 100g"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Short Code / SKU
                  </label>
                  <input
                    type="text"
                    name="shortCode"
                    required
                    defaultValue={editingProduct.shortCode}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase font-mono bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Company / Brand
                  </label>
                  <select
                    name="companyId"
                    defaultValue={editingProduct.companyId || ""}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Select Brand --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Category
                  </label>
                  <select
                    name="categoryId"
                    defaultValue={editingProduct.categoryId || ""}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
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
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="mrpRupees"
                    defaultValue={formatPaiseToInput(editingProduct.mrpPaise)}
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-emerald-700">
                    Price A — Wholesaler (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceARupees"
                    defaultValue={formatPaiseToInput(editingProduct.priceAPaise)}
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-blue-700">
                    Price B — Retailer (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceBRupees"
                    defaultValue={formatPaiseToInput(editingProduct.priceBPaise)}
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Price C — Customer (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    name="priceCRupees"
                    defaultValue={formatPaiseToInput(editingProduct.priceCPaise)}
                    min="0"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Qty in Case (Pcs / Ctn)
                  </label>
                  <input
                    type="number"
                    name="packSize"
                    defaultValue={editingProduct.packSize}
                    min={1}
                    required
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    HSN Code
                  </label>
                  <input
                    type="text"
                    name="hsn"
                    defaultValue={editingProduct.hsn}
                    required
                    maxLength={8}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    GST Slab
                  </label>
                  <select
                    name="gstRateBp"
                    defaultValue={editingProduct.gstRateBp}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={500}>5%</option>
                    <option value={1200}>12%</option>
                    <option value={1800}>18%</option>
                    <option value={2800}>28%</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Pack Label
                  </label>
                  <PackLabelSelector
                    name="packLabel"
                    defaultValue={editingProduct.packLabel || "Carton"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Reorder Level (Pcs)
                  </label>
                  <input
                    type="number"
                    name="reorderLevel"
                    defaultValue={editingProduct.reorderLevel}
                    min={0}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="edit-active"
                    name="active"
                    value="true"
                    defaultChecked={editingProduct.active}
                    className="rounded border-gray-300 text-[#790E11] focus:ring-[#790E11]"
                  />
                  <label htmlFor="edit-active" className="text-xs font-semibold text-gray-700">
                    Active (Visible in Store & Catalog)
                  </label>
                </div>

                {/* Product Photo & Re-upload Section */}
                <div className="md:col-span-3 bg-gray-50/90 p-4 rounded-xl border border-gray-200">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          handleFileUpload(file, setEditProductImageUrl, setEditProductImageUploading);
                        }
                      }}
                      className="w-24 h-24 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm relative group"
                    >
                      {editProductImageUrl ? (
                        <>
                          <ProductImage
                            src={editProductImageUrl}
                            alt="Preview"
                            className="w-full h-full object-contain p-1"
                          />
                          <button
                            type="button"
                            onClick={() => setEditProductImageUrl("")}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs hover:bg-red-700 shadow"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400 text-xs text-center px-2">
                          {editProductImageUploading ? "Uploading..." : "No Photo"}
                        </span>
                      )}
                      {editProductImageUploading && (
                        <div className="absolute inset-0 bg-white/90 flex items-center justify-center text-[10px] font-semibold text-[#790E11]">
                          Uploading...
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-800">
                          Product Photo
                        </label>
                        <span className="text-[11px] text-gray-500 font-medium">Square 1:1, White BG, &lt;200KB</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 shadow-sm">
                          <span>🔄 Re-upload Photo</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            disabled={editProductImageUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, setEditProductImageUrl, setEditProductImageUploading);
                              }
                            }}
                          />
                        </label>
                        <span className="text-xs text-gray-400">or URL:</span>
                        <input
                          type="text"
                          value={editProductImageUrl}
                          onChange={(e) => setEditProductImageUrl(e.target.value)}
                          placeholder="https://... or /uploads/..."
                          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProductPending || editProductImageUploading}
                  className="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-[#790E11] hover:bg-[#5E0A0D] disabled:opacity-50 transition-colors"
                >
                  {updateProductPending ? "Saving..." : "Update Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Sticky Bottom Selection Bar */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-gray-700 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-semibold whitespace-nowrap">
              {selectedIds.size} Selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition-colors"
            >
              <span>✏️</span> Bulk Edit
            </button>
            <button
              type="button"
              onClick={() => setDeleteModal({ open: true, mode: "bulk" })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow transition-colors"
            >
              <span>🗑️</span> Delete Selected
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Bulk Edit Products</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Updating {selectedIds.size} selected products. Only fields you change will be updated.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkEditSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Brand / Company */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Brand / Company
                  </label>
                  <select
                    value={bulkEditForm.companyId}
                    onChange={(e) =>
                      setBulkEditForm((prev) => ({ ...prev, companyId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Keep Unchanged --</option>
                    <option value="__NONE__">-- Remove Brand (None) --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                  <select
                    value={bulkEditForm.categoryId}
                    onChange={(e) =>
                      setBulkEditForm((prev) => ({ ...prev, categoryId: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Keep Unchanged --</option>
                    <option value="__NONE__">-- Remove Category (None) --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Qty in Case / Pack Size */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Qty in Case (Pcs/Ctn)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="-- Keep Unchanged --"
                    value={bulkEditForm.packSize}
                    onChange={(e) =>
                      setBulkEditForm((prev) => ({ ...prev, packSize: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                </div>

                {/* Pack Label */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pack Label</label>
                  <PackLabelSelector
                    allowUnchanged
                    defaultValue=""
                    value={bulkEditForm.packLabel}
                    onChange={(val) =>
                      setBulkEditForm((prev) => ({ ...prev, packLabel: val }))
                    }
                  />
                </div>

                {/* GST Slab */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">GST Rate</label>
                  <select
                    value={bulkEditForm.gstRateBp}
                    onChange={(e) =>
                      setBulkEditForm((prev) => ({ ...prev, gstRateBp: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="">-- Keep Unchanged --</option>
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="500">5%</option>
                    <option value="1200">12%</option>
                    <option value="1800">18%</option>
                    <option value="2800">28%</option>
                  </select>
                </div>

                {/* Active Status */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Catalog Status</label>
                  <select
                    value={bulkEditForm.active}
                    onChange={(e) =>
                      setBulkEditForm((prev) => ({
                        ...prev,
                        active: e.target.value as "unchanged" | "active" | "inactive",
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                  >
                    <option value="unchanged">-- Keep Unchanged --</option>
                    <option value="active">Active (Visible in Store & Catalog)</option>
                    <option value="inactive">Inactive (Hidden / Archived)</option>
                  </select>
                </div>
              </div>

              {/* Price Tier Overrides (Optional) */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-2">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide block">
                  Optional: Bulk Set Fixed Prices (₹)
                </span>
                <p className="text-[11px] text-gray-500">
                  Leave blank to preserve existing prices. Fill only if you want all {selectedIds.size} products to have the same rate.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600">MRP (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unchanged"
                      value={bulkEditForm.mrpRupees}
                      onChange={(e) =>
                        setBulkEditForm((prev) => ({ ...prev, mrpRupees: e.target.value }))
                      }
                      className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-700">List A (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unchanged"
                      value={bulkEditForm.priceARupees}
                      onChange={(e) =>
                        setBulkEditForm((prev) => ({ ...prev, priceARupees: e.target.value }))
                      }
                      className="w-full px-2 py-1 border border-emerald-300 rounded text-xs font-mono bg-emerald-50/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-blue-700">List B (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unchanged"
                      value={bulkEditForm.priceBRupees}
                      onChange={(e) =>
                        setBulkEditForm((prev) => ({ ...prev, priceBRupees: e.target.value }))
                      }
                      className="w-full px-2 py-1 border border-blue-300 rounded text-xs font-mono bg-blue-50/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-700">List C (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Unchanged"
                      value={bulkEditForm.priceCRupees}
                      onChange={(e) =>
                        setBulkEditForm((prev) => ({ ...prev, priceCRupees: e.target.value }))
                      }
                      className="w-full px-2 py-1 border border-amber-300 rounded text-xs font-mono bg-amber-50/30"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsBulkEditOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBulkUpdating}
                  className="inline-flex justify-center py-2 px-5 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isBulkUpdating ? "Updating..." : `Update ${selectedIds.size} Products`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0 text-xl font-bold">
                ⚠️
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">
                  {deleteModal.mode === "bulk"
                    ? `Delete ${selectedIds.size} Products?`
                    : `Delete "${deleteModal.product?.name}"?`}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {deleteModal.mode === "bulk"
                    ? `You are about to delete ${selectedIds.size} selected items.`
                    : `SKU: ${deleteModal.product?.shortCode}`}
                </p>
                <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <strong>Safe Ledger Protection:</strong>
                  <br />
                  Items with NO transaction history will be <strong>permanently deleted</strong>. Items linked to past invoices, purchases, or stock movements will be <strong>safely archived (marked Inactive)</strong> to maintain legal audit immutability.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteModal(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 py-2 px-4 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "Processing..." : "Yes, Delete / Archive"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Products Modal (Multi-Row Spreadsheet Grid) */}
      {isBulkAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-7xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>📑</span> Bulk Add Products to Master Catalog
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enter multiple products rapidly in a grid with brand, category, pack sizes, MRP, and tier rates (A/B/C).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkAddOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 text-lg"
              >
                ✕
              </button>
            </div>

            {/* Quick Auto-Fill Rate Calculator */}
            <div className="px-5 py-3 bg-amber-50/70 border-b border-amber-200/60 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-bold text-amber-900">⚡ Auto-Calculate Tier Rates (% off MRP):</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-semibold">List A:</span>
                  <input
                    type="number"
                    value={bulkAddPctA}
                    onChange={(e) => setBulkAddPctA(e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-center"
                    placeholder="25"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-semibold">List B:</span>
                  <input
                    type="number"
                    value={bulkAddPctB}
                    onChange={(e) => setBulkAddPctB(e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-center"
                    placeholder="20"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-semibold">List C:</span>
                  <input
                    type="number"
                    value={bulkAddPctC}
                    onChange={(e) => setBulkAddPctC(e.target.value)}
                    className="w-14 px-2 py-1 text-xs border border-gray-300 rounded bg-white font-bold text-center"
                    placeholder="15"
                  />
                  <span className="text-gray-500">%</span>
                </div>
                <button
                  type="button"
                  onClick={handleAutoCalcBulkRates}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded shadow-sm transition"
                >
                  Apply to All Rows with MRP
                </button>
              </div>

              <div className="text-[11px] text-gray-500 font-medium">
                Empty rows will be skipped automatically on save.
              </div>
            </div>

            {/* Errors banner if any */}
            {bulkAddErrors.length > 0 && (
              <div className="p-3 bg-red-50 border-b border-red-200 text-red-800 text-xs shrink-0 max-h-32 overflow-y-auto">
                <p className="font-bold mb-1">Please fix the following issues:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {bulkAddErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Grid Table Body */}
            <div className="flex-1 overflow-x-auto overflow-y-auto p-4">
              <table className="min-w-full divide-y divide-gray-200 text-xs border border-gray-200 rounded-lg">
                <thead className="bg-gray-100 text-gray-700 uppercase font-semibold tracking-wider sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-2 py-2.5 text-center w-8">#</th>
                    <th className="px-3 py-2.5 text-left min-w-[200px]">Product Name <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2.5 text-left min-w-[120px]">Code / SKU <span className="text-red-500">*</span></th>
                    <th className="px-3 py-2.5 text-left min-w-[140px]">Brand</th>
                    <th className="px-3 py-2.5 text-left min-w-[140px]">Category</th>
                    <th className="px-2 py-2.5 text-center min-w-[70px]">Pack Size</th>
                    <th className="px-2 py-2.5 text-left min-w-[130px]">Pack Label</th>
                    <th className="px-2 py-2.5 text-right min-w-[90px]">MRP (₹)</th>
                    <th className="px-2 py-2.5 text-right min-w-[90px]">Wholesale A (₹)</th>
                    <th className="px-2 py-2.5 text-right min-w-[90px]">Retail B (₹)</th>
                    <th className="px-2 py-2.5 text-right min-w-[90px]">Walk-in C (₹)</th>
                    <th className="px-2 py-2.5 text-center min-w-[90px]">GST Slab</th>
                    <th className="px-2 py-2.5 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {bulkAddRows.map((row, index) => (
                    <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-2 py-2 text-center text-gray-400 font-bold font-mono">
                        {index + 1}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleUpdateBulkRow(row.id, "name", e.target.value)}
                          placeholder="e.g. Parle-G 100g"
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-maroon-800 focus:border-maroon-800"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          value={row.shortCode}
                          onChange={(e) => handleUpdateBulkRow(row.id, "shortCode", e.target.value.toUpperCase())}
                          placeholder="e.g. PG100"
                          className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-xs font-mono uppercase focus:ring-1 focus:ring-maroon-800 focus:border-maroon-800"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.companyId}
                          onChange={(e) => handleUpdateBulkRow(row.id, "companyId", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                        >
                          <option value="">Select Brand...</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.categoryId}
                          onChange={(e) => handleUpdateBulkRow(row.id, "categoryId", e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white"
                        >
                          <option value="">Select Category...</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="1"
                          value={row.packSize}
                          onChange={(e) => handleUpdateBulkRow(row.id, "packSize", parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-center font-semibold"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <PackLabelSelector
                          name={`packLabel_${row.id}`}
                          defaultValue={row.packLabel}
                          onChange={(val) => handleUpdateBulkRow(row.id, "packLabel", val)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.mrpRupees}
                          onChange={(e) => handleUpdateBulkRow(row.id, "mrpRupees", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs text-right font-bold text-gray-900"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.priceARupees}
                          onChange={(e) => handleUpdateBulkRow(row.id, "priceARupees", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-emerald-300 rounded text-xs text-right font-semibold text-emerald-800 bg-emerald-50/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.priceBRupees}
                          onChange={(e) => handleUpdateBulkRow(row.id, "priceBRupees", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-blue-300 rounded text-xs text-right font-semibold text-blue-800 bg-blue-50/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.priceCRupees}
                          onChange={(e) => handleUpdateBulkRow(row.id, "priceCRupees", e.target.value)}
                          placeholder="0.00"
                          className="w-full px-2 py-1.5 border border-purple-300 rounded text-xs text-right font-semibold text-purple-800 bg-purple-50/30"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.gstRateBp}
                          onChange={(e) => handleUpdateBulkRow(row.id, "gstRateBp", parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-center font-medium"
                        >
                          <option value="0">0%</option>
                          <option value="500">5%</option>
                          <option value="1200">12%</option>
                          <option value="1800">18%</option>
                          <option value="2800">28%</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkRow(row.id)}
                          className="text-gray-400 hover:text-red-600 transition p-1"
                          title="Remove row"
                        >
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAddBulkRow(1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-sm transition"
                >
                  + Add 1 Row
                </button>
                <button
                  type="button"
                  onClick={() => handleAddBulkRow(5)}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 shadow-sm transition"
                >
                  + Add 5 Rows
                </button>
                <span className="text-xs text-gray-500 ml-2">
                  Total rows: <strong className="text-gray-800">{bulkAddRows.length}</strong> (
                  {bulkAddRows.filter((r) => r.name.trim().length > 0).length} filled)
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBulkAddOpen(false)}
                  disabled={isBulkCreating}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isBulkCreating}
                  onClick={handleSaveBulkProducts}
                  className="px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>💾</span> {isBulkCreating ? "Saving Products..." : "Save Products to Catalog"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
