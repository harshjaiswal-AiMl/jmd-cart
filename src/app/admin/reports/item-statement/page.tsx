import { prisma } from "@/lib/prisma";
import { itemStockStatementService } from "@/modules/reports/item-stock-statement.service";
import { ItemStatementClient } from "./item-statement-client";

export const dynamic = "force-dynamic";

export default async function ItemStatementPage() {
  const [initialReport, companies, categories] = await Promise.all([
    itemStockStatementService.getStatement({}),
    prisma.company.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
      <ItemStatementClient
        initialReport={initialReport}
        companies={companies}
        categories={categories}
      />
    </div>
  );
}
