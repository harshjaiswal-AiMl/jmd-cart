import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const pCount = await prisma.product.count();
  const cCount = await prisma.company.count();
  const lCount = await prisma.location.count();
  const sCount = await prisma.stockMovement.count();
  console.log('DB Counts:', { pCount, cCount, lCount, sCount });
  const locs = await prisma.location.findMany();
  console.log('Locations:', locs.map(l => ({ id: l.id, name: l.name, type: l.type })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
