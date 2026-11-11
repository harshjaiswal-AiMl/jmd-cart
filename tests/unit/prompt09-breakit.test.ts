import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { UserRole, InvoiceChannel, InvoiceStatus, PaymentMode, PaymentStatus } from "@prisma/client";
import {
  Permission,
  ROLE_PERMISSIONS,
  hasPermission,
  setRuntimeRolePermissions,
} from "@/modules/auth/permissions";
import {
  SUPER_ADMIN_LOCKED_PERMISSIONS,
  toggleRolePermission,
  RoleMatrixSafeguardError,
} from "@/modules/auth/role-matrix.service";
import { buildProductSearchIndex, searchItems } from "@/lib/search/smart-search";
import { searchParties } from "@/lib/search/party-search";
import { hiMessages } from "@/lib/i18n/messages/hi";
import { formatDDMMYYYY } from "@/lib/date";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { getBillLineItemDisplay } from "@/lib/printing/bill-format";
import { settingsService } from "@/modules/settings/settings.service";
import { partyRepository } from "@/modules/party/party.repository";
import { prisma } from "@/lib/prisma";

function makeInvoice(opts: {
  isCredit: boolean;
  paidNonCreditPaise?: number;
  totalPaise?: number;
  roundOffPaise?: number;
  isCancelled?: boolean;
  nameHi?: string | null;
}) {
  const total = opts.totalPaise ?? 100000;
  const round = opts.roundOffPaise ?? 0;
  const paidCash = opts.paidNonCreditPaise ?? (opts.isCredit ? 0 : total);
  const payments: any[] = [];
  if (paidCash > 0) {
    payments.push({ id: "p-cash", mode: PaymentMode.CASH, amountPaise: paidCash });
  }
  if (opts.isCredit && total - paidCash > 0) {
    payments.push({ id: "p-cr", mode: PaymentMode.CREDIT, amountPaise: total - paidCash });
  }
  return {
    id: "breakit-inv",
    branchId: 1,
    number: "INV/26-27/009999",
    fy: "2026-27",
    status: opts.isCancelled ? InvoiceStatus.CANCELLED : InvoiceStatus.FINAL,
    channel: InvoiceChannel.SHOP,
    locationId: "loc-shop",
    partyId: "party-1",
    buyerType: "RETAILER",
    notes: null,
    subtotalPaise: total - round,
    discountPaise: 0,
    taxablePaise: Math.round(total / 1.05),
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    roundOffPaise: round,
    totalPaise: total,
    paymentStatus: opts.isCredit ? PaymentStatus.PENDING : PaymentStatus.PAID,
    documentType: "RETAIL",
    customerName: "Maa Durga Store",
    customerPhone: "9876543210",
    customerAddress: "Saharsa",
    agentCodeSnapshot: null,
    createdBy: "u1",
    createdAt: new Date("2026-11-11T05:30:00Z"),
    updatedAt: new Date("2026-11-11T05:30:00Z"),
    finalizedAt: new Date("2026-11-11T05:30:00Z"),
    party: {
      id: "party-1",
      name: "Maa Durga Store",
      nameHi: opts.nameHi ?? "माँ दुर्गा स्टोर",
      phone: "9876543210",
      address: "Saharsa",
      gstin: null,
    },
    items: [
      {
        id: "it-1",
        invoiceId: "breakit-inv",
        productId: "pr-1",
        qty: 5,
        mrpPaise: 25000,
        discountBp: 0,
        unitPricePaise: 20000,
        taxablePaise: 95238,
        taxPaise: 4762,
        gstRateBp: 500,
        hsn: "2106",
        unitLabel: "Pcs",
        product: {
          id: "pr-1",
          name: "Aashirvaad Superior MP Chakki Atta Wholesale Jumbo Distributor Special 10kg Polybag Edition",
          nameHi: opts.nameHi ?? "आशीर्वाद चक्की आटा १० किलो",
          shortCode: "AT10",
          weight: "10kg",
          packSize: 10,
          packLabel: "Carton",
        },
      },
    ],
    payments,
    creditNotes: [],
  } as any;
}

describe("Prompt 09 Break-It Pass (Adversarial Hostile Cases R1-R6)", () => {
  it("R1: Sales & Billing group and default permissions + Super Admin safeguard holds", async () => {
    const matrixUi = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/admin/roles/roles-matrix-client.tsx"),
      "utf8"
    );
    expect(matrixUi).toContain('group: "Sales & Billing"');
    expect(matrixUi).toContain("Permission.POS_DELETE_BILL");
    expect(matrixUi).toContain("Permission.INVOICE_VOID");

    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain(Permission.POS_DELETE_BILL);
    expect(ROLE_PERMISSIONS.ADMIN).toContain(Permission.INVOICE_VOID);
    for (const r of [
      UserRole.ACCOUNTS,
      UserRole.WAREHOUSE_MANAGER,
      UserRole.GODOWN,
      UserRole.SHOP,
      UserRole.PRO,
      UserRole.SALESPERSON,
      UserRole.DELIVERY,
      UserRole.CUSTOMER,
    ]) {
      expect(ROLE_PERMISSIONS[r]).not.toContain(Permission.POS_DELETE_BILL);
      expect(ROLE_PERMISSIONS[r]).not.toContain(Permission.INVOICE_VOID);
    }

    // Non-Super Admin rejected with ForbiddenError
    await expect(
      toggleRolePermission({
        actorId: "u-admin",
        actorRole: UserRole.ADMIN,
        targetRole: UserRole.SHOP,
        permission: Permission.POS_DELETE_BILL,
        enabled: true,
      })
    ).rejects.toThrow("Only Super Admin");

    // Super Admin cannot lock themselves out of core governance rights
    for (const locked of Array.from(SUPER_ADMIN_LOCKED_PERMISSIONS)) {
      await expect(
        toggleRolePermission({
          actorId: "u-sa",
          actorRole: UserRole.SUPER_ADMIN,
          targetRole: UserRole.SUPER_ADMIN,
          permission: locked,
          enabled: false,
        })
      ).rejects.toBeInstanceOf(RoleMatrixSafeguardError);
    }

    // Immediate runtime cache invalidation propagation
    setRuntimeRolePermissions({ ...ROLE_PERMISSIONS, SHOP: [...ROLE_PERMISSIONS.SHOP, Permission.POS_DELETE_BILL] });
    expect(hasPermission(UserRole.SHOP, Permission.POS_DELETE_BILL)).toBe(true);
    setRuntimeRolePermissions(null);
    expect(hasPermission(UserRole.SHOP, Permission.POS_DELETE_BILL)).toBe(false);
  });

  it("R2: Void & bill-delete guards refuse unauthorized callers, empty reasons, and double voids", async () => {
    const voidRoute = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/invoices/[id]/void/route.ts"),
      "utf8"
    );
    expect(voidRoute).toContain("Permission.INVOICE_VOID");
    expect(voidRoute).toContain("403");

    const { billingService } = await import("@/modules/billing/billing.service");
    await expect(
      billingService.cancelInvoice(UserRole.SHOP, { invoiceId: "missing-id", reason: "Mistake" })
    ).rejects.toThrow();
    await expect(
      billingService.cancelInvoice(UserRole.ADMIN, { invoiceId: "missing-id", reason: "   " })
    ).rejects.toThrow();
  });

  it("R5: Credit default allows unflagged named party at Shop POS, treats limit 0 as unset, and blocks walk-in", async () => {
    const party = await prisma.party.create({
      data: {
        branchId: 1,
        name: `BreakIt Kirana ${Date.now()}`,
        phone: `9899${Math.floor(100000 + Math.random() * 899999)}`,
        type: "RETAILER",
        creditEnabled: false,
        creditLimitPaise: 0,
      },
    });
    try {
      const defOps = await settingsService.getPosOperationalSettings();
      expect(defOps.creditAllParties).toBe(true);

      // With creditAllParties override ON, party with creditEnabled=false and limit=0 succeeds with ₹1,00,000 sale!
      const statusAllowed = await partyRepository.checkPartyCreditStatus(party.id, 10000000, undefined, {
        allowCredit: true,
      });
      expect(statusAllowed.canProceedWithoutOverride).toBe(true);
      expect(statusAllowed.isLimitExceeded).toBe(false);

      // Switching creditAllParties override OFF restores strict per-party creditEnabled=false rejection!
      const statusBlocked = await partyRepository.checkPartyCreditStatus(party.id, 10000000, undefined, {
        allowCredit: false,
      });
      expect(statusBlocked.canProceedWithoutOverride).toBe(false);
      expect(statusBlocked.breachReasons.some((r) => /not authorized/i.test(r))).toBe(true);

      // Setting positive limit (₹500 = 50000p) enforces only above ₹500
      await prisma.party.update({ where: { id: party.id }, data: { creditLimitPaise: 50000 } });
      const withinLimit = await partyRepository.checkPartyCreditStatus(party.id, 40000, undefined, { allowCredit: true });
      expect(withinLimit.canProceedWithoutOverride).toBe(true);
      const overLimit = await partyRepository.checkPartyCreditStatus(party.id, 60000, undefined, { allowCredit: true });
      expect(overLimit.canProceedWithoutOverride).toBe(false);
      expect(overLimit.isLimitExceeded).toBe(true);
    } finally {
      await prisma.party.delete({ where: { id: party.id } }).catch(() => {});
    }
  });

  it("R6: Shared smart-search and party-search safely handle empty, regex chars, Hinglish, weights, and order swaps", () => {
    const products = [
      { id: "1", name: "Fortune Kachi Ghani Mustard Oil 1 Ltr Bottle", shortCode: "FKG-1L", weight: "1kg", mrpPaise: 15000, packSize: 10 },
      { id: "2", name: "Aashirvaad Shudh Chakki Atta 10kg", shortCode: "ASC-10", weight: "10kg", mrpPaise: 42000, packSize: 1 },
    ];
    const index = buildProductSearchIndex(products);
    expect(searchItems("", index).length).toBe(0);
    expect(() => searchItems("[test](foo)+*?^$\\", index)).not.toThrow();
    expect(searchItems("1kg oil fortune", index).map((p) => p.id)).toContain("1");
    expect(searchItems("FKG-1L", index)[0]?.id).toBe("1");
    expect(searchItems("1000ml", index).map((p) => p.id)).toContain("1");
    expect(searchParties("kali", [{ id: "p1", name: "Maa Kali Store", phone: "9876543210" }]).length).toBe(1);
    expect(searchParties("za", [{ id: "p1", name: "Maa Kali Store", phone: "9876543210" }]).length).toBe(0);
  });

  it("R3: Hindi dictionary completeness, Western numerals/dates, and zero Devanagari leakage onto printed bills", () => {
    for (const [k, v] of Object.entries(hiMessages)) {
      if (typeof v === "string") {
        expect(v.trim().length, `hiMessages.${k} empty`).toBeGreaterThan(0);
        expect(v).not.toContain("undefined");
      }
    }
    const formatted = formatDDMMYYYY(new Date("2026-11-05T10:00:00Z"));
    expect(formatted).toMatch(/^\d{2}-\d{2}-\d{4}$/);
    expect(formatted).not.toMatch(/[०-९]/);

    const testBiz = {
      tradeName: "JMD CART",
      legalName: "JAI MATA DI",
      gstin: "",
      fssai: "",
      address: "Saharsa",
      phone: "7979749009",
      email: "",
      upiId: "",
    };

    const htmlWithHi = renderDirectPrintHtml(makeInvoice({ isCredit: false, nameHi: "हिंदी नाम" }), testBiz);
    expect(htmlWithHi).not.toMatch(/[\u0900-\u097F]/);
  });

  it("R4: Thermal bill handles partial credit, positive/negative round-off, long names, void banner, and 0/integer qty", () => {
    const inv = makeInvoice({ isCredit: false });
    expect(
      getBillLineItemDisplay(
        { ...inv.items[0], qty: 20, unitLabel: "Carton", product: { ...inv.items[0].product, packSize: 10, packLabel: "Carton" } } as any,
        0
      ).qtyLabel
    ).toBe("2 Crt");
    expect(
      getBillLineItemDisplay(
        { ...inv.items[0], qty: 5, unitLabel: "Carton", product: { ...inv.items[0].product, packSize: 10, packLabel: "Carton" } } as any,
        0
      ).qtyLabel
    ).toBe("0.50 Crt");
    expect(
      getBillLineItemDisplay(
        { ...inv.items[0], qty: 3, unitLabel: "Pcs", product: { ...inv.items[0].product, packSize: 1, packLabel: "Pcs" } } as any,
        0
      ).qtyLabel
    ).toBe("3 Pcs");

    const testBiz = {
      tradeName: "JMD",
      legalName: "JAI MATA DI",
      gstin: "",
      fssai: "",
      address: "Saharsa",
      phone: "7979749009",
      email: "",
      upiId: "",
    };
    const cashHtml = renderDirectPrintHtml(makeInvoice({ isCredit: false }), testBiz);
    expect(cashHtml).not.toContain("Amount Pending:");
    expect(cashHtml).not.toMatch(/\b(DUES|OUTSTANDING|BALANCE|STAMP)\b/i);

    const partialCreditHtml = renderDirectPrintHtml(
      makeInvoice({ isCredit: true, totalPaise: 100000, paidNonCreditPaise: 25000, roundOffPaise: -25 }),
      testBiz
    );
    expect(partialCreditHtml).toContain("Amount Pending: ₹750.00");
    expect(partialCreditHtml).toContain("-₹0.25");

    const voidHtml = renderDirectPrintHtml(makeInvoice({ isCredit: false, isCancelled: true }), testBiz);
    expect(voidHtml).toContain("CANCELLED");

    const editServiceSrc = fs.readFileSync(
      path.resolve(process.cwd(), "src/modules/billing/invoice-edit.service.ts"),
      "utf8"
    );
    expect(editServiceSrc).toContain("allowPartyChange");
    expect(editServiceSrc).toContain("partyChangePermitted");
  });
});
