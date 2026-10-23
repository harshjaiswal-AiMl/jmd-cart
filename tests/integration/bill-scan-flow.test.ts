import { describe, it, expect, beforeAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { receivingService } from "@/modules/ocr/receiving.service";
import { UserRole } from "@prisma/client";
import { ForbiddenError } from "@/modules/auth/permissions";
import { stockService } from "@/modules/stock/stock.service";

describe("Prompt 10: Bill Scan, Counting & Idempotent Stock Receipt Flow", () => {
  const runId = Date.now().toString().slice(-6);
  let godownLocId: string;
  let shopLocId: string;
  let testCompanyId: string;
  let supplierPartyId: string;
  let testProductId: string;

  beforeAll(async () => {
    // 1. Locations
    const godown = await prisma.location.upsert({
      where: { id: "test-rec-godown" },
      update: {},
      create: {
        id: "test-rec-godown",
        name: "Test Receiving Godown",
        type: "GODOWN",
      },
    });
    godownLocId = godown.id;

    const shop = await prisma.location.upsert({
      where: { id: "test-rec-shop" },
      update: {},
      create: {
        id: "test-rec-shop",
        name: "Test Receiving Shop",
        type: "SHOP",
      },
    });
    shopLocId = shop.id;

    // 2. Company & Supplier
    const company = await prisma.company.upsert({
      where: { name: `Patanjali Test ${runId}` },
      update: {},
      create: {
        name: `Patanjali Test ${runId}`,
      },
    });
    testCompanyId = company.id;

    const party = await prisma.party.create({
      data: {
        name: `Shubham Traders ${runId}`,
        type: "SUPPLIER",
        companyId: testCompanyId,
      },
    });
    supplierPartyId = party.id;

    // 3. Product
    const product = await prisma.product.create({
      data: {
        name: `Haldi Chandan Soap ${runId}`,
        shortCode: `HCS_${runId}`,
        companyId: testCompanyId,
        mrpPaise: 1000, // ₹10.00
        packSize: 10,
        packLabel: "Box",
      },
    });
    testProductId = product.id;

    // 4. Test User
    await prisma.user.upsert({
      where: { phone: `98765${runId}` },
      update: {},
      create: {
        id: "user-godown",
        name: "Test Godown Keeper",
        phone: `98765${runId}`,
        passwordHash: "hash",
        role: UserRole.GODOWN,
      },
    });
  });

  it("strictly enforces RBAC: SHOP role cannot create bill scans", async () => {
    await expect(
      receivingService.createScan(UserRole.SHOP, "user-shop", {
        locationId: godownLocId,
        files: [{ buffer: Buffer.from("fake"), mimeType: "image/jpeg", originalName: "bill.jpg" }],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("strictly rejects SVG files to prevent stored-XSS", async () => {
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await expect(
      receivingService.createScan(UserRole.GODOWN, "user-godown", {
        locationId: godownLocId,
        files: [{ buffer: svgBuffer, mimeType: "image/svg+xml", originalName: "bill.svg" }],
      })
    ).rejects.toThrow(/SVG format is strictly prohibited/);
  });

  it("completes full scan, count verification, and idempotent stock posting", async () => {
    // 1. Create a Scan with a valid JPEG image
    const samplePath = path.resolve(process.cwd(), "ocr-samples/patanjali-shubham-traders-t940.jpg");
    const testImageBuffer = fs.existsSync(samplePath)
      ? fs.readFileSync(samplePath)
      : Buffer.from(
          "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
          "base64"
        );

    const scan = await receivingService.createScan(UserRole.GODOWN, "user-godown", {
      locationId: godownLocId,
      companyId: testCompanyId,
      supplierPartyId,
      files: [{ buffer: testImageBuffer, mimeType: "image/jpeg", originalName: "bill.jpg" }],
    });

    expect(scan).toBeDefined();
    expect(scan.status).toBe("COUNTING");

    // Create a scan line to simulate parsed bill item
    const line = await prisma.billScanLine.create({
      data: {
        scanId: scan.id,
        lineNo: 1,
        rawText: "Haldi Chandan Soap 10 CS 8.4900 8490.00",
        parsedName: "Haldi Chandan Soap",
        billedQty: 10,
        billedUnit: "CS",
        billedQtyPieces: 100, // 10 boxes * 10 packSize
        ratePaise: 849,
        gstRateBp: 500,
        amountPaise: 849000,
        productId: testProductId,
        matchStatus: "CONFIRMED",
      },
    });

    // Initial stock before posting
    const initialBalance = await stockService.getBalance(testProductId, godownLocId);

    // 2. Keeper counts the goods: receives 90 pieces (10 pieces short)
    const updatedLine = await receivingService.updateLineCount(UserRole.GODOWN, line.id, {
      countedCartons: 8,
      countedLoose: 10, // 8 * 10 + 10 = 90 pieces
      varianceReason: "1 box damaged in transport",
    });

    expect(updatedLine.countedPieces).toBe(90);
    expect(updatedLine.variance).toBe("SHORT");

    // 3. Post goods receipt: only confirmed 90 pieces are added to stock
    const postedScan = await receivingService.postGoodsReceipt(
      UserRole.GODOWN,
      "user-godown",
      scan.id
    );

    expect(postedScan.status).toBe("POSTED");
    expect(postedScan.purchaseId).toBeDefined();

    // Verify stock ledger at godown
    const postBalance = await stockService.getBalance(testProductId, godownLocId);
    expect(postBalance - initialBalance).toBe(90); // Exactly 90 pieces added

    // Verify supplier ledger entry
    const ledger = await prisma.ledgerEntry.findFirst({
      where: {
        partyId: supplierPartyId,
        referenceType: "PURCHASE",
        referenceId: postedScan.purchaseId!,
      },
    });
    expect(ledger).toBeDefined();

    // 4. Verify IDEMPOTENCY: calling postGoodsReceipt again doesn't double-add stock
    const secondPost = await receivingService.postGoodsReceipt(
      UserRole.GODOWN,
      "user-godown",
      scan.id
    );
    expect(secondPost.status).toBe("POSTED");

    const secondBalance = await stockService.getBalance(testProductId, godownLocId);
    expect(secondBalance).toBe(postBalance); // Balance remains unchanged
  });
});
