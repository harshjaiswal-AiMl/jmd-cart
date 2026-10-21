const fs = require('fs');
const data = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', 'utf8'));

for (const [name, rows] of Object.entries(data)) {
  const nonEmpty = rows.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
  if (nonEmpty.length === 0) continue;
  
  // Find header row (usually contains 'ITEM' or 'Particulars' or 'SL NO')
  let headerIdx = -1;
  for (let i = 0; i < Math.min(15, nonEmpty.length); i++) {
    const rStr = nonEmpty[i].join(' ').toUpperCase();
    if (rStr.includes('ITEM') || rStr.includes('PARTICULAR') || rStr.includes('PRODUCT') || (rStr.includes('MRP') && rStr.includes('PCS'))) {
      headerIdx = i;
      break;
    }
  }
  
  console.log(`\n========================================`);
  console.log(`SHEET: ${name} (non-empty rows: ${nonEmpty.length})`);
  if (headerIdx !== -1) {
    console.log(`Header Row ${headerIdx}:`, JSON.stringify(nonEmpty[headerIdx].filter(Boolean)));
    console.log(`Sample Data Row 1:`, JSON.stringify(nonEmpty[headerIdx + 1] ? nonEmpty[headerIdx + 1].filter(Boolean) : []));
    console.log(`Sample Data Row 2:`, JSON.stringify(nonEmpty[headerIdx + 2] ? nonEmpty[headerIdx + 2].filter(Boolean) : []));
  } else {
    console.log(`No explicit header found. First 3 rows:`);
    nonEmpty.slice(0, 3).forEach((r, i) => console.log(`  Row ${i}:`, JSON.stringify(r.filter(Boolean))));
  }
}
