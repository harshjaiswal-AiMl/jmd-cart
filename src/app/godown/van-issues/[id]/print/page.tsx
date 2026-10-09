import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { vanService } from "@/modules/van/van.service";
import { settingsService } from "@/modules/settings/settings.service";
import { formatISTDateTime } from "@/lib/date";
import { paiseToIndianWords } from "@/lib/number-to-words";
import Link from "next/link";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintVanIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.GODOWN &&
    session.user.role !== UserRole.SALESPERSON
  ) {
    redirect("/login");
  }

  const { id } = await params;
  const vanDay = await vanService.getVanDayById(session.user.role, id);

  if (!vanDay) {
    notFound();
  }

  const business = await settingsService.getBusinessDetails();

  let totalCartons = 0;
  let totalPieces = 0;
  let totalValuationPaise = 0;

  vanDay.lines.forEach((line) => {
    const cartons = Math.floor(line.issuedQty / line.product.packSize);
    const loose = line.issuedQty % line.product.packSize;
    totalCartons += cartons;
    totalPieces += line.issuedQty;
    totalValuationPaise += line.issuedQty * line.product.mrpPaise;
  });

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Navigation & Print Controls (Hidden on Print) */}
        <div className="flex items-center justify-between print:hidden bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <Link
            href="/godown/van-issues"
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to Van Issue List
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 font-mono">
              Sheet: {vanDay.issueSheetNo}
            </span>
            <PrintButton />
          </div>
        </div>

        {/* Formal A4 Document */}
        <div className="bg-white p-8 md:p-10 rounded-lg shadow-md print:shadow-none print:border-none border border-gray-300 font-sans text-gray-900">
          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900">
                  {business.legalName}
                </h1>
                <p className="text-xs text-gray-600 max-w-md mt-1">{business.address}</p>
                <div className="text-xs text-gray-600 mt-1 space-x-3 font-mono">
                  <span>GSTIN: {business.gstin}</span>
                  {business.fssai && <span>FSSAI: {business.fssai}</span>}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                  Van Issue &amp; Load Sheet
                </span>
                <p className="text-sm font-mono font-bold text-gray-900 mt-2">
                  {vanDay.issueSheetNo}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  IST Dispatch: {formatISTDateTime(vanDay.date)}
                </p>
              </div>
            </div>
          </div>

          {/* Dispatch Metadata */}
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-md border border-gray-200 text-xs mb-6">
            <div>
              <p className="text-gray-500 uppercase font-semibold text-[10px] tracking-wider">
                Destination Vehicle
              </p>
              <p className="font-bold text-sm text-gray-900 mt-0.5">{vanDay.vanLocation.name}</p>
              {vanDay.notes && (
                <p className="text-gray-600 mt-1">
                  <span className="font-semibold">Route Notes:</span> {vanDay.notes}
                </p>
              )}
            </div>

            <div>
              <p className="text-gray-500 uppercase font-semibold text-[10px] tracking-wider">
                Assigned Salesperson / Driver
              </p>
              <p className="font-bold text-sm text-gray-900 mt-0.5">{vanDay.salesperson.name}</p>
              <p className="text-gray-600 mt-0.5 font-mono">📞 {vanDay.salesperson.phone}</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full divide-y divide-gray-300 text-xs border border-gray-300">
              <thead className="bg-gray-100 text-gray-800 font-semibold">
                <tr>
                  <th className="py-2 px-2 text-center w-10">S.No</th>
                  <th className="py-2 px-2 text-left w-24">Item Code</th>
                  <th className="py-2 px-3 text-left">Product Description</th>
                  <th className="py-2 px-2 text-center w-20">Pack Size</th>
                  <th className="py-2 px-2 text-center w-16">Cartons</th>
                  <th className="py-2 px-2 text-center w-16">Loose Pcs</th>
                  <th className="py-2 px-2 text-right w-20">Total Pcs</th>
                  <th className="py-2 px-2 text-right w-20">MRP (₹)</th>
                  <th className="py-2 px-3 text-right w-24">Valuation (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {vanDay.lines.map((line, idx) => {
                  const cartons = Math.floor(line.issuedQty / line.product.packSize);
                  const loose = line.issuedQty % line.product.packSize;
                  const lineValuationPaise = line.issuedQty * line.product.mrpPaise;

                  return (
                    <tr key={line.id} className="hover:bg-gray-50">
                      <td className="py-2 px-2 text-center text-gray-500">{idx + 1}</td>
                      <td className="py-2 px-2 font-mono font-medium text-gray-800">
                        {line.product.shortCode}
                      </td>
                      <td className="py-2 px-3 font-medium text-gray-900">
                        {line.product.name}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600">
                        {line.product.packSize} / {line.product.packLabel}
                      </td>
                      <td className="py-2 px-2 text-center font-semibold text-gray-900">
                        {cartons > 0 ? cartons : "-"}
                      </td>
                      <td className="py-2 px-2 text-center text-gray-700">
                        {loose > 0 ? loose : "-"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-gray-900">
                        {line.issuedQty}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-gray-700">
                        {(line.product.mrpPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-gray-900">
                        {(lineValuationPaise / 100).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-400">
                <tr>
                  <td colSpan={4} className="py-2 px-3 text-left">
                    TOTAL DISPATCH QUANTITIES:
                  </td>
                  <td className="py-2 px-2 text-center">{totalCartons} ctn</td>
                  <td className="py-2 px-2 text-center">-</td>
                  <td className="py-2 px-2 text-right">{totalPieces} pcs</td>
                  <td className="py-2 px-2 text-right">NET MRP:</td>
                  <td className="py-2 px-3 text-right font-mono text-sm">
                    ₹{(totalValuationPaise / 100).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in Words */}
          <div className="bg-gray-50 p-3 rounded border border-gray-200 text-xs mb-8">
            <span className="font-semibold text-gray-700">Total MRP Value in Words: </span>
            <span className="text-gray-900 font-medium italic">
              {paiseToIndianWords(totalValuationPaise)}
            </span>
          </div>

          {/* Legal Acknowledgement & Signature Blocks */}
          <div className="space-y-6 pt-4 border-t border-gray-300">
            <p className="text-[11px] text-gray-600 italic leading-relaxed text-center">
              &quot;I acknowledge receipt of the above inventory in sound condition and sealed cartons
              for daily route distribution in Saharsa district. Any shortage or damage upon evening return
              will be reconciled under my responsibility.&quot;
            </p>

            <div className="grid grid-cols-2 gap-12 pt-8 text-xs text-gray-800">
              <div className="border-t border-gray-400 pt-2 text-center">
                <p className="font-bold">Godown Supervisor / Dispatcher</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Signature &amp; Stamp</p>
              </div>

              <div className="border-t border-gray-400 pt-2 text-center">
                <p className="font-bold">Route Salesperson / Driver</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Signature &amp; Received Date</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
