import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeWorkbookToBuffer } from "@/lib/xlsx";
import { brandSheetImportService } from "@/modules/catalog/import/brand-sheet-import.service";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";

describe("Part 2 — Brand Sheet Catalog & A/B/C Price Importer (SALONI, DAWAT, MDH)", () => {
  let adminUser: { id: string; role: UserRole };

  /**
   * Build the exact 3-sheet workbook fixture matching the client's real SALONI, DAWAT, and MDH sheets.
   */
  function buildClientWorkbookBuffer(): Buffer {
    return writeWorkbookToBuffer([
      {
        name: "SALONI",
        rows: [
          ["", "JAI MATA DI"],
          ["", "SAHARSA"],
          ["", "SALONI"],
          ["SL NO", "ITEMS", "QTY IN CASE", "MRP", "A", "B", "C"],
          [1, "Mustard OilPouch 1Ltr", 12, 225, 176.25, 177.25, 178],
          [2, "Mustard OilPouch 500ml", 24, 113, 88.23, 89.23, 89.5],
          [3, "Mustard Oil Bottle 1Ltr", 12, 230, 178.75, 179.75, 180.5],
          [4, "Mustard Oil Bottle 500ml", 24, 118, 90.21, 91.21, 91.75],
          [5, "Mustard Oil Bottle 200ml", 60, 51, 38.42, 39.42, 39.8],
          [6, "Mustard Oil Jar 2Ltr", 6, 469, 366.67, 368.34, 370],
          [7, "Mustard Oil Jar 5Ltr", 4, 1146, 910, 912.5, 915],
          [8, "Mustard OilJar 15Ltr", 1, 3365, 2600, 2610, 2620],
          [9, "Mustard Oil Tin 15Kg", 1, 3550, 2860, 2870, 2880],
        ],
      },
      {
        name: "DAWAT",
        rows: [
          ["", "JAI MATA DI"],
          ["", "SAHARSA"],
          ["", "DAWAT"],
          ["SL NO", "ITEMS", "WEIGHT", "QTY IN CASE", "MRP", "A", "B", "C"],
          [1, "Dawat Rozana Gold 26kg", "", 1, 0, 1890, 1900, 1910],
          [2, "Dawat Super 1kg", "", 20, 195, 152, 153, 155],
          [3, "Dawat Devaaya 1kg", "", 20, 100, 80, 81, 80], // B=81 > C=80 -> WARNING
          [4, "Dawat Pulav 1kg", "", 20, 130, 102, 103, 105],
        ],
      },
      {
        name: "MDH",
        rows: [
          ["", "JAI MATA DI"],
          ["", "SAHARSA"],
          ["", "MDH"],
          ["SL.NO", "ITEMS", "PCS", "MRP", "A", "B", "C"],
          [1, "Garam Masala 100gm", 100, 89, "22%", "21%", "20%"],
          [2, "Chana Masala 10gm", 25, 10, "22%", "21%", "20%"],
          [3, "Chana Masala 10g", 40, 10, "22%", "21%", "20%"], // duplicate normalized key -> NEEDS_REVIEW
          [4, "Chilli Powder (Kashmiri) 50 Gm", 100, 100, "22%", "21%", "20%"],
          [5, "Chilli Powder (Kashmiri) 50 Gm", 10, 98, "22%", "21%", "20%"],
          [6, "Chilli Powder (Kashmiri) 50 Gm", 200, 99, "22%", "21%", "20%"],
          [7, "Dhania Powder 100gm", 100, 50, "22%", "21%", "20%"],
          [8, "Dhania Powder 100gm", 100, 54, "22%", "21%", "20%"],
          [9, "Haldi Powder 200gm", 6, 2286.15, "22%", "21%", "20%"], // SUSPICIOUS MRP for 200gm
          [10, "MDH Mustard Oil 5ltr", 3308, 3308, "22%", "21%", "20%"], // SUSPICIOUS pcs == MRP
          [11, "Amchur Powder 100gm", 100, 0, "22%", "21%", "20%"], // MRP=0 in % mode -> ERROR
        ],
      },
    ]);
  }

  beforeEach(async () => {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (existingAdmin) {
      adminUser = { id: existingAdmin.id, role: existingAdmin.role };
    } else {
      const created = await prisma.user.create({
        data: {
          name: "Test Import Admin",
          phone: "9999900001",
          passwordHash: "hash",
          role: UserRole.SUPER_ADMIN,
        },
      });
      adminUser = { id: created.id, role: created.role };
    }
  });

  afterEach(async () => {
    await prisma.product.deleteMany({
      where: {
        company: {
          name: { in: ["SALONI", "DAWAT", "MDH"] },
        },
      },
    });
    await prisma.importBatch.deleteMany({
      where: { filename: "client_brand_sheets.xlsx" },
    });
    await prisma.company.deleteMany({
      where: { name: { in: ["SALONI", "DAWAT", "MDH"] } },
    });
  });

  it("1. parses SALONI (Absolute ₹), DAWAT (MRP=0 & B>C), and MDH (% off MRP, duplicates, suspicious, error) accurately", async () => {
    const buf = buildClientWorkbookBuffer();
    const preview = await brandSheetImportService.previewWorkbook(
      UserRole.SUPER_ADMIN,
      buf,
      "client_brand_sheets.xlsx"
    );

    expect(preview.sheets).toHaveLength(3);
    expect(preview.sheets[0]).toMatchObject({
      sheetName: "SALONI",
      detectedBrand: "SALONI",
      detectedMode: "ABSOLUTE",
      rowCount: 9,
    });
    expect(preview.sheets[1]).toMatchObject({
      sheetName: "DAWAT",
      detectedBrand: "DAWAT",
      detectedMode: "ABSOLUTE",
      rowCount: 4,
    });
    expect(preview.sheets[2]).toMatchObject({
      sheetName: "MDH",
      detectedBrand: "MDH",
      detectedMode: "PERCENT",
      rowCount: 11,
    });

    // Check SALONI row 1: Mustard OilPouch 1Ltr -> pcs=12, mrp=22500, A=17625, B=17725, C=17800
    const saloni1 = preview.rows.find((r) => r.rawItemName === "Mustard OilPouch 1Ltr")!;
    expect(saloni1).toBeDefined();
    expect(saloni1.packSize).toBe(12);
    expect(saloni1.mrpPaise).toBe(22500);
    expect(saloni1.priceAPaise).toBe(17625);
    expect(saloni1.priceBPaise).toBe(17725);
    expect(saloni1.priceCPaise).toBe(17800);
    expect(saloni1.status).toBe("OK");

    // Check DAWAT Rozana Gold 26kg: MRP=0 in Absolute mode -> WARNING, mrpPaise=null, A=189000
    const dawatRozana = preview.rows.find((r) => r.rawItemName.includes("Rozana Gold"))!;
    expect(dawatRozana.mrpPaise).toBeNull();
    expect(dawatRozana.priceAPaise).toBe(189000);
    expect(dawatRozana.priceBPaise).toBe(190000);
    expect(dawatRozana.priceCPaise).toBe(191000);
    expect(dawatRozana.status).toBe("WARNING");

    // Check DAWAT Devaaya 1kg: B=81 > C=80 -> WARNING
    const dawatDevaaya = preview.rows.find((r) => r.rawItemName.includes("Devaaya"))!;
    expect(dawatDevaaya.status).toBe("WARNING");
    expect(dawatDevaaya.messages.some((m) => m.includes("Price B") && m.includes("Price C"))).toBe(
      true
    );

    // Check MDH Garam Masala 100gm: MRP=89 at 22%/21%/20% -> 6942 / 7031 / 7120 paise
    const mdhGaram = preview.rows.find((r) => r.rawItemName === "Garam Masala 100gm")!;
    expect(mdhGaram.packSize).toBe(100);
    expect(mdhGaram.mrpPaise).toBe(8900);
    expect(mdhGaram.priceAPaise).toBe(6942);
    expect(mdhGaram.priceBPaise).toBe(7031);
    expect(mdhGaram.priceCPaise).toBe(7120);
    expect(mdhGaram.status).toBe("OK");

    // Check MDH duplicates: Chana Masala 10gm vs 10g, 3x Chilli Powder (Kashmiri) 50 Gm, 2x Dhania Powder 100gm
    const chanaRows = preview.rows.filter((r) => r.rawItemName.startsWith("Chana Masala"));
    expect(chanaRows).toHaveLength(2);
    expect(chanaRows.every((r) => r.status === "NEEDS_REVIEW")).toBe(true);

    const kashmiriRows = preview.rows.filter((r) =>
      r.rawItemName.includes("Chilli Powder (Kashmiri)")
    );
    expect(kashmiriRows).toHaveLength(3);
    expect(kashmiriRows.every((r) => r.status === "NEEDS_REVIEW")).toBe(true);

    // Check MDH suspicious rows: Haldi Powder 200gm (MRP 2286.15) and MDH Mustard Oil 5ltr (pcs 3308 == MRP 3308)
    const haldiRow = preview.rows.find((r) => r.rawItemName === "Haldi Powder 200gm")!;
    expect(haldiRow.status).toBe("SUSPICIOUS");

    const mdhOilRow = preview.rows.find((r) => r.rawItemName === "MDH Mustard Oil 5ltr")!;
    expect(mdhOilRow.status).toBe("SUSPICIOUS");

    // Check MDH MRP=0 in % mode -> ERROR
    const amchurRow = preview.rows.find((r) => r.rawItemName === "Amchur Powder 100gm")!;
    expect(amchurRow.status).toBe("ERROR");
  });

  it("2. blocks commit if SUSPICIOUS or ERROR rows are not resolved, and commits atomically once resolved", async () => {
    const buf = buildClientWorkbookBuffer();
    const preview = await brandSheetImportService.previewWorkbook(
      UserRole.SUPER_ADMIN,
      buf,
      "client_brand_sheets.xlsx"
    );

    // Unresolved ERROR / SUSPICIOUS should reject commit
    await expect(
      brandSheetImportService.commitImport(UserRole.SUPER_ADMIN, adminUser.id, {
        filename: preview.filename,
        rows: preview.rows,
      })
    ).rejects.toThrow();

    // Resolve suspicious & error rows (confirm suspicious, mark error row as importInactiveWithoutPrices)
    const resolvedRows = preview.rows.map((r) => ({
      ...r,
      suspiciousConfirmed: r.status === "SUSPICIOUS" ? true : r.suspiciousConfirmed,
      importInactiveWithoutPrices:
        r.status === "ERROR" ? true : r.importInactiveWithoutPrices,
    }));

    const commitRes = await brandSheetImportService.commitImport(
      UserRole.SUPER_ADMIN,
      adminUser.id,
      {
        filename: preview.filename,
        rows: resolvedRows,
      }
    );

    expect(commitRes.companiesCreated).toBe(3);
    expect(commitRes.productsCreated).toBe(24);
    expect(commitRes.rowsSkipped).toBe(0);

    // Re-importing the exact same sheet updates existing products (idempotent, 0 duplicates created)
    const secondPreview = await brandSheetImportService.previewWorkbook(
      UserRole.SUPER_ADMIN,
      buf,
      "client_brand_sheets.xlsx"
    );
    const secondResolved = secondPreview.rows.map((r) => ({
      ...r,
      suspiciousConfirmed: true,
      importInactiveWithoutPrices: r.status === "ERROR",
    }));

    const secondCommit = await brandSheetImportService.commitImport(
      UserRole.SUPER_ADMIN,
      adminUser.id,
      {
        filename: secondPreview.filename,
        rows: secondResolved,
      }
    );

    expect(secondCommit.companiesCreated).toBe(0);
    expect(secondCommit.productsUpdated).toBe(24);
    expect(secondCommit.productsCreated).toBe(0);
  });

  it("3. enforces RBAC so GODOWN role cannot access catalog/price importer", async () => {
    const buf = buildClientWorkbookBuffer();
    await expect(
      brandSheetImportService.previewWorkbook(
        UserRole.GODOWN,
        buf,
        "client_brand_sheets.xlsx"
      )
    ).rejects.toThrow(ForbiddenError);
  });
});
