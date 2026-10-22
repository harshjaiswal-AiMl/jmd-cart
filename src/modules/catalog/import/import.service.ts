import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "./csv-parser";
import { ImportResult, RowError, ParsedCatalogRow } from "./import.types";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { auditService } from "@/modules/audit/audit.service";
import { ensureSupplierParty } from "@/modules/party/party.service";
import { ALLOWED_GST_RATES_BP } from "../catalog.types";

export class CatalogImportService {
  /**
   * Import products from CSV text with row-level error reporting and idempotent re-runs.
   */
  async importCsv(
    actorRole: UserRole,
    actorId: string,
    csvContent: string,
    ip?: string
  ): Promise<ImportResult> {
    assertPermission(actorRole, Permission.IMPORT_PRODUCTS);

    const startTime = Date.now();
    const { rows } = parseCsv(csvContent);

    if (rows.length === 0) {
      return {
        totalRows: 0,
        importedCount: 0,
        updatedCount: 0,
        failedCount: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    // 1. Preload and cache existing Companies and Categories
    const [companiesList, categoriesList] = await Promise.all([
      prisma.company.findMany(),
      prisma.category.findMany(),
    ]);

    const companyMap = new Map<string, string>(
      companiesList.map((c) => [c.name.trim().toLowerCase(), c.id])
    );
    const categoryMap = new Map<string, string>(
      categoriesList.map((c) => [c.name.trim().toLowerCase(), c.id])
    );

    // 2. Validate rows and parse data
    const validRows: { rowNumber: number; parsed: ParsedCatalogRow }[] = [];
    const errors: RowError[] = [];

    // Track short codes inside this import to detect in-file duplicates
    const seenShortCodes = new Set<string>();

    for (const rawRow of rows) {
      const { rowNumber, data } = rawRow;
      const rowErrors: RowError[] = [];

      // Validate Name
      const name = data.name?.trim();
      if (!name || name.length < 2) {
        rowErrors.push({
          rowNumber,
          field: "name",
          value: name,
          message: "Product name is required (minimum 2 characters)",
        });
      }

      // Validate or generate Short Code
      let shortCode = data.shortCode?.trim().toUpperCase();
      if (!shortCode && name) {
        shortCode = this.generateShortCode(data.company?.trim(), name);
      }

      if (!shortCode || shortCode.length < 2) {
        rowErrors.push({
          rowNumber,
          field: "shortCode",
          value: shortCode,
          message: "Short code must be at least 2 alphanumeric characters",
        });
      } else if (seenShortCodes.has(shortCode)) {
        rowErrors.push({
          rowNumber,
          field: "shortCode",
          value: shortCode,
          message: `Duplicate short code '${shortCode}' found within the import file`,
        });
      } else {
        seenShortCodes.add(shortCode);
      }

      // Validate HSN Code
      const hsn = data.hsn?.trim();
      if (!hsn || !/^[0-9]{4,8}$/.test(hsn)) {
        rowErrors.push({
          rowNumber,
          field: "hsn",
          value: hsn,
          message: "HSN code must be 4 to 8 numeric digits",
        });
      }

      // Validate GST Rate (accepts 5, 12, 18, 28 or 500, 1200, 1800, 2800)
      const rawGst = data.gstRate?.replace(/%/g, "").trim();
      const gstNum = Number(rawGst);
      let gstRateBp: number | null = null;

      if (!isNaN(gstNum)) {
        if (ALLOWED_GST_RATES_BP.includes(gstNum as any)) {
          gstRateBp = gstNum;
        } else if (ALLOWED_GST_RATES_BP.includes((gstNum * 100) as any)) {
          gstRateBp = Math.round(gstNum * 100);
        }
      }

      if (gstRateBp === null) {
        rowErrors.push({
          rowNumber,
          field: "gstRate",
          value: rawGst,
          message: "GST rate must be a valid slab: 0%, 5%, 12%, 18%, or 28%",
        });
      }

      // Validate MRP
      const rawMrp = data.mrp?.replace(/[₹Rs\s]/gi, "").trim();
      const mrpNum = Number(rawMrp);
      let mrpPaise = 0;

      if (isNaN(mrpNum) || mrpNum <= 0) {
        rowErrors.push({
          rowNumber,
          field: "mrp",
          value: rawMrp,
          message: "MRP must be a valid positive number in rupees",
        });
      } else {
        mrpPaise = Math.round(mrpNum * 100);
      }

      // Validate Pack Size
      const rawPackSize = data.packSize?.trim();
      const packSize = rawPackSize ? parseInt(rawPackSize, 10) : 1;
      if (isNaN(packSize) || packSize < 1) {
        rowErrors.push({
          rowNumber,
          field: "packSize",
          value: rawPackSize,
          message: "Pack size must be a positive integer >= 1",
        });
      }

      const packLabel = data.packLabel?.trim() || "Carton";
      const rawReorder = data.reorderLevel?.trim();
      const reorderLevel = rawReorder ? parseInt(rawReorder, 10) : 0;

      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
      } else if (name && shortCode && hsn && gstRateBp !== null) {
        validRows.push({
          rowNumber,
          parsed: {
            name,
            shortCode,
            companyName: data.company?.trim(),
            categoryName: data.category?.trim(),
            hsn,
            gstRateBp,
            mrpPaise,
            packSize,
            packLabel,
            reorderLevel: isNaN(reorderLevel) ? 0 : reorderLevel,
          },
        });
      }
    }

    // 3. Resolve or create companies and categories
    for (const item of validRows) {
      if (item.parsed.companyName) {
        const norm = item.parsed.companyName.toLowerCase();
        if (!companyMap.has(norm)) {
          const comp = await prisma.company.upsert({
            where: { name: item.parsed.companyName },
            update: {},
            create: { name: item.parsed.companyName },
          });
          await ensureSupplierParty(comp);
          companyMap.set(norm, comp.id);
        }
      }

      if (item.parsed.categoryName) {
        const norm = item.parsed.categoryName.toLowerCase();
        if (!categoryMap.has(norm)) {
          const cat = await prisma.category.upsert({
            where: { name: item.parsed.categoryName },
            update: {},
            create: { name: item.parsed.categoryName },
          });
          categoryMap.set(norm, cat.id);
        }
      }
    }

    // 4. Batch upsert valid products into database
    let importedCount = 0;
    let updatedCount = 0;

    // Check which shortCodes already exist in database to distinguish create vs update
    const allShortCodes = validRows.map((r) => r.parsed.shortCode);
    const existingProducts = await prisma.product.findMany({
      where: { shortCode: { in: allShortCodes } },
      select: { shortCode: true },
    });
    const existingShortCodesSet = new Set(existingProducts.map((p) => p.shortCode));

    // Execute in transactional batches of 50
    const BATCH_SIZE = 50;
    for (let b = 0; b < validRows.length; b += BATCH_SIZE) {
      const batch = validRows.slice(b, b + BATCH_SIZE);

      await prisma.$transaction(
        batch.map((row) => {
          const { parsed } = row;
          const companyId = parsed.companyName
            ? companyMap.get(parsed.companyName.toLowerCase()) ?? null
            : null;
          const categoryId = parsed.categoryName
            ? categoryMap.get(parsed.categoryName.toLowerCase()) ?? null
            : null;

          return prisma.product.upsert({
            where: { shortCode: parsed.shortCode },
            update: {
              name: parsed.name,
              companyId,
              categoryId,
              hsn: parsed.hsn,
              gstRateBp: parsed.gstRateBp,
              mrpPaise: parsed.mrpPaise,
              packSize: parsed.packSize,
              packLabel: parsed.packLabel,
              reorderLevel: parsed.reorderLevel,
              active: true,
            },
            create: {
              name: parsed.name,
              shortCode: parsed.shortCode,
              companyId,
              categoryId,
              hsn: parsed.hsn,
              gstRateBp: parsed.gstRateBp,
              mrpPaise: parsed.mrpPaise,
              packSize: parsed.packSize,
              packLabel: parsed.packLabel,
              reorderLevel: parsed.reorderLevel,
              active: true,
            },
          });
        })
      );

      for (const row of batch) {
        if (existingShortCodesSet.has(row.parsed.shortCode)) {
          updatedCount++;
        } else {
          importedCount++;
          existingShortCodesSet.add(row.parsed.shortCode);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // 5. Write audit log
    await auditService.log({
      actorId,
      action: "CATALOG_CSV_IMPORTED",
      entity: "Product",
      after: {
        totalRows: rows.length,
        importedCount,
        updatedCount,
        failedCount: errors.length,
        durationMs,
      },
      ip,
    });

    return {
      totalRows: rows.length,
      importedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
      durationMs,
    };
  }

  private generateShortCode(company: string | undefined, name: string): string {
    const compPart = (company || "GEN")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 3);
    const namePart = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 15);
    return `${compPart}-${namePart}`.replace(/-+$/, "");
  }
}

export const catalogImportService = new CatalogImportService();
