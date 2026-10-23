import { OcrPage, OcrResult, ParsedBill, ParsedBillItem } from "./ocr.types";

/**
 * Normalizes Indian currency string (e.g. "1,03,529.47" -> 103529.47)
 */
export function parseCurrency(str: string | undefined): number {
  if (!str) return 0;
  const clean = str.replace(/[₹,\s]/g, "").replace(/([0-9]+)\.([0-9]{2}).*$/, "$1.$2");
  // Exclude 10-digit phone numbers
  if (/^\d{10}$/.test(clean)) return 0;

  const num = parseFloat(clean);
  if (isNaN(num) || num <= 0) return 0;
  const paise = Math.round(num * 100);
  return paise > 2000000000 ? 0 : paise; // safe integer fit
}

export function parseQuantity(str: string | undefined): { qty: number; unit: string } {
  if (!str) return { qty: 0, unit: "PCS" };
  const clean = str.replace(/,/g, "").trim();

  // Pattern like "20 crt", "1 CTN", "5 CS", "10 Pcs"
  const match = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)?$/);
  if (match) {
    const qty = parseFloat(match[1]);
    const rawUnit = (match[2] || "").toUpperCase();
    let unit = "PCS";
    if (["CRT", "CTN", "CS", "CASE", "CASES"].includes(rawUnit)) {
      unit = "CS";
    } else if (["BOX", "BTL", "PKT", "PCH"].includes(rawUnit)) {
      unit = rawUnit;
    }
    return { qty, unit };
  }

  const num = parseFloat(clean);
  return { qty: isNaN(num) ? 0 : num, unit: "PCS" };
}

export function parseIndianDate(str: string | undefined): Date | undefined {
  if (!str) return undefined;
  const clean = str.trim();

  // 17/10/2026 or 17-10-2026 or 17.10.2026
  const dmyMatch = clean.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    if (!isNaN(date.getTime())) return date;
  }

  // 14-Oct-2026 or 14-OCT-2026
  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
  };
  const namedMatch = clean.match(/(\d{1,2})[\/\-\.]([a-zA-Z]{3})[\/\-\.](\d{4})/);
  if (namedMatch) {
    const day = parseInt(namedMatch[1], 10);
    const monthStr = namedMatch[2].toLowerCase();
    const month = monthMap[monthStr] ?? 0;
    const year = parseInt(namedMatch[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    if (!isNaN(date.getTime())) return date;
  }

  return undefined;
}

export class TableParser {
  parse(ocrResult: OcrResult): ParsedBill {
    const allText = ocrResult.pages.map((p) => p.text).join("\n");
    const headerInfo = this.extractHeaders(allText);
    const items = this.extractItems(ocrResult.pages);

    let confidenceSum = 0;
    for (const item of items) {
      confidenceSum += item.confidence;
    }
    const avgConfidence = items.length > 0 ? confidenceSum / items.length : ocrResult.confidence;

    return {
      supplierName: headerInfo.supplierName,
      supplierGstin: headerInfo.supplierGstin,
      billNo: headerInfo.billNo,
      billDate: headerInfo.billDate,
      billTotalPaise: headerInfo.billTotalPaise,
      taxableTotalPaise: headerInfo.taxableTotalPaise,
      taxTotalPaise: headerInfo.taxTotalPaise,
      items,
      confidence: avgConfidence,
      rawText: allText,
    };
  }

  private extractHeaders(text: string) {
    let supplierName: string | undefined;
    let supplierGstin: string | undefined;
    let billNo: string | undefined;
    let billDate: Date | undefined;
    let billTotalPaise: number | undefined;
    let taxableTotalPaise: number | undefined;
    let taxTotalPaise: number | undefined;

    // GSTIN: 15-character Indian GSTIN
    const gstinMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Zz]{1}[0-9A-Z]{1})\b/);
    if (gstinMatch) {
      supplierGstin = gstinMatch[1].toUpperCase();
    }

    // Invoice / Bill No
    const invMatch = text.match(/(?:Invoice\s*(?:No\.?|Number)|INV\.?\s*NO\.?|Bill\s*(?:No\.?|Number))\s*[:.\-]?\s*([A-Za-z0-9\-\/]+)/i);
    if (invMatch) {
      billNo = invMatch[1].trim();
    } else {
      // Look for standalone patterns like A4530 or T-940 or 50654262712543
      const altInv = text.match(/\b([A-Z]\d{3,6}|T-\d{2,5}|[0-9]{10,16})\b/);
      if (altInv) {
        billNo = altInv[1];
      }
    }

    // Bill Date
    const dateMatch = text.match(/(?:Date|Dated|INV\.?\s*DATE)\s*[:.\-]?\s*([0-9]{1,2}[\/\-\.][0-9A-Za-z]{3,}[\/\-\.][0-9]{2,4})/i);
    if (dateMatch) {
      billDate = parseIndianDate(dateMatch[1]);
    } else {
      const altDate = text.match(/\b(\d{1,2}[\/\-\.](?:\d{1,2}|[A-Za-z]{3})[\/\-\.]\d{4})\b/);
      if (altDate) {
        billDate = parseIndianDate(altDate[1]);
      }
    }

    // Supplier detection by known patterns
    const upperText = text.toUpperCase();
    if (upperText.includes("MAHASHIAN DI HATTI") || upperText.includes("MDH")) {
      supplierName = "MDH (Mahashian Di Hatti)";
    } else if (upperText.includes("SHUBHAM TRADERS") || upperText.includes("PATANJALI")) {
      supplierName = "Patanjali (Shubham Traders)";
    } else if (upperText.includes("NILONS")) {
      supplierName = "Nilons Enterprises";
    } else if (upperText.includes("VINDHYAWASINI") || upperText.includes("BIKAJI")) {
      supplierName = "Bikaji (Vindhyawasini Sales)";
    } else {
      // First line or company name fallback
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        supplierName = lines[0].replace(/TAX INVOICE|ESTIMATE/gi, "").trim();
      }
    }

    // Bill Total: Look for Total / Grand Total / Amount Chargeable lines
    const decimalTotalMatch = text.match(
      /(?:Total\s*Amount|Grand\s*Total|Amount\s*Chargeable|Total\s*Net\s*Amount|TOTAL)[^\n]*?(?:₹\s*|\b)([0-9,]+\.[0-9]{2})\b/i
    );
    if (decimalTotalMatch) {
      billTotalPaise = parseCurrency(decimalTotalMatch[1]);
    } else {
      const fallbackTotalMatch = text.match(
        /(?:Total\s*Amount|Grand\s*Total|Amount\s*Chargeable|Total\s*Net\s*Amount|TOTAL)\s*[:.\-]?\s*₹?\s*([0-9,]+(?:\.[0-9]{2})?)/i
      );
      if (fallbackTotalMatch) {
        billTotalPaise = parseCurrency(fallbackTotalMatch[1]);
      }
    }

    return {
      supplierName,
      supplierGstin,
      billNo,
      billDate,
      billTotalPaise,
      taxableTotalPaise,
      taxTotalPaise,
    };
  }

  private extractItems(pages: OcrPage[]): ParsedBillItem[] {
    const items: ParsedBillItem[] = [];
    let currentLineNo = 1;

    for (const page of pages) {
      const lines = page.lines;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const text = line.text.trim();

        // Skip headers, footers, metadata lines, totals
        if (
          !text ||
          /^(S\.?No|Sl\s*No|Sr\s*No|Description|Particulars|Product|HSN|Qty|Rate|Amount|Total|Less|Subtotal|Tax|CGST|SGST|IGST|Bank|Terms|Page|This is a Computer|State Name|Buyer|Invoice|Inv\.?\s*No|Inv\.?\s*Date|Dated|Mob|Phone|Tel|GSTIN|PAN|CIN|FSSAI|Delivery|Transport|Vehicle|Declaration|Authorised|Tax\s*Invoice|Estimate|vindhyawasini|shubham|mahashian|nilons|patanjali)/i.test(text) ||
          /(?:Phone|Mob|GSTIN|State Name|Dated|Invoice|Inv\.?\s*No|Inv\.?\s*Date)\s*[:.\-]/i.test(text)
        ) {
          continue;
        }

        // An invoice item line should start with a line number (1, 2, 3...) or have an HSN/product pattern
        const startsWithLineNo = /^\d{1,3}\s+/.test(text);
        if (!startsWithLineNo && !text.match(/\b\d{4,8}\b/)) {
          continue;
        }

        const parsed = this.parseLine(text, currentLineNo);
        if (parsed) {
          // Arithmetic validation check: qty * rate ≈ amount
          this.validateArithmetic(parsed);
          items.push(parsed);
          currentLineNo++;
        }
      }
    }

    return items;
  }

  private parseLine(lineText: string, defaultLineNo: number): ParsedBillItem | null {
    const flags: string[] = [];
    let text = lineText.replace(/Continued\s*\.\.\./i, "").trim();

    // Line number detection
    let lineNo = defaultLineNo;
    const lineNoMatch = text.match(/^(\d{1,3})\s+(.*)$/);
    if (lineNoMatch) {
      lineNo = parseInt(lineNoMatch[1], 10);
      text = lineNoMatch[2].trim();
    }

    const tokens = text.split(/\s+/);
    if (tokens.length < 2) return null;

    // Try extracting HSN code (4 to 8 digits)
    let hsn: string | undefined;
    const hsnIdx = tokens.findIndex((t) => /^\d{4,8}$/.test(t) && t.length >= 4 && t.length <= 8);
    if (hsnIdx !== -1) {
      hsn = tokens[hsnIdx];
      tokens.splice(hsnIdx, 1);
    }

    // Determine where product description ends and numeric columns begin
    // FMCG descriptions often contain grammage/pack info like "200 Gm*20", "45 GM", "500gm", "100G X 120Pch"
    let lastDescIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const nextTok = i + 1 < tokens.length ? tokens[i + 1] : undefined;
      const clean = tok.replace(/[₹$,]/g, "");

      const isWholesaleUnit = /^(?:crt|ctn|cs|pcs|box|pkt|nos|dz|mtr|per)$/i.test(clean);

      // If token contains letters and is not a pure wholesale unit
      if (/[a-zA-Z]/.test(clean) && !isWholesaleUnit) {
        lastDescIdx = i;
      } else if (/(?:gm|gms|g|kg|kgs|ml|l|ltr|ltrs|pch|pcs|pkt|rs|box|\*|x)/i.test(tok) && !/^[0-9]+(?:\.[0-9]+)?%?$/.test(clean)) {
        lastDescIdx = i;
      } else if (nextTok) {
        const cleanNext = nextTok.replace(/[₹$,]/g, "");
        if (
          /^(?:gm|gms|g|kg|kgs|ml|l|ltr|ltrs|pch|pouch|tin|can|btl)$/i.test(cleanNext) ||
          /^(?:gm|gms|g|kg|ml|ltr|l|pch|pcs|pkt|rs|box|\*|x)/i.test(cleanNext)
        ) {
          lastDescIdx = i;
        }
      }
    }

    if (lastDescIdx === -1) return null;

    const namePart = tokens.slice(0, lastDescIdx + 1).join(" ").trim();
    if (!namePart || namePart.length < 2) return null;

    const numTokens = tokens.slice(lastDescIdx + 1);
    if (numTokens.length === 0) return null;

    // Default values
    let billedQty = 1;
    let billedUnit = "PCS";
    let ratePaise = 0;
    let amountPaise = 0;
    let discountPercent = 0;
    let gstRateBp = 500; // default 5% GST

    // Parse discount percent if present
    for (let k = 0; k < numTokens.length; k++) {
      const tok = numTokens[k];
      if (tok.endsWith("%")) {
        discountPercent = parseFloat(tok.replace("%", "")) || 0;
      } else if (tok === "%" && k > 0) {
        discountPercent = parseFloat(numTokens[k - 1]) || 0;
      }
    }

    // Check for explicit wholesale quantity & unit (e.g. "20 crt", "1 CTN")
    let foundUnitQty = false;
    for (let k = 0; k < numTokens.length; k++) {
      const tok = numTokens[k];
      if (/^(?:crt|ctn|cs|pcs|box|pkt)$/i.test(tok) && k > 0) {
        const prevQty = parseQuantity(numTokens[k - 1]);
        if (prevQty.qty > 0) {
          billedQty = prevQty.qty;
          billedUnit = tok.toUpperCase() === "CRT" ? "CS" : tok.toUpperCase();
          foundUnitQty = true;
          break;
        }
      }
    }

    // Extract all money values (non-percentage, valid currency numbers)
    const moneyValues: { raw: string; val: number; originalIndex: number }[] = [];
    for (let idx = 0; idx < numTokens.length; idx++) {
      const tok = numTokens[idx];
      if (!tok.includes("%") && tok !== "%") {
        const val = parseCurrency(tok);
        if (val > 0) {
          moneyValues.push({ raw: tok, val, originalIndex: idx });
        }
      }
    }

    if (foundUnitQty) {
      // In explicit unit lines like "20 crt 5,392.16 crt 4 % 1,03,529.47":
      // Rates and amounts are in moneyValues
      if (moneyValues.length >= 2) {
        // First money value after quantity is usually rate
        const rateCandidates = moneyValues.filter((m) => m.val !== Math.round(billedQty * 100));
        if (rateCandidates.length >= 2) {
          ratePaise = rateCandidates[0].val;
          amountPaise = rateCandidates[rateCandidates.length - 1].val;
        } else if (rateCandidates.length === 1) {
          amountPaise = rateCandidates[0].val;
          ratePaise = billedQty > 0 ? Math.round(amountPaise / billedQty) : amountPaise;
        }
      } else if (moneyValues.length === 1) {
        amountPaise = moneyValues[0].val;
        ratePaise = billedQty > 0 ? Math.round(amountPaise / billedQty) : amountPaise;
      }
    } else {
      // Multi-column invoices without unit keywords (like Patanjali: MRP, CLD, QTY, RATE, FREE, DIS%, GST%, AMT, NET)
      // Search for (qty, rate) pair among numbers that produces amount
      let bestPair: { qty: number; rate: number; amt: number } | null = null;

      if (moneyValues.length >= 2) {
        const lastVal = moneyValues[moneyValues.length - 1].val;
        const secondLastVal = moneyValues.length >= 3 ? moneyValues[moneyValues.length - 2].val : lastVal;

        for (let i = 0; i < moneyValues.length - 1; i++) {
          const rawQ = parseFloat(moneyValues[i].raw.replace(/,/g, ""));
          if (rawQ <= 0) continue;

          for (let j = i + 1; j < moneyValues.length; j++) {
            const rawR = parseFloat(moneyValues[j].raw.replace(/,/g, ""));
            if (rawR <= 0) continue;

            const expectedPaise = Math.round(rawQ * rawR * 100);
            if (
              Math.abs(expectedPaise - lastVal) < Math.max(100, lastVal * 0.05) ||
              Math.abs(expectedPaise - secondLastVal) < Math.max(100, secondLastVal * 0.05)
            ) {
              bestPair = { qty: Math.round(rawQ), rate: Math.round(rawR * 100), amt: lastVal };
              break;
            }
          }
          if (bestPair) break;
        }
      }

      if (bestPair) {
        billedQty = bestPair.qty;
        ratePaise = bestPair.rate;
        amountPaise = bestPair.amt;
      } else if (moneyValues.length >= 2) {
        const rawQ = parseFloat(moneyValues[0].raw.replace(/,/g, ""));
        billedQty = rawQ > 0 ? Math.round(rawQ) : 1;
        ratePaise = moneyValues[1].val;
        amountPaise = moneyValues[moneyValues.length - 1].val;
      } else if (moneyValues.length === 1) {
        amountPaise = moneyValues[0].val;
        ratePaise = amountPaise;
      }
    }

    // Calculate billed pieces based on unit
    let billedQtyPieces = Math.round(billedQty);
    if (billedUnit === "CS" || billedUnit === "CRT" || billedUnit === "CTN") {
      billedQtyPieces = Math.round(billedQty);
    }

    return {
      lineNo,
      rawText: lineText,
      parsedName: namePart,
      hsn,
      billedQty,
      billedUnit,
      billedQtyPieces,
      ratePaise,
      gstRateBp,
      amountPaise,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      flags,
      confidence: 85.0,
    };
  }

  private validateArithmetic(item: ParsedBillItem) {
    if (item.billedQty <= 0) {
      item.flags.push("ZERO_QTY");
    }
    if (item.ratePaise <= 0) {
      item.flags.push("ZERO_RATE");
    }
    if (item.amountPaise <= 0) {
      item.flags.push("ZERO_AMOUNT");
    }

    if (item.billedQty > 0 && item.ratePaise > 0 && item.amountPaise > 0) {
      // Base expected: qty * rate
      let expectedPaise = Math.round(item.billedQty * item.ratePaise);
      if (item.discountPercent && item.discountPercent > 0) {
        expectedPaise = Math.round(expectedPaise * (1 - item.discountPercent / 100));
      }

      // Check difference tolerance (allow 5% rounding / tax discrepancies)
      const diffPaise = Math.abs(expectedPaise - item.amountPaise);
      const tolerance = Math.max(100, Math.round(expectedPaise * 0.08)); // ₹1 or 8%

      if (diffPaise > tolerance) {
        item.flags.push("ARITHMETIC_MISMATCH");
      }
    }
  }
}

export const tableParser = new TableParser();
