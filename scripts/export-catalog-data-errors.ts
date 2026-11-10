import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

function checkOrdering(p: {
  mrpPaise: number | null;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
}): string[] {
  const w: string[] = [];
  if (p.priceAPaise != null && p.priceBPaise != null && p.priceAPaise > p.priceBPaise) w.push("A > B");
  if (p.priceBPaise != null && p.priceCPaise != null && p.priceBPaise > p.priceCPaise) w.push("B > C");
  if (p.mrpPaise != null && p.mrpPaise > 0) {
    if (p.priceAPaise != null && p.priceAPaise > p.mrpPaise) w.push("A > MRP");
    if (p.priceBPaise != null && p.priceBPaise > p.mrpPaise) w.push("B > MRP");
    if (p.priceCPaise != null && p.priceCPaise > p.mrpPaise) w.push("C > MRP");
  }
  return w;
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      shortCode: true,
      mrpPaise: true,
      priceAPaise: true,
      priceBPaise: true,
      priceCPaise: true,
      active: true,
    },
    orderBy: { name: "asc" },
  });

  const deepDiscountRows: any[] = [];
  const orderingErrorRows: any[] = [];

  for (const p of products) {
    const mrp = p.mrpPaise ?? 0;
    if (mrp > 0) {
      const tiers = [
        { tier: "A", val: p.priceAPaise },
        { tier: "B", val: p.priceBPaise },
        { tier: "C", val: p.priceCPaise },
      ];
      for (const t of tiers) {
        if (t.val != null && t.val > 0) {
          const pctOff = ((mrp - t.val) / mrp) * 100;
          if (pctOff >= 50) {
            deepDiscountRows.push({
              id: p.id,
              name: p.name,
              shortCode: p.shortCode,
              tier: t.tier,
              mrpRupees: mrp / 100,
              priceRupees: t.val / 100,
              discountPct: Math.round(pctOff * 100) / 100,
            });
          }
        }
      }
    }
    const warnings = checkOrdering(p);
    if (warnings.length > 0) {
      orderingErrorRows.push({
        id: p.id,
        name: p.name,
        shortCode: p.shortCode,
        mrpRupees: p.mrpPaise != null ? p.mrpPaise / 100 : null,
        priceA: p.priceAPaise != null ? p.priceAPaise / 100 : null,
        priceB: p.priceBPaise != null ? p.priceBPaise / 100 : null,
        priceC: p.priceCPaise != null ? p.priceCPaise / 100 : null,
        warnings,
      });
    }
  }

  const outPath = path.join(process.cwd(), "artifacts", "catalog-data-errors.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        scannedProducts: products.length,
        deepDiscountCount: deepDiscountRows.length,
        deepDiscountRows,
        orderingErrorCount: orderingErrorRows.length,
        orderingErrorRows,
      },
      null,
      2
    )
  );
  console.log(`Scanned ${products.length} products -> >=50% off: ${deepDiscountRows.length}, ordering warnings: ${orderingErrorRows.length}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
