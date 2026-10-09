import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { returnsService } from "@/modules/returns/returns.service";
import Link from "next/link";
import { formatISTDate, formatISTDateTime } from "@/lib/date";
import {
  ArrowLeft,
  Printer,
  CheckCircle2,
  Building2,
  PackageMinus,
  Calendar,
  FileText,
} from "lucide-react";

interface PageProps {
  params: {
    id: string;
  };
}

export const dynamic = "force-dynamic";

export default async function DebitNoteDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role as UserRole;
  if (
    role !== UserRole.SUPER_ADMIN &&
    role !== UserRole.GODOWN &&
    role !== UserRole.ACCOUNTS
  ) {
    redirect("/login");
  }

  const debitNote = await returnsService.getDebitNoteById(role, params.id);
  if (!debitNote) {
    notFound();
  }

  const totalPieces = debitNote.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/godown/returns"
              className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Debit Note {debitNote.number}
                </h1>
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  FINAL & LOCKED
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Issued on {formatISTDateTime(debitNote.createdAt)} • FY 20{debitNote.fy}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/godown/returns/${debitNote.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              Print A4 Debit Note
            </Link>
          </div>
        </div>

        {/* Confirmation Strip */}
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Inventory & Accounting Synchronized:</strong> Stock was permanently deducted via <code className="text-emerald-800 font-mono">RETURN_TO_COMPANY</code> and supplier ledger was debited by <strong className="font-mono">₹{(debitNote.totalPaise / 100).toFixed(2)}</strong>.
            </span>
          </div>

          <Link
            href={`/admin/parties/${debitNote.supplierId}/ledger`}
            className="text-emerald-700 hover:underline font-semibold text-[11px]"
          >
            View Supplier Ledger →
          </Link>
        </div>

        {/* Summary Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Supplier (Debited)
            </span>
            <div className="font-bold text-slate-900 text-sm">
              {debitNote.supplier.name}
            </div>
            {debitNote.supplier.gstin && (
              <div className="text-xs font-mono text-slate-600">
                GSTIN: {debitNote.supplier.gstin}
              </div>
            )}
            {debitNote.supplier.phone && (
              <div className="text-xs text-slate-500">
                Phone: {debitNote.supplier.phone}
              </div>
            )}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Dispatch Location & Creator
            </span>
            <div className="font-semibold text-slate-900 text-sm">
              {debitNote.location.name}
            </div>
            <div className="text-xs text-slate-600">
              Created by: <span className="font-medium text-slate-800">{debitNote.creator?.name || "Staff"}</span>
            </div>
            <div className="text-xs text-slate-500">
              Return Reason: <span className="font-bold text-rose-700">{debitNote.reason.replace(/_/g, " ")}</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Debit Amount Total
            </span>
            <div className="text-2xl font-mono font-black text-emerald-700">
              ₹{(debitNote.totalPaise / 100).toFixed(2)}
            </div>
            <div className="text-xs text-slate-500">
              Taxable: ₹{(debitNote.subtotalPaise / 100).toFixed(2)} • GST: ₹{(debitNote.taxPaise / 100).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Total Units: {totalPieces} pcs
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <span className="text-xs font-bold uppercase text-slate-700">
              Returned Product Lines ({debitNote.items.length})
            </span>
            <span className="text-xs font-mono font-bold text-slate-600">
              {totalPieces} pieces total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3 w-8">#</th>
                  <th className="p-3">Product Description</th>
                  <th className="p-3 text-center">HSN</th>
                  <th className="p-3 text-center">Batch #</th>
                  <th className="p-3 text-right">Quantity</th>
                  <th className="p-3 text-right">Rate (₹)</th>
                  <th className="p-3 text-right">Taxable (₹)</th>
                  <th className="p-3 text-center">GST</th>
                  <th className="p-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {debitNote.items.map((item, index) => {
                  const packSize = Math.max(1, item.product.packSize);
                  const ctns = Math.floor(item.qty / packSize);
                  const loose = item.qty % packSize;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="p-3 text-slate-400 text-center font-mono">
                        {index + 1}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">
                          {item.product.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                          <span>Code: {item.product.shortCode}</span>
                          {packSize > 1 && (
                            <span>({ctns} ctns + {loose} pcs)</span>
                          )}
                          {item.reason && (
                            <span className="text-rose-600 font-medium">
                              [{item.reason}]
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="p-3 text-center font-mono text-slate-600">
                        {item.product.hsn}
                      </td>

                      <td className="p-3 text-center font-mono text-slate-600">
                        {item.batchNo || "-"}
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {item.qty}
                      </td>

                      <td className="p-3 text-right font-mono text-slate-700">
                        {(item.unitPricePaise / 100).toFixed(2)}
                      </td>

                      <td className="p-3 text-right font-mono text-slate-700">
                        {(item.taxablePaise / 100).toFixed(2)}
                      </td>

                      <td className="p-3 text-center font-mono text-slate-600">
                        {(item.gstRateBp / 100).toFixed(0)}%
                      </td>

                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        ₹{(item.totalPaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes Section */}
          {debitNote.notes && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
              <span className="font-bold text-slate-700">Remarks:</span> {debitNote.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
