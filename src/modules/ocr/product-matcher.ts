import { prisma } from "@/lib/prisma";
import { BillScanLineMatchStatus } from "@prisma/client";

export interface MatchCandidate {
  productId: string;
  name: string;
  shortCode: string;
  mrpPaise: number;
  packSize: number;
  packLabel: string;
  score: number;
}

export interface MatchResult {
  productId?: string;
  matchConfidence: number;
  matchStatus: BillScanLineMatchStatus;
  suggestedPackSize: number;
  candidates: MatchCandidate[];
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts weights and pack notation from string, e.g.:
 * "110gm*180pc" -> ["110gm", "180pc"]
 * "200g" -> ["200g"]
 * "1 ltr" -> ["1ltr"]
 */
export function extractWeightsAndPacks(str: string): string[] {
  const norm = str.toLowerCase();
  const tokens: string[] = [];
  const matches = norm.match(/\b\d+(?:\.\d+)?\s*(?:gm|g|kg|ml|ltr|l|pc|pcs|crt|ctn)\b/g);
  if (matches) {
    tokens.push(...matches.map((m) => m.replace(/\s+/g, "")));
  }
  return tokens;
}

/**
 * Token-based similarity calculation (Dice's coefficient / Token Jaccard)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const n1 = normalizeText(s1);
  const n2 = normalizeText(s2);

  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0;

  const t1 = new Set(n1.split(" ").filter(Boolean));
  const t2 = new Set(n2.split(" ").filter(Boolean));

  let intersection = 0;
  for (const token of t1) {
    if (t2.has(token)) intersection++;
  }

  const union = new Set([...t1, ...t2]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Weight match bonus if both contain the exact same weight/grammage
  const w1 = extractWeightsAndPacks(s1);
  const w2 = extractWeightsAndPacks(s2);
  let weightMatch = false;
  for (const w of w1) {
    if (w2.includes(w)) {
      weightMatch = true;
      break;
    }
  }

  const score = weightMatch ? Math.min(1.0, jaccard + 0.25) : jaccard;
  return Math.round(score * 100) / 100;
}

export class ProductMatcher {
  /**
   * Matches a parsed bill line against the product catalog.
   */
  async matchLine(
    rawText: string,
    parsedName: string,
    companyId?: string | null,
    hsn?: string | null
  ): Promise<MatchResult> {
    const normalized = normalizeText(parsedName);

    // 1. Check SupplierItemAlias table first
    if (companyId) {
      const alias = await prisma.supplierItemAlias.findUnique({
        where: {
          companyId_normalizedBillText: {
            companyId,
            normalizedBillText: normalized,
          },
        },
        include: { product: true },
      });

      if (alias && alias.product.active) {
        return {
          productId: alias.productId,
          matchConfidence: 0.98,
          matchStatus: "SUGGESTED",
          suggestedPackSize: alias.product.packSize,
          candidates: [
            {
              productId: alias.productId,
              name: alias.product.name,
              shortCode: alias.product.shortCode,
              mrpPaise: alias.product.mrpPaise ?? 0,
              packSize: alias.product.packSize,
              packLabel: alias.product.packLabel,
              score: 0.98,
            },
          ],
        };
      }
    }

    // 2. Fetch candidate products from company (or all products if company unknown)
    const products = await prisma.product.findMany({
      where: {
        active: true,
        ...(companyId ? { companyId } : {}),
      },
      select: {
        id: true,
        name: true,
        shortCode: true,
        mrpPaise: true,
        packSize: true,
        packLabel: true,
        hsn: true,
      },
    });

    if (products.length === 0 && companyId) {
      // Fallback: search across all products
      const fallbackProducts = await prisma.product.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          shortCode: true,
          mrpPaise: true,
          packSize: true,
          packLabel: true,
          hsn: true,
        },
      });
      return this.rankCandidates(parsedName, hsn, fallbackProducts);
    }

    return this.rankCandidates(parsedName, hsn, products);
  }

  private rankCandidates(
    parsedName: string,
    hsn: string | null | undefined,
    products: Array<{
      id: string;
      name: string;
      shortCode: string;
      mrpPaise: number | null;
      packSize: number;
      packLabel: string;
      hsn: string;
    }>
  ): MatchResult {
    const scored: MatchCandidate[] = [];

    for (const p of products) {
      let score = calculateSimilarity(parsedName, p.name);

      // Bonus if short code matches
      if (normalizeText(parsedName).includes(p.shortCode.toLowerCase())) {
        score = Math.min(1.0, score + 0.3);
      }

      // Bonus if HSN matches
      if (hsn && p.hsn && p.hsn !== "0000" && hsn === p.hsn) {
        score = Math.min(1.0, score + 0.15);
      }

      if (score >= 0.35) {
        scored.push({
          productId: p.id,
          name: p.name,
          shortCode: p.shortCode,
          mrpPaise: p.mrpPaise ?? 0,
          packSize: p.packSize,
          packLabel: p.packLabel,
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (!best || best.score < 0.6) {
      return {
        matchConfidence: best ? best.score : 0,
        matchStatus: "UNMATCHED",
        suggestedPackSize: 1,
        candidates: scored.slice(0, 3),
      };
    }

    if (best.score >= 0.85) {
      return {
        productId: best.productId,
        matchConfidence: best.score,
        matchStatus: "SUGGESTED",
        suggestedPackSize: best.packSize,
        candidates: scored.slice(0, 3),
      };
    }

    return {
      productId: best.productId,
      matchConfidence: best.score,
      matchStatus: "SUGGESTED",
      suggestedPackSize: best.packSize,
      candidates: scored.slice(0, 3),
    };
  }

  /**
   * Learns alias mapping when user confirms a match.
   */
  async recordConfirmedAlias(
    companyId: string,
    rawText: string,
    productId: string
  ): Promise<void> {
    const normalized = normalizeText(rawText);
    if (!normalized || !companyId) return;

    await prisma.supplierItemAlias.upsert({
      where: {
        companyId_normalizedBillText: {
          companyId,
          normalizedBillText: normalized,
        },
      },
      create: {
        companyId,
        normalizedBillText: normalized,
        productId,
        timesConfirmed: 1,
      },
      update: {
        productId,
        timesConfirmed: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }
}

export const productMatcher = new ProductMatcher();
