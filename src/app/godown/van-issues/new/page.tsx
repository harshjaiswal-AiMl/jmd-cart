import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { NewVanIssueClient } from "./new-van-issue-client";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewVanIssuePage() {
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

  // 1. Fetch available Van locations
  const vanLocations = await vanService.listVanLocations(session.user.role);

  // 2. Fetch Central Godown
  const godown = await prisma.location.findFirst({
    where: { type: LocationType.GODOWN, active: true },
  });

  // 3. Fetch products and their Godown stock balance
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const godownBalances = godown
    ? await prisma.stockBalance.findMany({
        where: { locationId: godown.id },
      })
    : [];

  const balanceMap = new Map<string, number>();
  godownBalances.forEach((b) => balanceMap.set(b.productId, b.qty));

  const godownProducts = products.map((p) => ({
    ...p,
    godownQty: balanceMap.get(p.id) || 0,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
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
            <span>New Dispatch</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">New Van Issue & Load Sheet</h1>
          <p className="text-sm text-gray-600">
            Dispatch products from Central Godown into route delivery vans for daily distribution.
          </p>
        </div>

        <NewVanIssueClient vanLocations={vanLocations} godownProducts={godownProducts} />
      </div>
    </div>
  );
}
