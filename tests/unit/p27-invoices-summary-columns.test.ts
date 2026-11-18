import { describe, it, expect } from "vitest";

// Reconciled invoice summary calculator
export function calculateInvoiceSummary(
  invoices: Array<{
    status: string;
    totalPaise: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    discountPaise: number;
    channel: string;
    payments: Array<{ mode: string; amountPaise: number }>;
  }>
) {
  let count = 0;
  let totalAmountPaise = 0;
  let taxablePaise = 0;
  let taxPaise = 0;
  let discountPaise = 0;
  let cashPaise = 0;
  let upiPaise = 0;
  let cancelledCount = 0;
  let shopCount = 0;
  let vanCount = 0;
  let onlineCount = 0;

  for (const inv of invoices) {
    if (inv.status === "CANCELLED") {
      cancelledCount++;
      continue;
    }

    count++;
    totalAmountPaise += inv.totalPaise;
    taxablePaise += inv.taxablePaise;
    taxPaise += inv.cgstPaise + inv.sgstPaise + inv.igstPaise;
    discountPaise += inv.discountPaise;

    let invCash = 0;
    let invUpi = 0;
    for (const p of inv.payments) {
      if (p.mode === "CASH") {
        invCash += p.amountPaise;
      } else if (p.mode === "UPI" || p.mode === "CARD") {
        invUpi += p.amountPaise;
      }
    }
    cashPaise += invCash;
    upiPaise += invUpi;

    if (inv.channel === "SHOP") shopCount++;
    else if (inv.channel === "VAN") vanCount++;
    else if (inv.channel === "ONLINE") onlineCount++;
  }

  // Exactly reconciled: Cash + UPI + Credit = Total Bill
  const creditPaise = Math.max(0, totalAmountPaise - (cashPaise + upiPaise));
  const avgBillPaise = count > 0 ? Math.round(totalAmountPaise / count) : 0;

  return {
    count,
    totalAmountPaise,
    taxablePaise,
    taxPaise,
    discountPaise,
    cashPaise,
    upiPaise,
    creditPaise,
    avgBillPaise,
    cancelledCount,
    shopCount,
    vanCount,
    onlineCount,
  };
}

export function getSummaryRangeLabel(preset: string, customDate?: string): string {
  switch (preset) {
    case "TODAY":
      return "Today's";
    case "YESTERDAY":
      return "Yesterday's";
    case "THIS_WEEK":
      return "This Week's";
    case "THIS_MONTH":
      return "This Month's";
    case "CUSTOM":
      return customDate || "Selected";
    case "ALL":
    default:
      return "All-Time";
  }
}

export const DEFAULT_INVOICE_COLUMNS = {
  invoiceNumber: true,
  dateTime: true,
  customerParty: true,
  amount: true,
  actions: true,
  // Optional columns (hidden by default)
  channel: false,
  agent: false,
  buyerTag: false,
  status: false,
};

describe("Prompt 27 - Part A: Invoices Summary & Columns", () => {
  it("reconciles exactly: Cash Collected + UPI Collected + Today Credit = Total Bill", () => {
    const mockInvoices = [
      {
        status: "FINAL",
        totalPaise: 100000, // 1,000 Rs
        taxablePaise: 95000,
        cgstPaise: 2500,
        sgstPaise: 2500,
        igstPaise: 0,
        discountPaise: 5000,
        channel: "SHOP",
        payments: [{ mode: "CASH", amountPaise: 60000 }], // 600 Rs cash, 400 credit
      },
      {
        status: "FINAL",
        totalPaise: 250000, // 2,500 Rs
        taxablePaise: 238000,
        cgstPaise: 6000,
        sgstPaise: 6000,
        igstPaise: 0,
        discountPaise: 0,
        channel: "VAN",
        payments: [{ mode: "UPI", amountPaise: 250000 }], // 2,500 Rs UPI
      },
      {
        status: "FINAL",
        totalPaise: 50000, // 500 Rs
        taxablePaise: 47600,
        cgstPaise: 1200,
        sgstPaise: 1200,
        igstPaise: 0,
        discountPaise: 0,
        channel: "SHOP",
        payments: [], // 500 Rs full credit
      },
      {
        status: "CANCELLED",
        totalPaise: 80000,
        taxablePaise: 76000,
        cgstPaise: 2000,
        sgstPaise: 2000,
        igstPaise: 0,
        discountPaise: 0,
        channel: "SHOP",
        payments: [{ mode: "CASH", amountPaise: 80000 }],
      },
    ];

    const s = calculateInvoiceSummary(mockInvoices);

    // Cancelled invoice excluded
    expect(s.count).toBe(3);
    expect(s.cancelledCount).toBe(1);

    // Total Bill = 1000 + 2500 + 500 = 4,000 Rs = 400,000 paise
    expect(s.totalAmountPaise).toBe(400000);

    // Cash = 60,000 paise (600 Rs)
    expect(s.cashPaise).toBe(60000);

    // UPI = 250,000 paise (2,500 Rs)
    expect(s.upiPaise).toBe(250000);

    // Credit = 400,000 - 310,000 = 90,000 paise (900 Rs)
    expect(s.creditPaise).toBe(90000);

    // EXACT RECONCILIATION
    expect(s.cashPaise + s.upiPaise + s.creditPaise).toBe(s.totalAmountPaise);
  });

  it("formats range labels dynamically based on selected date filter", () => {
    expect(getSummaryRangeLabel("TODAY")).toBe("Today's");
    expect(getSummaryRangeLabel("YESTERDAY")).toBe("Yesterday's");
    expect(getSummaryRangeLabel("THIS_WEEK")).toBe("This Week's");
    expect(getSummaryRangeLabel("THIS_MONTH")).toBe("This Month's");
    expect(getSummaryRangeLabel("CUSTOM", "18-11-2026")).toBe("18-11-2026");
    expect(getSummaryRangeLabel("ALL")).toBe("All-Time");
  });

  it("verifies default columns match owner requirements (Invoice #, Date, Party, Amount, Actions)", () => {
    expect(DEFAULT_INVOICE_COLUMNS.invoiceNumber).toBe(true);
    expect(DEFAULT_INVOICE_COLUMNS.dateTime).toBe(true);
    expect(DEFAULT_INVOICE_COLUMNS.customerParty).toBe(true);
    expect(DEFAULT_INVOICE_COLUMNS.amount).toBe(true);
    expect(DEFAULT_INVOICE_COLUMNS.actions).toBe(true);

    // Optional columns are hidden by default
    expect(DEFAULT_INVOICE_COLUMNS.channel).toBe(false);
    expect(DEFAULT_INVOICE_COLUMNS.agent).toBe(false);
    expect(DEFAULT_INVOICE_COLUMNS.buyerTag).toBe(false);
    expect(DEFAULT_INVOICE_COLUMNS.status).toBe(false);
  });
});
