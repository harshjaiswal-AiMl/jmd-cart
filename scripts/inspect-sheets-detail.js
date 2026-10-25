const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', 'utf8'));

const args = process.argv.slice(2);
const start = parseInt(args[0] || '0', 10);
const count = parseInt(args[1] || '10', 10);

const entries = Object.entries(data).slice(start, start + count);

for (const [name, rows] of entries) {
  console.log('====================================');
  console.log('SHEET:', name, 'Total rows:', rows.length);
  const nonEmpty = rows.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
  console.log('Non-empty rows:', nonEmpty.length);
  nonEmpty.slice(0, 8).forEach((r, i) => {
    const compact = r.map((c, idx) => c ? `[${idx}]: ${c}` : null).filter(Boolean).join(' | ');
    console.log(`  Row ${i}: ${compact}`);
  });
}
