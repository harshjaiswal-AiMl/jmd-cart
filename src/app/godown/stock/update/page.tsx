import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { LocationType, UserRole } from "@prisma/client";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { stockExcelUploadService } from "@/modules/godown/stock-excel-upload.service";
import { UpdateStockClient } from "./update-stock-client";

export default async function UpdateStockPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_ADJUST)) {
    redirect("/login");
  }

  const [locations, products, recentBatches, companies] = await Promise.all([
    prisma.location.findMany({
      where: {
        active: true,
        type: { in: [LocationType.GODOWN, LocationType.SHOP] },
      },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      include: {
        stockBalances: true,
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: { shortCode: "asc" },
    }),
    stockExcelUploadService.listRecentStockBatches(
      session.user.role,
      session.user.id,
      10
    ),
    prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const productOptions = products.map((p) => {
    const balancesByLocation: Record<string, number> = {};
    for (const b of p.stockBalances) {
      balancesByLocation[b.locationId] = b.qty;
    }
    return {
      id: p.id,
      shortCode: p.shortCode,
      name: p.name,
      packSize: p.packSize || 1,
      unitType: "PCS",
      companyId: p.companyId || "",
      companyName: p.company?.name || "",
      categoryName: p.category?.name || "",
      balancesByLocation,
    };
  });

  const serializedBatches = recentBatches.map((b) => ({
    id: b.id,
    filename: b.filename,
    locationId: b.locationId,
    mode: b.mode || "STOCK_COUNT",
    rowsTotal: b.rowsTotal,
    rowsApplied: b.rowsApplied,
    rowsSkipped: b.rowsSkipped,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    userName: b.user?.name || "System",
  }));

  return (
    <div className="min-h-screen bg-[#FEFDF7] p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Update Stock (Opening / Count / Adjust / Instant Excel Upload)
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">
              Enter opening stock, physical stock count, +/- adjustments, or instant 1-step Excel (.xlsx / .csv) stock upload with full batch undo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/godown/stock"
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition"
            >
              ← Stock by Location
            </Link>
            {(session.user.role === UserRole.SUPER_ADMIN ||
              session.user.role === UserRole.ADMIN) && (
              <Link
                href="/admin"
                className="bg-[#790E11] hover:bg-[#5f0b0d] text-white text-xs font-bold px-3.5 py-2.5 rounded-xl transition"
              >
                Owner Dashboard
              </Link>
            )}
          </div>
        </div>

        <UpdateStockClient
          locations={locations}
          products={productOptions}
          companies={companies}
          userRole={session.user.role}
          recentBatches={serializedBatches}
        />
      </div>
    </div>
  );
}
