export interface RawCsvRow {
  rowNumber: number;
  data: Record<string, string>;
}

/**
 * Robust RFC 4180 compliant CSV parser in pure TypeScript.
 * Handles embedded commas, escaped quotes (""), CRLF/LF line breaks, and auto-detects delimiter.
 */
export function parseCsv(content: string): { headers: string[]; rows: RawCsvRow[] } {
  const cleanContent = content.replace(/^\uFEFF/, ""); // Remove BOM if present
  if (!cleanContent.trim()) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter (check first line)
  const firstLine = cleanContent.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ",";
  if (semicolonCount > commaCount && semicolonCount > tabCount) {
    delimiter = ";";
  } else if (tabCount > commaCount && tabCount > semicolonCount) {
    delimiter = "\t";
  }

  // Tokenize CSV stream
  const lines: string[][] = [];
  let currentField = "";
  let currentRecord: string[] = [];
  let insideQuotes = false;
  let i = 0;

  while (i < cleanContent.length) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
        i++;
        continue;
      }
    }

    if (!insideQuotes && char === delimiter) {
      currentRecord.push(currentField.trim());
      currentField = "";
      i++;
      continue;
    }

    if (!insideQuotes && (char === "\r" || char === "\n")) {
      currentRecord.push(currentField.trim());
      currentField = "";

      // Only push non-empty records
      if (currentRecord.some((f) => f.length > 0)) {
        lines.push(currentRecord);
      }
      currentRecord = [];

      if (char === "\r" && nextChar === "\n") {
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    currentField += char;
    i++;
  }

  // Final field and record if present
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField.trim());
    if (currentRecord.some((f) => f.length > 0)) {
      lines.push(currentRecord);
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // First line is headers
  const rawHeaders = lines[0].map((h) => h.trim());
  const normalizedHeaders = rawHeaders.map((h) => normalizeHeaderName(h));

  const rows: RawCsvRow[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const record = lines[rowIndex];
    const data: Record<string, string> = {};

    for (let colIndex = 0; colIndex < normalizedHeaders.length; colIndex++) {
      const header = normalizedHeaders[colIndex];
      data[header] = record[colIndex] ?? "";
    }

    rows.push({
      rowNumber: rowIndex + 1, // 1-based row number (header is row 1, data starts at row 2)
      data,
    });
  }

  return { headers: normalizedHeaders, rows };
}

/**
 * Normalize variations of column headers into standard schema keys.
 */
export function normalizeHeaderName(header: string): string {
  const clean = header.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (["name", "productname", "itemname", "product", "item"].includes(clean)) {
    return "name";
  }
  if (["shortcode", "itemcode", "code", "sku", "productcode", "id"].includes(clean)) {
    return "shortCode";
  }
  if (["company", "brand", "companyname", "brandname", "manufacturer"].includes(clean)) {
    return "company";
  }
  if (["category", "group", "categoryname", "productcategory"].includes(clean)) {
    return "category";
  }
  if (["hsn", "hsncode", "hsnsac", "hsnno"].includes(clean)) {
    return "hsn";
  }
  if (["gst", "gstrate", "gstpct", "gstpercentage", "tax", "taxrate", "vat"].includes(clean)) {
    return "gstRate";
  }
  if (["mrp", "price", "rate", "mrprs", "mrprupees", "unitprice"].includes(clean)) {
    return "mrp";
  }
  if (["packsize", "pack", "unitspercarton", "piecespercarton", "cartonsize", "packqty"].includes(clean)) {
    return "packSize";
  }
  if (["packlabel", "unit", "packaging", "packunit", "uom"].includes(clean)) {
    return "packLabel";
  }
  if (["reorderlevel", "reorder", "minstock", "alertlevel", "safetystock"].includes(clean)) {
    return "reorderLevel";
  }

  return clean;
}
