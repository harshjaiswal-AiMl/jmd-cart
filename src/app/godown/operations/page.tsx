import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { autoConvertService } from "@/modules/godown/auto-convert.service";
import { OperationsClient } from "./operations-client";

export const dynamic = "force-dynamic";

export default async function GodownOperationsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.GODOWN) {
    redirect("/login");
  }

  const [locations, products, autoConvertSummary] = await Promise.all([
    prisma.location.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, shortCode: true, packSize: true, packLabel: true },
      orderBy: { name: "asc" },
    }),
    autoConvertService.getDailyAutoConvertSummary(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Godown Operations &amp; Carton → Loose Auto-Conversion
            </h1>
            <p className="text-sm text-gray-600">
              Carton → Loose conversion in Godown, Daily Auto-Converted Cartons Report, Admin Reverse Option, transfers &amp; damage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/godown"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-lg shadow-sm text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              ← Godown Dashboard
            </Link>
            <Link
              href="/godown/returns"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 rounded-lg shadow-sm text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors"
            >
              Company Returns &amp; Debit Notes →
            </Link>
          </div>
        </div>

        <OperationsClient
          locations={locations}
          products={products}
          autoConvertSummary={autoConvertSummary}
        />
      </div>
    </div>
  );
}
