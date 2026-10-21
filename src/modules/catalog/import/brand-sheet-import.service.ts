import { ImportBatchStatus, ImportBatchType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";
import {
  readWorkbookFromBuffer,
  writeWorkbookToBuffer,
  ParsedCell,
  ParsedWorksheet,
} from "@/lib/xlsx";
import {
  calculatePriceFromMrpDiscountPct,
  validatePriceOrdering,
} from "@/modules/pricing/pricing.service";

export type SheetPricingMode = "ABSOLUTE" | "PERCENT";
export type ImportRowStatus =
  | "OK"
  | "WARNING"
  | "NEEDS_REVIEW"
  | "SUSPICIOUS"
  | "ERROR";

export type DuplicateResolutionAction = "KEEP_SEPARATE" | "KEEP_THIS" | "SKIP";

export interface ParsedBrandSheetRow {
  rowId: string;
  sheetName: string;
  rowNumber: number;
  brandName: string;
  rawItemName: string;
  cleanItemName: string;
  weight: string;
  normalizedKey: string; // brand|cleanItem|normalizedWeight
  shortCode: string; // deterministic SKU
  packSize: number; // QTY IN CASE / PCS (1 carton = packSize pieces)
  mrpRupees: number | null;
  mrpPaise: number | null;
  rawA: string;
  rawB: string;
  rawC: string;
  priceAPaise: number | null;
  priceBPaise: number | null;
  priceCPaise: number | null;
  sheetMode: SheetPricingMode;
  status: ImportRowStatus;
  messages: string[];
  duplicateGroupKey?: string;
  duplicateResolution?: DuplicateResolutionAction;
  suspiciousConfirmed?: boolean;
  importInactiveWithoutPrices?: boolean;
  willUpdateExisting?: boolean;
  existingProductId?: string;
}

export interface ParsedBrandSheetSummary {
  sheetName: string;
  detectedBrand: string;
  detectedMode: SheetPricingMode;
  rowCount: number;
}

export interface BrandWorkbookPreview {
  filename: string;
  sheets: ParsedBrandSheetSummary[];
  rows: ParsedBrandSheetRow[];
  counts: {
    total: number;
    ok: number;
    warning: number;
    needsReview: number;
    suspicious: number;
    error: number;
  };
}

export interface CommitBrandImportInput {
  filename: string;
  rows: ParsedBrandSheetRow[];
}

export interface CommitBrandImportResult {
  batchId: string;
  companiesCreated: number;
  productsCreated: number;
  productsUpdated: number;
  rowsSkipped: number;
}

const IGNORED_TITLE_PHRASES = new Set([
  "JAI MATA DI",
  "JAIMATADI",
  "SAHARSA",
  "PRICE LIST",
  "RATE LIST",
  "SHEET1",
  "SHEET2",
  "SHEET3",
]);

/**
 * Extract weight token from an item name if weight column is blank.
 * Handles e.g. "Mustard OilPouch 1Ltr", "Mustard Oil Bottle 200ml", "Mustard Oil Tin 15Kg",
 * "Chana Masala 10gm", "Chilli Powder (Kashmiri) 50 Gm", "Dawat Rozana Gold 26kg",
 * "1 Ltr*12", "500ml*24", etc.
 */
export function extractNameAndWeight(
  rawName: string,
  explicitWeight?: string | null
): { cleanName: string; weight: string; normalizedWeight: string } {
  const trimmedName = rawName.replace(/\s+/g, " ").trim();
  let weightStr = (explicitWeight ?? "").trim();

  if (!weightStr) {
    // Match trailing or embedded weight like "1Ltr", "500ml", "15Kg", "50 Gm", "10g", "1.5 Ltr"
    const weightRegex =
      /\b(\d+(?:\.\d+)?)\s*(kg|gm|gms|gram|grams|g|ltr|ltrs|liter|liters|l|ml|pc|pcs|pack)\b(?:\s*\*\s*\d+)?/i;
    const match = weightRegex.exec(trimmedName);
    if (match) {
      weightStr = `${match[1]}${match[2]}`;
    }
  }

  const normalizedWeight = normalizeWeightToken(weightStr);
  // Keep full descriptive name (including weight if part of the original item description)
  // while also computing a base clean name without trailing weight for duplicate comparison
  const baseWithoutWeight = trimmedName
    .replace(
      /\b(\d+(?:\.\d+)?)\s*(kg|gm|gms|gram|grams|g|ltr|ltrs|liter|liters|l|ml)\b(?:\s*\*\s*\d+)?/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  return {
    cleanName: baseWithoutWeight || trimmedName,
    weight: weightStr,
    normalizedWeight,
  };
}

export function normalizeWeightToken(weight: string): string {
  if (!weight) return "";
  const m = /^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/.exec(weight.trim());
  if (!m) return weight.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const num = m[1];
  const unitRaw = m[2].toLowerCase();
  let unit = unitRaw.toUpperCase();
  if (unitRaw === "gm" || unitRaw === "gms" || unitRaw === "gram" || unitRaw === "grams" || unitRaw === "g") {
    unit = "G";
  } else if (unitRaw === "kg" || unitRaw === "kgs" || unitRaw === "kilogram") {
    unit = "KG";
  } else if (unitRaw === "ltr" || unitRaw === "ltrs" || unitRaw === "liter" || unitRaw === "liters" || unitRaw === "l") {
    unit = "L";
  } else if (unitRaw === "ml" || unitRaw === "milliliter") {
    unit = "ML";
  }
  return `${num}${unit}`;
}

export function normalizeItemKey(
  brand: string,
  cleanName: string,
  normalizedWeight: string
): string {
  const b = brand.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const n = cleanName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const w = normalizedWeight.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "");
  return `${b}|${n}|${w}`;
}

/**
 * Deterministic SKU generator from brandCode + normalizedName + normalizedWeight.
 */
export function buildDeterministicSku(
  brand: string,
  cleanName: string,
  normalizedWeight: string,
  variantSuffix?: string
): string {
  const brandCode = brand
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4) || "GEN";

  const words = cleanName
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let nameCode = "";
  if (words.length === 1) {
    nameCode = words[0].slice(0, 8);
  } else {
    nameCode = words
      .slice(0, 4)
      .map((w) => w.slice(0, 3))
      .join("");
  }
  nameCode = nameCode.slice(0, 12) || "ITEM";

  const weightPart = normalizedWeight
    ? `-${normalizedWeight.replace(/[^A-Z0-9]/g, "")}`
    : "";
  const suffixPart = variantSuffix ? `-${variantSuffix}` : "";

  return `${brandCode}-${nameCode}${weightPart}${suffixPart}`.slice(0, 50);
}

function normalizeHeaderCell(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface HeaderMapping {
  headerRowIdx: number;
  slNoCol: number;
  itemsCol: number;
  weightCol: number;
  caseQtyCol: number;
  mrpCol: number;
  aCol: number;
  bCol: number;
  cCol: number;
}

function findHeaderRow(rows: ParsedCell[][]): HeaderMapping | null {
  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    let slNoCol = -1;
    let itemsCol = -1;
    let weightCol = -1;
    let caseQtyCol = -1;
    let mrpCol = -1;
    let aCol = -1;
    let bCol = -1;
    let cCol = -1;

    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeaderCell(row[c]?.display ?? "");
      if (!norm) continue;

      if (norm === "SL NO" || norm === "SLNO" || norm === "S NO" || norm === "SR NO" || norm === "SL") {
        slNoCol = c;
      } else if (
        norm === "ITEMS" ||
        norm === "ITEM" ||
        norm === "ITEM NAME" ||
        norm === "PARTICULARS" ||
        norm === "PRODUCT" ||
        norm === "PRODUCTS" ||
        norm === "DESCRIPTION"
      ) {
        itemsCol = c;
      } else if (norm === "WEIGHT" || norm === "WT" || norm === "PACK" || norm === "SIZE") {
        weightCol = c;
      } else if (
        norm === "QTY IN CASE" ||
        norm === "QTY IN CARTON" ||
        norm === "CASE QTY" ||
        norm === "PCS" ||
        norm === "PIECES" ||
        norm === "PACK SIZE" ||
        norm === "PCS IN CASE"
      ) {
        caseQtyCol = c;
      } else if (norm === "MRP" || norm === "M R P") {
        mrpCol = c;
      } else if (norm === "A" || norm === "LIST A" || norm === "PRICE A" || norm === "WHOLESALER") {
        aCol = c;
      } else if (norm === "B" || norm === "LIST B" || norm === "PRICE B" || norm === "RETAILER") {
        bCol = c;
      } else if (norm === "C" || norm === "LIST C" || norm === "PRICE C" || norm === "CUSTOMER") {
        cCol = c;
      }
    }

    if (itemsCol !== -1 && (mrpCol !== -1 || aCol !== -1 || caseQtyCol !== -1)) {
      return {
        headerRowIdx: r,
        slNoCol,
        itemsCol,
        weightCol,
        caseQtyCol,
        mrpCol,
        aCol,
        bCol,
        cCol,
      };
    }
  }
  return null;
}

/**
 * Detect brand name from pre-header title rows (ignoring "JAI MATA DI" and "SAHARSA")
 * or fall back to the worksheet tab name.
 */
function detectBrandName(sheet: ParsedWorksheet, headerRowIdx: number): string {
  const candidates: string[] = [];

  for (let r = 0; r < headerRowIdx; r++) {
    const row = sheet.rows[r] ?? [];
    for (const cell of row) {
      const txt = (cell?.display ?? "").trim();
      if (!txt) continue;
      const upper = txt
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!upper) continue;
      if (IGNORED_TITLE_PHRASES.has(upper)) continue;
      candidates.push(txt.trim());
    }
  }

  // Last non-ignored title line right above header is typically the brand name (e.g. SALONI, MDH, DAWAT)
  if (candidates.length > 0) {
    return candidates[candidates.length - 1].toUpperCase();
  }

  const cleanTab = sheet.name.trim();
  const upperTab = cleanTab.toUpperCase();
  if (!IGNORED_TITLE_PHRASES.has(upperTab) && !/^SHEET\d+$/i.test(cleanTab)) {
    return cleanTab.toUpperCase();
  }

  return "GENERAL";
}

/**
 * Auto-detect whether a sheet's A/B/C columns are in PERCENT mode or ABSOLUTE ₹ mode.
 */
function detectSheetPricingMode(
  rows: ParsedCell[][],
  mapping: HeaderMapping
): SheetPricingMode {
  let percentSignals = 0;
  let absoluteSignals = 0;

  for (let r = mapping.headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const cols = [mapping.aCol, mapping.bCol, mapping.cCol].filter((c) => c >= 0);
    for (const colIdx of cols) {
      const cell = row[colIdx];
      if (!cell || cell.raw === null || cell.display.trim() === "") continue;

      if (cell.isPercentFormatted || cell.display.includes("%")) {
        percentSignals++;
      } else if (typeof cell.raw === "number" && cell.raw > 0 && cell.raw < 1) {
        percentSignals++;
      } else if (typeof cell.raw === "number" && cell.raw >= 1) {
        absoluteSignals++;
      }
    }
  }

  return percentSignals > 0 && percentSignals >= absoluteSignals ? "PERCENT" : "ABSOLUTE";
}

/**
 * Parse a cell value as a percentage number (e.g. "22%" -> 22, 0.22 -> 22, 22 -> 22).
 */
function parsePercentValue(cell: ParsedCell | undefined): number | null {
  if (!cell || cell.raw === null || cell.display.trim() === "") return null;
  const disp = cell.display.trim();
  if (disp.endsWith("%")) {
    const num = Number(disp.slice(0, -1).trim());
    return Number.isFinite(num) ? num : null;
  }
  const num = typeof cell.raw === "number" ? cell.raw : Number(disp);
  if (!Number.isFinite(num)) return null;
  // If Excel stored 22% as 0.22 raw number
  if (num > 0 && num < 1) {
    return +(num * 100).toFixed(4);
  }
  return num;
}

/**
 * Parse a cell value as rupees -> integer paise.
 */
function parseRupeesCellToPaise(cell: ParsedCell | undefined): {
  rupees: number | null;
  paise: number | null;
} {
  if (!cell || cell.raw === null || cell.display.trim() === "") {
    return { rupees: null, paise: null };
  }
  const cleanStr = cell.display.replace(/[₹,\s]/g, "").trim();
  const num = typeof cell.raw === "number" ? cell.raw : Number(cleanStr);
  if (!Number.isFinite(num) || num <= 0) {
    return { rupees: null, paise: null };
  }
  return {
    rupees: num,
    paise: Math.round(num * 100),
  };
}

/**
 * Estimate expected max reasonable MRP in rupees for a given weight to flag typos
 * like Haldi Powder 200gm with MRP 2286.15.
 */
function isMrpWildlyOutOfLineForWeight(
  normalizedWeight: string,
  mrpRupees: number
): boolean {
  const m = /^(\d+(?:\.\d+)?)(G|KG|ML|L)$/.exec(normalizedWeight);
  if (!m) return false;
  const qty = Number(m[1]);
  const unit = m[2];

  // e.g. <= 250g spice/food packet having MRP > ₹1,200 is almost certainly a carton rate or typo
  if (unit === "G" && qty <= 250 && mrpRupees > 1200) {
    return true;
  }
  if (unit === "ML" && qty <= 250 && mrpRupees > 1200) {
    return true;
  }
  return false;
}

export class BrandSheetImportService {
  /**
   * Parse an uploaded .xlsx or .csv buffer into a structured preview with all 5 data-quality rules applied.
   */
  async previewWorkbook(
    role: UserRole,
    buffer: Buffer,
    filename: string,
    sheetModeOverrides?: Record<string, SheetPricingMode>
  ): Promise<BrandWorkbookPreview> {
    assertPermission(role, Permission.IMPORT_PRODUCTS);

    const worksheets = readWorkbookFromBuffer(buffer, filename);

    // Load existing products & companies so we can mark updates vs creates
    const existingProducts = await prisma.product.findMany({
      include: { company: true },
    });

    const existingByNormalizedKey = new Map<string, { id: string; shortCode: string }>();
    for (const p of existingProducts) {
      const brand = p.company?.name ?? "GENERAL";
      const { cleanName, normalizedWeight } = extractNameAndWeight(p.name, p.weight);
      const key = normalizeItemKey(brand, cleanName, normalizedWeight);
      existingByNormalizedKey.set(key, { id: p.id, shortCode: p.shortCode });
    }

    const sheetsSummary: ParsedBrandSheetSummary[] = [];
    const allRows: ParsedBrandSheetRow[] = [];

    for (const sheet of worksheets) {
      const mapping = findHeaderRow(sheet.rows);
      if (!mapping) continue;

      const brandName = detectBrandName(sheet, mapping.headerRowIdx);
      const autoMode = detectSheetPricingMode(sheet.rows, mapping);
      const effectiveMode = sheetModeOverrides?.[sheet.name] ?? autoMode;

      let sheetRowCount = 0;

      for (let r = mapping.headerRowIdx + 1; r < sheet.rows.length; r++) {
        const row = sheet.rows[r];
        if (!row) continue;

        const rawItemName = (row[mapping.itemsCol]?.display ?? "").trim();
        if (!rawItemName) continue;

        // Skip repeated header or footer total rows
        const upperItem = normalizeHeaderCell(rawItemName);
        if (upperItem === "ITEMS" || upperItem === "TOTAL" || upperItem === "GRAND TOTAL") {
          continue;
        }

        sheetRowCount++;

        const explicitWeight =
          mapping.weightCol >= 0 ? (row[mapping.weightCol]?.display ?? "").trim() : "";

        // Note: if weight is not already in the item name, append explicitWeight so display name is complete
        const { cleanName, weight, normalizedWeight } = extractNameAndWeight(
          rawItemName,
          explicitWeight
        );

        const displayItemName =
          explicitWeight &&
          !rawItemName.toLowerCase().includes(explicitWeight.toLowerCase())
            ? `${rawItemName} ${explicitWeight}`.trim()
            : rawItemName;

        // Parse case_qty (QTY IN CASE / PCS = pieces per 1 carton)
        const rawCaseQtyCell = mapping.caseQtyCol >= 0 ? row[mapping.caseQtyCol] : undefined;
        const parsedCaseQty =
          rawCaseQtyCell && rawCaseQtyCell.display.trim() !== ""
            ? Math.round(Number(rawCaseQtyCell.raw ?? rawCaseQtyCell.display))
            : 1;
        const packSize = Number.isFinite(parsedCaseQty) && parsedCaseQty >= 1 ? parsedCaseQty : 1;

        // Parse MRP
        const mrpCell = mapping.mrpCol >= 0 ? row[mapping.mrpCol] : undefined;
        const { rupees: mrpRupees, paise: mrpPaise } = parseRupeesCellToPaise(mrpCell);

        // Parse A, B, C according to effectiveMode
        const cellA = mapping.aCol >= 0 ? row[mapping.aCol] : undefined;
        const cellB = mapping.bCol >= 0 ? row[mapping.bCol] : undefined;
        const cellC = mapping.cCol >= 0 ? row[mapping.cCol] : undefined;

        let priceAPaise: number | null = null;
        let priceBPaise: number | null = null;
        let priceCPaise: number | null = null;

        const messages: string[] = [];
        let status: ImportRowStatus = "OK";

        if (effectiveMode === "PERCENT") {
          const pctA = parsePercentValue(cellA);
          const pctB = parsePercentValue(cellB);
          const pctC = parsePercentValue(cellC);

          if (mrpPaise == null || mrpPaise <= 0) {
            status = "ERROR";
            messages.push(
              "MRP is 0 or missing in % off MRP mode; cannot compute A/B/C prices. Fix MRP or import as inactive without prices."
            );
          } else {
            if (pctA != null) priceAPaise = calculatePriceFromMrpDiscountPct(mrpPaise, pctA);
            if (pctB != null) priceBPaise = calculatePriceFromMrpDiscountPct(mrpPaise, pctB);
            if (pctC != null) priceCPaise = calculatePriceFromMrpDiscountPct(mrpPaise, pctC);
          }
        } else {
          // ABSOLUTE ₹ mode
          priceAPaise = parseRupeesCellToPaise(cellA).paise;
          priceBPaise = parseRupeesCellToPaise(cellB).paise;
          priceCPaise = parseRupeesCellToPaise(cellC).paise;

          if (mrpPaise == null || mrpPaise <= 0) {
            status = "WARNING";
            messages.push("MRP missing (saved as null)");
          }
        }

        // Check suspicious values (Rule 3)
        // e.g. case_qty > 5000, case_qty == MRP (when MRP >= 100), or MRP wildly out of line for weight
        const isCaseQtyHuge = packSize > 5000;
        const isCaseQtyEqualToMrp =
          mrpRupees != null && mrpRupees >= 100 && packSize === mrpRupees;
        const isMrpOutlier =
          mrpRupees != null &&
          isMrpWildlyOutOfLineForWeight(normalizedWeight, mrpRupees);

        if (isCaseQtyHuge || isCaseQtyEqualToMrp || isMrpOutlier) {
          if (status !== "ERROR") {
            status = "SUSPICIOUS";
          }
          if (isCaseQtyHuge) {
            messages.push(`Suspicious case_qty (${packSize} > 5000)`);
          }
          if (isCaseQtyEqualToMrp) {
            messages.push(
              `Suspicious: Qty in Case (${packSize}) equals MRP (${mrpRupees}) — possible column copy error`
            );
          }
          if (isMrpOutlier) {
            messages.push(
              `Suspicious MRP ₹${mrpRupees} for weight ${normalizedWeight} (possible carton price entered in MRP)`
            );
          }
        }

        // Check A <= B <= C <= MRP ordering warnings
        const orderingWarnings = validatePriceOrdering({
          mrpPaise,
          priceAPaise,
          priceBPaise,
          priceCPaise,
        });
        if (orderingWarnings.length > 0) {
          for (const w of orderingWarnings) {
            messages.push(w.message);
          }
          if (status === "OK") {
            status = "WARNING";
          }
        }

        const normalizedKey = normalizeItemKey(brandName, cleanName, normalizedWeight);
        const existingMatch = existingByNormalizedKey.get(normalizedKey);
        const shortCode =
          existingMatch?.shortCode ??
          buildDeterministicSku(brandName, cleanName, normalizedWeight);

        allRows.push({
          rowId: `${sheet.name}-R${r + 1}`,
          sheetName: sheet.name,
          rowNumber: r + 1,
          brandName,
          rawItemName: displayItemName,
          cleanItemName: cleanName,
          weight: weight || normalizedWeight,
          normalizedKey,
          shortCode,
          packSize,
          mrpRupees,
          mrpPaise,
          rawA: cellA?.display ?? "",
          rawB: cellB?.display ?? "",
          rawC: cellC?.display ?? "",
          priceAPaise,
          priceBPaise,
          priceCPaise,
          sheetMode: effectiveMode,
          status,
          messages,
          willUpdateExisting: Boolean(existingMatch),
          existingProductId: existingMatch?.id,
        });
      }

      sheetsSummary.push({
        sheetName: sheet.name,
        detectedBrand: brandName,
        detectedMode: effectiveMode,
        rowCount: sheetRowCount,
      });
    }

    // Rule 2: Detect duplicate items in the same file with same normalizedKey
    const groupMap = new Map<string, ParsedBrandSheetRow[]>();
    for (const row of allRows) {
      const list = groupMap.get(row.normalizedKey) ?? [];
      list.push(row);
      groupMap.set(row.normalizedKey, list);
    }

    for (const [key, group] of groupMap.entries()) {
      if (group.length > 1) {
        group.forEach((row, idx) => {
          row.duplicateGroupKey = key;
          row.duplicateResolution = "KEEP_SEPARATE";
          // Give distinct variant SKUs if kept separate
          if (idx > 0) {
            row.shortCode = buildDeterministicSku(
              row.brandName,
              row.cleanItemName,
              normalizeWeightToken(row.weight),
              `V${idx + 1}`
            );
            row.willUpdateExisting = false;
            row.existingProductId = undefined;
          }
          if (row.status !== "ERROR") {
            row.status = "NEEDS_REVIEW";
          }
          row.messages.push(
            `Duplicate item in file (${group.length} occurrences with different pcs/MRP). Choose: Keep as separate variant, Keep only one, or Skip.`
          );
        });
      }
    }

    const counts = {
      total: allRows.length,
      ok: allRows.filter((r) => r.status === "OK").length,
      warning: allRows.filter((r) => r.status === "WARNING").length,
      needsReview: allRows.filter((r) => r.status === "NEEDS_REVIEW").length,
      suspicious: allRows.filter((r) => r.status === "SUSPICIOUS").length,
      error: allRows.filter((r) => r.status === "ERROR").length,
    };

    return {
      filename,
      sheets: sheetsSummary,
      rows: allRows,
      counts,
    };
  }

  /**
   * Commit reviewed catalog & price sheet rows in a single atomic transaction.
   */
  async commitImport(
    role: UserRole,
    actorId: string,
    input: CommitBrandImportInput,
    ip?: string
  ): Promise<CommitBrandImportResult> {
    assertPermission(role, Permission.IMPORT_PRODUCTS);

    const { filename, rows } = input;

    // Validate no unresolved blocking rows remain
    for (const row of rows) {
      if (row.duplicateResolution === "SKIP") continue;

      if (row.status === "ERROR" && !row.importInactiveWithoutPrices) {
        throw new Error(
          `Row ${row.rowNumber} (${row.rawItemName}) has an unresolved ERROR. Fix MRP, mark 'Import as inactive without prices', or Skip.`
        );
      }

      if (row.status === "SUSPICIOUS" && !row.suspiciousConfirmed) {
        throw new Error(
          `Row ${row.rowNumber} (${row.rawItemName}) is flagged SUSPICIOUS and must be explicitly confirmed or edited before commit.`
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let companiesCreated = 0;
      let productsCreated = 0;
      let productsUpdated = 0;
      let rowsSkipped = 0;

      const companyCache = new Map<string, string>();
      const existingCompanies = await tx.company.findMany();
      for (const c of existingCompanies) {
        companyCache.set(c.name.toUpperCase(), c.id);
      }

      // Ensure a default category exists if needed
      let defaultCat = await tx.category.findFirst({
        where: { name: "General" },
      });
      if (!defaultCat) {
        defaultCat = await tx.category.create({
          data: { name: "General", active: true },
        });
      }

      for (const row of rows) {
        if (row.duplicateResolution === "SKIP") {
          rowsSkipped++;
          continue;
        }

        const brandUpper = (row.brandName || "GENERAL").trim().toUpperCase();
        let companyId = companyCache.get(brandUpper);
        if (!companyId) {
          const createdComp = await tx.company.create({
            data: { name: brandUpper, active: true },
          });
          companyId = createdComp.id;
          companyCache.set(brandUpper, companyId);
          companiesCreated++;
        }

        const isInactiveNoPrices =
          row.status === "ERROR" && Boolean(row.importInactiveWithoutPrices);

        const mrpPaise = isInactiveNoPrices ? null : row.mrpPaise;
        const priceAPaise = isInactiveNoPrices ? null : row.priceAPaise;
        const priceBPaise = isInactiveNoPrices ? null : row.priceBPaise;
        const priceCPaise = isInactiveNoPrices ? null : row.priceCPaise;
        const active = !isInactiveNoPrices;

        // Check if product exists by existingProductId or shortCode
        const existing = row.existingProductId
          ? await tx.product.findUnique({ where: { id: row.existingProductId } })
          : await tx.product.findUnique({ where: { shortCode: row.shortCode } });

        if (existing) {
          await tx.product.update({
            where: { id: existing.id },
            data: {
              name: row.rawItemName,
              weight: row.weight || null,
              companyId,
              packSize: Math.max(1, row.packSize || 1),
              mrpPaise,
              priceAPaise,
              priceBPaise,
              priceCPaise,
              active,
            },
          });
          productsUpdated++;
        } else {
          // Ensure unique shortCode
          let finalSku = row.shortCode;
          const collision = await tx.product.findUnique({
            where: { shortCode: finalSku },
          });
          if (collision) {
            finalSku = `${finalSku}-${row.rowNumber}`.slice(0, 60);
          }

          await tx.product.create({
            data: {
              name: row.rawItemName,
              shortCode: finalSku,
              weight: row.weight || null,
              companyId,
              categoryId: defaultCat.id,
              hsn: "0000",
              gstRateBp: 0,
              packSize: Math.max(1, row.packSize || 1),
              packLabel: "Carton",
              mrpPaise,
              priceAPaise,
              priceBPaise,
              priceCPaise,
              active,
            },
          });
          productsCreated++;
        }
      }

      const batch = await tx.importBatch.create({
        data: {
          type: ImportBatchType.CATALOG,
          filename,
          userId: actorId,
          mode: "CATALOG_ABC",
          rowsTotal: rows.length,
          rowsApplied: productsCreated + productsUpdated,
          rowsSkipped,
          status: ImportBatchStatus.APPLIED,
          summary: {
            companiesCreated,
            productsCreated,
            productsUpdated,
            rowsSkipped,
          },
        },
      });

      return {
        batchId: batch.id,
        companiesCreated,
        productsCreated,
        productsUpdated,
        rowsSkipped,
      };
    });

    await auditService.log({
      actorId,
      action: "CATALOG_EXCEL_IMPORT_COMMITTED",
      entity: "ImportBatch",
      entityId: result.batchId,
      after: {
        filename,
        ...result,
      },
      ip,
    });

    return result;
  }

  /**
   * Generate a neutral blank .xlsx template (headers only, zero fake rows).
   */
  generateBlankTemplateBuffer(): Buffer {
    return writeWorkbookToBuffer([
      {
        name: "BRAND_NAME",
        rows: [
          ["SL NO", "ITEMS", "WEIGHT", "QTY IN CASE", "MRP", "A", "B", "C"],
        ],
      },
    ]);
  }

  /**
   * Generate an .xlsx report of flagged / review / error rows from a preview.
   */
  generateReviewReportBuffer(rows: ParsedBrandSheetRow[]): Buffer {
    const flagged = rows.filter((r) => r.status !== "OK");
    const sheetRows: Array<Array<string | number | null>> = [
      [
        "SHEET",
        "ROW",
        "BRAND",
        "ITEMS",
        "WEIGHT",
        "QTY IN CASE",
        "MRP",
        "A (₹)",
        "B (₹)",
        "C (₹)",
        "STATUS",
        "NOTES / ISSUES",
      ],
      ...flagged.map((r) => [
        r.sheetName,
        r.rowNumber,
        r.brandName,
        r.rawItemName,
        r.weight,
        r.packSize,
        r.mrpRupees ?? "",
        r.priceAPaise != null ? +(r.priceAPaise / 100).toFixed(2) : "",
        r.priceBPaise != null ? +(r.priceBPaise / 100).toFixed(2) : "",
        r.priceCPaise != null ? +(r.priceCPaise / 100).toFixed(2) : "",
        r.status,
        r.messages.join("; "),
      ]),
    ];

    return writeWorkbookToBuffer([
      {
        name: "Review_Report",
        rows: sheetRows,
      },
    ]);
  }
}

export const brandSheetImportService = new BrandSheetImportService();
