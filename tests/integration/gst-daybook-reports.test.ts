import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { reportsService } from "@/modules/reports/reports.service";
import { UserRole, InvoiceChannel } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { getISTDateString } from "@/lib/date";

describe("GST Reports, Day Book & Sales Register (Task 4.2)", () => {
  let todayStr: string;

  beforeAll(async () => {
    todayStr = getISTDateString();
  });

  describe("RBAC Access Security", () => {
    it("allows SUPER_ADMIN and ACCOUNTS to access GSTR-1 and Day Book", async () => {
      const gstr1 = await reportsService.getGstr1Report(UserRole.SUPER_ADMIN);
      expect(gstr1).toBeDefined();

      const dayBook = await reportsService.getDayBookReport(UserRole.ACCOUNTS, todayStr);
      expect(dayBook).toBeDefined();

      const salesRegister = await reportsService.getSalesRegisterReport(UserRole.SUPER_ADMIN);
      expect(salesRegister).toBeDefined();
    });

    it("denies access to unauthorized roles (e.g. SHOP, SALESPERSON, DELIVERY, CUSTOMER)", async () => {
      await expect(
        reportsService.getGstr1Report(UserRole.SHOP)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        reportsService.getDayBookReport(UserRole.SALESPERSON)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        reportsService.getSalesRegisterReport(UserRole.DELIVERY)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        reportsService.getGstr1Report(UserRole.CUSTOMER)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("GSTR-1 Outward Supplies Structure", () => {
    it("returns correct GSTR-1 tables (Table 4A B2B, Table 7 B2CS, Table 12 HSN Summary, and Rate Breakdown)", async () => {
      const gstr1 = await reportsService.getGstr1Report(UserRole.SUPER_ADMIN, todayStr.slice(0, 7));

      expect(gstr1.periodMonth).toBe(todayStr.slice(0, 7));
      expect(Array.isArray(gstr1.b2bInvoices)).toBe(true);
      expect(Array.isArray(gstr1.b2csSummary)).toBe(true);
      expect(Array.isArray(gstr1.hsnSummary)).toBe(true);
      expect(Array.isArray(gstr1.rateBreakdown)).toBe(true);

      expect(gstr1.totalTaxablePaise).toBeGreaterThanOrEqual(0);
      expect(gstr1.totalCgstPaise).toBeGreaterThanOrEqual(0);
      expect(gstr1.totalSgstPaise).toBeGreaterThanOrEqual(0);
      expect(gstr1.totalTaxPaise).toBe(gstr1.totalCgstPaise + gstr1.totalSgstPaise + gstr1.totalIgstPaise);
    });
  });

  describe("Day Book Accounting Register", () => {
    it("returns chronological entries with debit and credit balance in integer paise", async () => {
      const dayBook = await reportsService.getDayBookReport(UserRole.SUPER_ADMIN, todayStr);

      expect(dayBook.date).toBe(todayStr);
      expect(dayBook.totalDebitPaise).toBeGreaterThanOrEqual(0);
      expect(dayBook.totalCreditPaise).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(dayBook.entries)).toBe(true);
      expect(dayBook.entriesCount).toBe(dayBook.entries.length);

      if (dayBook.entries.length > 0) {
        const first = dayBook.entries[0];
        expect(first.voucherNo).toBeDefined();
        expect(first.voucherType).toBeDefined();
        expect(first.partyName).toBeDefined();
        expect(first.particulars).toBeDefined();
      }
    });
  });

  describe("Sales Register", () => {
    it("returns sales invoices ledger with GST split and round-off across date range", async () => {
      const register = await reportsService.getSalesRegisterReport(UserRole.SUPER_ADMIN, todayStr, todayStr);

      expect(register.startDate).toBe(todayStr);
      expect(register.endDate).toBe(todayStr);
      expect(Array.isArray(register.rows)).toBe(true);
      expect(register.totalInvoices).toBe(register.rows.length);
      expect(register.totalTaxablePaise).toBeGreaterThanOrEqual(0);
      expect(register.totalNetSalesPaise).toBeGreaterThanOrEqual(0);
    });
  });
});
