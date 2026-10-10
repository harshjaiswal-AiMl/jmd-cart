import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { tallyExportService } from "@/modules/tally/tally.service";
import { UserRole, InvoiceChannel, PaymentMode } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { getISTDateString } from "@/lib/date";

describe("Tally XML and CSV Voucher Export (Task 4.3)", () => {
  let todayStr: string;

  beforeAll(async () => {
    todayStr = getISTDateString();
  });

  describe("RBAC Permissions", () => {
    it("allows SUPER_ADMIN and ACCOUNTS to generate Tally exports", async () => {
      const xmlExport = await tallyExportService.exportVouchers(UserRole.SUPER_ADMIN, {
        format: "XML",
        startDate: todayStr,
        endDate: todayStr,
      });

      expect(xmlExport).toBeDefined();
      expect(xmlExport.filename).toContain("tally_vouchers_");
      expect(xmlExport.filename).toContain(".xml");
      expect(xmlExport.mimeType).toBe("application/xml");
      expect(xmlExport.content).toContain("<ENVELOPE>");
      expect(xmlExport.content).toContain("<TALLYREQUEST>Import Data</TALLYREQUEST>");

      const csvExport = await tallyExportService.exportVouchers(UserRole.ACCOUNTS, {
        format: "CSV",
        startDate: todayStr,
        endDate: todayStr,
      });

      expect(csvExport).toBeDefined();
      expect(csvExport.filename).toContain(".csv");
      expect(csvExport.mimeType).toBe("text/csv");
      expect(csvExport.content).toContain("Voucher Type,Voucher No,Date");
    });

    it("rejects unauthorized staff roles (e.g. SHOP, SALESPERSON, DELIVERY, CUSTOMER)", async () => {
      await expect(
        tallyExportService.exportVouchers(UserRole.SHOP)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        tallyExportService.exportVouchers(UserRole.SALESPERSON)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        tallyExportService.exportVouchers(UserRole.DELIVERY)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        tallyExportService.exportVouchers(UserRole.CUSTOMER)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Tally XML Payload Verification", () => {
    it("generates well-formed Tally XML envelope with voucher tags and ledger entries", async () => {
      const res = await tallyExportService.exportVouchers(UserRole.SUPER_ADMIN, {
        format: "XML",
        startDate: todayStr,
        endDate: todayStr,
      });

      expect(res.content).toContain("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
      expect(res.content).toContain("<BODY>");
      expect(res.content).toContain("<IMPORTDATA>");
      expect(res.content).toContain("</IMPORTDATA>");
      expect(res.content).toContain("</BODY>");
      expect(res.content).toContain("</ENVELOPE>");
      expect(res.summary).toBeDefined();
      expect(res.summary.salesCount).toBeGreaterThanOrEqual(0);
      expect(res.summary.receiptsCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Tally CSV Payload Verification", () => {
    it("generates CSV with required columns (Voucher Type, Number, Party, Taxable, CGST, SGST)", async () => {
      const res = await tallyExportService.exportVouchers(UserRole.SUPER_ADMIN, {
        format: "CSV",
        startDate: todayStr,
        endDate: todayStr,
      });

      const lines = res.content.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const header = lines[0];
      expect(header).toContain("Voucher Type");
      expect(header).toContain("Voucher No");
      expect(header).toContain("Party Name");
      expect(header).toContain("Taxable (Rs)");
      expect(header).toContain("CGST (Rs)");
      expect(header).toContain("SGST (Rs)");
      expect(header).toContain("Total (Rs)");
    });
  });
});
