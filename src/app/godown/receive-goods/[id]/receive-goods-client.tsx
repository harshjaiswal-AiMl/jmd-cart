"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Check,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle2,
  ShieldCheck,
  Plus,
  Minus,
} from "lucide-react";
import {
  updateLineCountAction,
  confirmAllAsBilledAction,
  postGoodsReceiptAction,
} from "../actions";

interface ProductOption {
  id: string;
  name: string;
  shortCode: string;
  packSize: number;
  packLabel: string;
  mrpPaise: number | null;
}

interface ScanLineItem {
  id: string;
  lineNo: number;
  rawText: string;
  parsedName: string;
  hsn: string | null;
  billedQty: number;
  billedUnit: string;
  billedQtyPieces: number;
  ratePaise: number;
  gstRateBp: number;
  amountPaise: number;
  productId: string | null;
  matchConfidence: number | null;
  matchStatus: string;
  countedCartons: number;
  countedLoose: number;
  countedPieces: number;
  variance: string;
  varianceReason: string | null;
  flags: string[];
  confirmedAsBilled: boolean;
  product?: ProductOption | null;
}

interface BillScanData {
  id: string;
  billNo: string | null;
  billDate: Date | null;
  billTotalPaise: number | null;
  status: string;
  sourceType: string;
  imageKeys: string[];
  ocrConfidence: number | null;
  purchaseId: string | null;
  supplierParty?: { id: string; name: string } | null;
  company?: { id: string; name: string } | null;
  location: { id: string; name: string };
  lines: ScanLineItem[];
}

interface ReceiveGoodsClientProps {
  scan: BillScanData;
  availableProducts: ProductOption[];
}

export function ReceiveGoodsClient({
  scan: initialScan,
  availableProducts,
}: ReceiveGoodsClientProps) {
  const [scan, setScan] = useState<BillScanData>(initialScan);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(100);
  const [activeTab, setActiveTab] = useState<"both" | "image" | "count">("both");
  const [isPending, startTransition] = useTransition();
  const [postError, setPostError] = useState<string | null>(null);

  const totalPages = Math.max(1, scan.imageKeys.length);
  const isPosted = scan.status === "POSTED";

  // Calculate live verification metrics
  const totalLines = scan.lines.length;
  const countedLines = scan.lines.filter(
    (l) => l.confirmedAsBilled || l.countedPieces > 0 || l.varianceReason
  ).length;

  const totalAcceptedPieces = scan.lines.reduce((sum, l) => sum + l.countedPieces, 0);

  const handleStepperChange = (
    lineId: string,
    cartonDelta: number,
    looseDelta: number
  ) => {
    const line = scan.lines.find((l) => l.id === lineId);
    if (!line || isPosted) return;

    const newCartons = Math.max(0, line.countedCartons + cartonDelta);
    const newLoose = Math.max(0, line.countedLoose + looseDelta);
    const packSize = line.product?.packSize || 1;
    const newPieces = newCartons * packSize + newLoose;

    // Optimistic UI update
    setScan((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              countedCartons: newCartons,
              countedLoose: newLoose,
              countedPieces: newPieces,
              variance:
                newPieces === l.billedQtyPieces
                  ? "NONE"
                  : newPieces < l.billedQtyPieces
                  ? "SHORT"
                  : "EXCESS",
            }
          : l
      ),
    }));

    startTransition(async () => {
      await updateLineCountAction(lineId, {
        productId: line.productId,
        countedCartons: newCartons,
        countedLoose: newLoose,
        varianceReason: line.varianceReason,
      });
    });
  };

  const handleProductSelect = (lineId: string, prodId: string) => {
    if (isPosted) return;
    const prod = availableProducts.find((p) => p.id === prodId);
    const line = scan.lines.find((l) => l.id === lineId);
    if (!line) return;

    const packSize = prod?.packSize || 1;
    const newPieces = line.countedCartons * packSize + line.countedLoose;

    setScan((prev) => ({
      ...prev,
      lines: prev.lines.map((l) =>
        l.id === lineId
          ? {
              ...l,
              productId: prodId,
              product: prod || null,
              countedPieces: newPieces,
              matchStatus: "CONFIRMED",
            }
          : l
      ),
    }));

    startTransition(async () => {
      await updateLineCountAction(lineId, {
        productId: prodId,
        countedCartons: line.countedCartons,
        countedLoose: line.countedLoose,
      });
    });
  };

  const handleConfirmAllAsBilled = () => {
    if (isPosted) return;
    startTransition(async () => {
      const res = await confirmAllAsBilledAction(scan.id);
      if (res.scan) {
        setScan(res.scan as unknown as BillScanData);
      }
    });
  };

  const handlePostReceipt = () => {
    if (isPosted) return;
    setPostError(null);
    startTransition(async () => {
      const res = await postGoodsReceiptAction(scan.id);
      if (res.error) {
        setPostError(res.error);
      } else if (res.scan) {
        setScan(res.scan as unknown as BillScanData);
      }
    });
  };

  const imageSrc = `/api/bills/${scan.id}/image/${currentPage}`;

  return (
    <div className="space-y-4">
      {/* Top Banner / Navigation */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/godown/receive-goods"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-lg font-black text-gray-900">
              {scan.billNo ? `Bill #${scan.billNo}` : "Review & Count Shipment"}
            </h1>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                isPosted
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {scan.status}
            </span>
          </div>

          <div className="text-xs text-gray-600 flex flex-wrap gap-x-3 gap-y-1 mt-1 ml-7">
            <span>
              Supplier:{" "}
              <strong>
                {scan.company?.name || scan.supplierParty?.name || "Direct Supplier"}
              </strong>
            </span>
            <span>•</span>
            <span>Receiving at: {scan.location.name}</span>
            {scan.billTotalPaise && (
              <>
                <span>•</span>
                <span>
                  Bill Total: ₹{(scan.billTotalPaise / 100).toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* View Controls & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mobile Tab Toggle */}
          <div className="flex md:hidden rounded-xl border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={() => setActiveTab("image")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "image" ? "bg-white text-blue-600 shadow-xs" : "text-gray-600"
              }`}
            >
              Bill Image
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("count")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                activeTab === "count" ? "bg-white text-blue-600 shadow-xs" : "text-gray-600"
              }`}
            >
              Count ({countedLines}/{totalLines})
            </button>
          </div>

          {!isPosted && (
            <button
              type="button"
              disabled={isPending}
              onClick={handleConfirmAllAsBilled}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
            >
              ✓ All As Per Bill
            </button>
          )}

          {!isPosted && (
            <button
              type="button"
              disabled={isPending || countedLines === 0}
              onClick={handlePostReceipt}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 active:scale-98"
            >
              {isPending ? "Posting..." : "Done & Add to Stock →"}
            </button>
          )}
        </div>
      </div>

      {/* Posted Success Banner */}
      {isPosted && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            <div>
              <div className="text-sm font-bold text-emerald-950">
                Goods receipt posted successfully to godown stock!
              </div>
              <div className="text-xs text-emerald-800">
                {totalAcceptedPieces.toLocaleString("en-IN")} accepted pieces added to{" "}
                {scan.location.name}.
              </div>
            </div>
          </div>
          {scan.purchaseId && (
            <Link
              href={`/godown/purchases`}
              className="px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition"
            >
              View GRN Record →
            </Link>
          )}
        </div>
      )}

      {postError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
          {postError}
        </div>
      )}

      {/* Main Split View: Left Document Viewer, Right Verification & Counting */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Document Viewer (Hidden on mobile if count tab active) */}
        <div
          className={`lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col h-[750px] ${
            activeTab === "count" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Viewer Controls */}
          <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <FileText className="w-4 h-4 text-gray-500" />
              <span>Bill Document</span>
              {totalPages > 1 && (
                <span className="text-gray-500 font-normal">
                  (Page {currentPage} of {totalPages})
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
                className="p-1 rounded-lg hover:bg-gray-200 text-gray-600"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-gray-500 w-10 text-center">
                {zoom}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(250, z + 25))}
                className="p-1 rounded-lg hover:bg-gray-200 text-gray-600"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              {totalPages > 1 && (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-300">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                    className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                    className="p-1 rounded-lg hover:bg-gray-200 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Document Preview Canvas */}
          <div className="flex-1 bg-gray-100 overflow-auto p-4 flex items-center justify-center">
            {scan.imageKeys.length > 0 ? (
              <img
                src={imageSrc}
                alt="Bill Scan Page"
                style={{ width: `${zoom}%`, maxWidth: "none" }}
                className="shadow-md rounded-lg transition-all duration-150 origin-top"
              />
            ) : (
              <div className="text-xs text-gray-400">No bill image available</div>
            )}
          </div>
        </div>

        {/* Right: Items Verification & Counting Table */}
        <div
          className={`lg:col-span-7 bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col h-[750px] ${
            activeTab === "image" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Header Progress Bar */}
          <div className="p-4 border-b border-gray-200 bg-gray-50/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-gray-800">
                Count &amp; Verify Physical Goods ({countedLines}/{totalLines} lines counted)
              </span>
              <p className="text-[11px] text-gray-500">
                Stock is added strictly according to keeper confirmed counts.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-gray-900">
                Accepted: {totalAcceptedPieces.toLocaleString("en-IN")} pcs
              </span>
            </div>
          </div>

          {/* Lines Table */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
            {scan.lines.map((line) => {
              const packSize = line.product?.packSize || 1;
              const isMatch = line.countedPieces === line.billedQtyPieces && line.countedPieces > 0;
              const isShort = line.countedPieces < line.billedQtyPieces;
              const isExcess = line.countedPieces > line.billedQtyPieces;

              return (
                <div
                  key={line.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isMatch
                      ? "bg-emerald-50/30"
                      : isShort && line.countedPieces > 0
                      ? "bg-amber-50/40"
                      : "hover:bg-gray-50/60"
                  }`}
                >
                  {/* Top Line: OCR Raw Text & Matched Product */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          #{line.lineNo}
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          {line.parsedName}
                        </span>
                        {line.hsn && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            HSN: {line.hsn}
                          </span>
                        )}
                      </div>

                      {/* Product Selector */}
                      <div className="pt-1">
                        <select
                          disabled={isPosted}
                          value={line.productId || ""}
                          onChange={(e) => handleProductSelect(line.id, e.target.value)}
                          className="w-full text-xs font-medium py-1.5 px-2.5 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Match with Catalog Product --</option>
                          {availableProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              [{p.shortCode}] {p.name} ({p.packSize} pcs/{p.packLabel})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Billed info */}
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">Billed:</div>
                      <div className="font-bold text-gray-900 text-sm">
                        {line.billedQty} {line.billedUnit}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        ({line.billedQtyPieces} pcs)
                      </div>
                    </div>
                  </div>

                  {/* Bottom Line: Steppers & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-gray-100">
                    {/* Steppers */}
                    <div className="flex items-center gap-4">
                      {/* Carton Stepper */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 font-medium">Cartons:</span>
                        <button
                          type="button"
                          disabled={isPosted || line.countedCartons <= 0}
                          onClick={() => handleStepperChange(line.id, -1, 0)}
                          className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm text-gray-900">
                          {line.countedCartons}
                        </span>
                        <button
                          type="button"
                          disabled={isPosted}
                          onClick={() => handleStepperChange(line.id, 1, 0)}
                          className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Loose Stepper */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600 font-medium">Loose:</span>
                        <button
                          type="button"
                          disabled={isPosted || line.countedLoose <= 0}
                          onClick={() => handleStepperChange(line.id, 0, -1)}
                          className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-sm text-gray-900">
                          {line.countedLoose}
                        </span>
                        <button
                          type="button"
                          disabled={isPosted}
                          onClick={() => handleStepperChange(line.id, 0, 1)}
                          className="w-7 h-7 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 flex items-center justify-center font-bold text-gray-700 disabled:opacity-40"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Live Total & Status Chip */}
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs text-gray-500">Counted Total: </span>
                        <strong className="text-sm font-bold text-gray-900 font-mono">
                          {line.countedPieces} pcs
                        </strong>
                      </div>

                      {line.countedPieces > 0 && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase ${
                            isMatch
                              ? "bg-emerald-100 text-emerald-800"
                              : isShort
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isMatch ? "MATCH" : isShort ? "SHORT" : "EXCESS"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Variance Reason Input if Shortage */}
                  {isShort && line.countedPieces > 0 && !isPosted && (
                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Reason for shortage (e.g. Broken in transit, short supplied by vendor)..."
                        value={line.varianceReason || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setScan((prev) => ({
                            ...prev,
                            lines: prev.lines.map((l) =>
                              l.id === line.id ? { ...l, varianceReason: val } : l
                            ),
                          }));
                          startTransition(async () => {
                            await updateLineCountAction(line.id, {
                              countedCartons: line.countedCartons,
                              countedLoose: line.countedLoose,
                              varianceReason: val,
                            });
                          });
                        }}
                        className="w-full text-xs px-2.5 py-1.5 border border-amber-300 rounded-lg bg-amber-50/50 focus:bg-white focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
