import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import { UserRole, BillScanStatus, BillScanSourceType, BillScanVariance, LedgerKind } from "@prisma/client";
import { assertPermission, Permission } from "@/modules/auth/permissions";
import { tesseractEngine } from "./tesseract-engine";
import { pdfTextEngine } from "./pdf-engine";
import { tableParser } from "./table-parser";
import { productMatcher } from "./product-matcher";
import { purchaseService } from "@/modules/purchase/purchase.service";
import { auditService } from "@/modules/audit/audit.service";
import { detectImageMimeType, isSvg } from "@/lib/storage/image-validation";

export class ReceivingService {
  /**
   * Uploads bill images/PDF to private R2 storage and triggers offline OCR.
   */
  async createScan(
    actorRole: UserRole,
    actorId: string,
    params: {
      locationId: string;
      files: Array<{ buffer: Buffer; mimeType: string; originalName: string }>;
      supplierPartyId?: string | null;
      companyId?: string | null;
    }
  ) {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);

    if (!params.files || params.files.length === 0) {
      throw new Error("At least one bill document or photo is required");
    }

    const storage = getStorage();
    const scanId = `bscan_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const idempotencyKey = `scan_idem_${scanId}`;
    const imageKeys: string[] = [];

    let isPdf = false;
    let singleBuffer = params.files[0].buffer;

    for (let i = 0; i < params.files.length; i++) {
      const f = params.files[i];

      // Security check: reject SVG and executable files
      if (isSvg(f.buffer)) {
        throw new Error("SVG format is strictly prohibited for security");
      }

      const detectedMime = detectImageMimeType(f.buffer);
      const isDigitalPdf = f.mimeType === "application/pdf" || f.originalName.toLowerCase().endsWith(".pdf");

      if (!detectedMime && !isDigitalPdf) {
        throw new Error(`Unsupported or unverified image format for file ${f.originalName}`);
      }

      const ext = isDigitalPdf ? "pdf" : "jpg";
      if (isDigitalPdf) isPdf = true;

      const storageKey = `bills/${scanId}/page_${i + 1}.${ext}`;
      await storage.put(storageKey, f.buffer, {
        contentType: isDigitalPdf ? "application/pdf" : detectedMime || "image/jpeg",
      });
      imageKeys.push(storageKey);
    }

    // Check if actor exists in DB to prevent foreign key errors
    let creatorId: string | null = null;
    if (actorId) {
      const existingUser = await prisma.user.findUnique({
        where: { id: actorId },
        select: { id: true },
      });
      if (existingUser) creatorId = existingUser.id;
    }

    // Create Draft BillScan record
    const billScan = await prisma.billScan.create({
      data: {
        id: scanId,
        locationId: params.locationId,
        supplierPartyId: params.supplierPartyId ?? null,
        companyId: params.companyId ?? null,
        imageKeys,
        sourceType: isPdf ? BillScanSourceType.PDF_TEXT : BillScanSourceType.IMAGE,
        status: BillScanStatus.DRAFT,
        createdBy: creatorId,
        idempotencyKey,
      },
    });

    // Run OCR & Table Parser immediately
    await this.processOcr(billScan.id, singleBuffer, isPdf, params.companyId ?? undefined);

    return this.getScan(actorRole, billScan.id);
  }

  /**
   * Internal processor: extracts text, parses bill, matches items with catalog
   */
  async processOcr(
    scanId: string,
    buffer: Buffer,
    isPdf: boolean,
    preferredCompanyId?: string
  ) {
    try {
      const ocrResult = isPdf
        ? await pdfTextEngine.processPdf(buffer)
        : await tesseractEngine.processImage(buffer);

      const parsedBill = tableParser.parse(ocrResult);

      // Auto-detect company/supplier if not pre-selected
      let matchedCompanyId = preferredCompanyId;
      let matchedPartyId: string | undefined;

      if (!matchedCompanyId && parsedBill.supplierName) {
        const company = await prisma.company.findFirst({
          where: {
            active: true,
            name: { contains: parsedBill.supplierName.split(" ")[0], mode: "insensitive" },
          },
          include: { supplierParty: true },
        });

        if (company) {
          matchedCompanyId = company.id;
          matchedPartyId = company.supplierParty?.id;
        }
      }

      // Update BillScan with extracted header details
      await prisma.billScan.update({
        where: { id: scanId },
        data: {
          status: BillScanStatus.COUNTING,
          ocrEngine: ocrResult.engine,
          ocrDurationMs: ocrResult.durationMs,
          ocrConfidence: ocrResult.confidence,
          billNo: parsedBill.billNo ?? null,
          billDate: parsedBill.billDate ?? null,
          billTotalPaise: parsedBill.billTotalPaise ?? null,
          parsedJson: parsedBill as unknown as import("@prisma/client").Prisma.InputJsonValue,
          companyId: matchedCompanyId ?? null,
          supplierPartyId: matchedPartyId ?? null,
        },
      });

      // Match each parsed line against product database
      for (let i = 0; i < parsedBill.items.length; i++) {
        const item = parsedBill.items[i];
        const match = await productMatcher.matchLine(
          item.rawText,
          item.parsedName,
          matchedCompanyId,
          item.hsn
        );

        // Adjust piece count if product pack size known
        const packMultiplier = (item.billedUnit === "CS" || item.billedUnit === "CRT" || item.billedUnit === "CTN")
          ? (match.suggestedPackSize > 1 ? match.suggestedPackSize : 1)
          : 1;

        const billedPieces = Math.round(item.billedQty * packMultiplier);

        await prisma.billScanLine.create({
          data: {
            scanId,
            lineNo: item.lineNo || i + 1,
            rawText: item.rawText,
            parsedName: item.parsedName,
            hsn: item.hsn ?? null,
            billedQty: item.billedQty,
            billedUnit: item.billedUnit,
            billedQtyPieces: billedPieces,
            ratePaise: item.ratePaise,
            gstRateBp: item.gstRateBp,
            amountPaise: item.amountPaise,
            productId: match.productId ?? null,
            matchConfidence: match.matchConfidence,
            matchStatus: match.matchStatus,
            countedCartons: 0,
            countedLoose: 0,
            countedPieces: 0,
            flags: item.flags,
            confirmedAsBilled: false,
          },
        });
      }
    } catch (err: unknown) {
      console.error("OCR Processing error for scan", scanId, err);
      // Fallback directly to manual-assist mode on OCR error
      await prisma.billScan.update({
        where: { id: scanId },
        data: {
          status: BillScanStatus.COUNTING,
          sourceType: BillScanSourceType.MANUAL,
          ocrConfidence: 0,
        },
      });
    }
  }

  /**
   * Fetch a scan record by ID with lines and candidate matches
   */
  async getScan(actorRole: UserRole, scanId: string) {
    assertPermission(actorRole, Permission.STOCK_VIEW);

    const scan = await prisma.billScan.findUnique({
      where: { id: scanId },
      include: {
        supplierParty: true,
        company: true,
        location: true,
        creator: { select: { id: true, name: true, role: true } },
        lines: {
          include: {
            product: true,
          },
          orderBy: { lineNo: "asc" },
        },
      },
    });

    if (!scan) throw new Error("Bill scan not found");
    return scan;
  }

  /**
   * Lists recent receipts / bill scans
   */
  async listScans(actorRole: UserRole, limit = 50) {
    assertPermission(actorRole, Permission.STOCK_VIEW);

    return prisma.billScan.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        supplierParty: true,
        company: true,
        location: true,
        creator: { select: { id: true, name: true } },
        lines: {
          select: { id: true, matchStatus: true, variance: true },
        },
      },
    });
  }

  /**
   * Update keeper count for a line item
   */
  async updateLineCount(
    actorRole: UserRole,
    lineId: string,
    data: {
      productId?: string | null;
      countedCartons: number;
      countedLoose: number;
      varianceReason?: string | null;
      confirmedAsBilled?: boolean;
    }
  ) {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);

    const line = await prisma.billScanLine.findUnique({
      where: { id: lineId },
      include: { product: true },
    });

    if (!line) throw new Error("Scan line item not found");

    const productId = data.productId !== undefined ? data.productId : line.productId;
    let packSize = 1;

    if (productId) {
      const prod = await prisma.product.findUnique({
        where: { id: productId },
        select: { packSize: true },
      });
      if (prod) packSize = prod.packSize;
    }

    const countedPieces = data.countedCartons * packSize + data.countedLoose;

    let variance: BillScanVariance = BillScanVariance.NONE;
    if (countedPieces < line.billedQtyPieces) {
      variance = BillScanVariance.SHORT;
    } else if (countedPieces > line.billedQtyPieces) {
      variance = BillScanVariance.EXCESS;
    }

    return prisma.billScanLine.update({
      where: { id: lineId },
      data: {
        productId,
        matchStatus: productId ? "CONFIRMED" : line.matchStatus,
        countedCartons: data.countedCartons,
        countedLoose: data.countedLoose,
        countedPieces,
        variance,
        varianceReason: data.varianceReason ?? null,
        confirmedAsBilled: data.confirmedAsBilled ?? false,
      },
      include: { product: true },
    });
  }

  /**
   * Shortcut: Set all lines as billed (auto-count cartons and loose)
   */
  async confirmAllAsBilled(actorRole: UserRole, scanId: string) {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);

    const scan = await prisma.billScan.findUnique({
      where: { id: scanId },
      include: { lines: { include: { product: true } } },
    });

    if (!scan) throw new Error("Bill scan not found");

    for (const line of scan.lines) {
      const packSize = line.product?.packSize || 1;
      const cartons = Math.floor(line.billedQtyPieces / packSize);
      const loose = line.billedQtyPieces % packSize;

      await prisma.billScanLine.update({
        where: { id: line.id },
        data: {
          countedCartons: cartons,
          countedLoose: loose,
          countedPieces: line.billedQtyPieces,
          variance: BillScanVariance.NONE,
          varianceReason: null,
          confirmedAsBilled: true,
          matchStatus: line.productId ? "CONFIRMED" : line.matchStatus,
        },
      });
    }

    return this.getScan(actorRole, scanId);
  }

  /**
   * Posts verified count to Stock Ledger & Purchase GRN atomically.
   */
  async postGoodsReceipt(
    actorRole: UserRole,
    actorId: string,
    scanId: string,
    ip?: string
  ) {
    assertPermission(actorRole, Permission.STOCK_RECEIVE);

    const scan = await prisma.billScan.findUnique({
      where: { id: scanId },
      include: {
        lines: { include: { product: true } },
        supplierParty: true,
      },
    });

    if (!scan) throw new Error("Bill scan not found");
    if (scan.status === BillScanStatus.POSTED) {
      // Idempotency: return existing posted scan
      return scan;
    }

    // Validation: every line must be verified and have a matched product
    const validLines = scan.lines.filter((l) => l.productId && l.countedPieces > 0);
    if (validLines.length === 0) {
      throw new Error("No verified items with positive count to receive into stock");
    }

    // Call existing Purchase Service in atomic transaction
    const purchaseResult = await purchaseService.recordPurchaseReceive(
      actorRole,
      actorId,
      {
        supplierId: scan.supplierPartyId,
        billNo: scan.billNo || `SCAN-${scan.id.slice(-6)}`,
        billDate: scan.billDate || new Date(),
        locationId: scan.locationId,
        billScanId: scan.id,
        billTotalPaise: scan.billTotalPaise,
        items: validLines.map((l) => ({
          productId: l.productId!,
          qty: l.countedPieces, // Only confirmed counts alter stock
          billedQty: l.billedQtyPieces,
          acceptedQty: l.countedPieces,
          varianceReason: l.varianceReason,
          ratePaise: l.ratePaise > 0 ? l.ratePaise : (l.product?.mrpPaise || 10000),
          gstRateBp: l.gstRateBp,
        })),
        idempotencyKey: `post_grn_${scan.id}`,
      },
      ip
    );

    // Learn aliases for next time
    if (scan.companyId) {
      for (const line of validLines) {
        if (line.productId && line.parsedName) {
          await productMatcher.recordConfirmedAlias(
            scan.companyId,
            line.parsedName,
            line.productId
          );
        }
      }
    }

    // Shortage handling: if any line is SHORT, calculate shortage value
    const shortages = scan.lines.filter((l) => l.variance === BillScanVariance.SHORT);
    if (shortages.length > 0 && scan.supplierPartyId) {
      let shortagePaise = 0;
      for (const sh of shortages) {
        const shortQty = sh.billedQtyPieces - sh.countedPieces;
        shortagePaise += Math.round((shortQty * sh.ratePaise * (10000 + sh.gstRateBp)) / 10000);
      }

      if (shortagePaise > 0) {
        // Record Debit Note draft entry for the supplier
        await prisma.ledgerEntry.create({
          data: {
            partyId: scan.supplierPartyId,
            kind: LedgerKind.DEBIT_NOTE,
            debitPaise: shortagePaise,
            referenceType: "PURCHASE_SHORTAGE",
            referenceId: purchaseResult.id,
          },
        });
      }
    }

    // Mark Scan as POSTED
    await prisma.billScan.update({
      where: { id: scan.id },
      data: {
        status: BillScanStatus.POSTED,
        postedAt: new Date(),
        purchaseId: purchaseResult.id,
      },
    });

    await auditService.log({
      actorId,
      action: "BILL_SCAN_POSTED",
      entity: "BillScan",
      entityId: scan.id,
      ip,
      after: {
        purchaseId: purchaseResult.id,
        receivedPieces: validLines.reduce((sum, l) => sum + l.countedPieces, 0),
        billTotalPaise: scan.billTotalPaise,
      },
    });

    return this.getScan(actorRole, scan.id);
  }

  /**
   * Secure image streaming from private R2 bills bucket
   */
  async getBillImageStream(
    actorRole: UserRole,
    scanId: string,
    keyOrIndex: string | number
  ): Promise<{ stream: ReadableStream | Buffer; contentType: string }> {
    assertPermission(actorRole, Permission.STOCK_VIEW);

    const scan = await prisma.billScan.findUnique({
      where: { id: scanId },
      select: { imageKeys: true },
    });

    if (!scan || scan.imageKeys.length === 0) {
      throw new Error("Bill images not found");
    }

    let targetKey: string;
    if (typeof keyOrIndex === "number") {
      targetKey = scan.imageKeys[keyOrIndex] || scan.imageKeys[0];
    } else if (scan.imageKeys.includes(keyOrIndex)) {
      targetKey = keyOrIndex;
    } else {
      targetKey = scan.imageKeys[0];
    }

    const storage = getStorage();
    const obj = await storage.get(targetKey);
    if (!obj) {
      throw new Error("Image not found in storage");
    }

    return {
      stream: obj.body,
      contentType: obj.contentType || "image/jpeg",
    };
  }
}

export const receivingService = new ReceivingService();
