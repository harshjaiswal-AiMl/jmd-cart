import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { receivingService } from "@/modules/ocr/receiving.service";
import Link from "next/link";
import { Camera, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";

export default async function ReceiveGoodsListPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, Permission.STOCK_RECEIVE)) redirect("/login");

  const scans = await receivingService.listScans(session.user.role, 50);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                <Camera className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                Receive Goods (Scan Supplier Bill)
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              Photograph arrival bills, run offline OCR extraction, count physical goods, and add verified stock.
            </p>
          </div>

          <Link
            href="/godown/receive-goods/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition active:scale-98"
          >
            <Camera className="w-4 h-4" />
            + Scan New Bill (Camera / PDF)
          </Link>
        </div>

        {/* Scan Receipts List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50/60 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Recent Bill Scans ({scans.length})
            </span>
          </div>

          {scans.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-gray-800">No bill scans yet</div>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                When a shipment arrives, photograph the invoice or upload the PDF bill to start the counting &amp; receiving flow.
              </p>
              <div className="pt-2">
                <Link
                  href="/godown/receive-goods/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition"
                >
                  <Camera className="w-3.5 h-3.5" /> Scan First Bill
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {scans.map((scan) => {
                const totalLines = scan.lines.length;
                const statusColors = {
                  DRAFT: "bg-gray-100 text-gray-700 border-gray-200",
                  COUNTING: "bg-amber-50 text-amber-800 border-amber-200",
                  READY: "bg-blue-50 text-blue-800 border-blue-200",
                  POSTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
                  CANCELLED: "bg-red-50 text-red-800 border-red-200",
                };

                return (
                  <Link
                    key={scan.id}
                    href={`/godown/receive-goods/${scan.id}`}
                    className="block p-4 sm:p-5 hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold text-gray-900 text-sm">
                            {scan.billNo ? `Bill #${scan.billNo}` : "Unnumbered Bill"}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${
                              statusColors[scan.status]
                            }`}
                          >
                            {scan.status}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            {scan.sourceType}
                          </span>
                        </div>

                        <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Supplier:{" "}
                            <strong className="text-gray-800">
                              {scan.company?.name || scan.supplierParty?.name || "Direct Supplier"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>Location: {scan.location.name}</span>
                          <span>•</span>
                          <span>{totalLines} lines detected</span>
                          {scan.billTotalPaise && (
                            <>
                              <span>•</span>
                              <span>
                                Bill Total:{" "}
                                <strong className="text-gray-900">
                                  ₹{(scan.billTotalPaise / 100).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {new Date(scan.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          {scan.creator?.name && (
                            <div className="text-[11px] text-gray-400">
                              by {scan.creator.name}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
