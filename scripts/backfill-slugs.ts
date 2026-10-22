import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/slug";

async function main() {
  console.log("Starting slug backfill...");

  // 1. Categories
  const categories = await prisma.category.findMany({ where: { slug: null } });
  console.log(`Found ${categories.length} categories without slug.`);
  for (const cat of categories) {
    let base = slugify(cat.name) || `cat-${cat.id}`;
    let slug = base;
    let i = 1;
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    await prisma.category.update({
      where: { id: cat.id },
      data: { slug },
    });
  }

  // 2. Companies (Brands)
  const companies = await prisma.company.findMany({ where: { slug: null } });
  console.log(`Found ${companies.length} brands without slug.`);
  for (const comp of companies) {
    let base = slugify(comp.name) || `brand-${comp.id}`;
    let slug = base;
    let i = 1;
    while (await prisma.company.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    await prisma.company.update({
      where: { id: comp.id },
      data: { slug },
    });
  }

  // 3. Products
  const products = await prisma.product.findMany({ where: { slug: null } });
  console.log(`Found ${products.length} products without slug.`);
  for (const prod of products) {
    let base = slugify(prod.name) || `prod-${prod.id}`;
    let slug = base;
    let i = 1;
    while (await prisma.product.findUnique({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    await prisma.product.update({
      where: { id: prod.id },
      data: { slug },
    });
  }

  console.log("Slug backfill complete!");
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
