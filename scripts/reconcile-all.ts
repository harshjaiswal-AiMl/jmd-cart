import fs from 'fs';
import path from 'path';

// Load sheets and stock items
const sheets = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', 'utf8'));
const stockItems = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/parsed_stock_items.json', 'utf8'));

export interface ExtractedProduct {
  brand: string;
  name: string;
  weight: string;
  normalizedWeight: string;
  packSize: number;
  mrpRupees: number;
  priceA: number | null;
  priceB: number | null;
  priceC: number | null;
  category: string;
  sheetSource: string;
}

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

function parseNum(val: any): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/[₹,\s]/g, '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

export function normalizeWeight(weight: string): string {
  if (!weight) return '';
  const clean = weight.toLowerCase().replace(/\s+/g, '');
  const m = /^(\d+(?:\.\d+)?)\s*([a-z]+)/.exec(clean);
  if (!m) return clean.toUpperCase();
  const num = parseFloat(m[1]);
  let unit = m[2];
  if (unit === 'g' || unit === 'gm' || unit === 'gms' || unit === 'gram' || unit === 'grams') {
    return `${num}G`;
  }
  if (unit === 'kg' || unit === 'kgs' || unit === 'kilo') {
    return `${num * 1000}G`;
  }
  if (unit === 'ml' || unit === 'milliliter') {
    return `${num}ML`;
  }
  if (unit === 'l' || unit === 'ltr' || unit === 'ltrs' || unit === 'liter' || unit === 'liters') {
    return `${num * 1000}ML`;
  }
  if (unit === 'pc' || unit === 'pcs' || unit === 's' || unit === "'s" || unit === 'piece') {
    return `${num}PC`;
  }
  return `${num}${unit.toUpperCase()}`;
}

export function extractWeightFromName(name: string): string {
  const m = /(\d+(?:\.\d+)?)\s*(kg|gm|gms|gram|grams|g|ltr|ltrs|liter|liters|l|ml|pc|pcs|s|'s)\b/i.exec(name);
  if (m) {
    return `${m[1]}${m[2].toLowerCase()}`;
  }
  return '';
}

export function extractAllSheetProducts(): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];

  // Helper to push
  function addProd(p: ExtractedProduct) {
    if (!p.name || p.name.toUpperCase().includes('TOTAL')) return;
    if (!p.weight) {
      p.weight = extractWeightFromName(p.name) || 'Standard';
    }
    p.normalizedWeight = normalizeWeight(p.weight);
    if (!p.packSize || p.packSize < 1) p.packSize = 1;
    products.push(p);
  }

  // 1. MDH NEW
  (sheets['MDH NEW'] || []).slice(5).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    const aDisc = parseNum(r[4]) || 0;
    const bDisc = parseNum(r[5]) || 0;
    const cDisc = parseNum(r[6]) || 0;
    const discValues = [aDisc, bDisc, cDisc].filter(d => d > 0 && d < 1).sort((x, y) => y - x);
    let priceA = null, priceB = null, priceC = null;
    if (discValues.length >= 3 && mrp > 0) {
      priceA = +(mrp * (1 - discValues[0])).toFixed(2);
      priceB = +(mrp * (1 - discValues[1])).toFixed(2);
      priceC = +(mrp * (1 - discValues[2])).toFixed(2);
    }
    addProd({
      brand: 'MDH',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Spices & Masala',
      sheetSource: 'MDH NEW'
    });
  });

  // 2. SALONI
  (sheets['SALONI'] || []).slice(8).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'Saloni',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Ghee & Oils',
      sheetSource: 'SALONI'
    });
  });

  // 3. DAWAT
  (sheets['DAWAT'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[6]);
    const priceB = parseNum(r[7]);
    const priceC = parseNum(r[8]);
    addProd({
      brand: 'Dawat',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Rice & Aata',
      sheetSource: 'DAWAT'
    });
  });

  // 4. EVEREADY NEW
  (sheets['EVEREADY NEW'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[8]);
    const priceB = parseNum(r[9]);
    const priceC = parseNum(r[10]);
    addProd({
      brand: 'EVEREADY',
      name,
      weight: extractWeightFromName(name) || '1pc',
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Electronics',
      sheetSource: 'EVEREADY NEW'
    });
  });

  // 5. TESTO
  (sheets['TESTO'] || []).slice(7).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    const priceA = parseNum(r[4]);
    const priceB = parseNum(r[5]);
    const priceC = parseNum(r[6]);
    addProd({
      brand: 'Testo',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Ketchup & Sauces',
      sheetSource: 'TESTO'
    });
  });

  // 6. NILONS
  (sheets['NILONS'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[3]);
    const packSize = parseInt(r[4], 10) || 1;
    const mrp = parseNum(r[5]) || 0;
    const priceA = parseNum(r[7]);
    const priceB = parseNum(r[8]);
    addProd({
      brand: 'NILONS',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC: mrp,
      category: 'Ketchup & Sauces',
      sheetSource: 'NILONS'
    });
  });

  // 7. DENVER
  (sheets['DENVER'] || []).slice(7).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const weight = cleanStr(r[3]);
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'DENVER',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Personal Care',
      sheetSource: 'DENVER'
    });
  });

  // 8. NAMASTE INDIA
  (sheets['NAMASTE INDIA'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[3]);
    const packSize = parseInt(r[4], 10) || 1;
    const mrp = parseNum(r[5]) || 0;
    const priceA = parseNum(r[7]);
    const priceB = parseNum(r[8]);
    addProd({
      brand: 'Namaste India',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC: mrp,
      category: 'Ghee & Oils',
      sheetSource: 'NAMASTE INDIA'
    });
  });

  // 9. NISHA
  (sheets['NISHA'] || []).slice(6).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const weight = cleanStr(r[3]);
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'NISHA',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Beauty Care',
      sheetSource: 'NISHA'
    });
  });

  // 10. PATANJALI
  (sheets['PATANJALI'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'Patanjali',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Personal Care',
      sheetSource: 'PATANJALI'
    });
  });

  // 11. REGENCY
  (sheets['REGENCY'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    const priceA = parseNum(r[4]);
    const priceB = parseNum(r[5]);
    const priceC = parseNum(r[6]);
    addProd({
      brand: 'Regency',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Dry Fruits',
      sheetSource: 'REGENCY'
    });
  });

  // 12. SUNDROP
  (sheets['SUNDROP'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    addProd({
      brand: 'SUN DROP',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA: mrp ? +(mrp * 0.8).toFixed(2) : null,
      priceB: mrp ? +(mrp * 0.85).toFixed(2) : null,
      priceC: mrp ? +(mrp * 0.9).toFixed(2) : null,
      category: 'Biscuit & Snacks',
      sheetSource: 'SUNDROP'
    });
  });

  // 13. VIJOHN
  (sheets['VIJOHN'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const doz = parseNum(r[2]);
    const packSize = doz ? Math.round(doz * 12) : 1;
    const mrp = parseNum(r[3]) || 0;
    const priceA = parseNum(r[4]);
    const priceB = parseNum(r[5]);
    const priceC = parseNum(r[6]);
    addProd({
      brand: 'VI- JOHN',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Personal Care',
      sheetSource: 'VIJOHN'
    });
  });

  // 14. BIKAJI
  (sheets['BIKAJI'] || []).slice(11).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[6]);
    const priceB = parseNum(r[7]);
    addProd({
      brand: 'BIKAJI',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC: mrp,
      category: 'Biscuit & Snacks',
      sheetSource: 'BIKAJI'
    });
  });

  // 15. AASHIRVAD
  (sheets['AASHIRVAD'] || []).slice(3).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[6]);
    const priceB = parseNum(r[7]);
    addProd({
      brand: 'AASHIRVAD',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC: mrp,
      category: 'Rice & Aata',
      sheetSource: 'AASHIRVAD'
    });
  });

  // 16. CRYSTAL
  (sheets['CRYSTAL'] || []).slice(6).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const packSizeStr = cleanStr(r[1]);
    const packSize = parseInt(packSizeStr.replace(/[^0-9]/g, ''), 10) || 1;
    const rate = parseNum(r[2]) || 0;
    addProd({
      brand: 'CRYSTAL',
      name,
      weight: '1pc',
      normalizedWeight: '',
      packSize,
      mrpRupees: rate,
      priceA: rate,
      priceB: rate,
      priceC: rate,
      category: 'Disposable Plate and Cup',
      sheetSource: 'CRYSTAL'
    });
  });

  // 17. CITY GOLD
  (sheets['CITY GOLD'] || []).slice(2).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'City Gold',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize: 24,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Tea & Beverages',
      sheetSource: 'CITY GOLD'
    });
  });

  // 18. HAMDARD
  (sheets['HAMDARD'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const weight = cleanStr(r[1]);
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    const priceA = parseNum(r[4]);
    const priceB = parseNum(r[5]);
    const priceC = parseNum(r[6]);
    addProd({
      brand: 'HAMDARD',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Tea & Beverages',
      sheetSource: 'HAMDARD'
    });
  });

  // 19. PATANJALI AASTHA
  (sheets['PATANJALI AASTHA'] || []).slice(11).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'Patanjali Aastha',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Personal Care',
      sheetSource: 'PATANJALI AASTHA'
    });
  });

  // 20. SWASTIK
  (sheets['SWASTIK'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'SWASTIK',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Pulses & Dal',
      sheetSource: 'SWASTIK'
    });
  });

  // 21. LIZZAT
  (sheets['LIZZAT'] || []).slice(9).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const weight = cleanStr(r[1]);
    const packSize = parseInt(r[2], 10) || 1;
    const mrp = parseNum(r[3]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    addProd({
      brand: 'Lizzat',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC: mrp,
      category: 'Biscuit & Snacks',
      sheetSource: 'LIZZAT'
    });
  });

  // 22. UTTAM
  (sheets['UTTAM'] || []).slice(3).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(cleanStr(r[3]).replace(/[^0-9]/g, ''), 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const priceA = parseNum(r[5]);
    const priceB = parseNum(r[6]);
    const priceC = parseNum(r[7]);
    addProd({
      brand: 'Uttam',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Pulses & Dal',
      sheetSource: 'UTTAM'
    });
  });

  // 23. HIMALAYA
  (sheets['HIMALAYA'] || []).slice(5).forEach((r: any[]) => {
    const name = cleanStr(r[1]);
    if (!name) return;
    const weight = cleanStr(r[2]);
    const packSize = parseInt(r[3], 10) || 1;
    const mrp = parseNum(r[4]) || 0;
    const aDisc = parseNum(r[5]) || 0;
    const bDisc = parseNum(r[6]) || 0;
    const cDisc = parseNum(r[7]) || 0;
    const discValues = [aDisc, bDisc, cDisc].filter(d => d > 0 && d < 1).sort((x, y) => y - x);
    let priceA = null, priceB = null, priceC = null;
    if (discValues.length >= 3 && mrp > 0) {
      priceA = +(mrp * (1 - discValues[0])).toFixed(2);
      priceB = +(mrp * (1 - discValues[1])).toFixed(2);
      priceC = +(mrp * (1 - discValues[2])).toFixed(2);
    }
    addProd({
      brand: 'Himalaya',
      name,
      weight: weight || extractWeightFromName(name),
      normalizedWeight: '',
      packSize,
      mrpRupees: mrp,
      priceA,
      priceB,
      priceC,
      category: 'Personal Care',
      sheetSource: 'HIMALAYA'
    });
  });

  // 24. GOKUL
  (sheets['GOKUL'] || []).slice(10).forEach((r: any[]) => {
    const name = cleanStr(r[0]);
    if (!name) return;
    const rate = parseNum(r[2]) || 0;
    addProd({
      brand: 'Gokul',
      name,
      weight: extractWeightFromName(name),
      normalizedWeight: '',
      packSize: 1,
      mrpRupees: rate,
      priceA: rate,
      priceB: rate,
      priceC: rate,
      category: 'Spices & Masala',
      sheetSource: 'GOKUL'
    });
  });

  return products;
}

// Run test
const extracted = extractAllSheetProducts();
console.log(`Total extracted products from 28 sheets: ${extracted.length}`);

// Test matching with stock items
const stockCount = stockItems.length;
console.log(`Total physical stock items: ${stockCount}`);

let matchedCount = 0;
const matchedPairs: any[] = [];
const unmatchedStock: any[] = [];

stockItems.forEach((si: any) => {
  const siBrand = si.brand.toUpperCase();
  const siWeightNorm = normalizeWeight(si.weight);
  const siWords = si.item.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter((w: string) => w.length > 2);

  // Find candidate in extracted
  const candidates = extracted.filter(ep => {
    const epBrand = ep.brand.toUpperCase();
    if (epBrand !== siBrand && !epBrand.includes(siBrand) && !siBrand.includes(epBrand)) return false;
    // check weight if both have weight
    if (siWeightNorm && ep.normalizedWeight && siWeightNorm !== ep.normalizedWeight) return false;
    return true;
  });

  // Best candidate by word overlap and packSize match
  let bestCandidate: ExtractedProduct | null = null;
  let bestScore = 0;

  for (const cand of candidates) {
    const candWords = cand.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    let overlap = 0;
    for (const w of siWords) {
      if (candWords.includes(w)) overlap++;
    }
    // Boost score if packSize matches
    if (si.qtyInCase && cand.packSize === si.qtyInCase) {
      overlap += 2;
    }
    if (overlap > bestScore) {
      bestScore = overlap;
      bestCandidate = cand;
    }
  }

  if (bestCandidate && bestScore >= 2) {
    matchedCount++;
    matchedPairs.push({
      stockRow: si.row,
      stockBrand: si.brand,
      stockItem: si.item,
      stockWeight: si.weight,
      stockCartons: si.cartons,
      stockLoose: si.loose,
      sheetBrand: bestCandidate.brand,
      sheetName: bestCandidate.name,
      sheetWeight: bestCandidate.weight,
      packSize: bestCandidate.packSize || si.qtyInCase || 1,
      priceA: bestCandidate.priceA || si.price,
      priceB: bestCandidate.priceB || si.price,
      priceC: bestCandidate.priceC || si.price,
      mrp: bestCandidate.mrpRupees || si.price
    });
  } else {
    unmatchedStock.push(si);
  }
});

console.log(`Matched stock items: ${matchedCount} / ${stockCount}`);
console.log(`Unmatched stock items: ${unmatchedStock.length}`);
if (unmatchedStock.length > 0) {
  console.log('Sample unmatched stock items:');
  console.log(unmatchedStock.slice(0, 10).map(u => ({ brand: u.brand, item: u.item, weight: u.weight, qtyInCase: u.qtyInCase })));
}
