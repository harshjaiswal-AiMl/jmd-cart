import {
  ImportBatchStatus,
  ImportBatchType,
  LocationType,
  MovementType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertPermission, ForbiddenError, Permission } from "@/modules/auth/permissions";
import { stockRepository } from "@/modules/stock/stock.repository";
import { auditService } from "@/modules/audit/audit.service";
import {
  readWorkbookFromBuffer,
  writeWorkbookToBuffer,
  ParsedCell,
} from "@/lib/xlsx";
import {
  extractNameAndWeight,
  normalizeItemKey,
} from "@/modules/catalog/import/brand-sheet-import.service";

export type StockUploadMode = "OPENING_STOCK" | "STOCK_COUNT" | "ADD" | "DEDUCT";

export interface AppliedStockUploadRow {
  rowNumber: number;
  sheetName: string;
  productId: string;
  shortCode: string;
  productName: string;
  packSize: number;
  locationId: string;
  locationName: string;
  beforePieces: number;
  beforeCartons: number;
  beforeLoose: number;
  afterPieces: number;
  afterCartons: number;
  afterLoose: number;
  deltaPieces: number;
}

export interface SkippedStockUploadRow {
  rowNumber: number;
  sheetName: string;
  rawItemOrSku: string;
  rawCartons: string;
  rawLoose: string;
  reason: string;
}

export interface StockExcelUploadResult {
  batchId: string;
  filename: string;
  mode: StockUploadMode;
  locationId: string;
  locationName: string;
  rowsTotal: number;
  rowsApplied: number;
  rowsSkipped: number;
  totalCartonsDelta: number;
  totalLooseDelta: number;
  totalPiecesDelta: number;
  appliedRows: AppliedStockUploadRow[];
  skippedRows: SkippedStockUploadRow[];
  skippedErrorXlsxBase64?: string;
}

export interface UndoStockBatchResult {
  batchId: string;
  reversedCount: number;
}

function normalizeColHeader(str: string): string {
  return str
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class StockExcelUploadService {
  /**
   * One-step instant stock Excel/CSV upload:
   * - Validates and immediately applies all valid rows in a single DB transaction
   * - Tags StockMovement records with batchId and reason `Excel upload <filename>`
   * - Skips invalid/unknown/ambiguous rows and produces a downloadable .xlsx error report
   * - Enforces GODOWN role restriction to Godown location only
   */
  async uploadAndApplyStockWorkbook(
    role: UserRole,
    actorId: string,
    input: {
      buffer: Buffer;
      filename: string;
      defaultLocationId: string;
      mode?: StockUploadMode;
    },
    ip?: string
  ): Promise<StockExcelUploadResult> {
    assertPermission(role, Permission.STOCK_ADJUST);

    const mode: StockUploadMode = input.mode ?? "STOCK_COUNT";
    const filename = input.filename || "stock_upload.xlsx";

    const locations = await prisma.location.findMany({
      where: { active: true },
    });
    const locById = new Map(locations.map((l) => [l.id, l]));
    const locByName = new Map(
      locations.map((l) => [l.name.toUpperCase().trim(), l])
    );

    const godownLoc =
      locations.find((l) => l.id === "loc-godown-main") ??
      locations.find((l) => l.type === LocationType.GODOWN);

    // Server-side guard: GODOWN keeper can only upload to Godown location
    const defaultLocation = input.defaultLocationId
      ? locById.get(input.defaultLocationId)
      : godownLoc;
    if (!defaultLocation) {
      if (role === UserRole.GODOWN) {
        throw new ForbiddenError(
          "Warehouse Manager (GODOWN) is only authorized to upload stock for the Central Godown location."
        );
      }
      throw new Error(`Stock location '${input.defaultLocationId}' not found`);
    }

    if (role === UserRole.GODOWN && defaultLocation.type !== LocationType.GODOWN) {
      throw new ForbiddenError(
        "Warehouse Manager (GODOWN) is only authorized to upload stock for the Central Godown location."
      );
    }

    // Load active products for fast matching by SKU or exact (brand + name + weight) or unique name+weight
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        company: true,
        stockBalances: true,
      },
    });

    const bySku = new Map<string, (typeof products)[0]>();
    const byBrandNameWeight = new Map<string, Array<(typeof products)[0]>>();
    const byNameWeight = new Map<string, Array<(typeof products)[0]>>();
    const byExactName = new Map<string, Array<(typeof products)[0]>>();

    for (const p of products) {
      bySku.set(p.shortCode.toUpperCase().trim(), p);

      const brand = p.company?.name ?? "";
      const { cleanName, normalizedWeight } = extractNameAndWeight(p.name, p.weight);

      const bnwKey = normalizeItemKey(brand, cleanName, normalizedWeight);
      const bnwList = byBrandNameWeight.get(bnwKey) ?? [];
      bnwList.push(p);
      byBrandNameWeight.set(bnwKey, bnwList);

      const nwKey = normalizeItemKey("", cleanName, normalizedWeight);
      const nwList = byNameWeight.get(nwKey) ?? [];
      nwList.push(p);
      byNameWeight.set(nwKey, nwList);

      const exactKey = p.name.toUpperCase().replace(/\s+/g, " ").trim();
      const exList = byExactName.get(exactKey) ?? [];
      exList.push(p);
      byExactName.set(exactKey, exList);
    }

    const worksheets = readWorkbookFromBuffer(input.buffer, filename);

    interface ValidatedCandidateRow {
      rowNumber: number;
      sheetName: string;
      product: (typeof products)[0];
      location: (typeof locations)[0];
      cartons: number;
      loose: number;
      totalInputPieces: number;
    }

    const validCandidates: ValidatedCandidateRow[] = [];
    const skippedRows: SkippedStockUploadRow[] = [];

    for (const sheet of worksheets) {
      // Find header row
      let headerRowIdx = -1;
      let skuCol = -1;
      let itemCol = -1;
      let brandCol = -1;
      let weightCol = -1;
      let cartonsCol = -1;
      let looseCol = -1;
      let piecesCol = -1;
      let locationCol = -1;

      for (let r = 0; r < Math.min(sheet.rows.length, 20); r++) {
        const row = sheet.rows[r];
        if (!row) continue;

        for (let c = 0; c < row.length; c++) {
          const norm = normalizeColHeader(row[c]?.display ?? "");
          if (!norm) continue;

          if (norm === "SKU" || norm === "SHORT CODE" || norm === "SHORTCODE" || norm === "CODE") {
            skuCol = c;
          } else if (
            norm === "ITEM" ||
            norm === "ITEMS" ||
            norm === "ITEM NAME" ||
            norm === "PRODUCT" ||
            norm === "PRODUCT NAME"
          ) {
            itemCol = c;
          } else if (norm === "BRAND" || norm === "COMPANY") {
            brandCol = c;
          } else if (norm === "WEIGHT" || norm === "WT" || norm === "SIZE") {
            weightCol = c;
          } else if (
            norm === "CARTONS" ||
            norm === "CARTON" ||
            norm === "CTN" ||
            norm === "CASES" ||
            norm === "BOXES"
          ) {
            cartonsCol = c;
          } else if (norm === "LOOSE" || norm === "LOOSE PCS" || norm === "LOOSE PIECES") {
            looseCol = c;
          } else if (norm === "PIECES" || norm === "PCS" || norm === "TOTAL PIECES" || norm === "QTY") {
            piecesCol = c;
          } else if (norm === "LOCATION" || norm === "GODOWN" || norm === "WAREHOUSE") {
            locationCol = c;
          }
        }

        if ((skuCol !== -1 || itemCol !== -1) && (cartonsCol !== -1 || looseCol !== -1 || piecesCol !== -1)) {
          headerRowIdx = r;
          break;
        }
      }

      // If no explicit header row found, assume standard columns: 0=SKU/ITEM, 1=CARTONS, 2=LOOSE
      const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
      if (headerRowIdx === -1) {
        itemCol = 0;
        cartonsCol = 1;
        looseCol = 2;
      }

      for (let r = startRow; r < sheet.rows.length; r++) {
        const row = sheet.rows[r];
        if (!row || row.every((c) => !c || c.display.trim() === "")) continue;

        const rowNumber = r + 1;
        const rawSku = skuCol >= 0 ? (row[skuCol]?.display ?? "").trim() : "";
        const rawItem = itemCol >= 0 ? (row[itemCol]?.display ?? "").trim() : "";
        const rawBrand = brandCol >= 0 ? (row[brandCol]?.display ?? "").trim() : "";
        const rawWeight = weightCol >= 0 ? (row[weightCol]?.display ?? "").trim() : "";
        const rawIdentifier = rawSku || rawItem;

        if (!rawIdentifier) continue;

        const rawCartonsStr = cartonsCol >= 0 ? (row[cartonsCol]?.display ?? "").trim() : "";
        const rawLooseStr = looseCol >= 0 ? (row[looseCol]?.display ?? "").trim() : "";
        const rawPiecesStr = piecesCol >= 0 ? (row[piecesCol]?.display ?? "").trim() : "";

        // Match product:
        // 1. Try SKU match
        let matchedProduct = bySku.get(rawIdentifier.toUpperCase());
        let ambiguousError: string | null = null;

        if (!matchedProduct && rawItem) {
          // 2. Try exact full name match
          const exactMatches = byExactName.get(
            rawItem.toUpperCase().replace(/\s+/g, " ").trim()
          );
          if (exactMatches && exactMatches.length === 1) {
            matchedProduct = exactMatches[0];
          } else if (exactMatches && exactMatches.length > 1) {
            ambiguousError = `Ambiguous item '${rawItem}' matches ${exactMatches.length} products (${exactMatches.map((m) => m.shortCode).join(", ")})`;
          }

          if (!matchedProduct && !ambiguousError) {
            const { cleanName, normalizedWeight } = extractNameAndWeight(rawItem, rawWeight);
            if (rawBrand) {
              const bnwMatches = byBrandNameWeight.get(
                normalizeItemKey(rawBrand, cleanName, normalizedWeight)
              );
              if (bnwMatches && bnwMatches.length === 1) {
                matchedProduct = bnwMatches[0];
              } else if (bnwMatches && bnwMatches.length > 1) {
                ambiguousError = `Ambiguous brand+item '${rawBrand} ${rawItem}' matches ${bnwMatches.length} products`;
              }
            } else {
              const nwMatches = byNameWeight.get(
                normalizeItemKey("", cleanName, normalizedWeight)
              );
              if (nwMatches && nwMatches.length === 1) {
                matchedProduct = nwMatches[0];
              } else if (nwMatches && nwMatches.length > 1) {
                ambiguousError = `Ambiguous item '${rawItem}' exists across multiple brands (${nwMatches.map((m) => m.shortCode).join(", ")}); specify SKU`;
              }
            }
          }
        }

        if (ambiguousError) {
          skippedRows.push({
            rowNumber,
            sheetName: sheet.name,
            rawItemOrSku: rawIdentifier,
            rawCartons: rawCartonsStr,
            rawLoose: rawLooseStr || rawPiecesStr,
            reason: ambiguousError,
          });
          continue;
        }

        if (!matchedProduct) {
          skippedRows.push({
            rowNumber,
            sheetName: sheet.name,
            rawItemOrSku: rawIdentifier,
            rawCartons: rawCartonsStr,
            rawLoose: rawLooseStr || rawPiecesStr,
            reason: `Unknown product '${rawIdentifier}' not found in catalog`,
          });
          continue;
        }

        // Resolve location if specified on row
        let targetLoc = defaultLocation;
        if (locationCol >= 0) {
          const rawLoc = (row[locationCol]?.display ?? "").trim();
          if (rawLoc) {
            const foundLoc =
              locById.get(rawLoc) ?? locByName.get(rawLoc.toUpperCase());
            if (!foundLoc) {
              skippedRows.push({
                rowNumber,
                sheetName: sheet.name,
                rawItemOrSku: rawIdentifier,
                rawCartons: rawCartonsStr,
                rawLoose: rawLooseStr,
                reason: `Unknown location '${rawLoc}'`,
              });
              continue;
            }
            if (role === UserRole.GODOWN && foundLoc.type !== LocationType.GODOWN) {
              skippedRows.push({
                rowNumber,
                sheetName: sheet.name,
                rawItemOrSku: rawIdentifier,
                rawCartons: rawCartonsStr,
                rawLoose: rawLooseStr,
                reason: `GODOWN role can only update Central Godown stock (rejected location '${foundLoc.name}')`,
              });
              continue;
            }
            targetLoc = foundLoc;
          }
        }

        // Parse cartons & loose / pieces
        const cartonsNum = rawCartonsStr === "" ? 0 : Number(rawCartonsStr);
        const looseNum = rawLooseStr === "" ? 0 : Number(rawLooseStr);
        const piecesNum = rawPiecesStr === "" ? 0 : Number(rawPiecesStr);

        if (
          !Number.isFinite(cartonsNum) ||
          !Number.isFinite(looseNum) ||
          !Number.isFinite(piecesNum) ||
          !Number.isInteger(cartonsNum) ||
          !Number.isInteger(looseNum) ||
          !Number.isInteger(piecesNum) ||
          cartonsNum < 0 ||
          looseNum < 0 ||
          piecesNum < 0
        ) {
          skippedRows.push({
            rowNumber,
            sheetName: sheet.name,
            rawItemOrSku: rawIdentifier,
            rawCartons: rawCartonsStr,
            rawLoose: rawLooseStr || rawPiecesStr,
            reason: "Cartons and Loose/Pieces must be non-negative integers",
          });
          continue;
        }

        const packSize = Math.max(1, matchedProduct.packSize || 1);
        const totalInputPieces =
          cartonsCol === -1 && looseCol === -1 && piecesCol !== -1
            ? piecesNum
            : cartonsNum * packSize + looseNum + (looseCol === -1 ? piecesNum : 0);

        validCandidates.push({
          rowNumber,
          sheetName: sheet.name,
          product: matchedProduct,
          location: targetLoc,
          cartons: Math.floor(totalInputPieces / packSize),
          loose: totalInputPieces % packSize,
          totalInputPieces,
        });
      }
    }

    const appliedRows: AppliedStockUploadRow[] = [];

    // Execute all valid stock adjustments in one transaction and link to ImportBatch
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.importBatch.create({
        data: {
          type: ImportBatchType.STOCK,
          filename,
          userId: actorId,
          locationId: defaultLocation.id,
          mode,
          rowsTotal: validCandidates.length + skippedRows.length,
          rowsApplied: 0,
          rowsSkipped: skippedRows.length,
          status: ImportBatchStatus.APPLIED,
        },
      });

      const reasonStr = `Excel upload ${filename}`;

      for (let i = 0; i < validCandidates.length; i++) {
        const cand = validCandidates[i];
        const currentPieces = await stockRepository.getBalance(
          cand.product.id,
          cand.location.id,
          tx
        );

        let deltaPieces = 0;
        let movementType: MovementType = MovementType.ADJUSTMENT;

        if (mode === "OPENING_STOCK") {
          deltaPieces = cand.totalInputPieces;
          movementType = MovementType.PURCHASE_RECEIPT;
        } else if (mode === "STOCK_COUNT") {
          deltaPieces = cand.totalInputPieces - currentPieces;
          movementType = MovementType.ADJUSTMENT;
        } else if (mode === "ADD") {
          deltaPieces = cand.totalInputPieces;
          movementType = MovementType.ADJUSTMENT;
        } else if (mode === "DEDUCT") {
          deltaPieces = -cand.totalInputPieces;
          movementType = MovementType.ADJUSTMENT;
        }

        const afterPieces = currentPieces + deltaPieces;
        if (afterPieces < 0) {
          skippedRows.push({
            rowNumber: cand.rowNumber,
            sheetName: cand.sheetName,
            rawItemOrSku: cand.product.shortCode,
            rawCartons: String(cand.cartons),
            rawLoose: String(cand.loose),
            reason: `Would result in negative stock (${afterPieces} pcs); current is ${currentPieces} pcs`,
          });
          continue;
        }

        if (deltaPieces !== 0) {
          const absDelta = Math.abs(deltaPieces);
          const fromLocationId = deltaPieces < 0 ? cand.location.id : null;
          const toLocationId = deltaPieces > 0 ? cand.location.id : null;

          if (fromLocationId) {
            const lockedBal = await stockRepository.lockAndGetBalance(
              tx,
              cand.product.id,
              fromLocationId
            );
            await stockRepository.setBalance(
              tx,
              cand.product.id,
              fromLocationId,
              lockedBal - absDelta
            );
          }
          if (toLocationId) {
            const lockedBal = await stockRepository.lockAndGetBalance(
              tx,
              cand.product.id,
              toLocationId
            );
            await stockRepository.setBalance(
              tx,
              cand.product.id,
              toLocationId,
              lockedBal + absDelta
            );
          }

          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId: cand.product.id,
              fromLocationId,
              toLocationId,
              qty: absDelta,
              referenceType:
                mode === "OPENING_STOCK" ? "OPENING_STOCK" : "STOCK_EXCEL_UPLOAD",
              referenceId: createdBatch.id,
              batchId: createdBatch.id,
              reason: reasonStr,
              idempotencyKey: `stock-xlsx-${createdBatch.id}-${i}-${cand.rowNumber}`,
              createdBy: actorId,
              meta: {
                mode,
                filename,
                rowNumber: cand.rowNumber,
                beforePieces: currentPieces,
                afterPieces,
                deltaPieces,
              },
            },
          });
        }

        const packSize = Math.max(1, cand.product.packSize || 1);
        appliedRows.push({
          rowNumber: cand.rowNumber,
          sheetName: cand.sheetName,
          productId: cand.product.id,
          shortCode: cand.product.shortCode,
          productName: cand.product.name,
          packSize,
          locationId: cand.location.id,
          locationName: cand.location.name,
          beforePieces: currentPieces,
          beforeCartons: Math.floor(currentPieces / packSize),
          beforeLoose: currentPieces % packSize,
          afterPieces,
          afterCartons: Math.floor(afterPieces / packSize),
          afterLoose: afterPieces % packSize,
          deltaPieces,
        });
      }

      const updatedBatch = await tx.importBatch.update({
        where: { id: createdBatch.id },
        data: {
          rowsApplied: appliedRows.length,
          rowsSkipped: skippedRows.length,
          summary: {
            appliedCount: appliedRows.length,
            skippedCount: skippedRows.length,
          },
        },
      });

      return updatedBatch;
    });

    const totalPiecesDelta = appliedRows.reduce((s, r) => s + r.deltaPieces, 0);
    const totalCartonsDelta = appliedRows.reduce(
      (s, r) => s + (r.afterCartons - r.beforeCartons),
      0
    );
    const totalLooseDelta = appliedRows.reduce(
      (s, r) => s + (r.afterLoose - r.beforeLoose),
      0
    );

    let skippedErrorXlsxBase64: string | undefined;
    if (skippedRows.length > 0) {
      const errBuf = writeWorkbookToBuffer([
        {
          name: "Skipped_Rows",
          rows: [
            ["SHEET", "ROW", "ITEM / SKU", "CARTONS", "LOOSE", "ERROR REASON"],
            ...skippedRows.map((sr) => [
              sr.sheetName,
              sr.rowNumber,
              sr.rawItemOrSku,
              sr.rawCartons,
              sr.rawLoose,
              sr.reason,
            ]),
          ],
        },
      ]);
      skippedErrorXlsxBase64 = errBuf.toString("base64");
    }

    await auditService.log({
      actorId,
      action: "STOCK_EXCEL_UPLOAD_APPLIED",
      entity: "ImportBatch",
      entityId: batch.id,
      after: {
        filename,
        mode,
        rowsApplied: appliedRows.length,
        rowsSkipped: skippedRows.length,
        totalPiecesDelta,
      },
      ip,
    });

    return {
      batchId: batch.id,
      filename,
      mode,
      locationId: defaultLocation.id,
      locationName: defaultLocation.name,
      rowsTotal: appliedRows.length + skippedRows.length,
      rowsApplied: appliedRows.length,
      rowsSkipped: skippedRows.length,
      totalCartonsDelta,
      totalLooseDelta,
      totalPiecesDelta,
      appliedRows,
      skippedRows,
      skippedErrorXlsxBase64,
    };
  }

  /**
   * Undo an applied stock upload batch:
   * - Posts exact reversal movements in one transaction
   * - Marks batch status = UNDONE
   * - Refuses if any product would go negative (e.g. stock was already sold/transferred) and lists blocking items
   * - GODOWN can undo only their own uploads within 24 hours; SUPER_ADMIN / ADMIN can undo any
   */
  async undoStockUploadBatch(
    role: UserRole,
    actorId: string,
    batchId: string,
    ip?: string
  ): Promise<UndoStockBatchResult> {
    assertPermission(role, Permission.STOCK_ADJUST);

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
      include: {
        movements: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!batch || batch.type !== ImportBatchType.STOCK) {
      throw new Error("Stock upload batch not found");
    }

    if (batch.status === ImportBatchStatus.UNDONE) {
      throw new Error("This stock upload batch has already been undone");
    }

    if (role === UserRole.GODOWN) {
      if (batch.userId !== actorId) {
        throw new ForbiddenError(
          "Warehouse Manager (GODOWN) can only undo their own stock upload batches"
        );
      }
      const ageMs = Date.now() - batch.createdAt.getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        throw new ForbiddenError(
          "Warehouse Manager (GODOWN) can only undo stock uploads within 24 hours of upload"
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check if reversing any movement would drive balance negative
      const blockingItems: string[] = [];

      for (const mov of batch.movements) {
        // Original movement added stock to `toLocationId` -> reversal must deduct from `toLocationId`
        if (mov.toLocationId) {
          const curBal = await stockRepository.getBalance(
            mov.productId,
            mov.toLocationId,
            tx
          );
          if (curBal < mov.qty) {
            blockingItems.push(
              `${mov.product.name} (${mov.product.shortCode}): needs ${mov.qty} pcs to reverse, only ${curBal} pcs remaining`
            );
          }
        }
      }

      if (blockingItems.length > 0) {
        throw new Error(
          `Cannot undo upload because stock has already been consumed/transferred for: ${blockingItems.join(
            "; "
          )}`
        );
      }

      let reversedCount = 0;
      for (const mov of batch.movements) {
        const revFromLocationId = mov.toLocationId;
        const revToLocationId = mov.fromLocationId;

        if (revFromLocationId) {
          const lockedBal = await stockRepository.lockAndGetBalance(
            tx,
            mov.productId,
            revFromLocationId
          );
          await stockRepository.setBalance(
            tx,
            mov.productId,
            revFromLocationId,
            lockedBal - mov.qty
          );
        }
        if (revToLocationId) {
          const lockedBal = await stockRepository.lockAndGetBalance(
            tx,
            mov.productId,
            revToLocationId
          );
          await stockRepository.setBalance(
            tx,
            mov.productId,
            revToLocationId,
            lockedBal + mov.qty
          );
        }

        await tx.stockMovement.create({
          data: {
            type: MovementType.ADJUSTMENT,
            productId: mov.productId,
            fromLocationId: revFromLocationId,
            toLocationId: revToLocationId,
            qty: mov.qty,
            referenceType: "STOCK_EXCEL_UNDO",
            referenceId: batch.id,
            batchId: batch.id,
            reason: `Undo Excel upload ${batch.filename}`,
            idempotencyKey: `undo-stock-xlsx-${batch.id}-${mov.id}`,
            createdBy: actorId,
          },
        });
        reversedCount++;
      }

      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportBatchStatus.UNDONE,
          undoneAt: new Date(),
          undoneBy: actorId,
        },
      });

      return { batchId: batch.id, reversedCount };
    });

    await auditService.log({
      actorId,
      action: "STOCK_EXCEL_UPLOAD_UNDONE",
      entity: "ImportBatch",
      entityId: batchId,
      after: result,
      ip,
    });

    return result;
  }

  /**
   * Generate a downloadable .xlsx file containing all current catalog items and their current cartons & loose stock
   * for a given location so the warehouse manager can fill/adjust numbers and re-upload.
   */
  async generateCurrentStockExcelBuffer(
    role: UserRole,
    locationId: string
  ): Promise<Buffer> {
    assertPermission(role, Permission.STOCK_VIEW);

    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        company: true,
        stockBalances: {
          where: { locationId },
        },
      },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
    });

    const rows: Array<Array<string | number | null>> = [
      ["SKU", "BRAND", "ITEM", "WEIGHT", "QTY IN CASE", "CARTONS", "LOOSE"],
      ...products.map((p) => {
        const qty = p.stockBalances[0]?.qty ?? 0;
        const packSize = Math.max(1, p.packSize || 1);
        return [
          p.shortCode,
          p.company?.name ?? "",
          p.name,
          p.weight ?? "",
          packSize,
          Math.floor(qty / packSize),
          qty % packSize,
        ];
      }),
    ];

    return writeWorkbookToBuffer([
      {
        name: "Current_Stock",
        rows,
      },
    ]);
  }

  /**
   * List recent stock upload batches for display and one-click undo.
   */
  async listRecentStockBatches(role: UserRole, actorId: string, limit = 10) {
    assertPermission(role, Permission.STOCK_ADJUST);

    const where =
      role === UserRole.GODOWN
        ? { type: ImportBatchType.STOCK, userId: actorId }
        : { type: ImportBatchType.STOCK };

    return prisma.importBatch.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        location: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}

export const stockExcelUploadService = new StockExcelUploadService();
