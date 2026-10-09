import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hasPermission, Permission } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";
import { StockClient } from "./stock-client";

export default async function GodownStockOverviewPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!hasPermission(session.user.role, Permission.STOCK_VIEW)) {
    redirect("/login");
  }

  const [locations, companies, initialData, initialKPIs] = await Promise.all([
    prisma.location.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    }),
    prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    stockService.listStockBalances(session.user.role, {}),
    stockService.getStockKPIs(session.user.role),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stock Inventory by Location</h1>
            <p className="text-sm text-gray-600">
              Live balances across Godown, Shop, and Sales Vans with low-stock reorder thresholds.
            </p>
          </div>
        </div>

        <StockClient
          locations={locations}
          companies={companies}
          initialData={initialData}
          initialKPIs={initialKPIs}
        />
      </div>
    </div>
  );
}
