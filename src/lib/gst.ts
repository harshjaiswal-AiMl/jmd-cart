/**
 * GST Calculation Engine for IDMS
 * Rules:
 *  - All monetary values are integer paise (1 Rupee = 100 paise).
 *  - Rates and discounts are integer basis points (1% = 100 bp).
 *  - MRP is tax-inclusive. Taxable value is extracted from the inclusive line total.
 *  - Half-up rounding to exact paise.
 *  - Intra-state (Bihar): CGST = round(tax / 2), SGST = tax - CGST (sum matches tax exactly).
 *  - Inter-state: IGST = tax.
 *  - Invoice grand total rounded to nearest rupee with explicit round_off_paise.
 */

export interface LineItemPriceInput {
  mrpPaise: number;
  qty: number;
  discountBp?: number;
  gstRateBp: number;
  isInterState?: boolean;
}

export interface LineItemPriceResult {
  mrpPaise: number;
  qty: number;
  discountBp: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  taxablePaise: number;
  gstRateBp: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface TaxSummaryRate {
  gstRateBp: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
}

export interface InvoiceTotalsResult {
  items: LineItemPriceResult[];
  subtotalPaise: number;      // Sum of (mrpPaise * qty)
  lineDiscountPaise: number;  // Sum of discounts across lines
  orderDiscountPaise: number; // Order-level discount applied
  netSubtotalPaise: number;   // Raw total before tax extraction / bill round-off
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  rawTotalPaise: number;
  roundOffPaise: number;      // Difference to round to nearest rupee
  totalPaise: number;         // Grand total in integer paise (multiple of 100)
  taxSummaryByRate: TaxSummaryRate[];
}

/**
 * Calculate pricing and tax for a single line item.
 */
export function calculateLineGst(input: LineItemPriceInput): LineItemPriceResult {
  const { mrpPaise, qty, discountBp = 0, gstRateBp, isInterState = false } = input;

  if (!Number.isInteger(mrpPaise) || mrpPaise < 0) {
    throw new Error(`mrpPaise must be a non-negative integer, got ${mrpPaise}`);
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new Error(`qty must be a positive integer, got ${qty}`);
  }
  if (!Number.isInteger(discountBp) || discountBp < 0 || discountBp > 10000) {
    throw new Error(`discountBp must be between 0 and 10000, got ${discountBp}`);
  }
  if (!Number.isInteger(gstRateBp) || gstRateBp < 0) {
    throw new Error(`gstRateBp must be a non-negative integer, got ${gstRateBp}`);
  }

  // 1. Calculate discounted unit price in paise (half-up)
  const unitPricePaise =
    discountBp > 0
      ? Math.round((mrpPaise * (10000 - discountBp)) / 10000)
      : mrpPaise;

  // 2. Line total (inclusive of tax)
  const lineTotalPaise = unitPricePaise * qty;

  // 3. Extract taxable value from inclusive price
  // Formula: Taxable = (LineTotal * 10000) / (10000 + gstRateBp)
  const taxablePaise =
    gstRateBp > 0
      ? Math.round((lineTotalPaise * 10000) / (10000 + gstRateBp))
      : lineTotalPaise;

  // 4. Tax amount is remainder to avoid rounding drift
  const taxPaise = lineTotalPaise - taxablePaise;

  // 5. Split tax into CGST / SGST (intra-state) or IGST (inter-state)
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;

  if (isInterState) {
    igstPaise = taxPaise;
  } else if (taxPaise > 0) {
    cgstPaise = Math.round(taxPaise / 2);
    sgstPaise = taxPaise - cgstPaise; // Exact remainder guarantees sum === taxPaise
  }

  return {
    mrpPaise,
    qty,
    discountBp,
    unitPricePaise,
    lineTotalPaise,
    taxablePaise,
    gstRateBp,
    taxPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
  };
}

/**
 * Calculate totals for an entire invoice given line items and optional order discount.
 */
export function calculateInvoiceTotals(
  lines: LineItemPriceInput[],
  orderDiscountBp: number = 0
): InvoiceTotalsResult {
  if (!Number.isInteger(orderDiscountBp) || orderDiscountBp < 0 || orderDiscountBp > 10000) {
    throw new Error(`orderDiscountBp must be between 0 and 10000, got ${orderDiscountBp}`);
  }

  const computedItems: LineItemPriceResult[] = [];
  const taxMap = new Map<number, TaxSummaryRate>();

  let subtotalPaise = 0;
  let lineDiscountPaise = 0;
  let taxablePaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let rawTotalPaise = 0;

  for (const line of lines) {
    // If order discount applies, combine discounts multiplicatively or apply to line
    // Per spec: line slab discount applies first, order discount is additional % on order
    const effectiveDiscountBp =
      orderDiscountBp > 0
        ? Math.min(
            10000,
            (line.discountBp ?? 0) +
              Math.round(((10000 - (line.discountBp ?? 0)) * orderDiscountBp) / 10000)
          )
        : (line.discountBp ?? 0);

    const computed = calculateLineGst({
      ...line,
      discountBp: effectiveDiscountBp,
    });

    computedItems.push(computed);

    const fullMrpTotal = line.mrpPaise * line.qty;
    subtotalPaise += fullMrpTotal;
    lineDiscountPaise += fullMrpTotal - computed.lineTotalPaise;
    taxablePaise += computed.taxablePaise;
    cgstPaise += computed.cgstPaise;
    sgstPaise += computed.sgstPaise;
    igstPaise += computed.igstPaise;
    rawTotalPaise += computed.lineTotalPaise;

    // Group into tax summary by rate
    const existing = taxMap.get(computed.gstRateBp) ?? {
      gstRateBp: computed.gstRateBp,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalTaxPaise: 0,
    };

    existing.taxablePaise += computed.taxablePaise;
    existing.cgstPaise += computed.cgstPaise;
    existing.sgstPaise += computed.sgstPaise;
    existing.igstPaise += computed.igstPaise;
    existing.totalTaxPaise += computed.taxPaise;
    taxMap.set(computed.gstRateBp, existing);
  }

  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;

  // Invoice round-off to nearest whole Rupee (multiple of 100 paise)
  const roundedTotalPaise = Math.round(rawTotalPaise / 100) * 100;
  const roundOffPaise = roundedTotalPaise - rawTotalPaise;

  return {
    items: computedItems,
    subtotalPaise,
    lineDiscountPaise,
    orderDiscountPaise: 0,
    netSubtotalPaise: rawTotalPaise,
    taxablePaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    rawTotalPaise,
    roundOffPaise,
    totalPaise: roundedTotalPaise,
    taxSummaryByRate: Array.from(taxMap.values()).sort((a, b) => a.gstRateBp - b.gstRateBp),
  };
}

/**
 * Format integer paise into Indian Rupee string (e.g. 125050 -> "₹1,250.50").
 */
export function formatPaiseToRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const remainderPaise = absPaise % 100;

  const formattedRupees = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(rupees);

  const formattedPaise = String(remainderPaise).padStart(2, "0");
  return `${sign}₹${formattedRupees}.${formattedPaise}`;
}

/**
 * Format basis points to percentage string (e.g. 1200 -> "12%", 550 -> "5.5%").
 */
export function formatBasisPoints(bp: number): string {
  const pct = bp / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}
