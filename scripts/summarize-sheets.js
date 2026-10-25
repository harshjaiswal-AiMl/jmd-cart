const fs = require('fs');
const sheets = JSON.parse(fs.readFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', 'utf8'));

const summary = {};

for (const [sheetName, rows] of Object.entries(sheets)) {
  const nonEmpty = rows.filter(r => r && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
  if (nonEmpty.length === 0) continue;

  let headerRow = -1;
  let headers = [];

  for (let i = 0; i < Math.min(15, nonEmpty.length); i++) {
    const row = nonEmpty[i];
    const str = row.join(' ').toUpperCase();
    if (str.includes('ITEM') || str.includes('PARTICULAR') || str.includes('PRODUCT') || (str.includes('MRP') && str.includes('PCS'))) {
      headerRow = i;
      headers = row;
      break;
    }
  }

  summary[sheetName] = {
    totalNonEmpty: nonEmpty.length,
    headerRowIndex: headerRow,
    headers: headers.map((h, idx) => h ? `[${idx}]: ${h}` : null).filter(Boolean),
    sampleRows: nonEmpty.slice(headerRow + 1, headerRow + 4).map(r => r.map((c, idx) => c !== undefined && c !== null ? `[${idx}]: ${c}` : null).filter(Boolean))
  };
}

fs.writeFileSync('d:/JMD CART/temp_xlsx/sheets_summary.json', JSON.stringify(summary, null, 2), 'utf8');
console.log('Saved utf8 summary');
