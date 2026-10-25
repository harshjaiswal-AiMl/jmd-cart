const fs = require('fs');
const sheets = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', 'utf8'));

// Helper to clean string
function cleanStr(val) {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\s+/g, ' ').trim();
}

function parseNum(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/[₹,\s]/g, '').trim();
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function extractWeightFromName(name) {
  const m = /(\d+(?:\.\d+)?)\s*(kg|gm|gms|gram|grams|g|ltr|ltrs|liter|liters|l|ml|pc|pcs|s|'s)\b/i.exec(name);
  if (m) {
    return `${m[1]}${m[2].toLowerCase()}`;
  }
  return '';
}

const allProducts = [];

// 1. MDH NEW
const mdhRows = sheets['MDH NEW'] || [];
mdhRows.slice(5).forEach(r => {
  const name = cleanStr(r[1]);
  if (!name || name.toUpperCase().includes('TOTAL')) return;
  const packSize = parseInt(r[2], 10) || 1;
  const mrp = parseNum(r[3]) || 0;
  const aDisc = parseNum(r[4]) || 0; // e.g. 0.20
  const bDisc = parseNum(r[5]) || 0; // e.g. 0.21
  const cDisc = parseNum(r[6]) || 0; // e.g. 0.216

  // In wholesale pricing:
  // Wholesaler gets highest discount (Price A lowest cost): mrp * (1 - cDisc)
  // Retailer gets medium discount (Price B): mrp * (1 - bDisc)
  // Small shop / Consumer gets lowest discount (Price C): mrp * (1 - aDisc)
  // Let's ensure Price A <= Price B <= Price C <= MRP
  const discValues = [aDisc, bDisc, cDisc].filter(d => d > 0 && d < 1).sort((x, y) => y - x); // descending discount
  let priceA = null, priceB = null, priceC = null;
  if (discValues.length >= 3 && mrp > 0) {
    priceA = +(mrp * (1 - discValues[0])).toFixed(2);
    priceB = +(mrp * (1 - discValues[1])).toFixed(2);
    priceC = +(mrp * (1 - discValues[2])).toFixed(2);
  } else if (mrp > 0) {
    priceA = +(mrp * 0.8).toFixed(2);
    priceB = +(mrp * 0.85).toFixed(2);
    priceC = +(mrp * 0.9).toFixed(2);
  }

  allProducts.push({
    brand: 'MDH',
    name,
    weight: extractWeightFromName(name) || '100gm',
    packSize,
    mrp,
    priceA,
    priceB,
    priceC,
    category: 'Spices & Masala'
  });
});

console.log(`Extracted MDH products: ${allProducts.length}`);

fs.writeFileSync('d:/JMD CART/temp_xlsx/sample_extracted.json', JSON.stringify(allProducts.slice(0, 10), null, 2));
