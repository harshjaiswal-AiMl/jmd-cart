import { describe, it, expect } from "vitest";

// Enricher function representing the logic in stock-ledger.service.ts
export function enrichLedgerRow(
  movement: {
    id: string;
    createdAt: Date;
    referenceType: string | null;
    referenceId: string | null;
    reason: string | null;
    meta?: any;
    fromLocationName?: string;
    toLocationName?: string;
  },
  invoiceMap: Map<string, { number: string; partyName?: string | null; customerName?: string | null }>,
  grnMap: Map<string, { grnNumber?: string | null; billNo?: string | null; supplierName?: string | null }>
) {
  let referenceNumber: string | null = null;
  let partyOrDestination = "—";

  if (movement.referenceType?.toUpperCase() === "INVOICE" && movement.referenceId) {
    const inv = invoiceMap.get(movement.referenceId);
    if (inv) {
      referenceNumber = inv.number;
      partyOrDestination = inv.partyName || inv.customerName || "Walk-in Retail";
    }
  }

  if (
    (movement.referenceType?.toUpperCase() === "GRN" || movement.referenceType?.toUpperCase() === "PURCHASE") &&
    movement.referenceId
  ) {
    const g = grnMap.get(movement.referenceId);
    if (g) {
      referenceNumber = g.grnNumber || (g.billNo ? `Bill #${g.billNo}` : movement.referenceId);
      partyOrDestination = g.supplierName || "Supplier";
    }
  }

  // Fallback regex extraction from reason string
  if (!referenceNumber && movement.reason) {
    const invMatch = movement.reason.match(/Invoice\s*#([A-Za-z0-9\/\-_]+)/i);
    if (invMatch) {
      referenceNumber = invMatch[1];
    }
  }

  if (partyOrDestination === "—") {
    if (movement.meta?.partyName) {
      partyOrDestination = movement.meta.partyName;
    } else if (movement.meta?.supplierName) {
      partyOrDestination = movement.meta.supplierName;
    } else if (movement.toLocationName) {
      partyOrDestination = `To: ${movement.toLocationName}`;
    } else if (movement.fromLocationName) {
      partyOrDestination = `From: ${movement.fromLocationName}`;
    }
  }

  return {
    referenceNumber: referenceNumber || movement.referenceId || "—",
    partyOrDestination,
  };
}

describe("Prompt 27 - Part E: Stock Ledger Enrichment", () => {
  it("enriches invoice movements with human-readable invoice number and party name", () => {
    const invoiceMap = new Map([
      [
        "cmwamustu000wzzt12345",
        {
          number: "INV/26-27/000157",
          partyName: "Shree Krishna Store",
          customerName: null,
        },
      ],
    ]);
    const grnMap = new Map();

    const row = enrichLedgerRow(
      {
        id: "mov-1",
        createdAt: new Date("2026-11-18T10:00:00Z"),
        referenceType: "INVOICE",
        referenceId: "cmwamustu000wzzt12345",
        reason: "Invoice #INV/26-27/000157 (Cartons from Godown)",
      },
      invoiceMap,
      grnMap
    );

    expect(row.referenceNumber).toBe("INV/26-27/000157");
    expect(row.partyOrDestination).toBe("Shree Krishna Store");
  });

  it("extracts invoice number from reason if invoice map entry is missing", () => {
    const invoiceMap = new Map();
    const grnMap = new Map();

    const row = enrichLedgerRow(
      {
        id: "mov-2",
        createdAt: new Date("2026-11-18T10:00:00Z"),
        referenceType: "INVOICE",
        referenceId: "cmwamustu_unknown",
        reason: "Invoice #INV/26-27/000226 (Cartons from Godown)",
      },
      invoiceMap,
      grnMap
    );

    expect(row.referenceNumber).toBe("INV/26-27/000226");
  });

  it("enriches GRN movements with GRN number and supplier name", () => {
    const invoiceMap = new Map();
    const grnMap = new Map([
      [
        "grn-cuid-999",
        {
          grnNumber: "GRN-2026-0089",
          billNo: "BILL-5432",
          supplierName: "Haldiram Snacks Pvt Ltd",
        },
      ],
    ]);

    const row = enrichLedgerRow(
      {
        id: "mov-3",
        createdAt: new Date("2026-11-18T10:00:00Z"),
        referenceType: "GRN",
        referenceId: "grn-cuid-999",
        reason: "GRN receipt from Haldiram",
      },
      invoiceMap,
      grnMap
    );

    expect(row.referenceNumber).toBe("GRN-2026-0089");
    expect(row.partyOrDestination).toBe("Haldiram Snacks Pvt Ltd");
  });
});
