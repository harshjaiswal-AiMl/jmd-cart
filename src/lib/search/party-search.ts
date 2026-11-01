/**
 * JMD Cart - Enterprise Party Search Engine
 *
 * Implements token-based search with word-prefix ranking, phone digit matching,
 * address/area matching, GSTIN search, and Walk-in customer intelligence.
 *
 * Ranking Hierarchy:
 * 1. Exact name prefix (Rank 1: party name starts with query)
 * 2. Word prefix (Rank 2: any word in party name starts with token)
 * 3. Phone / GSTIN prefix or match (Rank 3)
 * 4. Area / Address match (Rank 4)
 * 5. Substring / Typo tolerance (Rank 5)
 */

export interface SearchableParty {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  gstin?: string | null;
  type?: "CUSTOMER" | "RETAILER" | "WHOLESALER" | string | null;
  creditEnabled?: boolean;
  creditLimitPaise?: number;
  currentBalancePaise?: number;
  shortCode?: string | null;
  isWalkIn?: boolean;
}

/**
 * Normalizes string for token matching
 */
function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/['"`]/g, "");
}

/**
 * Computes Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j - 1], prev, row[j]) + 1;
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Searches and ranks parties according to Prompt #17 specifications
 */
export function searchParties<T extends SearchableParty>(
  query: string,
  parties: T[],
  limit = 20
): T[] {
  const rawQuery = query.trim();

  // If query is empty, return default listing (Walk-in first, then parties)
  if (!rawQuery) {
    const walkIns = parties.filter((p) => p.isWalkIn || p.id === "" || p.name.toLowerCase().includes("walk-in"));
    const others = parties.filter((p) => !p.isWalkIn && p.id !== "" && !p.name.toLowerCase().includes("walk-in"));
    return [...walkIns, ...others].slice(0, limit);
  }

  const qLower = normalizeText(rawQuery);
  const tokens = qLower.split(/\s+/).filter(Boolean);

  // Check if query is explicitly asking for walk-in / counter sale
  const isQueryingWalkIn = ["walk", "walk-in", "counter", "cash", "retail"].some((term) =>
    tokens.some((tok) => term.startsWith(tok) || tok.startsWith(term))
  );

  const scored: Array<{ party: T; score: number }> = [];

  for (const party of parties) {
    const isPartyWalkIn = party.isWalkIn || party.id === "" || party.name.toLowerCase().includes("walk-in");

    // Walk-in should ONLY appear if query explicitly matches walk-in terms
    if (isPartyWalkIn && !isQueryingWalkIn) {
      continue;
    }

    const partyNameLower = normalizeText(party.name);
    const partyWords = partyNameLower.split(/\s+/).filter(Boolean);
    const phoneDigits = party.phone ? party.phone.replace(/\D/g, "") : "";
    const addressLower = party.address ? normalizeText(party.address) : "";
    const cityLower = party.city ? normalizeText(party.city) : "";
    const gstinUpper = party.gstin ? party.gstin.toUpperCase() : "";
    const shortCodeLower = party.shortCode ? normalizeText(party.shortCode) : "";

    let allTokensMatch = true;
    let totalScore = 0;

    for (const token of tokens) {
      let tokenMatched = false;
      let tokenScore = 0;

      // Special case for Walk-in / Counter Sale
      if (isPartyWalkIn) {
        const walkTerms = ["walk", "walk-in", "counter", "cash", "retail", "sale"];
        if (walkTerms.some((t) => t.startsWith(token) || token.startsWith(t))) {
          tokenMatched = true;
          tokenScore = 900;
        }
      }

      // 1. Exact full name starts with token (e.g. "sh" -> "Shahwaz Enterprises")
      if (!tokenMatched && partyNameLower.startsWith(token)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 1000 - (partyNameLower.length - token.length));
      }

      // 2. Word in party name starts with token (e.g. "sh" matches "Shiv", "Shree", "Kumar Shahwaz")
      if (!tokenMatched) {
        for (const word of partyWords) {
          if (word.startsWith(token)) {
            tokenMatched = true;
            tokenScore = Math.max(tokenScore, 800 - (word.length - token.length));
          }
        }
      }

      // 3. Short code match
      if (!tokenMatched && shortCodeLower && shortCodeLower.startsWith(token)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 750);
      }

      // 4. Phone number matching (prefix or contiguous digits >= 3)
      if (!tokenMatched && phoneDigits) {
        const cleanTok = token.replace(/\D/g, "");
        if (cleanTok.length >= 3 && phoneDigits.includes(cleanTok)) {
          tokenMatched = true;
          tokenScore = Math.max(tokenScore, phoneDigits.startsWith(cleanTok) ? 700 : 600);
        }
      }

      // 5. GSTIN match
      if (!tokenMatched && gstinUpper && gstinUpper.includes(token.toUpperCase())) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 650);
      }

      // 6. City / Address word prefix match
      if (!tokenMatched) {
        if (cityLower && cityLower.startsWith(token)) {
          tokenMatched = true;
          tokenScore = Math.max(tokenScore, 500);
        } else if (addressLower) {
          const addressWords = addressLower.split(/\s+/);
          if (addressWords.some((w) => w.startsWith(token))) {
            tokenMatched = true;
            tokenScore = Math.max(tokenScore, 400);
          } else if (token.length >= 3 && addressLower.includes(token)) {
            tokenMatched = true;
            tokenScore = Math.max(tokenScore, 300);
          }
        }
      }

      // 7. Substring match in name (only for tokens of length >= 3 to avoid noise like "di" matching "aadil")
      if (!tokenMatched && token.length >= 3 && partyNameLower.includes(token)) {
        tokenMatched = true;
        tokenScore = Math.max(tokenScore, 200);
      }

      // 8. Typo tolerance (Levenshtein distance <= 1 for tokens of 4-6 chars, <= 2 for 7+ chars)
      if (!tokenMatched && token.length >= 4) {
        const maxDist = token.length >= 7 ? 2 : 1;
        for (const word of partyWords) {
          if (Math.abs(word.length - token.length) <= maxDist) {
            const dist = levenshteinDistance(token, word);
            if (dist <= maxDist) {
              tokenMatched = true;
              tokenScore = Math.max(tokenScore, 150);
              break;
            }
          }
        }
      }

      if (!tokenMatched) {
        allTokensMatch = false;
        break;
      }

      totalScore += tokenScore;
    }

    if (allTokensMatch) {
      // Bonus for wholesaler / retailer
      if (party.type === "WHOLESALER") totalScore += 10;
      else if (party.type === "RETAILER") totalScore += 5;

      scored.push({ party, score: totalScore });
    }
  }

  // Sort descending by score, tie-break by shorter name, then alphabetical
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (a.party.name.length !== b.party.name.length) {
      return a.party.name.length - b.party.name.length;
    }
    return a.party.name.localeCompare(b.party.name);
  });

  return scored.slice(0, limit).map((s) => s.party);
}

/**
 * Formats party ledger balance as readable Indian Rupees with Dr/Cr notation
 */
export function formatPartyBalance(balancePaise: number | null | undefined): string {
  if (balancePaise == null || balancePaise === 0) return "₹0.00";
  const absRs = (Math.abs(balancePaise) / 100).toFixed(2);
  return balancePaise > 0 ? `₹${absRs} Dr` : `₹${absRs} Cr`;
}
