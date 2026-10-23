import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { ScanUploadForm } from "./scan-upload-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewReceiveGoodsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!hasPermission(session.user.role, Permission.STOCK_RECEIVE)) redirect("/login");

  const [locations, companies] = await Promise.all([
    prisma.location.findMany({
      where: { active: true, type: { in: ["GODOWN", "SHOP"] } },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        supplierParty: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const formattedCompanies = companies.map((c) => ({
    id: c.id,
    name: c.name,
    supplierPartyId: c.supplierParty?.id || null,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link
            href="/godown/receive-goods"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Bill Scans
          </Link>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            Scan Supplier Delivery Bill
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Capture clear photos of the physical paper bill or upload digital invoice PDF.
          </p>
        </div>

        <ScanUploadForm locations={locations} companies={formattedCompanies} />
      </div>
    </div>
  );
}
