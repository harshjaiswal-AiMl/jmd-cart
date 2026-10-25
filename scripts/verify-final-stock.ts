import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function main() {
  const dbPass = execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart"', { encoding: 'utf8' }).trim();
  const dbUrl = `postgresql://jmdcart_app:${encodeURIComponent(dbPass)}@127.0.0.1:5433/jmdcart?schema=public`;

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const balances = await prisma.stockBalance.groupBy({
      by: ['locationId'],
      _sum: { qty: true },
      _count: { productId: true }
    });
    console.log('Stock Balances by Location:');
    console.log(balances);

    const locations = await prisma.location.findMany();
    for (const loc of locations) {
      const b = balances.find(x => x.locationId === loc.id);
      console.log(`  Location: ${loc.name} (${loc.id}) -> Products: ${b?._count.productId || 0}, Total Pieces: ${b?._sum.qty || 0}`);
    }

    const sampleProductsWithStock = await prisma.product.findMany({
      where: { stockBalances: { some: { qty: { gt: 0 } } } },
      include: {
        company: true,
        stockBalances: true
      },
      take: 8
    });
    console.log('\nSample Products with Live Stock in Main Godown:');
    sampleProductsWithStock.forEach(p => {
      console.log({
        name: p.name,
        company: p.company?.name,
        mrp: (p.mrpPaise || 0) / 100,
        priceA: (p.priceAPaise || 0) / 100,
        priceB: (p.priceBPaise || 0) / 100,
        priceC: (p.priceCPaise || 0) / 100,
        packSize: p.packSize,
        godownStockPieces: p.stockBalances[0]?.qty || 0
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
