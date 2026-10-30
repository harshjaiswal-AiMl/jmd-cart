import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { openingStockService } from "@/modules/stock/opening-stock.service";
import { OpeningStockClient } from "./opening-stock-client";

export const metadata = {
  title: "Opening Stock Management (18-Oct Baseline) | JMD Cart",
  description: "Fixed Opening Stock baseline control, godown/shop piece breakdown, and real-time adjustment.",
};

const ALLOWED_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.GODOWN,
  UserRole.WAREHOUSE_MANAGER,
];

export default async function OpeningStockPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!ALLOWED_ROLES.includes(session.user.role as UserRole)) {
    redirect("/admin");
  }

  const [openingStockData, allProducts] = await Promise.all([
    openingStockService.getOpeningStockList(),
    prisma.product.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        shortCode: true,
        packSize: true,
        packLabel: true,
        mrpPaise: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <OpeningStockClient
          initialItems={openingStockData.items}
          initialSummary={openingStockData.summary}
          companies={openingStockData.companies}
          categories={openingStockData.categories}
          allProductsList={allProducts}
        />
      </div>
    </div>
  );
}
