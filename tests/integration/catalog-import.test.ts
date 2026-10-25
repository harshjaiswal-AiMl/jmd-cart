import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { catalogImportService } from "@/modules/catalog/import/import.service";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

describe("Task 1.5: Catalog CSV Import & Idempotency", () => {
  let adminUser: { id: string; role: UserRole };

  beforeEach(async () => {
    adminUser = await prisma.user.findUniqueOrThrow({
      where: { phone: "9876543210" },
      select: { id: true, role: true },
    });
  });

  afterAll(async () => {
    // Clean up all imported fixture products
    await prisma.auditLog.deleteMany({
      where: { action: "CATALOG_CSV_IMPORTED" },
    });
    await prisma.product.deleteMany({
      where: { shortCode: { startsWith: "FIX-" } },
    });
    await prisma.product.deleteMany({
      where: { shortCode: { in: ["TEST-IMP-01", "TEST-IMP-02", "TEST-DUP-01", "TEST-ERR-OK"] } },
    });
  });

  describe("Basic CSV Import & Automatic Taxonomy Creation", () => {
    it("should parse valid CSV, create new company/category, and upsert products", async () => {
      const csv = `name,shortCode,company,category,hsn,gstRate,mrp,packSize,packLabel,reorderLevel
"Tata Tea Gold 250g",TEST-IMP-01,"Tata Consumer","Tea & Beverages",09024020,5,150,24,Carton,48
"Tata Salt 1kg",TEST-IMP-02,"Tata Consumer","Essentials",25010010,0,28,30,Bag,60`;

      const result = await catalogImportService.importCsv(
        adminUser.role,
        adminUser.id,
        csv
      );

      expect(result.totalRows).toBe(2);
      expect(result.importedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.errors.length).toBe(0);

      // Verify DB records
      const tea = await prisma.product.findUniqueOrThrow({
        where: { shortCode: "TEST-IMP-01" },
        include: { company: true, category: true },
      });
      expect(tea.name).toBe("Tata Tea Gold 250g");
      expect(tea.company?.name).toBe("Tata Consumer");
      expect(tea.category?.name).toBe("Tea & Beverages");
      expect(tea.mrpPaise).toBe(15000);
      expect(tea.gstRateBp).toBe(500);
      expect(tea.packSize).toBe(24);
    });
  });

  describe("Row-Level Error Diagnosis", () => {
    it("should capture and report row-level errors with exact row numbers and field names", async () => {
      const csvWithErrors = `name,shortCode,company,category,hsn,gstRate,mrp,packSize
"Valid Item",TEST-ERR-OK,Bikaji,Snacks,21069099,12,100,10
"",TEST-ERR-02,Bikaji,Snacks,21069099,12,100,10
"Invalid HSN Item",TEST-ERR-03,Bikaji,Snacks,99,12,100,10
"Invalid GST Item",TEST-ERR-04,Bikaji,Snacks,21069099,15,100,10
"Negative MRP Item",TEST-ERR-05,Bikaji,Snacks,21069099,12,-50,10
"Zero Pack Size Item",TEST-ERR-06,Bikaji,Snacks,21069099,12,100,0`;

      const result = await catalogImportService.importCsv(
        adminUser.role,
        adminUser.id,
        csvWithErrors
      );

      expect(result.totalRows).toBe(6);
      expect(result.importedCount).toBe(1); // Only the 1 valid item
      expect(result.failedCount).toBe(5); // 5 rows failed

      // Check specific row errors
      const row2Err = result.errors.find((e) => e.rowNumber === 3 && e.field === "name");
      expect(row2Err).toBeDefined();

      const row3Err = result.errors.find((e) => e.rowNumber === 4 && e.field === "hsn");
      expect(row3Err).toBeDefined();

      const row4Err = result.errors.find((e) => e.rowNumber === 5 && e.field === "gstRate");
      expect(row4Err).toBeDefined();

      const row5Err = result.errors.find((e) => e.rowNumber === 6 && e.field === "mrp");
      expect(row5Err).toBeDefined();

      const row6Err = result.errors.find((e) => e.rowNumber === 7 && e.field === "packSize");
      expect(row6Err).toBeDefined();
    });
  });

  describe("Idempotent Re-Run", () => {
    it("should update existing products on re-run instead of crashing or duplicating", async () => {
      const initialCsv = `name,shortCode,company,category,hsn,gstRate,mrp,packSize
"Parle-G 100g",TEST-DUP-01,Parle,Biscuits,19053100,18,10,24`;

      const firstRun = await catalogImportService.importCsv(
        adminUser.role,
        adminUser.id,
        initialCsv
      );
      expect(firstRun.importedCount).toBe(1);
      expect(firstRun.updatedCount).toBe(0);

      // Second run with updated price (MRP 12 instead of 10)
      const secondCsv = `name,shortCode,company,category,hsn,gstRate,mrp,packSize
"Parle-G 100g Premium",TEST-DUP-01,Parle,Biscuits,19053100,18,12,24`;

      const secondRun = await catalogImportService.importCsv(
        adminUser.role,
        adminUser.id,
        secondCsv
      );
      expect(secondRun.importedCount).toBe(0);
      expect(secondRun.updatedCount).toBe(1);
      expect(secondRun.failedCount).toBe(0);

      // Verify updated values in DB
      const updatedProd = await prisma.product.findUniqueOrThrow({
        where: { shortCode: "TEST-DUP-01" },
      });
      expect(updatedProd.name).toBe("Parle-G 100g Premium");
      expect(updatedProd.mrpPaise).toBe(1200); // Updated to Rs 12.00
    });
  });

  describe("900-Row Fixture Benchmark", () => {
    it("should import 900 rows in under 30 seconds (acceptance criteria)", async () => {
      const fixturePath = path.join(process.cwd(), "tests/fixtures/catalog-900-rows.csv");
      expect(fs.existsSync(fixturePath)).toBe(true);

      const content = fs.readFileSync(fixturePath, "utf-8");

      const result = await catalogImportService.importCsv(
        adminUser.role,
        adminUser.id,
        content
      );

      expect(result.totalRows).toBe(900);
      expect(result.importedCount).toBe(900);
      expect(result.failedCount).toBe(0);
      expect(result.durationMs).toBeLessThan(30000); // acceptance criteria: < 30 seconds

      console.log(`[Benchmark] 900 rows imported in ${result.durationMs}ms`);

      // Verify count in DB
      const count = await prisma.product.count({
        where: { shortCode: { startsWith: "FIX-" } },
      });
      expect(count).toBe(900);
    });
  });
});
