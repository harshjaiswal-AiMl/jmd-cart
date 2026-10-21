import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { UserRole, ImportBatchStatus, MovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { writeWorkbookToBuffer } from "@/lib/xlsx";
import { stockExcelUploadService } from "@/modules/godown/stock-excel-upload.service";
import { stockRepository } from "@/modules/stock/stock.repository";

describe("Instant Excel Stock Upload & Batch Undo Integration Tests", () => {
  let adminUserId: string;
  let godownUserId: string;
  let product1Sku: string;
  let product1Id: string;
  let product2Sku: string;
  let product2Id: string;

  beforeAll(async () => {
    const admin = await prisma.user.create({
      data: {
        name: "Stock Admin",
        phone: "9999900011",
        passwordHash: "hash",
        role: UserRole.ADMIN,
        active: true,
      },
    });
    adminUserId = admin.id;

    const godownUser = await prisma.user.create({
      data: {
        name: "Godown Keeper",
        phone: "9999900012",
        passwordHash: "hash",
        role: UserRole.GODOWN,
        active: true,
      },
    });
    godownUserId = godownUser.id;

    const company = await prisma.company.create({
      data: { name: "SALONI_STOCK_TEST" },
    });
    const category = await prisma.category.create({
      data: { name: "Mustard Oil Test" },
    });

    const p1 = await prisma.product.create({
      data: {
        shortCode: "SAL-1L-POUCH-12",
        name: "SALONI 1 LTR POUCH",
        companyId: company.id,
        categoryId: category.id,
        packSize: 12,
        mrpPaise: 22500,
        priceAPaise: 17500,
        priceBPaise: 18000,
        priceCPaise: 18500,
      },
    });
    product1Id = p1.id;
    product1Sku = p1.shortCode;

    const p2 = await prisma.product.create({
      data: {
        shortCode: "SAL-5L-JAR-4",
        name: "SALONI 5 LTR JAR",
        companyId: company.id,
        categoryId: category.id,
        packSize: 4,
        mrpPaise: 114600,
        priceAPaise: 88000,
        priceBPaise: 90000,
        priceCPaise: 92000,
      },
    });
    product2Id = p2.id;
    product2Sku = p2.shortCode;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uploads a stock .xlsx with valid + invalid rows, applies valid rows immediately, records batchId, and undoes the batch", async () => {
    const buf = writeWorkbookToBuffer([
      {
        name: "Stock Count",
        rows: [
          ["SKU", "Product Name", "Cartons", "Loose Pieces", "Reason"],
          [product1Sku, "SALONI 1 LTR POUCH", 5, 3, "Morning count"], // 5 * 12 + 3 = 63 pcs
          [product2Sku, "SALONI 5 LTR JAR", 10, 0, "Morning count"], // 10 * 4 + 0 = 40 pcs
          ["UNKNOWN-SKU-999", "Unknown Item", 2, 0, "Bad row"], // Invalid SKU -> skipped
        ],
      },
    ]);

    const uploadRes = await stockExcelUploadService.uploadAndApplyStockWorkbook(
      UserRole.GODOWN,
      godownUserId,
      {
        buffer: buf,
        filename: "godown-morning-stock.xlsx",
        defaultLocationId: "loc-godown-main",
        mode: "STOCK_COUNT",
      }
    );

    expect(uploadRes.rowsTotal).toBe(3);
    expect(uploadRes.rowsApplied).toBe(2);
    expect(uploadRes.rowsSkipped).toBe(1);
    expect(uploadRes.skippedErrorXlsxBase64).toBeTruthy();

    // Verify immediate stock balances
    const bal1 = await stockRepository.getBalance(product1Id, "loc-godown-main");
    const bal2 = await stockRepository.getBalance(product2Id, "loc-godown-main");
    expect(bal1).toBe(63);
    expect(bal2).toBe(40);

    // Verify batchId recorded on StockMovement
    const movements = await prisma.stockMovement.findMany({
      where: { batchId: uploadRes.batchId },
    });
    expect(movements.length).toBe(2);

    // Undo the batch
    const undoRes = await stockExcelUploadService.undoStockUploadBatch(
      UserRole.GODOWN,
      godownUserId,
      uploadRes.batchId
    );
    expect(undoRes.reversedCount).toBe(2);

    // Balances return to 0
    const bal1AfterUndo = await stockRepository.getBalance(
      product1Id,
      "loc-godown-main"
    );
    const bal2AfterUndo = await stockRepository.getBalance(
      product2Id,
      "loc-godown-main"
    );
    expect(bal1AfterUndo).toBe(0);
    expect(bal2AfterUndo).toBe(0);

    // Batch status is UNDONE
    const batch = await prisma.importBatch.findUnique({
      where: { id: uploadRes.batchId },
    });
    expect(batch?.status).toBe(ImportBatchStatus.UNDONE);
  });

  it("blocks batch undo with negative-stock guard if stock was subsequently consumed", async () => {
    const buf = writeWorkbookToBuffer([
      {
        name: "Opening",
        rows: [
          ["SKU", "Cartons", "Loose Pieces", "Reason"],
          [product1Sku, 2, 0, "Opening entry"], // +24 pcs
        ],
      },
    ]);

    const uploadRes = await stockExcelUploadService.uploadAndApplyStockWorkbook(
      UserRole.ADMIN,
      adminUserId,
      {
        buffer: buf,
        filename: "opening.xlsx",
        defaultLocationId: "loc-godown-main",
        mode: "OPENING_STOCK",
      }
    );
    expect(uploadRes.rowsApplied).toBe(1);
    expect(await stockRepository.getBalance(product1Id, "loc-godown-main")).toBe(
      24
    );

    // Simulate a subsequent sale/consumption of 10 pieces
    await prisma.$transaction(async (tx) => {
      const cur = await stockRepository.lockAndGetBalance(
        tx,
        product1Id,
        "loc-godown-main"
      );
      await stockRepository.setBalance(tx, product1Id, "loc-godown-main", cur - 10);
      await tx.stockMovement.create({
        data: {
          type: MovementType.ADJUSTMENT,
          productId: product1Id,
          fromLocationId: "loc-godown-main",
          qty: 10,
          reason: "Simulated sale consumption",
          idempotencyKey: `sim-sale-${Date.now()}`,
          createdBy: adminUserId,
        },
      });
    });

    expect(await stockRepository.getBalance(product1Id, "loc-godown-main")).toBe(
      14
    );

    // Attempt to undo the +24 upload -> would leave -10 -> must fail
    await expect(
      stockExcelUploadService.undoStockUploadBatch(
        UserRole.ADMIN,
        adminUserId,
        uploadRes.batchId
      )
    ).rejects.toThrow(/Cannot undo upload because stock has already been consumed/i);
  });

  it("rejects GODOWN role attempting to upload stock for Shop location", async () => {
    const buf = writeWorkbookToBuffer([
      {
        name: "Shop Stock",
        rows: [
          ["SKU", "Cartons", "Loose Pieces"],
          [product1Sku, 1, 0],
        ],
      },
    ]);

    await expect(
      stockExcelUploadService.uploadAndApplyStockWorkbook(
        UserRole.GODOWN,
        godownUserId,
        {
          buffer: buf,
          filename: "shop-attempt.xlsx",
          defaultLocationId: "loc-shop-retail",
          mode: "STOCK_COUNT",
        }
      )
    ).rejects.toThrow(/Warehouse Manager.*Godown location/i);
  });
});
