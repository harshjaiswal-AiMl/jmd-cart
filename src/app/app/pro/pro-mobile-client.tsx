"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  PlusCircle,
  ShoppingBag,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Phone,
  MapPin,
  TrendingUp,
  X,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  Package,
  Edit3,
  Camera,
  UploadCloud,
} from "lucide-react";
import { searchItems } from "@/lib/search/smart-search";
import { searchPartiesAction, createProPartyAction, punchProOrderAction, cancelProOrderAction, createProProductAction, saveProProductPriceAction } from "./actions";
import { ProductImage } from "@/components/common/ProductImage";

interface ProProduct {
  id: string;
  name: string;
  shortCode: string;
  weight?: string | null;
  packSize: number;
  packLabel: string;
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  imageUrl?: string | null;
  shopQty: number;
  godownQty: number;
}

interface ProParty {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  type: string;
  priceTier: string;
  creditLimitPaise: number;
  outstandingPaise: number;
}

interface ProOrder {
  id: string;
  orderNumber: string;
  partyName: string;
  partyPhone?: string | null;
  totalPaise: number;
  status: string;
  createdAt: string;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    weight?: string | null;
    quantity: number;
    packSize: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
}

interface CartLine {
  productId: string;
  productName: string;
  weight?: string | null;
  packSize: number;
  packLabel: string;
  cartons: number;
  loose: number;
  unitPricePaise: number;
}

interface Props {
  initialProducts: ProProduct[];
  initialParties: ProParty[];
  initialOrders: ProOrder[];
  todaySummary: {
    count: number;
    totalPaise: number;
    bookedPending: number;
    confirmed: number;
    delivered: number;
  };
  user: {
    id: string;
    name: string;
    role: string;
    agentCode?: string | null;
  };
  initialTab?: string;
  companies?: Array<{ id: string; name: string }>;
  categories?: Array<{ id: string; name: string }>;
}

export function ProMobileClient({
  initialProducts,
  initialParties,
  initialOrders,
  todaySummary,
  user,
  initialTab = "parties",
  companies = [],
  categories = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const [products, setProducts] = useState<ProProduct[]>(initialProducts);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProProduct | null>(null);

  // Add Product form state
  const [addName, setAddName] = useState("");
  const [addWeight, setAddWeight] = useState("");
  const [addPackSize, setAddPackSize] = useState("1");
  const [addCompanyId, setAddCompanyId] = useState("");
  const [addCategoryId, setAddCategoryId] = useState("");
  const [addMrp, setAddMrp] = useState("");
  const [addPriceA, setAddPriceA] = useState("");
  const [addPriceB, setAddPriceB] = useState("");
  const [addPriceC, setAddPriceC] = useState("");
  const [addImageUrl, setAddImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Edit Product form state
  const [editMrp, setEditMrp] = useState("");
  const [editPriceA, setEditPriceA] = useState("");
  const [editPriceB, setEditPriceB] = useState("");
  const [editPriceC, setEditPriceC] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const handleImageUpload = async (file: File, isEdit: boolean) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Image upload failed");
      }

      if (isEdit) {
        setEditImageUrl(data.key || data.url);
      } else {
        setAddImageUrl(data.key || data.url);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveNewProduct = () => {
    if (!addName.trim()) {
      setErrorMessage("Product name is required");
      return;
    }
    const mrpPaise = Math.round((parseFloat(addMrp) || 0) * 100);
    const priceAPaise = Math.round((parseFloat(addPriceA) || 0) * 100);
    const priceBPaise = Math.round((parseFloat(addPriceB) || 0) * 100);
    const priceCPaise = Math.round((parseFloat(addPriceC) || 0) * 100);

    if (mrpPaise <= 0 || priceAPaise <= 0) {
      setErrorMessage("MRP and Price A are required");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createProProductAction({
          name: addName.trim(),
          weight: addWeight.trim() || undefined,
          packSize: parseInt(addPackSize, 10) || 1,
          mrpPaise,
          priceAPaise,
          priceBPaise: priceBPaise || priceAPaise,
          priceCPaise: priceCPaise || priceAPaise,
          companyId: addCompanyId || undefined,
          categoryId: addCategoryId || undefined,
          imageUrl: addImageUrl || undefined,
        });

        if (res.success && res.product) {
          const newP: ProProduct = {
            id: res.product.id,
            name: res.product.name,
            shortCode: res.product.shortCode,
            weight: res.product.weight,
            packSize: res.product.packSize,
            packLabel: res.product.packLabel,
            mrpPaise: res.product.mrpPaise,
            priceAPaise: res.product.priceAPaise,
            priceBPaise: res.product.priceBPaise,
            priceCPaise: res.product.priceCPaise,
            imageUrl: res.product.imageUrl,
            shopQty: 0,
            godownQty: 0,
          };
          setProducts((prev) => [newP, ...prev]);
          setShowAddProductModal(false);
          setAddName("");
          setAddWeight("");
          setAddPackSize("1");
          setAddMrp("");
          setAddPriceA("");
          setAddPriceB("");
          setAddPriceC("");
          setAddImageUrl("");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to add product");
      }
    });
  };

  const handleSaveProductPrices = () => {
    if (!editingProduct) return;
    const mrpPaise = Math.round((parseFloat(editMrp) || 0) * 100);
    const priceAPaise = Math.round((parseFloat(editPriceA) || 0) * 100);
    const priceBPaise = Math.round((parseFloat(editPriceB) || 0) * 100);
    const priceCPaise = Math.round((parseFloat(editPriceC) || 0) * 100);

    startTransition(async () => {
      try {
        await saveProProductPriceAction({
          productId: editingProduct.id,
          mrpPaise: mrpPaise > 0 ? mrpPaise : undefined,
          priceAPaise: priceAPaise > 0 ? priceAPaise : undefined,
          priceBPaise: priceBPaise > 0 ? priceBPaise : undefined,
          priceCPaise: priceCPaise > 0 ? priceCPaise : undefined,
          imageUrl: editImageUrl || undefined,
        });

        setProducts((prev) =>
          prev.map((p) =>
            p.id === editingProduct.id
              ? {
                  ...p,
                  mrpPaise: mrpPaise > 0 ? mrpPaise : p.mrpPaise,
                  priceAPaise: priceAPaise > 0 ? priceAPaise : p.priceAPaise,
                  priceBPaise: priceBPaise > 0 ? priceBPaise : p.priceBPaise,
                  priceCPaise: priceCPaise > 0 ? priceCPaise : p.priceCPaise,
                  imageUrl: editImageUrl || p.imageUrl,
                }
              : p
          )
        );
        setEditingProduct(null);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to update price");
      }
    });
  };

  const catalogFilteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || (p.shortCode && p.shortCode.toLowerCase().includes(q))
    );
  }, [products, catalogSearch]);

  const [parties, setParties] = useState<ProParty[]>(initialParties);
  const [orders, setOrders] = useState<ProOrder[]>(initialOrders);
  const [summary, setSummary] = useState(todaySummary);

  // Selected party for punching order
  const [selectedParty, setSelectedParty] = useState<ProParty | null>(
    initialParties.length > 0 ? initialParties[0] : null
  );

  // Punch Order Cart
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerNotes, setCustomerNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [partySearch, setPartySearch] = useState("");

  // New Party Modal
  const [showNewPartyModal, setShowNewPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState("");
  const [newPartyPhone, setNewPartyPhone] = useState("");
  const [newPartyAddress, setNewPartyAddress] = useState("");
  const [newPartyGst, setNewPartyGst] = useState("");
  const [newPartyType, setNewPartyType] = useState<"RETAILER" | "WHOLESALER">("RETAILER");

  // Status & Transitions
  const [isPending, startTransition] = useTransition();
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; totalPaise: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter parties by search query
  const filteredParties = useMemo(() => {
    if (!partySearch.trim()) return parties;
    const q = partySearch.toLowerCase().trim();
    return [...parties].sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.name.localeCompare(b.name);
    }).filter((p) =>
      p.name.toLowerCase().includes(q) || (p.phone && p.phone.includes(q))
    );
  }, [parties, partySearch]);

  // Filter products by smart multi-token search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    return searchItems(productSearch, products as any, { limit: 10 }) as unknown as ProProduct[];
  }, [initialProducts, productSearch]);

  // Helper: resolve price for party tier
  const getProductPriceForParty = (product: ProProduct, party: ProParty | null): number => {
    const tier = party?.priceTier || "A";
    if (tier === "B" && product.priceBPaise) return product.priceBPaise;
    if (tier === "C" && product.priceCPaise) return product.priceCPaise;
    return product.priceAPaise || product.mrpPaise || 0;
  };

  // Add product to cart
  const handleAddToCart = (product: ProProduct) => {
    const price = getProductPriceForParty(product, selectedParty);
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id ? { ...item, cartons: item.cartons + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          weight: product.weight,
          packSize: product.packSize || 1,
          packLabel: product.packLabel || "Carton",
          cartons: 1,
          loose: 0,
          unitPricePaise: price,
        },
      ];
    });
    setProductSearch("");
  };

  // Update cart quantities
  const updateCartLine = (productId: string, field: "cartons" | "loose", delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const nextVal = Math.max(0, item[field] + delta);
            return { ...item, [field]: nextVal };
          }
          return item;
        })
        .filter((item) => item.cartons > 0 || item.loose > 0)
    );
  };

  const removeCartLine = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Cart totals
  const cartSummary = useMemo(() => {
    let totalPieces = 0;
    let totalPaise = 0;
    let totalCartons = 0;
    for (const line of cart) {
      const pieces = line.cartons * line.packSize + line.loose;
      totalPieces += pieces;
      totalCartons += line.cartons;
      totalPaise += pieces * line.unitPricePaise;
    }
    return { totalPieces, totalCartons, totalPaise };
  }, [cart]);

  // Create new party
  const handleCreateParty = () => {
    if (!newPartyName.trim()) {
      setErrorMessage("Enter party name");
      return;
    }
    if (!newPartyPhone.trim() || newPartyPhone.trim().length < 10) {
      setErrorMessage("Enter a valid 10-digit phone number");
      return;
    }

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const res = await createProPartyAction({
          name: newPartyName,
          phone: newPartyPhone,
          address: newPartyAddress,
          gst: newPartyGst,
          type: newPartyType as any,
        });

        if (res.party) {
          const createdParty: ProParty = {
            id: res.party.id,
            name: res.party.name,
            phone: res.party.phone,
            address: res.party.address,
            type: res.party.type,
            priceTier: res.party.priceTier || "A",
            creditLimitPaise: res.party.creditLimitPaise || 0,
            outstandingPaise: 0,
          };
          setParties((prev) => [createdParty, ...prev]);
          setSelectedParty(createdParty);
          setShowNewPartyModal(false);
          setNewPartyName("");
          setNewPartyPhone("");
          setNewPartyAddress("");
          setNewPartyGst("");
          setActiveTab("punch");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to create party");
      }
    });
  };

  // Punch Order
  const handlePunchOrder = () => {
    if (!selectedParty) {
      setErrorMessage("Please select a party first");
      return;
    }
    if (cart.length === 0) {
      setErrorMessage("Cart is empty. Add at least one item.");
      return;
    }

    startTransition(async () => {
      try {
        setErrorMessage(null);
        const res = await punchProOrderAction({
          partyId: selectedParty.id,
          lines: cart.map((line) => ({
            productId: line.productId,
            cartons: line.cartons,
            loose: line.loose,
            overrideUnitPricePaise: line.unitPricePaise,
          })),
          customerNotes,
          deliveryAddress: selectedParty.address || "Saharsa",
          contactPhone: selectedParty.phone || "0000000000",
        });

        if (res.success) {
          setOrderSuccess({
            orderNumber: res.orderNumber,
            totalPaise: res.totalPaise,
          });

          // Prepend to orders list
          const newOrder: ProOrder = {
            id: res.orderId,
            orderNumber: res.orderNumber,
            partyName: selectedParty.name,
            partyPhone: selectedParty.phone,
            totalPaise: res.totalPaise,
            status: "BOOKED_BY_PRO",
            createdAt: new Date().toISOString(),
            items: cart.map((c) => ({
              id: `${res.orderId}-${c.productId}`,
              productId: c.productId,
              productName: c.productName,
              weight: c.weight,
              quantity: c.cartons * c.packSize + c.loose,
              packSize: c.packSize,
              unitPricePaise: c.unitPricePaise,
              totalPaise: (c.cartons * c.packSize + c.loose) * c.unitPricePaise,
            })),
          };

          setOrders((prev) => [newOrder, ...prev]);
          setSummary((prev) => ({
            ...prev,
            count: prev.count + 1,
            totalPaise: prev.totalPaise + res.totalPaise,
            bookedPending: prev.bookedPending + 1,
          }));

          setCart([]);
          setCustomerNotes("");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to punch order");
      }
    });
  };

  // Cancel Order
  const handleCancelOrder = (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    startTransition(async () => {
      try {
        await cancelProOrderAction(orderId);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o))
        );
      } catch (err: any) {
        alert(err.message || "Failed to cancel order");
      }
    });
  };

  // Reorder shortcut
  const handleReorder = (order: ProOrder) => {
    const partyMatch = parties.find((p) => p.name === order.partyName) || selectedParty;
    if (partyMatch) setSelectedParty(partyMatch);

    const reloadedCart: CartLine[] = order.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      const packSize = it.packSize || prod?.packSize || 1;
      const cartons = Math.floor(it.quantity / packSize);
      const loose = it.quantity % packSize;
      return {
        productId: it.productId,
        productName: it.productName,
        weight: it.weight,
        packSize,
        packLabel: prod?.packLabel || "Carton",
        cartons: cartons > 0 ? cartons : 0,
        loose,
        unitPricePaise: it.unitPricePaise,
      };
    });

    setCart(reloadedCart);
    setActiveTab("punch");
  };

  return (
    <div className="max-w-md mx-auto space-y-4 pb-20 select-none">
      {/* Top PRO Agent Hero Banner */}
      <div className="bg-[#12355B] text-white p-4 rounded-3xl shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-black">{user.name}</span>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-full border border-amber-300/30">
                  {user.agentCode || "PRO AGENT"}
                </span>
              </div>
              <p className="text-[11px] text-white/70">JMD Field Order Executive</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedParty(null);
              setShowNewPartyModal(true);
            }}
            className="flex items-center gap-1 text-[11px] font-black bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/20 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Party</span>
          </button>
        </div>

        {/* Quick KPI stats strip */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/10 text-center">
          <div>
            <div className="text-[10px] text-white/70">Today Orders</div>
            <div className="text-base font-black font-mono">{summary.count}</div>
          </div>
          <div>
            <div className="text-[10px] text-white/70">Booked Value</div>
            <div className="text-base font-black font-mono text-amber-300">
              ₹{(summary.totalPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-white/70">Warehouse Queue</div>
            <div className="text-base font-black font-mono text-emerald-300">
              {summary.bookedPending}
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)}>
            <X className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {/* Order Success Dialog */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Order Punched!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Warehouse manager has been alerted with push &amp; ring!
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-2xl font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Order #</span>
                <span className="font-bold text-slate-800">{orderSuccess.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total</span>
                <span className="font-bold text-emerald-700">
                  ₹{(orderSuccess.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="font-bold text-amber-600">BOOKED_BY_PRO</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setOrderSuccess(null);
                  setActiveTab("orders");
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                View Orders
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderSuccess(null);
                  setActiveTab("punch");
                }}
                className="py-2.5 px-3 rounded-xl bg-[#12355B] text-white text-xs font-black shadow-md hover:bg-[#0E2843]"
              >
                Punch Another
              </button>
            </div>
          </div>
        </div>
      )}


      {/* TAB: CATALOG (Products & All-Tier Price Editor & Image Upload) */}
      {activeTab === "catalog" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search products or barcode..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#12355B]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setAddName("");
                setAddWeight("");
                setAddPackSize("1");
                setAddMrp("");
                setAddPriceA("");
                setAddPriceB("");
                setAddPriceC("");
                setAddImageUrl("");
                setShowAddProductModal(true);
              }}
              className="px-3 py-2 bg-[#FC830D] text-white rounded-2xl text-xs font-bold flex items-center gap-1 shadow-md hover:bg-[#e07205] transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-2">
            {catalogFilteredProducts.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs hover:shadow-xs transition space-y-2"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    <ProductImage
                      src={p.imageUrl}
                      alt={p.name}
                      width={56}
                      height={56}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-bold text-slate-900 text-xs truncate">{p.name}</h4>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(p);
                          setEditMrp(p.mrpPaise ? (p.mrpPaise / 100).toFixed(2) : "");
                          setEditPriceA(p.priceAPaise ? (p.priceAPaise / 100).toFixed(2) : "");
                          setEditPriceB(p.priceBPaise ? (p.priceBPaise / 100).toFixed(2) : "");
                          setEditPriceC(p.priceCPaise ? (p.priceCPaise / 100).toFixed(2) : "");
                          setEditImageUrl(p.imageUrl || "");
                        }}
                        className="p-1 text-slate-400 hover:text-[#12355B] rounded-lg transition"
                        title="Edit Price & Image"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Pack: {p.packSize} pcs {p.weight ? `· ${p.weight}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                        Shop: {p.shopQty} pcs
                      </span>
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                        Godown: {p.godownQty} pcs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Price Tiers Grid (All 3 Tiers + MRP) */}
                <div className="grid grid-cols-4 gap-1.5 pt-1.5 border-t border-slate-100 text-center font-mono">
                  <div className="bg-slate-50 p-1 rounded-lg">
                    <span className="block text-[8px] font-bold uppercase text-slate-400">MRP</span>
                    <span className="text-[11px] font-black text-slate-800">
                      {p.mrpPaise ? `₹${(p.mrpPaise / 100).toFixed(0)}` : "—"}
                    </span>
                  </div>
                  <div className="bg-emerald-50/60 p-1 rounded-lg border border-emerald-100">
                    <span className="block text-[8px] font-bold uppercase text-emerald-700">Tier A</span>
                    <span className="text-[11px] font-black text-emerald-800">
                      {p.priceAPaise ? `₹${(p.priceAPaise / 100).toFixed(0)}` : "—"}
                    </span>
                  </div>
                  <div className="bg-blue-50/60 p-1 rounded-lg border border-blue-100">
                    <span className="block text-[8px] font-bold uppercase text-blue-700">Tier B</span>
                    <span className="text-[11px] font-black text-blue-800">
                      {p.priceBPaise ? `₹${(p.priceBPaise / 100).toFixed(0)}` : "—"}
                    </span>
                  </div>
                  <div className="bg-amber-50/60 p-1 rounded-lg border border-amber-100">
                    <span className="block text-[8px] font-bold uppercase text-amber-700">Tier C</span>
                    <span className="text-[11px] font-black text-amber-800">
                      {p.priceCPaise ? `₹${(p.priceCPaise / 100).toFixed(0)}` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: PARTIES */}
      {activeTab === "parties" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search parties (e.g. sh, sharma)..."
                value={partySearch}
                onChange={(e) => setPartySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#12355B]"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNewPartyModal(true)}
              className="p-2 rounded-2xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition"
              title="Add Party"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {filteredParties.map((party) => (
              <div
                key={party.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-[#12355B] transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm text-slate-900">{party.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      Tier {party.priceTier || "A"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                    {party.phone && (
                      <span className="flex items-center gap-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {party.phone}
                      </span>
                    )}
                    {party.address && (
                      <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {party.address}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    Outstanding:{" "}
                    <span className={party.outstandingPaise > 0 ? "text-amber-700 font-bold" : "text-emerald-600"}>
                      ₹{(party.outstandingPaise / 100).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedParty(party);
                    setActiveTab("punch");
                  }}
                  className="px-3 py-2 rounded-xl bg-[#12355B] hover:bg-[#0E2843] text-white text-xs font-black flex items-center gap-1 shadow-sm active:scale-95 transition"
                >
                  <span>Punch</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {filteredParties.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                No parties found. Tap &quot;+ New Party&quot; to add one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PUNCH ORDER */}
      {activeTab === "punch" && (
        <div className="space-y-3">
          {/* Selected Party Header */}
          <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            {selectedParty ? (
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Order For
                </div>
                <div className="font-black text-sm text-slate-900">{selectedParty.name}</div>
                <div className="text-[11px] text-slate-500">
                  {selectedParty.phone || "No phone"} • Tier {selectedParty.priceTier || "A"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-700 font-bold">No party selected!</div>
            )}

            <button
              type="button"
              onClick={() => setActiveTab("parties")}
              className="text-xs font-bold text-[#12355B] bg-blue-50 px-2.5 py-1.5 rounded-xl hover:bg-blue-100 transition"
            >
              Change
            </button>
          </div>

          {/* Product Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search product (e.g. bhuj 400, parle)..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium focus:ring-2 focus:ring-[#12355B]"
            />

            {/* Smart Search Dropdown */}
            {filteredProducts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const price = getProductPriceForParty(p, selectedParty);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleAddToCart(p)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.weight && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                              {p.weight}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Pack: {p.packSize} pcs • Code: {p.shortCode}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-xs text-[#12355B]">
                          ₹{(price / 100).toFixed(2)}/pc
                        </div>
                        <div className="text-[10px] text-emerald-600 font-semibold">
                          Stock: {p.godownQty + p.shopQty}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
            <div className="p-3 bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                Cart Items ({cart.length})
              </span>
              <span className="text-xs font-bold text-slate-500">
                {cartSummary.totalCartons} Cartons • {cartSummary.totalPieces} Pcs
              </span>
            </div>

            {cart.map((line) => {
              const linePieces = line.cartons * line.packSize + line.loose;
              const lineTotal = linePieces * line.unitPricePaise;
              return (
                <div key={line.productId} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                        <span>{line.productName}</span>
                        {line.weight && (
                          <span className="text-[10px] bg-slate-100 px-1 py-0.2 rounded font-semibold text-slate-600">
                            {line.weight}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        ₹{(line.unitPricePaise / 100).toFixed(2)} / pc • 1 ctn = {line.packSize} pcs
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCartLine(line.productId)}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {/* Cartons control */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500">Cartons:</span>
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => updateCartLine(line.productId, "cartons", -1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 py-1 text-xs font-mono font-bold">
                          {line.cartons}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartLine(line.productId, "cartons", 1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Loose control */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-500">Loose:</span>
                      <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => updateCartLine(line.productId, "loose", -1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 py-1 text-xs font-mono font-bold">
                          {line.loose}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartLine(line.productId, "loose", 1)}
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-[#12355B]">
                        ₹{(lineTotal / 100).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {cart.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                Cart is empty. Type a product name above to add items.
              </div>
            )}
          </div>

          {/* Customer Notes */}
          {cart.length > 0 && (
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-600">Order Notes / Instructions</label>
              <input
                type="text"
                placeholder="Optional delivery instructions or notes..."
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
          )}

          {/* Order Punch Total & Submit */}
          {cart.length > 0 && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-md space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Total Items / Pieces:</span>
                <span className="font-bold text-slate-800">
                  {cart.length} lines • {cartSummary.totalPieces} pcs
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                <span className="text-sm font-black text-slate-900">Total Amount:</span>
                <span className="text-lg font-black text-[#12355B] font-mono">
                  ₹{(cartSummary.totalPaise / 100).toLocaleString("en-IN")}
                </span>
              </div>

              <button
                type="button"
                disabled={isPending}
                onClick={handlePunchOrder}
                className="w-full py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-md active:scale-98 transition disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Alerting Godown...</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>Book Order (Alert Godown)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MY ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              My Orders ({orders.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">Recent first</span>
          </div>

          <div className="space-y-2.5">
            {orders.map((o) => (
              <div
                key={o.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2 hover:border-[#12355B] transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-black text-sm text-slate-900">{o.orderNumber}</div>
                    <div className="text-[11px] text-slate-500">{o.partyName}</div>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {o.status === "BOOKED_BY_PRO" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        Awaiting Godown
                      </span>
                    )}
                    {o.status === "CONFIRMED" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        Confirmed
                      </span>
                    )}
                    {o.status === "PACKED" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        Packed
                      </span>
                    )}
                    {o.status === "DELIVERED" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Delivered
                      </span>
                    )}
                    {o.status === "CANCELLED" && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                  <span className="text-slate-400">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="font-black text-[#12355B] font-mono">
                    ₹{(o.totalPaise / 100).toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {o.status === "BOOKED_BY_PRO" && (
                    <button
                      type="button"
                      onClick={() => handleCancelOrder(o.id)}
                      className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      Cancel Order
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleReorder(o)}
                    className="px-2.5 py-1 text-[11px] font-bold text-[#12355B] bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    Reorder Items
                  </button>
                </div>
              </div>
            ))}

            {orders.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                No orders punched yet. Go to Parties tab to book one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: TODAY SUMMARY */}
      {activeTab === "today" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Today&apos;s Performance
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100">
                <div className="text-[11px] font-bold text-blue-700">Orders Punched</div>
                <div className="text-2xl font-black text-blue-950 font-mono mt-1">
                  {summary.count}
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100">
                <div className="text-[11px] font-bold text-amber-700">Total Booked (₹)</div>
                <div className="text-2xl font-black text-amber-950 font-mono mt-1">
                  ₹{(summary.totalPaise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Awaiting Warehouse:</span>
                <span className="font-bold text-amber-600 font-mono">{summary.bookedPending}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Confirmed &amp; Packing:</span>
                <span className="font-bold text-blue-600 font-mono">{summary.confirmed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivered:</span>
                <span className="font-bold text-emerald-600 font-mono">{summary.delivered}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("punch")}
              className="w-full py-2.5 rounded-xl bg-[#12355B] text-white font-black text-xs shadow-md hover:bg-[#0E2843] transition"
            >
              Punch New Order
            </button>
          </div>
        </div>
      )}

      {/* NEW PARTY MODAL */}
      {showNewPartyModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-3.5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-900">Add New Party</h3>
              <button
                type="button"
                onClick={() => setShowNewPartyModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="font-bold text-slate-700">Party / Shop Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kirana Store"
                  value={newPartyName}
                  onChange={(e) => setNewPartyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-0.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Phone Number *</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={newPartyPhone}
                  onChange={(e) => setNewPartyPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-0.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Address / Area</label>
                <input
                  type="text"
                  placeholder="e.g. D.B. Road, Saharsa"
                  value={newPartyAddress}
                  onChange={(e) => setNewPartyAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-0.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="15-digit GST number"
                  value={newPartyGst}
                  onChange={(e) => setNewPartyGst(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-0.5 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Party Type</label>
                <select
                  value={newPartyType}
                  onChange={(e) => setNewPartyType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl mt-0.5 focus:bg-white font-bold"
                >
                  <option value="RETAILER">Retailer (Tier A)</option>
                  <option value="WHOLESALER">Wholesaler (Tier B)</option>
                </select>
              </div>

              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[10px] text-blue-800">
                Newly created parties are flagged for Accounts team verification but can be punched immediately.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewPartyModal(false)}
                className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreateParty}
                className="py-2.5 rounded-xl bg-[#12355B] text-white text-xs font-black shadow-md hover:bg-[#0E2843] disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Party"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ADD PRODUCT MODAL (Mobile Friendly) */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#FC830D]" />
                Add New Product
              </h3>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Kurkure Masala Munch 45g"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#12355B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Weight / Unit</label>
                  <input
                    type="text"
                    placeholder="45g / 100ml"
                    value={addWeight}
                    onChange={(e) => setAddWeight(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Pack Size (Pcs)</label>
                  <input
                    type="number"
                    min="1"
                    value={addPackSize}
                    onChange={(e) => setAddPackSize(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Company & Category Select */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Company / Brand</label>
                  <select
                    value={addCompanyId}
                    onChange={(e) => setAddCompanyId(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Category</label>
                  <select
                    value={addCategoryId}
                    onChange={(e) => setAddCategoryId(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Image Upload Box */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Product Photo</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                    {addImageUrl ? (
                      <ProductImage src={addImageUrl} alt="Preview" width={64} height={64} className="w-full h-full object-contain" />
                    ) : (
                      <Camera className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <label className="flex-1 cursor-pointer">
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition">
                      <UploadCloud className="w-4 h-4 text-[#12355B]" />
                      {isUploading ? "Uploading..." : "Take Photo / Gallery"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={isUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, false);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Price Tiers (A, B, C and MRP) */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-mono">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="20.00"
                    value={addMrp}
                    onChange={(e) => setAddMrp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-emerald-700 mb-1">Price A (Retail ₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="18.00"
                    value={addPriceA}
                    onChange={(e) => setAddPriceA(e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-700 mb-1">Price B (Semi ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="17.50"
                    value={addPriceB}
                    onChange={(e) => setAddPriceB(e.target.value)}
                    className="w-full px-3 py-2 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-black text-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-amber-700 mb-1">Price C (Bulk ₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="17.00"
                    value={addPriceC}
                    onChange={(e) => setAddPriceC(e.target.value)}
                    className="w-full px-3 py-2 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-black text-amber-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewProduct}
                disabled={isPending || isUploading}
                className="flex-1 py-2.5 rounded-xl bg-[#FC830D] text-white text-xs font-black shadow-md hover:bg-[#e07205] disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PRODUCT PRICES & IMAGE MODAL (Mobile Friendly) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-5 max-w-md w-full space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5 truncate">
                <Edit3 className="w-4 h-4 text-[#12355B]" />
                Edit: {editingProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Photo update */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Update Product Photo</label>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  <ProductImage
                    src={editImageUrl || editingProduct.imageUrl}
                    alt={editingProduct.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-contain"
                  />
                </div>
                <label className="flex-1 cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition">
                    <Camera className="w-4 h-4 text-[#12355B]" />
                    {isUploading ? "Uploading..." : "Take New Photo / Pick"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={isUploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file, true);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* All Tier Prices */}
            <div className="space-y-2 pt-2 border-t border-slate-100 font-mono">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-700 mb-1">MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editMrp}
                  onChange={(e) => setEditMrp(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-black uppercase text-emerald-700 mb-1">Tier A (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPriceA}
                    onChange={(e) => setEditPriceA(e.target.value)}
                    className="w-full px-2 py-1.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-black text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-blue-700 mb-1">Tier B (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPriceB}
                    onChange={(e) => setEditPriceB(e.target.value)}
                    className="w-full px-2 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-black text-blue-900"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black uppercase text-amber-700 mb-1">Tier C (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPriceC}
                    onChange={(e) => setEditPriceC(e.target.value)}
                    className="w-full px-2 py-1.5 bg-amber-50/50 border border-amber-200 rounded-xl text-xs font-black text-amber-900"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProductPrices}
                disabled={isPending || isUploading}
                className="flex-1 py-2.5 rounded-xl bg-[#12355B] text-white text-xs font-black shadow-md hover:bg-[#0E2843] disabled:opacity-50"
              >
                {isPending ? "Updating..." : "Update Prices"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION: Parties · Punch Order · My Orders · Today */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
        <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("parties")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "parties" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Parties</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("punch")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition relative ${
              activeTab === "punch" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <ShoppingBag className="w-5 h-5 mb-0.5" />
            <span>Punch Order</span>
            {cart.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "orders" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Clock className="w-5 h-5 mb-0.5" />
            <span>My Orders</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "today" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <TrendingUp className="w-5 h-5 mb-0.5" />
            <span>Today</span>
          </button>
        </div>
      </div>
    </div>
  );
}
