/**
 * Smart Item Search Engine (Busy Accounting / FMCG Style)
 *
 * Capabilities:
 * 1. Multi-token search ("bhuj 400", "bikaji bhuj 200", "400 bhuj")
 * 2. Weight-aware matching:
 *    - "400g", "400gm", "400", "0.4kg" match 400G items
 *    - "1kg", "1000g" match 1KG items
 *    - "1l", "1ltr", "1000ml" match 1L items
 *    - Bare numbers like "4" match weight values starting with 4 (e.g. 400G)
 * 3. Typo / edit tolerance (1 edit distance for tokens >= 4 characters)
 * 4. Ranking:
 *    - Exact full-name-prefix
 *    - Word-prefix match in name
 *    - Weight match
 *    - Brand/code match
 *    - In-stock items ranked before out-of-stock items
 *    - Shorter names win ties
 * 5. Target latency: < 50ms for 2,000+ items
 */

export interface SearchableProduct {
  id: string;
  name: string;
  shortCode: string;
  companyName?: string | null;
  categoryName?: string | null;
  weight?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
  weightBase?: number | null; // Base grams or ml
  packSize?: number;
  packLabel?: string | null;
  shopStockQty?: number;
  godownStockQty?: number;
  godownCartons?: number;
  godownLoose?: number;
  mrpPaise?: number | null;
  priceAPaise?: number | null;
  priceBPaise?: number | null;
  priceCPaise?: number | null;
  bagSize?: number | null;
  imageUrl?: string | null;
  active?: boolean;
  [key: string]: any;
}

export interface SearchIndexItem {
  product: SearchableProduct;
  lowerName: string;
  nameWords: string[];
  lowerCompany: string;
  companyWords: string[];
  lowerShortCode: string;
  parsedWeightBase: number | null; // e.g. 400 for 400g, 1000 for 1kg/1L
  weightValueStr: string; // e.g. "400", "0.4"
  weightDisplay: string; // e.g. "400g", "1kg"
  inStock: boolean;
  totalStockPcs: number;
  searchableTokens: string[];
}

/**
 * Normalise any weight to base units (grams for mass, ml for liquid).
 */
export function parseWeightToBase(val?: number | null, unit?: string | null): number | null {
  if (val === undefined || val === null || isNaN(val) || val <= 0) return null;
  const u = (unit || "g").trim().toLowerCase();
  if (u === "kg" || u === "kilo" || u === "kilogram") return val * 1000;
  if (u === "l" || u === "ltr" || u === "litre" || u === "liter") return val * 1000;
  return val; // g, ml, pcs
}

/**
 * Conservative extraction of weight from free text like "Bhujia 400G" or "Oil 1 LTR".
 */
export function extractWeightFromText(text: string): { value: number; unit: string; base: number } | null {
  if (!text) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*(kg|kilo|gm|g|gram|grams|ltr|l|litre|liter|ml|pcs|pc)\b/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  if (isNaN(val) || val <= 0) return null;
  const rawUnit = match[2].toLowerCase();
  let unit = "g";
  if (rawUnit.startsWith("k")) unit = "kg";
  else if (rawUnit.startsWith("l")) unit = "l";
  else if (rawUnit === "ml") unit = "ml";
  else if (rawUnit.startsWith("p")) unit = "pcs";
  const base = parseWeightToBase(val, unit) ?? val;
  return { value: val, unit, base };
}

const UNIT_WORDS = new Set([
  "g",
  "gm",
  "gms",
  "gram",
  "grams",
  "kg",
  "kgs",
  "kilo",
  "kilogram",
  "l",
  "lt",
  "ltr",
  "ltrs",
  "litre",
  "litres",
  "liter",
  "liters",
  "ml",
  "pcs",
  "pc",
]);

/**
 * Normalise and combine query tokens so "0.4" + "kg" becomes "0.4kg", "1" + "ltr" becomes "1ltr".
 */
export function tokenizeQuery(rawQuery: string): string[] {
  // Replace punctuation like *, /, ,, - with spaces so "bhuj/400" -> "bhuj 400"
  const cleaned = rawQuery.replace(/[*,\/]/g, " ").trim().toLowerCase();
  if (!cleaned) return [];

  const rawTokens = cleaned.split(/\s+/).filter(Boolean);
  const combinedTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const cur = rawTokens[i];
    const next = rawTokens[i + 1];

    // If cur is a number and next is a unit (e.g. "400" + "gm" -> "400gm", "1" + "ltr" -> "1ltr")
    if (next && /^\d+(\.\d+)?$/.test(cur) && UNIT_WORDS.has(next)) {
      combinedTokens.push(`${cur}${next}`);
      i++; // Skip the unit token
    } else {
      combinedTokens.push(cur);
    }
  }

  return combinedTokens;
}

/**
 * Parse a user query token to see if it represents a weight search.
 * e.g. "400g" -> base: 400, "0.4kg" -> base: 400, "1kg" -> base: 1000, "400" -> bareNum: 400
 */
export function parseQueryTokenForWeight(token: string): {
  isWeight: boolean;
  baseWeight?: number;
  bareNumber?: number;
  bareNumberStr?: string;
} {
  const t = token.toLowerCase();
  const weightMatch = t.match(/^(\d+(?:\.\d+)?)(kg|kgs|kilo|gm|gms|g|gram|grams|ltr|ltrs|l|litre|litres|liter|liters|ml)$/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const rawUnit = weightMatch[2].toLowerCase();
    let unit = "g";
    if (rawUnit.startsWith("k")) unit = "kg";
    else if (rawUnit.startsWith("l")) unit = "l";
    else if (rawUnit === "ml") unit = "ml";
    const base = parseWeightToBase(val, unit);
    if (base !== null) {
      return { isWeight: true, baseWeight: base };
    }
  }

  // Pure digits: e.g. "400" or "4"
  if (/^\d+(\.\d+)?$/.test(t)) {
    const num = parseFloat(t);
    return { isWeight: false, bareNumber: num, bareNumberStr: t };
  }

  return { isWeight: false };
}

/**
 * 1-edit distance for typo tolerance (levenshtein <= 1).
 */
function isOneEditAway(s1: string, s2: string): boolean {
  if (Math.abs(s1.length - s2.length) > 1) return false;
  if (s1 === s2) return true;
  let edits = 0;
  let i = 0;
  let j = 0;
  while (i < s1.length && j < s2.length) {
    if (s1[i] !== s2[j]) {
      edits++;
      if (edits > 1) return false;
      if (s1.length > s2.length) i++;
      else if (s1.length < s2.length) j++;
      else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }
  return true;
}

/**
 * Pre-build search index for high-speed client-side searching.
 */
export function buildProductSearchIndex(products: SearchableProduct[]): SearchIndexItem[] {
  return products.map((p) => {
    const lowerName = (p.name || "").toLowerCase().trim();
    const nameWords = lowerName.split(/[\s\-_/]+/).filter(Boolean);
    const lowerCompany = (p.companyName || "").toLowerCase().trim();
    const companyWords = lowerCompany.split(/[\s\-_/]+/).filter(Boolean);
    const lowerShortCode = (p.shortCode || "").toLowerCase().trim();

    // Determine weight
    let weightBase = p.weightBase ?? parseWeightToBase(p.weightValue, p.weightUnit);
    let weightVal = p.weightValue ?? null;
    let weightU = p.weightUnit ?? null;

    if (weightBase === null) {
      const fromWeightStr = p.weight ? extractWeightFromText(p.weight) : null;
      const fromName = extractWeightFromText(lowerName);
      const extracted = fromWeightStr || fromName;
      if (extracted) {
        weightBase = extracted.base;
        weightVal = extracted.value;
        weightU = extracted.unit;
      }
    }

    const weightDisplay = p.weight?.trim() || (weightVal ? `${weightVal}${weightU || "g"}` : "");
    const weightValueStr = weightVal !== null ? String(weightVal) : "";

    const totalStock = (p.shopStockQty ?? 0) + (p.godownStockQty ?? 0);
    const inStock = totalStock > 0;

    // Tokens to index
    const searchableTokens: string[] = [
      ...nameWords,
      ...companyWords,
      lowerShortCode,
      weightDisplay.toLowerCase(),
      weightValueStr,
      weightBase !== null ? `${weightBase}g` : "",
      weightBase !== null ? `${weightBase}` : "",
      p.packLabel ? p.packLabel.toLowerCase() : "",
    ].filter(Boolean);

    return {
      product: p,
      lowerName,
      nameWords,
      lowerCompany,
      companyWords,
      lowerShortCode,
      parsedWeightBase: weightBase,
      weightValueStr,
      weightDisplay,
      inStock,
      totalStockPcs: totalStock,
      searchableTokens,
    };
  });
}

/**
 * Search items given a query string and pre-indexed products (or raw products list).
 */
export function searchItems(
  query: string,
  indexOrProducts: SearchIndexItem[] | SearchableProduct[],
  options?: {
    limit?: number;
    requireInStock?: boolean;
    counterLocation?: "SHOP" | "GODOWN" | "VAN";
  }
): SearchableProduct[] {
  const rawQuery = query.trim().toLowerCase();
  if (!rawQuery) {
    return [];
  }

  const limit = options?.limit ?? 15;

  // Build index if passed raw products
  let index: SearchIndexItem[];
  if (indexOrProducts.length > 0 && "searchableTokens" in indexOrProducts[0]) {
    index = indexOrProducts as SearchIndexItem[];
  } else {
    index = buildProductSearchIndex(indexOrProducts as SearchableProduct[]);
  }

  // Tokenize user query with unit joining
  const queryTokens = tokenizeQuery(rawQuery);
  if (queryTokens.length === 0) return [];

  // Scored matching
  const matches: Array<{ item: SearchIndexItem; score: number }> = [];

  for (const item of index) {
    if (options?.requireInStock && !item.inStock) continue;

    let allTokensMatch = true;
    let itemScore = 0;

    for (const qTok of queryTokens) {
      let tokenMatched = false;
      let tokenScore = 0;

      // 1. Weight token matching
      const weightInfo = parseQueryTokenForWeight(qTok);
      if (weightInfo.isWeight && item.parsedWeightBase !== null) {
        if (Math.abs(item.parsedWeightBase - weightInfo.baseWeight!) < 0.01) {
          tokenMatched = true;
          tokenScore += 50; // exact weight match
        }
      } else if (weightInfo.bareNumber !== undefined) {
        // e.g. "400" or "4"
        const bareStr = weightInfo.bareNumberStr!;
        // Exact weight base match (e.g. 400g item matches "400")
        if (item.parsedWeightBase !== null && item.parsedWeightBase === weightInfo.bareNumber) {
          tokenMatched = true;
          tokenScore += 45;
        }
        // Item weightValue starts with this bare number (e.g. "4" matches 400g or 40g like Busy)
        else if (item.weightValueStr && item.weightValueStr.startsWith(bareStr)) {
          tokenMatched = true;
          tokenScore += 30;
        }
        // Base grams starts with bare number (e.g. 400g matches "4")
        else if (item.parsedWeightBase !== null && String(item.parsedWeightBase).startsWith(bareStr)) {
          tokenMatched = true;
          tokenScore += 25;
        }
        // Name contains number prefix
        else if (item.nameWords.some((w) => w.startsWith(bareStr))) {
          tokenMatched = true;
          tokenScore += 20;
        }
      }

      // 2. Word prefix match on product name
      if (!tokenMatched) {
        for (const w of item.nameWords) {
          if (w.startsWith(qTok)) {
            tokenMatched = true;
            tokenScore += 40;
            break;
          }
        }
      }

      // 3. Short code match (prefix or exact or contains)
      if (!tokenMatched) {
        const cleanShortCode = item.lowerShortCode.replace(/[-_]/g, "");
        const cleanQTok = qTok.replace(/[-_]/g, "");
        if (item.lowerShortCode === qTok || cleanShortCode === cleanQTok) {
          tokenMatched = true;
          tokenScore += 60;
        } else if (
          item.lowerShortCode.startsWith(qTok) ||
          cleanShortCode.startsWith(cleanQTok) ||
          item.lowerShortCode.includes(qTok) ||
          cleanShortCode.includes(cleanQTok)
        ) {
          tokenMatched = true;
          tokenScore += 35;
        }
      }

      // 4. Brand / company match
      if (!tokenMatched) {
        for (const cw of item.companyWords) {
          if (cw.startsWith(qTok)) {
            tokenMatched = true;
            tokenScore += 25;
            break;
          }
        }
      }

      // 5. Name contains substring
      if (!tokenMatched && item.lowerName.includes(qTok)) {
        tokenMatched = true;
        tokenScore += 15;
      }

      // 6. Typo / edit tolerance on tokens >= 4 chars
      if (!tokenMatched && qTok.length >= 4) {
        for (const w of item.nameWords) {
          if (w.length >= 4 && isOneEditAway(qTok, w)) {
            tokenMatched = true;
            tokenScore += 10;
            break;
          }
        }
      }

      if (!tokenMatched) {
        allTokensMatch = false;
        break;
      }

      itemScore += tokenScore;
    }

    if (allTokensMatch) {
      // Bonus for exact name prefix match of whole query
      if (item.lowerName.startsWith(rawQuery)) {
        itemScore += 100;
      }

      // Stock preference: in-stock items boosted, out-of-stock items penalized
      if (item.inStock) {
        itemScore += 500;
      } else {
        itemScore -= 500; // Out-of-stock items ranked last
      }

      matches.push({ item, score: itemScore });
    }
  }

  // Sort: highest score first, ties broken by shorter name
  matches.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.item.lowerName.length - b.item.lowerName.length;
  });

  return matches.slice(0, limit).map((m) => m.item.product);
}
