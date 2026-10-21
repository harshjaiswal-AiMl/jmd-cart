const fs = require('fs');

const raw = fs.readFileSync('C:/Users/admin/.gemini/antigravity/brain/1211f38c-27f4-46eb-9ef3-5be03bd6bf6d/scratch/user_prompt_10.txt', 'utf8');

// The stock table is between <USER_REQUEST> and "here is all of my product"
const match = raw.match(/<USER_REQUEST>([\s\S]*?)here is all of my product/i);
const tableText = match ? match[1].trim() : raw;

const lines = tableText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
console.log('Total table lines:', lines.length);

const header = lines[0].split('\t').map(c => c.trim());
console.log('Header:', header);

const stockItems = [];
let currentBrand = '';

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(c => c.trim());
  if (parts.length < 3) continue;
  
  // Columns: SKU, BRAND, ITEM, WEIGHT, QTY IN CASE, CARTONS, LOOSE, PRICE, CHECK, NOTES
  const [sku, brand, item, weight, qtyInCase, cartons, loose, price, check, notes] = parts;
  
  if (brand) {
    currentBrand = brand;
  }
  
  stockItems.push({
    row: i + 1,
    sku: sku || '1',
    brand: (brand || currentBrand).trim(),
    item: (item || '').trim(),
    weight: (weight || '').trim(),
    qtyInCase: parseInt(qtyInCase, 10) || null,
    cartons: parseInt(cartons, 10) || 0,
    loose: parseInt(loose, 10) || 0,
    price: parseFloat(price) || null,
    check: (check || '').toUpperCase() === 'TRUE',
    notes: (notes || '').trim()
  });
}

console.log(`Parsed ${stockItems.length} stock items.`);
console.log('Sample parsed items:');
console.log(stockItems.slice(0, 5));
console.log('Last 5 parsed items:');
console.log(stockItems.slice(-5));

// Group by brand
const byBrand = {};
stockItems.forEach(item => {
  byBrand[item.brand] = (byBrand[item.brand] || 0) + 1;
});
console.log('Counts by brand in physical stock:', byBrand);

fs.writeFileSync('d:/JMD CART/temp_xlsx/parsed_stock_items.json', JSON.stringify(stockItems, null, 2));
console.log('Saved to d:/JMD CART/temp_xlsx/parsed_stock_items.json');
