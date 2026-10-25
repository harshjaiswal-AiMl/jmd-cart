import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function main() {
  const dbPass = execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart"', { encoding: 'utf8' }).trim();
  const dbUrl = `postgresql://jmdcart_app:${encodeURIComponent(dbPass)}@127.0.0.1:5433/jmdcart?schema=public`;

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    const products = await prisma.product.findMany({
      include: { company: true },
      take: 10,
    });
    console.log('Sample existing products:', products.map(p => ({
      id: p.id,
      name: p.name,
      code: p.shortCode,
      company: p.company?.name,
      image: p.imageUrl,
      mrp: p.mrpPaise,
      priceA: p.priceAPaise,
    })));
    const categories = await prisma.category.findMany();
    console.log('Categories:', categories.map(c => c.name));
    const companies = await prisma.company.findMany();
    console.log('Total companies:', companies.length);
    console.log('Companies:', companies.map(c => c.name));

    // check invoice or order count
    const invoiceCount = await prisma.invoice.count();
    const orderCount = await prisma.order.count();
    const stockBalanceCount = await prisma.stockBalance.count();
    console.log({ invoiceCount, orderCount, stockBalanceCount });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
