import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { dataQualityService } from "@/modules/catalog/data-quality.service";
import { DataQualityClient } from "./data-quality-client";

export const dynamic = "force-dynamic";

export default async function CatalogDataQualityPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SUPER_ADMIN &&
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.GODOWN
  ) {
    redirect("/login");
  }

  const report = await dataQualityService.getReport(session.user.role);
  const isReadOnly = session.user.role === UserRole.GODOWN;

  return (
    <div className="min-h-screen bg-[#FEFDF7] p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin/catalog"
                className="text-xs font-bold text-gray-500 hover:text-gray-800 transition"
              >
                ← Catalog Master
              </Link>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mt-1">
              Catalog Data-Quality Audit
            </h1>
            <p className="text-sm text-gray-600">
              Audit numeric/short names, pack size outliers, missing prices, unassigned brands, duplicates, and missing photos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/catalog"
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold px-3.5 py-2 rounded-xl transition"
            >
              Back to Catalog
            </Link>
            <Link
              href="/admin/catalog/price-lists"
              className="bg-[#790E11] hover:bg-[#5E0A0D] text-white text-xs font-bold px-3.5 py-2 rounded-xl transition"
            >
              Price Lists
            </Link>
          </div>
        </div>

        <DataQualityClient initialReport={report} readOnly={isReadOnly} />
      </div>
    </div>
  );
}
