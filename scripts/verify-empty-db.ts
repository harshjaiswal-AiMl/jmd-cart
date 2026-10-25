import { prisma } from "../src/lib/prisma";

async function main() {
  const [
    users,
    companies,
    categories,
    products,
    stockMovements,
    stockBalances,
    invoices,
    orders,
    parties,
    purchases,
    locations,
    settings,
    sequences,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.stockMovement.count(),
    prisma.stockBalance.count(),
    prisma.invoice.count(),
    prisma.order.count(),
    prisma.party.count(),
    prisma.purchase.count(),
    prisma.location.count(),
    prisma.setting.count(),
    prisma.sequence.count(),
  ]);

  const businessTables = {
    users,
    companies,
    categories,
    products,
    stock_movements: stockMovements,
    stock_balances: stockBalances,
    invoices,
    orders,
    parties,
    purchases,
  };

  const referenceTables = {
    locations,
    settings,
    sequences,
  };

  console.log("=== Business Tables (Expected: 0 rows) ===");
  console.table(businessTables);

  console.log("=== Reference Tables (Expected: > 0 rows) ===");
  console.table(referenceTables);

  const nonZeroBusiness = Object.entries(businessTables).filter(([, count]) => count > 0);
  if (nonZeroBusiness.length > 0) {
    console.error("ERROR: Non-zero business tables found:", nonZeroBusiness);
    process.exit(1);
  }

  console.log("SUCCESS: All business tables have 0 rows; reference tables initialized.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
