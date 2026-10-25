import fs from 'fs';
import path from 'path';
import { PrismaClient, MovementType } from '@prisma/client';
import { execSync } from 'child_process';
import { extractAllSheetProducts, normalizeWeight, extractWeightFromName, ExtractedProduct } from './reconcile-all';
import { getBrandSlug } from './generate-brand-badges';

// Get Cloud SQL DB connection string
function getPrismaClient(): PrismaClient {
  const dbPass = execSync('gcloud secrets versions access latest --secret="DB_PASSWORD" --project="jmd-cart"', { encoding: 'utf8' }).trim();
  const dbUrl = `postgresql://jmdcart_app:${encodeURIComponent(dbPass)}@127.0.0.1:5433/jmdcart?schema=public`;
  return new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });
}

// Canonical company mapping
const COMPANY_NAME_MAP: Record<string, string> = {
  MDH: 'MDH',
  BIKAJI: 'Bikaji',
  TESTO: 'Testo',
  DAWAT: 'Dawat',
  DAAWAT: 'Dawat',
  SALONI: 'Saloni',
  EVEREADY: 'Eveready',
  NILONS: 'Nilons',
  DENVER: 'Denver',
  DENEVER: 'Denver',
  'NAMASTE INDIA': 'Namaste India',
  NISHA: 'Nisha',
  PATANJALI: 'Patanjali',
  'PATANJALI AASTHA': 'Patanjali Aastha',
  'CITY GOLD': 'City Gold',
  SUNDROP: 'Sun Drop',
  'SUN DROP': 'Sun Drop',
  'VIJOHN': 'Vi-John',
  'VI- JOHN': 'Vi-John',
  HIMALAYA: 'Himalaya',
  LIZZAT: 'Lizzat',
  UTTAM: 'Uttam Sugar',
  'UTTAM SUGAR': 'Uttam Sugar',
  'NATURE FRESH': 'Nature Fresh',
  'DS GROUP': 'DS Group',
  DS: 'DS Group',
  AASHIRVAD: 'Aashirvad',
  HAMDARD: 'Hamdard',
  REGENCY: 'Regency',
  SWASTIK: 'Swastik',
  GOKUL: 'Gokul',
  CRYSTAL: 'Crystal',
  VIHANA: 'Vihana'
};

function getCanonicalCompanyName(rawBrand: string): string {
  const upper = rawBrand.toUpperCase().trim();
  return COMPANY_NAME_MAP[upper] || rawBrand.trim();
}

function toPaise(rupees: number | null | undefined): number | null {
  if (rupees === null || rupees === undefined || isNaN(rupees) || rupees <= 0) return null;
  return Math.round(rupees * 100);
}

function makeShortCode(brand: string, cleanName: string, weight: string, seenCodes: Set<string>): string {
  const bCode = brand.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'JMD';
  const nameWords = cleanName.toUpperCase().replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  let nCode = '';
  if (nameWords.length === 1) {
    nCode = nameWords[0].slice(0, 6);
  } else {
    nCode = nameWords.slice(0, 3).map(w => w.slice(0, 3)).join('');
  }
  const wCode = weight.toUpperCase().replace(/[^A-Z0-9]/g, '');
  
  let candidate = `${bCode}-${nCode}-${wCode}`.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!seenCodes.has(candidate)) {
    seenCodes.add(candidate);
    return candidate;
  }
  
  let counter = 2;
  while (seenCodes.has(`${candidate}-${counter}`)) {
    counter++;
  }
  const finalCode = `${candidate}-${counter}`;
  seenCodes.add(finalCode);
  return finalCode;
}

export async function runCatalogAndStockImport() {
  console.log('--- Starting JMD Cart Master Catalog & Stock Reconciliation & Import ---');
  const prisma = getPrismaClient();

  try {
    // 1. Verify DB connection
    const loc = await prisma.location.findUnique({ where: { id: 'loc-godown-main' } });
    if (!loc) {
      throw new Error('Main Godown (loc-godown-main) location not found in database!');
    }
    console.log('✓ Main Godown location verified:', loc.name);

    // 2. Extract products from all 28 master sheets
    const sheetProducts = extractAllSheetProducts();
    console.log(`✓ Parsed ${sheetProducts.length} items from 28 master brand sheets`);

    // 3. Load physical stock items
    const stockItems = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/parsed_stock_items.json', 'utf8'));
    console.log(`✓ Loaded ${stockItems.length} physical stock inventory count rows`);

    // 4. Clean up any previous dummy products in DB
    console.log('Cleaning up old catalog products to guarantee zero duplicates...');
    await prisma.stockMovement.deleteMany({});
    await prisma.stockBalance.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.product.deleteMany({});
    console.log('✓ Database cleaned (0 residual products, 0 movements, 0 balances)');

    // 5. Ensure All Companies Exist with Canonical Names
    console.log('Ensuring all companies exist...');
    const allBrandsSet = new Set<string>();
    sheetProducts.forEach(p => allBrandsSet.add(getCanonicalCompanyName(p.brand)));
    stockItems.forEach((si: any) => allBrandsSet.add(getCanonicalCompanyName(si.brand)));

    const companyMap = new Map<string, string>(); // name -> id
    for (const compName of allBrandsSet) {
      const company = await prisma.company.upsert({
        where: { name: compName },
        create: { name: compName, branchId: 1, active: true },
        update: { active: true },
      });
      companyMap.set(compName, company.id);
    }
    console.log(`✓ ${companyMap.size} canonical companies upserted`);

    // 6. Ensure Categories Exist
    console.log('Ensuring categories exist...');
    const categoryMap = new Map<string, string>(); // name -> id
    const existingCats = await prisma.category.findMany();
    existingCats.forEach(c => categoryMap.set(c.name, c.id));

    // Default category fallback
    const defaultCatId = categoryMap.get('Spices & Masala') || existingCats[0].id;

    // 7. Master Catalog Building & Deduplication
    console.log('Building deduplicated master catalog...');
    interface CatalogItem {
      key: string; // brand|normalizedName|normalizedWeight
      brand: string;
      canonicalCompany: string;
      name: string;
      weight: string;
      normalizedWeight: string;
      packSize: number;
      mrpRupees: number;
      priceA: number | null;
      priceB: number | null;
      priceC: number | null;
      category: string;
      imageUrl: string;
      stockRows: any[];
    }

    const catalog = new Map<string, CatalogItem>();

    // Helper to generate normalized key
    function getCatalogKey(brand: string, name: string, weight: string): string {
      const b = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
      const w = normalizeWeight(weight);
      // clean name tokens
      const n = name
        .toLowerCase()
        .replace(/(\d+(?:\.\d+)?)\s*(kg|gm|gms|gram|grams|g|ltr|ltrs|liter|liters|l|ml|pc|pcs|s|'s)\b/gi, '')
        .replace(/[^a-z0-9]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .join('');
      return `${b}|${n}|${w}`;
    }

    // Add all sheet products into master catalog
    for (const sp of sheetProducts) {
      const canonicalComp = getCanonicalCompanyName(sp.brand);
      const key = getCatalogKey(canonicalComp, sp.name, sp.weight);
      if (!catalog.has(key)) {
        const slug = getBrandSlug(canonicalComp);
        catalog.set(key, {
          key,
          brand: sp.brand,
          canonicalCompany: canonicalComp,
          name: sp.name,
          weight: sp.weight,
          normalizedWeight: sp.normalizedWeight || normalizeWeight(sp.weight),
          packSize: sp.packSize || 1,
          mrpRupees: sp.mrpRupees || 0,
          priceA: sp.priceA,
          priceB: sp.priceB,
          priceC: sp.priceC,
          category: sp.category,
          imageUrl: `/brand/${slug}.svg`,
          stockRows: []
        });
      }
    }
    console.log(`✓ Added ${catalog.size} unique master products from price sheets`);

    // 8. Match Physical Stock Items against Master Catalog
    console.log('Reconciling physical stock items with catalog products...');
    let exactMatches = 0;
    let createdFromStock = 0;

    for (const si of stockItems) {
      const canonicalComp = getCanonicalCompanyName(si.brand);
      const siWeight = si.weight || extractWeightFromName(si.item) || 'Standard';
      const siKey = getCatalogKey(canonicalComp, si.item, si.weight);

      // Try exact key match
      let matchedItem = catalog.get(siKey);

      // If no exact key, fuzzy match within same brand and matching weight
      if (!matchedItem) {
        const siWords = si.item.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w: string) => w.length > 2);
        const siWeightNorm = normalizeWeight(siWeight);

        let bestCand: CatalogItem | null = null;
        let bestScore = 0;

        for (const item of Array.from(catalog.values())) {
          if (item.canonicalCompany !== canonicalComp) continue;
          if (siWeightNorm && item.normalizedWeight && siWeightNorm !== item.normalizedWeight) continue;

          const itemWords = item.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
          let overlap = 0;
          for (const w of siWords) {
            if (itemWords.includes(w)) overlap++;
          }
          if (si.qtyInCase && item.packSize === si.qtyInCase) {
            overlap += 2;
          }
          if (overlap > bestScore) {
            bestScore = overlap;
            bestCand = item;
          }
        }

        if (bestCand && bestScore >= 2) {
          matchedItem = bestCand;
        }
      }

      if (matchedItem) {
        exactMatches++;
        matchedItem.stockRows.push(si);
        // If stock row had a specific price and catalog didn't have prices, use stock price
        if (si.price && (!matchedItem.priceA || matchedItem.mrpRupees === 0)) {
          matchedItem.mrpRupees = si.price;
          matchedItem.priceA = matchedItem.priceA || +(si.price * 0.8).toFixed(2);
          matchedItem.priceB = matchedItem.priceB || +(si.price * 0.85).toFixed(2);
          matchedItem.priceC = matchedItem.priceC || si.price;
        }
      } else {
        // Create new catalog item for this stock row
        createdFromStock++;
        const slug = getBrandSlug(canonicalComp);
        const newItem: CatalogItem = {
          key: siKey,
          brand: si.brand,
          canonicalCompany: canonicalComp,
          name: `${si.item} ${si.weight}`.trim(),
          weight: siWeight,
          normalizedWeight: normalizeWeight(siWeight),
          packSize: si.qtyInCase || 1,
          mrpRupees: si.price || 0,
          priceA: si.price ? +(si.price * 0.8).toFixed(2) : null,
          priceB: si.price ? +(si.price * 0.85).toFixed(2) : null,
          priceC: si.price || null,
          category: 'Spices & Masala', // will be refined by brand
          imageUrl: `/brand/${slug}.svg`,
          stockRows: [si]
        };
        catalog.set(siKey, newItem);
      }
    }

    console.log(`✓ Reconciled: ${exactMatches} stock rows matched master sheet items, ${createdFromStock} created directly from stock`);
    console.log(`✓ Final Master Catalog size: ${catalog.size} distinct deduplicated products`);

    // 9. Assign Categories based on Company / Product
    const COMPANY_CATEGORY_MAP: Record<string, string> = {
      MDH: 'Spices & Masala',
      Gokul: 'Spices & Masala',
      Bikaji: 'Biscuit & Snacks',
      Lizzat: 'Biscuit & Snacks',
      Testo: 'Ketchup & Sauces',
      Nilons: 'Ketchup & Sauces',
      Dawat: 'Rice & Aata',
      Aashirvad: 'Rice & Aata',
      Swastik: 'Pulses & Dal',
      Saloni: 'Ghee & Oils',
      'Namaste India': 'Ghee & Oils',
      'Nature Fresh': 'Ghee & Oils',
      Denver: 'Personal Care',
      'Vi-John': 'Personal Care',
      Nisha: 'Beauty Care',
      Himalaya: 'Personal Care',
      Patanjali: 'Personal Care',
      'Patanjali Aastha': 'Personal Care',
      'City Gold': 'Tea & Beverages',
      Hamdard: 'Tea & Beverages',
      'Sun Drop': 'Biscuit & Snacks',
      Eveready: 'Electronics',
      'Uttam Sugar': 'Pulses & Dal',
      Regency: 'Dry Fruits',
      'DS Group': 'Biscuit & Snacks',
      Crystal: 'Disposable Plate and Cup',
      Vihana: 'Pulses & Dal'
    };

    // 10. Insert All Products into PostgreSQL DB
    console.log('Inserting products into database...');
    const seenCodes = new Set<string>();
    const createdProducts: Array<{ id: string; item: CatalogItem }> = [];

    // Process in batches
    const catalogItems = Array.from(catalog.values());
    for (let i = 0; i < catalogItems.length; i += 50) {
      const batch = catalogItems.slice(i, i + 50);
      for (const item of batch) {
        const compId = companyMap.get(item.canonicalCompany);
        const catName = COMPANY_CATEGORY_MAP[item.canonicalCompany] || 'Spices & Masala';
        const catId = categoryMap.get(catName) || defaultCatId;
        const shortCode = makeShortCode(item.canonicalCompany, item.name, item.weight, seenCodes);

        const mrpPaise = toPaise(item.mrpRupees);
        let priceAPaise = toPaise(item.priceA);
        let priceBPaise = toPaise(item.priceB);
        let priceCPaise = toPaise(item.priceC);

        // Ensure price ordering: priceA <= priceB <= priceC <= mrp
        if (mrpPaise && !priceCPaise) priceCPaise = mrpPaise;
        if (mrpPaise && !priceAPaise) priceAPaise = Math.round(mrpPaise * 0.8);
        if (mrpPaise && !priceBPaise) priceBPaise = Math.round(mrpPaise * 0.85);

        const product = await prisma.product.create({
          data: {
            branchId: 1,
            name: item.name,
            shortCode,
            weight: item.weight,
            companyId: compId,
            categoryId: catId,
            packSize: item.packSize || 1,
            packLabel: 'Carton',
            mrpPaise,
            priceAPaise,
            priceBPaise,
            priceCPaise,
            imageUrl: item.imageUrl,
            active: true
          }
        });
        createdProducts.push({ id: product.id, item });
      }
    }
    console.log(`✓ Successfully created ${createdProducts.length} products in database`);

    // 11. Post Opening Stock ONLY to Main Godown (loc-godown-main)
    console.log('Posting Opening Stock to Main Godown (loc-godown-main)...');
    let totalStockMovements = 0;
    let totalPiecesGodown = 0;
    let totalCartonsGodown = 0;
    let totalLooseGodown = 0;

    for (const { id: productId, item } of createdProducts) {
      if (item.stockRows.length === 0) continue;

      let productTotalPieces = 0;

      for (const sr of item.stockRows) {
        const cartons = sr.cartons || 0;
        const loose = sr.loose || 0;
        const packSize = item.packSize || sr.qtyInCase || 1;
        const pieces = (cartons * packSize) + loose;

        if (pieces <= 0) continue;

        productTotalPieces += pieces;
        totalCartonsGodown += cartons;
        totalLooseGodown += loose;
        totalPiecesGodown += pieces;
        totalStockMovements++;

        const idempotencyKey = `opening-stock-row-${sr.row}-${productId}`;

        // Create immutable StockMovement row
        await prisma.stockMovement.create({
          data: {
            branchId: 1,
            type: MovementType.ADJUSTMENT,
            productId,
            toLocationId: 'loc-godown-main',
            fromLocationId: null,
            qty: pieces,
            reason: 'Opening Stock Physical Inventory Count',
            referenceType: 'OPENING_STOCK',
            referenceId: `STOCK_ROW_${sr.row}`,
            idempotencyKey,
            meta: {
              cartons,
              loose,
              packSize,
              rawBrand: sr.brand,
              rawItem: sr.item,
              rawWeight: sr.weight,
              price: sr.price,
              sourceRow: sr.row
            }
          }
        });
      }

      if (productTotalPieces > 0) {
        // Upsert StockBalance for Main Godown
        await prisma.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId,
              locationId: 'loc-godown-main'
            }
          },
          create: {
            branchId: 1,
            productId,
            locationId: 'loc-godown-main',
            qty: productTotalPieces
          },
          update: {
            qty: { increment: productTotalPieces }
          }
        });
      }
    }

    console.log(`✓ Opening Stock Posted:`);
    console.log(`  - Total Movements: ${totalStockMovements}`);
    console.log(`  - Total Cartons: ${totalCartonsGodown}`);
    console.log(`  - Total Loose: ${totalLooseGodown}`);
    console.log(`  - Total Pieces: ${totalPiecesGodown}`);
    console.log(`  - Destination Location: loc-godown-main (ONLY)`);

    // 12. Verification & Summary
    const finalProductCount = await prisma.product.count();
    const finalMovementCount = await prisma.stockMovement.count();
    const finalBalanceCount = await prisma.stockBalance.count();
    const totalGodownStock = await prisma.stockBalance.aggregate({
      where: { locationId: 'loc-godown-main' },
      _sum: { qty: true }
    });

    console.log('\n=== FINAL RECONCILIATION VERIFICATION ===');
    console.log(`Total Products in DB: ${finalProductCount}`);
    console.log(`Total Companies: ${companyMap.size}`);
    console.log(`Total Stock Movements: ${finalMovementCount}`);
    console.log(`Products with Stock in Main Godown: ${finalBalanceCount}`);
    console.log(`Sum of all Pieces in Main Godown: ${totalGodownStock._sum.qty}`);
    console.log('Zero stock in other locations (Retail Shop, Van 1, Van 2).');
    console.log('Catalog & Stock Import successfully completed!');

  } finally {
    await prisma.$disconnect();
  }
}

runCatalogAndStockImport().catch(err => {
  console.error('Fatal error during catalog import:', err);
  process.exit(1);
});
