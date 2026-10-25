import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const isApply = process.argv.includes("--apply");

  console.log("==================================================");
  console.log("   CLEANUP PRODUCTS STARTING WITH DIGITS (0-9)    ");
  console.log(` Mode: ${isApply ? "APPLY (Committing changes)" : "DRY-RUN (Simulating only, use --apply to commit)"}`);
  console.log("==================================================\n");

  // Find all active products where name starts with a digit 0-9
  const products = await prisma.product.findMany({
    where: {
      active: true,
    },
    select: {
      id: true,
      name: true,
      shortCode: true,
      mrpPaise: true,
      packSize: true,
      stockBalances: {
        select: {
          qty: true,
          location: { select: { name: true } },
        },
      },
      _count: {
        select: {
          invoiceItems: true,
          orderItems: true,
          stockMovements: true,
        },
      },
    },
  });

  const digitProducts = products.filter((p) => /^[0-9]/.test(p.name.trim()));

  console.log(`Found ${digitProducts.length} active products starting with a digit:\n`);

  for (const p of digitProducts) {
    const totalStock = p.stockBalances.reduce((sum, b) => sum + b.qty, 0);
    const hasHistory = p._count.invoiceItems > 0 || p._count.orderItems > 0 || p._count.stockMovements > 0;
    console.log(`- [${p.shortCode}] "${p.name}" | Stock: ${totalStock} pcs | Invoices: ${p._count.invoiceItems} | Movements: ${p._count.stockMovements}`);

    if (isApply) {
      await prisma.product.update({
        where: { id: p.id },
        data: { active: false },
      });
      console.log(`  -> Deactivated product ${p.shortCode}`);
    }
  }

  console.log("\n==================================================");
  console.log(`Total matching products: ${digitProducts.length}`);
  if (isApply) {
    console.log("All matching products have been deactivated (active = false).");
  } else {
    console.log("Run with --apply to deactivate these products.");
  }
  console.log("==================================================");
}

main()
  .catch((e) => {
    console.error("Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
