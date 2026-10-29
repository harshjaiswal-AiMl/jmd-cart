import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import Link from "next/link";
import { EditVanIssueClient } from "./edit-van-issue-client";

export const dynamic = "force-dynamic";

export default async function EditVanIssuePage({
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
    session.user.role !== UserRole.ADMIN &&
    session.user.role !== UserRole.WAREHOUSE_MANAGER &&
    session.user.role !== UserRole.GODOWN
  ) {
    redirect("/login");
  }

  const { id } = await params;
  const vanDay = await vanService.getVanDayById(session.user.role, id);

  if (!vanDay) {
    notFound();
  }

  // Only OPEN van issue sheets can be edited
  if (vanDay.status !== "OPEN") {
    redirect(`/godown/van-issues/${id}/print`);
  }

  // Fetch Central Godown
  const godown = await prisma.location.findFirst({
    where: { type: LocationType.GODOWN, active: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch all active products
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  // Fetch Godown stock balances
  const godownBalances = godown
    ? await prisma.stockBalance.findMany({
        where: { locationId: godown.id },
      })
    : [];

  const godownBalanceMap = new Map<string, number>();
  godownBalances.forEach((b) => godownBalanceMap.set(b.productId, b.qty));

  // Fetch Van stock balances
  const vanBalances = await prisma.stockBalance.findMany({
    where: { locationId: vanDay.vanLocationId },
  });
  const vanBalanceMap = new Map<string, number>();
  vanBalances.forEach((b) => vanBalanceMap.set(b.productId, b.qty));

  const stockProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    shortCode: p.shortCode,
    packSize: p.packSize,
    packLabel: p.packLabel,
    mrpPaise: p.mrpPaise,
    godownQty: godownBalanceMap.get(p.id) || 0,
    vanQty: vanBalanceMap.get(p.id) || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/godown" className="hover:underline">
              Godown
            </Link>
            <span>/</span>
            <Link href="/godown/van-issues" className="hover:underline">
              Van Issues
            </Link>
            <span>/</span>
            <Link href={`/godown/van-issues/${vanDay.id}/print`} className="hover:underline">
              {vanDay.issueSheetNo}
            </Link>
            <span>/</span>
            <span>Edit Load</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Edit Van Load Sheet: {vanDay.issueSheetNo}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Van: <span className="font-semibold text-gray-800">{vanDay.vanLocation.name}</span> &nbsp;|&nbsp;
                Salesperson: <span className="font-semibold text-gray-800">{vanDay.salesperson.name}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/godown/van-issues/${vanDay.id}/print`}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                🖨️ View Print Sheet
              </Link>
              <Link
                href="/godown/van-issues"
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                ← Back to List
              </Link>
            </div>
          </div>
        </div>

        <EditVanIssueClient vanDay={vanDay} products={stockProducts} />
      </div>
    </div>
  );
}
