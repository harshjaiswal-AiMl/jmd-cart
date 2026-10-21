import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function main() {
  const dbPass = execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart"', { encoding: 'utf8' }).trim();
  const dbUrl = `postgresql://jmdcart_app:${encodeURIComponent(dbPass)}@127.0.0.1:5433/jmdcart?schema=public`;

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    const pCount = await prisma.product.count();
    const cCount = await prisma.company.count();
    const lCount = await prisma.location.count();
    const sCount = await prisma.stockMovement.count();
    console.log('Connected to Cloud SQL via proxy!');
    console.log('Current DB Counts:', { pCount, cCount, lCount, sCount });
    const locs = await prisma.location.findMany();
    console.log('Locations:', locs.map(l => ({ id: l.id, name: l.name, type: l.type })));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('Error connecting to DB:', err);
  process.exit(1);
});
