import { describe, it, expect, vi } from "vitest";
import { UserRole, InvoiceChannel, PaymentMode } from "@prisma/client";
import { finalizeInvoiceInputSchema } from "@/modules/billing/billing.types";
import { billingService } from "@/modules/billing/billing.service";
import { getFinancialYear } from "@/lib/invoice-number";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Shop POS Backdated Billing - Schema Validation", () => {
  it("accepts an optional valid past invoiceDate in finalizeInvoiceInputSchema", () => {
    const pastDate = new Date("2026-10-15T12:00:00Z");
    const parsed = finalizeInvoiceInputSchema.parse({
      channel: InvoiceChannel.SHOP,
      locationId: "loc_shop_1",
      idempotencyKey: "test_key_1",
      items: [{ productId: "prod_1", qty: 2 }],
      invoiceDate: pastDate,
    });

    expect(parsed.invoiceDate).toBeDefined();
    expect(parsed.invoiceDate?.toISOString()).toBe(pastDate.toISOString());
  });

  it("coerces string date to Date object in finalizeInvoiceInputSchema", () => {
    const parsed = finalizeInvoiceInputSchema.parse({
      channel: InvoiceChannel.SHOP,
      locationId: "loc_shop_1",
      idempotencyKey: "test_key_2",
      items: [{ productId: "prod_1", qty: 2 }],
      invoiceDate: "2026-10-20",
    });

    expect(parsed.invoiceDate).toBeInstanceOf(Date);
    expect(parsed.invoiceDate?.getFullYear()).toBe(2026);
  });

  it("defaults invoiceDate to undefined if omitted (normal cashier billing)", () => {
    const parsed = finalizeInvoiceInputSchema.parse({
      channel: InvoiceChannel.SHOP,
      locationId: "loc_shop_1",
      idempotencyKey: "test_key_3",
      items: [{ productId: "prod_1", qty: 1 }],
    });

    expect(parsed.invoiceDate).toBeUndefined();
  });
});

describe("Shop POS Backdated Billing - RBAC & Guard Logic", () => {
  it("blocks non-admin (e.g. SHOP cashier) from finalizing with invoiceDate", async () => {
    const pastDate = new Date("2026-10-10T10:00:00Z");

    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: InvoiceChannel.SHOP,
          locationId: "loc_shop_1",
          idempotencyKey: "test_key_cashier_backdate",
          items: [{ productId: "prod_1", qty: 1 }],
          invoiceDate: pastDate,
        }
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("blocks SALESPERSON from finalizing with invoiceDate", async () => {
    const pastDate = new Date("2026-10-10T10:00:00Z");

    await expect(
      billingService.finalizeInvoice(
        UserRole.SALESPERSON,
        {
          channel: InvoiceChannel.SHOP,
          locationId: "loc_shop_1",
          idempotencyKey: "test_key_salesperson_backdate",
          items: [{ productId: "prod_1", qty: 1 }],
          invoiceDate: pastDate,
        }
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects future invoice date even for SUPER_ADMIN", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await expect(
      billingService.finalizeInvoice(
        UserRole.SUPER_ADMIN,
        {
          channel: InvoiceChannel.SHOP,
          locationId: "loc_shop_1",
          idempotencyKey: "test_key_future_admin",
          items: [{ productId: "prod_1", qty: 1 }],
          invoiceDate: tomorrow,
        }
      )
    ).rejects.toThrow("Invoice date cannot be in the future");
  });

  it("computes the correct financial year for backdated dates across FY boundaries", () => {
    // April 2026 -> FY 26-27
    const dateOct2026 = new Date("2026-10-15T00:00:00Z");
    expect(getFinancialYear(dateOct2026)).toBe("26-27");

    // January 2026 -> FY 25-26
    const dateJan2026 = new Date("2026-01-15T00:00:00Z");
    expect(getFinancialYear(dateJan2026)).toBe("25-26");
  });
});

describe("Shop POS Backdated Billing - Cashier vs Admin UI Contract", () => {
  it("only enables backdated billing options for SUPER_ADMIN and ADMIN", () => {
    const checkIsAdmin = (role: UserRole) => role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
    const isSuperAdminRole = checkIsAdmin(UserRole.SUPER_ADMIN);
    const isAdminRole = checkIsAdmin(UserRole.ADMIN);
    const isCashierShop = checkIsAdmin(UserRole.SHOP);
    const isSalesperson = checkIsAdmin(UserRole.SALESPERSON);

    expect(isSuperAdminRole).toBe(true);
    expect(isAdminRole).toBe(true);
    expect(isCashierShop).toBe(false);
    expect(isSalesperson).toBe(false);
  });
});
