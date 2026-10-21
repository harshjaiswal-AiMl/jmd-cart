const fs = require('fs');
const path = require('path');

const xlsxDir = 'd:/JMD CART/temp_xlsx';

// 1. Parse sharedStrings.xml
console.log('Reading sharedStrings.xml...');
const sharedStringsXml = fs.readFileSync(path.join(xlsxDir, 'xl/sharedStrings.xml'), 'utf8');

// Fast regex for <si>...</si>
const sharedStrings = [];
const siRegex = /<si>([\s\S]*?)<\/si>/g;
let siMatch;
while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
  const siContent = siMatch[1];
  // extract all <t ...>text</t> or <t>text</t>
  const tMatches = siContent.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
  const text = tMatches.map(m => m.replace(/<t[^>]*>/, '').replace(/<\/t>/, '')).join('');
  // decode basic XML entities
  sharedStrings.push(
    text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}
console.log(`Loaded ${sharedStrings.length} shared strings.`);

// 2. Parse workbook.xml & workbook.xml.rels
const wbXml = fs.readFileSync(path.join(xlsxDir, 'xl/workbook.xml'), 'utf8');
const wbRelsXml = fs.readFileSync(path.join(xlsxDir, 'xl/_rels/workbook.xml.rels'), 'utf8');

const relsMap = {};
const relRegex = /Id="([^"]+)"[^>]+Target="([^"]+)"/g;
let relMatch;
while ((relMatch = relRegex.exec(wbRelsXml)) !== null) {
  relsMap[relMatch[1]] = relMatch[2].replace(/^worksheets\//, '');
}

const sheetRegex = /<sheet[^>]+name="([^"]+)"[^>]+sheetId="([^"]+)"[^>]+r:id="([^"]+)"/g;
let sheetMatch;
const sheets = [];
while ((sheetMatch = sheetRegex.exec(wbXml)) !== null) {
  const name = sheetMatch[1];
  const rId = sheetMatch[3];
  const target = relsMap[rId];
  sheets.push({ name, target });
}

console.log(`Found ${sheets.length} sheets in workbook:`);

function colNameToIndex(colName) {
  let index = 0;
  for (let i = 0; i < colName.length; i++) {
    index = index * 26 + (colName.charCodeAt(i) - 64);
  }
  return index - 1;
}

const allSheetsData = {};

sheets.forEach(({ name, target }) => {
  const sheetPath = path.join(xlsxDir, 'xl/worksheets', target);
  if (!fs.existsSync(sheetPath)) return;
  const sheetXml = fs.readFileSync(sheetPath, 'utf8');
  
  const rows = [];
  const rowRegex = /<row[^>]+r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let rMatch;
  while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
    const rowNum = parseInt(rMatch[1], 10);
    const rowContent = rMatch[2];
    const cells = [];
    
    const cellRegex = /<c\s+r="([A-Z]+)(\d+)"(?:\s+s="[^"]*")?(?:\s+t="([^"]*)")?[^>]*>(?:<f>[\s\S]*?<\/f>)?(?:<v>([\s\S]*?)<\/v>|<is><t>([\s\S]*?)<\/t><\/is>)?<\/c>/g;
    let cMatch;
    while ((cMatch = cellRegex.exec(rowContent)) !== null) {
      const colStr = cMatch[1];
      const colIdx = colNameToIndex(colStr);
      const type = cMatch[3];
      const val = cMatch[4] !== undefined ? cMatch[4] : cMatch[5];
      
      let parsedVal = val;
      if (type === 's' && val !== undefined) {
        parsedVal = sharedStrings[parseInt(val, 10)] || '';
      } else if (type === 'inlineStr' && val !== undefined) {
        parsedVal = val;
      }
      cells[colIdx] = parsedVal !== undefined ? parsedVal : '';
    }
    rows.push(cells);
  }
  allSheetsData[name] = rows;
  console.log(`Sheet "${name}": ${rows.length} rows`);
  if (rows.length > 0) {
    console.log(`  Row 0: ${JSON.stringify(rows[0] ? rows[0].slice(0, 10) : [])}`);
    if (rows[1]) console.log(`  Row 1: ${JSON.stringify(rows[1].slice(0, 10))}`);
    if (rows[2]) console.log(`  Row 2: ${JSON.stringify(rows[2].slice(0, 10))}`);
  }
});

fs.writeFileSync('d:/JMD CART/temp_xlsx/all_sheets.json', JSON.stringify(allSheetsData, null, 2));
console.log('Saved all sheets to d:/JMD CART/temp_xlsx/all_sheets.json');
