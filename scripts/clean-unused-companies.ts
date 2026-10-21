import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function main() {
  const dbPass = execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart"', { encoding: 'utf8' }).trim();
  const dbUrl = `postgresql://jmdcart_app:${encodeURIComponent(dbPass)}@127.0.0.1:5433/jmdcart?schema=public`;

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  try {
    const companies = await prisma.company.findMany({
      include: { _count: { select: { products: true } } }
    });
    console.log('Total companies:', companies.length);
    const unused = companies.filter(c => c._count.products === 0);
    console.log('Unused companies with 0 products:', unused.map(c => c.name));
    if (unused.length > 0) {
      const ids = unused.map(c => c.id);
      await prisma.company.deleteMany({ where: { id: { in: ids } } });
      console.log('Deleted', ids.length, 'unused companies.');
    }
    const remaining = await prisma.company.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' }
    });
    console.log('Active canonical companies:');
    remaining.forEach(c => console.log(`  ${c.name}: ${c._count.products} products`));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
