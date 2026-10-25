"use client";

import { useState, useTransition, useMemo } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SearchableSelect } from "@/components/common/SearchableSelect";
import {
  manualConvertGodownAction,
  reverseConversionAction,
  transferStockAction,
  transferBatchStockAction,
  cartonBreakAction,
  recordDamageAction,
  adjustStockAction,
  OperationActionResult,
} from "./actions";
import type { DailyAutoConvertSummary } from "@/modules/godown/auto-convert.service";
import {
  Search,
  Plus,
  Trash2,
  ArrowRight,
  Package,
  AlertCircle,
  CheckCircle2,
  ArrowRightLeft,
  PackageOpen,
  Scissors,
  SlidersHorizontal,
  Building2,
  Store,
  Layers,
} from "lucide-react";

interface OperationsClientProps {
  locations: { id: string; name: string; type?: string }[];
  products: {
    id: string;
    name: string;
    shortCode: string;
    packSize: number;
    packLabel: string;
    godownQty?: number;
  }[];
  autoConvertSummary: DailyAutoConvertSummary;
}

function ActionButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-xs text-xs font-bold rounded-lg text-white bg-[#790E11] hover:bg-[#600b0e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#790E11] disabled:opacity-50 transition-colors cursor-pointer"
    >
      {pending ? "Executing..." : label}
    </button>
  );
}

export function OperationsClient({
  locations,
  products,
  autoConvertSummary,
}: OperationsClientProps) {
  const router = useRouter();
  const [isPendingReverse, startReverseTransition] = useTransition();
  const [reverseMessage, setReverseMessage] = useState<string | null>(null);
  const [reverseError, setReverseError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "transfer" | "autoconvert" | "break" | "damage" | "adjust"
  >("transfer");

  const [manualConvertState, manualConvertFormAction] = useFormState<
    OperationActionResult | undefined,
    FormData
  >(manualConvertGodownAction, undefined);

  const [transferState, transferFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    transferStockAction,
    undefined
  );
  const [breakState, breakFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    cartonBreakAction,
    undefined
  );
  const [damageState, damageFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    recordDamageAction,
    undefined
  );
  const [adjustState, adjustFormAction] = useFormState<OperationActionResult | undefined, FormData>(
    adjustStockAction,
    undefined
  );

  const godownLoc = locations.find((l) => l.name.toLowerCase().includes("godown")) || locations[0];
  const shopLoc = locations.find((l) => l.name.toLowerCase().includes("shop")) || locations[1];

  // Batch transfer state (multi-product transfer Godown -> Shop)
  const [fromLocId, setFromLocId] = useState(godownLoc?.id || locations[0]?.id || "");
  const [toLocId, setToLocId] = useState(shopLoc?.id || locations[1]?.id || "");
  const [transferReason, setTransferReason] = useState("");
  const [transferSearch, setTransferSearch] = useState("");
  const [transferItems, setTransferItems] = useState<Record<string, { cartons: number; loose: number }>>({});
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [batchTransferMessage, setBatchTransferMessage] = useState<string | null>(null);
  const [batchTransferError, setBatchTransferError] = useState<string | null>(null);

  const [manualProdId, setManualProdId] = useState(products[0]?.id || "");
  const [manualCartons, setManualCartons] = useState(1);
  const selectedManualProd = products.find((p) => p.id === manualProdId) || products[0];

  const [breakProdId, setBreakProdId] = useState(products[0]?.id || "");
  const [cartons, setCartons] = useState(5);
  const selectedBreakProd = products.find((p) => p.id === breakProdId) || products[0];

  const [damageProdId, setDamageProdId] = useState(products[0]?.id || "");
  const [adjustProdId, setAdjustProdId] = useState(products[0]?.id || "");

  const productOptions = useMemo(
    () =>
      products.map((p) => {
        const hasStock = (p.godownQty ?? 0) > 0;
        return {
          value: p.id,
          label: `[${p.shortCode}] ${p.name}`,
          subLabel: `1 Carton = ${p.packSize} pcs (${p.packLabel})`,
          badge: p.godownQty !== undefined ? (hasStock ? `Godown: ${p.godownQty} pcs` : "0 pcs") : undefined,
          badgeColor: hasStock ? ("green" as const) : ("gray" as const),
          inStock: hasStock,
        };
      }),
    [products]
  );

  const handleReverse = (auditLogId: string) => {
    setReverseMessage(null);
    setReverseError(null);
    startReverseTransition(async () => {
      const res = await reverseConversionAction(auditLogId);
      if (res.error) {
        setReverseError(res.error);
      } else {
        setReverseMessage(res.message || "Conversion reversed successfully.");
        router.refresh();
      }
    });
  };

  const addProductToTransfer = (prodId: string) => {
    setTransferItems((prev) => ({
      ...prev,
      [prodId]: prev[prodId] || { cartons: 1, loose: 0 },
    }));
    setTransferSearch("");
  };

  const removeProductFromTransfer = (prodId: string) => {
    setTransferItems((prev) => {
      const next = { ...prev };
      delete next[prodId];
      return next;
    });
  };

  const handleTransferCartonChange = (prodId: string, val: number) => {
    const safe = Math.max(0, val || 0);
    setTransferItems((prev) => ({
      ...prev,
      [prodId]: {
        cartons: safe,
        loose: prev[prodId]?.loose || 0,
      },
    }));
  };

  const handleTransferLooseChange = (prodId: string, val: number) => {
    const safe = Math.max(0, val || 0);
    setTransferItems((prev) => ({
      ...prev,
      [prodId]: {
        cartons: prev[prodId]?.cartons || 0,
        loose: safe,
      },
    }));
  };

  const handleBatchTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchTransferError(null);
    setBatchTransferMessage(null);

    if (fromLocId === toLocId) {
      setBatchTransferError("Source (From) and Destination (To) locations cannot be the same.");
      return;
    }

    const itemsToSubmit = Object.entries(transferItems)
      .map(([productId, counts]) => {
        const prod = products.find((p) => p.id === productId);
        const packSize = Math.max(1, prod?.packSize || 1);
        const totalPieces = counts.cartons * packSize + counts.loose;
        return {
          productId,
          qty: totalPieces,
          cartons: counts.cartons,
          loose: counts.loose,
          prod,
        };
      })
      .filter((i) => i.qty > 0);

    if (itemsToSubmit.length === 0) {
      setBatchTransferError("Please add at least one product with quantity > 0 to transfer.");
      return;
    }

    const sourceLoc = locations.find((l) => l.id === fromLocId);
    const isFromGodown =
      sourceLoc?.type === "GODOWN" || sourceLoc?.name.toLowerCase().includes("godown");

    if (isFromGodown) {
      for (const item of itemsToSubmit) {
        if (item.prod && item.prod.godownQty !== undefined && item.qty > item.prod.godownQty) {
          setBatchTransferError(
            `Insufficient stock for '${item.prod.name}'. Godown balance: ${item.prod.godownQty} pcs, Transfer requested: ${item.qty} pcs.`
          );
          return;
        }
      }
    }

    setTransferSubmitting(true);
    try {
      const res = await transferBatchStockAction({
        fromLocationId: fromLocId,
        toLocationId: toLocId,
        reason: transferReason || "Godown to Shop stock restocking",
        items: itemsToSubmit.map((i) => ({ productId: i.productId, qty: i.qty })),
      });

      if (res.error) {
        setBatchTransferError(res.error);
      } else {
        setBatchTransferMessage(
          res.message || `Successfully transferred ${itemsToSubmit.length} product(s)!`
        );
        setTransferItems({});
        setTransferReason("");
        router.refresh();
      }
    } catch (err: any) {
      setBatchTransferError(err?.message || "Transfer failed");
    } finally {
      setTransferSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Live Engine Status */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-[#790E11]" />
              Warehouse Operations &amp; Transfers
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Ledger Connected
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Execute inter-location stock movements, carton unpacks, auto-convert audits, and adjustments across Godown and Shop.
          </p>
        </div>

        {/* Live Auto-Convert Metric Widget */}
        <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 p-2.5 rounded-xl text-xs">
          <PackageOpen className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="leading-tight">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Today&apos;s Auto-Debox</span>
            <span className="font-bold text-gray-900 font-mono">
              {autoConvertSummary.totalCartonsOpenedToday} ctns ({autoConvertSummary.totalLooseGeneratedToday} pcs)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("autoconvert")}
            className="ml-2 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-2xs transition"
          >
            Audit Log ({autoConvertSummary.entries.length})
          </button>
        </div>
      </div>

      {/* Modern Segmented Pill Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-1.5 flex gap-1.5 overflow-x-auto shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab("transfer")}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "transfer"
              ? "bg-[#790E11] text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          1. Inter-Location Transfer
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("autoconvert")}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "autoconvert"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <PackageOpen className="w-3.5 h-3.5" />
          2. Carton Kholo → Loose &amp; Auto-Convert
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("break")}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "break"
              ? "bg-[#790E11] text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          3. Carton Break (Godown → Shop)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("damage")}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "damage"
              ? "bg-red-700 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          4. Record Damage / Spoilage
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("adjust")}
          className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === "adjust"
              ? "bg-[#790E11] text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          5. Manual Ledger Adjustment
        </button>
      </div>

      {/* Tab 0: Manual Carton Kholo -> Loose + Safeguard #2 Daily Auto-Converted Cartons Report + Safeguard #3 Reverse */}
      {activeTab === "autoconvert" && (
        <div className="space-y-6">
          {/* Manual Carton Kholo -> Loose me Convert Karo (Godown) */}
          <form
            action={manualConvertFormAction}
            className="bg-white p-6 rounded-xl border border-amber-200 shadow-sm space-y-5"
          >
            <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Carton Kholo → Loose me Convert Karo (Godown Stock)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Godown ke andar hi carton khol kar loose pieces me convert karein (1 carton = N pieces pack size se auto-calculate). Stock log me entry banegi: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">carton -N, loose +N×packSize</code>.
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                Auto-Convert is ALSO Active on Orders / Van / Transfers
              </span>
            </div>

            {manualConvertState?.error && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {manualConvertState.error}
              </div>
            )}
            {manualConvertState?.success && (
              <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium">
                ✓ {manualConvertState.message || "Carton converted to loose in Godown!"}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Select Product in Godown
                </label>
                <SearchableSelect
                  name="productId"
                  options={productOptions}
                  value={manualProdId}
                  onChange={(val) => setManualProdId(val)}
                  placeholder="Select product..."
                  searchPlaceholder="Search product by code, name..."
                  popoverWidthClass="w-full min-w-[340px]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Cartons to Open (N)
                </label>
                <input
                  type="number"
                  name="cartonsToOpen"
                  min="1"
                  value={manualCartons}
                  onChange={(e) => setManualCartons(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  required
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 block uppercase font-bold">
                    Conversion Preview
                  </span>
                  <span className="text-sm font-black text-amber-950 font-mono">
                    carton -{manualCartons}, loose +
                    {manualCartons * (selectedManualProd?.packSize || 1)}
                  </span>
                </div>
                <ActionButton label="Carton Kholo → Loose" />
              </div>
            </div>
          </form>

          {/* SAFEGUARD #2 & #3: Daily "Auto-Converted Cartons" Report + Reverse Option */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Safeguard #2 &amp; #3: Daily &ldquo;Auto-Converted Cartons&rdquo; Report
                </h3>
                <p className="text-xs text-gray-500">
                  Har conversion ki poori detail: kitne carton khule, kitne loose bane, kitne order/van me gaye, aur kitne loose Godown me bache. Agar galti se conversion hua ho to Admin/Godown reverse kar sakta hai.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                Today: {autoConvertSummary.totalCartonsOpenedToday} Cartons → +
                {autoConvertSummary.totalLooseGeneratedToday} Loose Pcs
              </span>
            </div>

            {reverseMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold">
                ✓ {reverseMessage}
              </div>
            )}
            {reverseError && (
              <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold">
                ✕ {reverseError}
              </div>
            )}

            {autoConvertSummary.entries.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                Aaj abhi tak koi carton auto-convert nahi hua hai. Jab kisi Online Order, Van Issue ya Transfer me Godown loose stock se zyada loose pieces maange jayenge, to system khud carton khol kar yahan entry dikhayega.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-gray-600 uppercase font-bold text-[11px]">
                      <th className="py-2.5 px-3">Time</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Stock Log Entry</th>
                      <th className="py-2.5 px-3">Used in Order/Van</th>
                      <th className="py-2.5 px-3">Loose Left in Godown</th>
                      <th className="py-2.5 px-3">Reason &amp; Reference</th>
                      <th className="py-2.5 px-3 text-right">Safeguard #3 Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {autoConvertSummary.entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={entry.reversed ? "bg-gray-50 opacity-60" : "hover:bg-amber-50/30"}
                      >
                        <td className="py-2.5 px-3 font-mono text-gray-500">
                          {new Date(entry.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-gray-900">
                          {entry.productName}
                          <span className="block text-[10px] font-normal text-gray-500">
                            1 Carton = {entry.packSize} pcs
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                            {entry.logText}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-700">
                          {entry.looseUsed} pcs
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                          {entry.looseRemaining} loose pcs
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-gray-800">{entry.reason}</span>
                          <span className="block text-[10px] font-mono text-gray-500">
                            {entry.referenceType}: {entry.referenceNumber}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {entry.reversed ? (
                            <span className="inline-block px-2 py-0.5 bg-gray-200 text-gray-600 rounded font-bold text-[10px]">
                              Reversed
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isPendingReverse}
                              onClick={() => handleReverse(entry.id)}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-bold text-[11px] transition cursor-pointer disabled:opacity-50"
                            >
                              ↩ Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 1: Multi-Product Inter-Location Transfer */}
      {activeTab === "transfer" && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Multi-Product Stock Transfer (Godown → Shop / Locations)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Godown se Shop ya dusre location me ek sath multiple products transfer karein. Cartons aur loose pieces dono enter kar sakte hain.
              </p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-full">
              Multi-Product Batch Mode
            </span>
          </div>

          {batchTransferError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{batchTransferError}</span>
            </div>
          )}
          {batchTransferMessage && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600" />
              <span>{batchTransferMessage}</span>
            </div>
          )}

          {/* Locations Corridor & Reason Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50/80 p-4 rounded-2xl border border-gray-200">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#790E11]" />
                Source Location (From)
              </label>
              <select
                value={fromLocId}
                onChange={(e) => setFromLocId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#790E11]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="hidden md:flex md:col-span-1 items-center justify-center pt-5">
              <div className="w-8 h-8 rounded-full bg-white border border-gray-200 shadow-2xs flex items-center justify-center text-gray-400">
                <ArrowRight className="w-4 h-4 text-[#790E11]" />
              </div>
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-blue-600" />
                Destination Location (To)
              </label>
              <select
                value={toLocId}
                onChange={(e) => setToLocId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#790E11]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                Transfer Note / Reason
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Regular shop restocking"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#790E11]"
              />
            </div>
          </div>

          {/* Search & Add Products */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Search className="w-4 h-4 text-blue-600" />
                Search &amp; Add Products to Transfer List
              </label>
              <span className="text-xs text-slate-500">
                Type name or shortcode to add
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={transferSearch}
                onChange={(e) => setTransferSearch(e.target.value)}
                placeholder="Search product by name or shortcode (e.g. MDH, Besan, Oil...)"
                className="w-full px-4 py-2.5 pl-10 border border-slate-300 rounded-xl text-sm bg-white shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            {/* Filtered suggestions list */}
            {transferSearch.trim().length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto divide-y divide-slate-100 z-10">
                {products
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(transferSearch.toLowerCase()) ||
                      p.shortCode.toLowerCase().includes(transferSearch.toLowerCase())
                  )
                  .slice(0, 15)
                  .map((p) => {
                    const isAdded = Boolean(transferItems[p.id]);
                    return (
                      <div
                        key={p.id}
                        className="p-3 flex items-center justify-between hover:bg-blue-50/50 transition cursor-pointer"
                        onClick={() => addProductToTransfer(p.id)}
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-3">
                            <span className="font-mono">{p.shortCode}</span>
                            <span>•</span>
                            <span>1 Carton = {p.packSize} pcs</span>
                            {p.godownQty !== undefined && (
                              <>
                                <span>•</span>
                                <span className="font-medium text-emerald-700">
                                  Godown Stock: {p.godownQty} pcs ({Math.floor(p.godownQty / (p.packSize || 1))} ctns)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addProductToTransfer(p.id);
                          }}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                            isAdded
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-600 hover:bg-blue-700 text-white"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {isAdded ? "Added (Add more)" : "Add Product"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Selected Products Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Selected Products for Transfer ({Object.keys(transferItems).length})
              </h4>
              {Object.keys(transferItems).length > 0 && (
                <button
                  type="button"
                  onClick={() => setTransferItems({})}
                  className="text-xs text-rose-600 hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>

            {Object.keys(transferItems).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                <Package className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-medium text-slate-700">Koi product select nahi kiya hai</p>
                <p className="text-xs text-slate-500">
                  Upar search box me product ka naam search karke add karein, fir cartons ya loose pieces set karein.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full text-left text-sm divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-slate-700 text-xs uppercase font-bold tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-center">Available Stock</th>
                      <th className="px-4 py-3 text-center w-28">Cartons</th>
                      <th className="px-4 py-3 text-center w-28">Loose (Pcs)</th>
                      <th className="px-4 py-3 text-center w-32">Total Pieces</th>
                      <th className="px-4 py-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {Object.entries(transferItems).map(([prodId, counts]) => {
                      const prod = products.find((p) => p.id === prodId);
                      if (!prod) return null;
                      const packSize = Math.max(1, prod.packSize || 1);
                      const totalPieces = counts.cartons * packSize + counts.loose;
                      const isOverStock = prod.godownQty !== undefined && totalPieces > prod.godownQty;

                      return (
                        <tr key={prodId} className={isOverStock ? "bg-rose-50/50" : undefined}>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{prod.name}</div>
                            <div className="text-xs text-slate-500 font-mono">
                              {prod.shortCode} • 1 Ctn = {packSize} pcs
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs">
                            {prod.godownQty !== undefined ? (
                              <span className="font-bold text-slate-700 font-mono">
                                {prod.godownQty} pcs
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={counts.cartons}
                              onChange={(e) =>
                                handleTransferCartonChange(prodId, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-mono text-sm focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              value={counts.loose}
                              onChange={(e) =>
                                handleTransferLooseChange(prodId, parseInt(e.target.value, 10) || 0)
                              }
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-center font-mono text-sm focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded font-mono font-bold text-xs ${
                                isOverStock
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-blue-100 text-blue-900"
                              }`}
                            >
                              {totalPieces} pcs
                            </span>
                            {isOverStock && (
                              <span className="block text-[10px] text-rose-600 font-bold mt-0.5">
                                Stock se zyada!
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => removeProductFromTransfer(prodId)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 transition rounded-lg hover:bg-rose-50 cursor-pointer"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Action Bar */}
          {Object.keys(transferItems).length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">
                    Products
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {Object.keys(transferItems).length}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">
                    Total Cartons
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {Object.values(transferItems).reduce((sum, c) => sum + (c.cartons || 0), 0)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-bold block">
                    Total Pieces
                  </span>
                  <span className="text-base font-black text-blue-700 font-mono">
                    {Object.entries(transferItems).reduce((sum, [pid, c]) => {
                      const prod = products.find((p) => p.id === pid);
                      return sum + (c.cartons || 0) * (prod?.packSize || 1) + (c.loose || 0);
                    }, 0)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBatchTransferSubmit}
                disabled={transferSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#790E11] hover:bg-[#600b0e] text-white font-bold rounded-xl shadow-xs disabled:opacity-50 transition cursor-pointer text-xs"
              >
                {transferSubmitting ? (
                  "Transferring..."
                ) : (
                  <>
                    <span>Execute Stock Transfer</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Carton Break */}
      {activeTab === "break" && (
        <form action={breakFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Carton Break (Godown → Shop Loose)</h3>
            <p className="text-sm text-gray-500">
              Unpack cartons stored at Godown into loose units available for retail sale at the Shop.
            </p>
          </div>

          {breakState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{breakState.error}</div>
          )}
          {breakState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Cartons broken into pieces successfully!</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <SearchableSelect
                name="productId"
                options={productOptions}
                value={breakProdId}
                onChange={(val) => setBreakProdId(val)}
                placeholder="Select product..."
                searchPlaceholder="Search product by code, name..."
                popoverWidthClass="w-full min-w-[360px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Source (Godown)</label>
              <select name="fromLocationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value={godownLoc?.id}>{godownLoc?.name}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Destination (Shop)</label>
              <select name="toLocationId" defaultValue={shopLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value={shopLoc?.id}>{shopLoc?.name}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Number of Cartons to Break
              </label>
              <input
                type="number"
                name="cartons"
                min="1"
                value={cartons}
                onChange={(e) => setCartons(parseInt(e.target.value, 10) || 1)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-700 block uppercase font-semibold">Total Loose Pieces Added to Shop</span>
                <span className="text-xl font-bold text-blue-900 font-mono">
                  {cartons * (selectedBreakProd?.packSize || 1)} pieces
                </span>
              </div>
              <span className="text-xs text-blue-600 font-mono">
                {cartons} x {selectedBreakProd?.packSize || 1}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Break Cartons" />
          </div>
        </form>
      )}

      {/* Tab 3: Damage / Spoilage */}
      {activeTab === "damage" && (
        <form action={damageFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Record Damage / Spoilage</h3>
            <p className="text-sm text-gray-500">Deduct ruined, broken, or spoiled goods from inventory with justification.</p>
          </div>

          {damageState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{damageState.error}</div>
          )}
          {damageState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Damage recorded and stock deducted.</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <SearchableSelect
                name="productId"
                options={productOptions}
                value={damageProdId}
                onChange={(val) => setDamageProdId(val)}
                placeholder="Select product..."
                searchPlaceholder="Search product by code, name..."
                popoverWidthClass="w-full min-w-[340px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Location</label>
              <select name="locationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Damaged Quantity (Pieces)</label>
              <input type="number" name="qty" min="1" defaultValue={1} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Damage Reason</label>
              <input type="text" name="reason" required placeholder="e.g. Water leak, transit breakage, rodents" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Deduct Damaged Stock" />
          </div>
        </form>
      )}

      {/* Tab 4: Manual Adjustment */}
      {activeTab === "adjust" && (
        <form action={adjustFormAction} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-lg font-bold text-gray-900">Manual Stock Adjustment</h3>
            <p className="text-sm text-gray-500">Correct discrepancies found outside formal stock audits (+ to add, - to subtract).</p>
          </div>

          {adjustState?.error && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{adjustState.error}</div>
          )}
          {adjustState?.success && (
            <div className="p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">Stock adjusted successfully!</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Product</label>
              <SearchableSelect
                name="productId"
                options={productOptions}
                value={adjustProdId}
                onChange={(val) => setAdjustProdId(val)}
                placeholder="Select product..."
                searchPlaceholder="Search product by code, name..."
                popoverWidthClass="w-full min-w-[340px]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Location</label>
              <select name="locationId" defaultValue={godownLoc?.id} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Adjustment Quantity (+/- Pieces)
              </label>
              <input type="number" name="adjustmentQty" placeholder="+5 or -3" required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono" />
              <p className="mt-1 text-xs text-gray-500">Positive number increases stock; negative number decreases stock.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">Reason</label>
              <input type="text" name="reason" required placeholder="e.g. Packing discrepancy count correction" className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <ActionButton label="Apply Adjustment" />
          </div>
        </form>
      )}
    </div>
  );
}
