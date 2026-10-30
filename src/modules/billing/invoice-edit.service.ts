import { prisma } from "@/lib/prisma";
import { Prisma, UserRole, InvoiceStatus, PaymentStatus, LedgerKind, MovementType } from "@prisma/client";
import { stockService } from "@/modules/stock/stock.service";
import { calculateLineGst, calculateInvoiceTotals } from "@/lib/gst";
import { validateManualDate } from "@/lib/datetime";

export interface EditInvoiceItemInput {
  productId: string;
  qty: number; // in integer pieces
  mrpPaise?: number | null;
  ratePaise?: number | null;
  discountBp?: number;
}

export interface EditInvoiceInput {
  invoiceId: string;
  expectedVersion?: number;
  reason: string;
  partyId?: string | null;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  invoiceDate?: Date | string | null;
  dateChangeReason?: string;
  items: EditInvoiceItemInput[];
  notes?: string;
}

export interface InvoiceEditPreview {
  invoiceNumber: string;
  oldTotalPaise: number;
  newTotalPaise: number;
  totalDiffPaise: number;
  oldItemCount: number;
  newItemCount: number;
  stockChanges: {
    productId: string;
    productName: string;
    oldQty: number;
    newQty: number;
    deltaQty: number; // positive = deduct more, negative = restore
  }[];
  gstChanges: {
    taxableDiffPaise: number;
    cgstDiffPaise: number;
    sgstDiffPaise: number;
    igstDiffPaise: number;
  };
  ledgerImpactPaise: number; // positive = party owes more
}

export class InvoiceEditService {
  /**
   * Generates a side-by-side preview of what will change upon editing an invoice.
   */
  async previewInvoiceEdit(
    input: EditInvoiceInput
  ): Promise<InvoiceEditPreview> {
    const invoice = await prisma.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        items: { include: { product: true } },
        party: true,
      },
    });

    if (!invoice) throw new Error("Invoice not found");
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new Error("Cancelled invoices cannot be modified");
    }

    // Build product map for new items
    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const prodMap = new Map(products.map((p) => [p.id, p]));

    const isInterState = invoice.igstPaise > 0;
    const gstLines = input.items.map((it) => {
      const prod = prodMap.get(it.productId);
      if (!prod) throw new Error(`Product not found: ${it.productId}`);
      const mrp = it.mrpPaise ?? prod.mrpPaise ?? 0;
      const rate = it.ratePaise ?? mrp;
      const discountBp =
        mrp > rate ? Math.round(((mrp - rate) / mrp) * 10000) : it.discountBp || 0;
      const gstRateBp = prod.gstRateBp || 0;

      return calculateLineGst({
        mrpPaise: mrp,
        qty: it.qty,
        discountBp,
        gstRateBp,
        isInterState,
      });
    });

    const invoiceTotals = calculateInvoiceTotals(gstLines, 0);

    // Compute stock changes
    const oldQtyMap = new Map<string, number>();
    for (const item of invoice.items) {
      oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + item.qty);
    }

    const newQtyMap = new Map<string, number>();
    for (const item of input.items) {
      newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + item.qty);
    }

    const allProdIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));
    const allProducts = await prisma.product.findMany({
      where: { id: { in: allProdIds } },
    });
    const allProdMap = new Map(allProducts.map((p) => [p.id, p]));

    const stockChanges = allProdIds.map((pid) => {
      const oldQty = oldQtyMap.get(pid) || 0;
      const newQty = newQtyMap.get(pid) || 0;
      return {
        productId: pid,
        productName: allProdMap.get(pid)?.name || "Item",
        oldQty,
        newQty,
        deltaQty: newQty - oldQty,
      };
    });

    return {
      invoiceNumber: invoice.number,
      oldTotalPaise: invoice.totalPaise,
      newTotalPaise: invoiceTotals.totalPaise,
      totalDiffPaise: invoiceTotals.totalPaise - invoice.totalPaise,
      oldItemCount: invoice.items.length,
      newItemCount: input.items.length,
      stockChanges,
      gstChanges: {
        taxableDiffPaise: invoiceTotals.taxablePaise - invoice.taxablePaise,
        cgstDiffPaise: invoiceTotals.cgstPaise - invoice.cgstPaise,
        sgstDiffPaise: invoiceTotals.sgstPaise - invoice.sgstPaise,
        igstDiffPaise: invoiceTotals.igstPaise - invoice.igstPaise,
      },
      ledgerImpactPaise: invoiceTotals.totalPaise - invoice.totalPaise,
    };
  }

  /**
   * Atomically modifies an invoice with full revision history, append-only stock delta movements,
   * GST recomputation, and party ledger adjustments.
   */
  async modifyInvoice(
    role: UserRole,
    input: EditInvoiceInput,
    actorId?: string
  ) {
    if (!input.reason || input.reason.trim().length < 3) {
      throw new Error("A valid reason (minimum 3 characters) is required to edit an invoice.");
    }

    const allowedRoles: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.ACCOUNTS,
      UserRole.SHOP,
    ];
    if (!allowedRoles.includes(role)) {
      throw new Error("You do not have permission to modify invoices.");
    }

    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          items: { include: { product: true } },
          payments: true,
          party: true,
        },
      });

      if (!invoice) throw new Error("Invoice not found");
      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new Error("Cancelled invoices cannot be modified");
      }

      // Optimistic concurrency check
      if (input.expectedVersion !== undefined && invoice.version !== input.expectedVersion) {
        throw new Error("Conflict: This invoice was modified by another user. Please refresh and try again.");
      }

      // Check date validity if date is changing
      let targetDate = invoice.invoiceDate || invoice.createdAt;
      if (input.invoiceDate) {
        const parsedDate = new Date(input.invoiceDate);
        const dateCheck = validateManualDate({
          date: parsedDate,
          maxBackDays: role === UserRole.SHOP ? 7 : 30,
        });
        if (!dateCheck.valid) {
          throw new Error(dateCheck.error);
        }
        targetDate = parsedDate;
      }

      // Snapshot before edit
      const beforeSnapshot = {
        invoice: {
          number: invoice.number,
          partyId: invoice.partyId,
          customerName: invoice.customerName,
          customerPhone: invoice.customerPhone,
          customerAddress: invoice.customerAddress,
          invoiceDate: invoice.invoiceDate,
          subtotalPaise: invoice.subtotalPaise,
          discountPaise: invoice.discountPaise,
          taxablePaise: invoice.taxablePaise,
          cgstPaise: invoice.cgstPaise,
          sgstPaise: invoice.sgstPaise,
          igstPaise: invoice.igstPaise,
          roundOffPaise: invoice.roundOffPaise,
          totalPaise: invoice.totalPaise,
          version: invoice.version,
        },
        items: invoice.items.map((it) => ({
          productId: it.productId,
          qty: it.qty,
          mrpPaise: it.mrpPaise,
          unitPricePaise: it.unitPricePaise,
          discountBp: it.discountBp,
          taxablePaise: it.taxablePaise,
          taxPaise: it.taxPaise,
          lineTotalPaise: it.unitPricePaise * it.qty,
        })),
      };

      // 1. Compute product pricing & GST
      const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const prodMap = new Map(products.map((p) => [p.id, p]));

      const isInterState = invoice.igstPaise > 0;
      const gstLines = input.items.map((it) => {
        const prod = prodMap.get(it.productId);
        if (!prod) throw new Error(`Product not found: ${it.productId}`);
        const mrp = it.mrpPaise ?? prod.mrpPaise ?? 0;
        const rate = it.ratePaise ?? mrp;
        const discountBp =
          mrp > rate ? Math.round(((mrp - rate) / mrp) * 10000) : it.discountBp || 0;
        const gstRateBp = prod.gstRateBp || 0;

        return calculateLineGst({
          mrpPaise: mrp,
          qty: it.qty,
          discountBp,
          gstRateBp,
          isInterState,
        });
      });

      const invoiceTotals = calculateInvoiceTotals(gstLines, 0);

      // 2. Compute and post append-only Stock Deltas
      const oldQtyMap = new Map<string, number>();
      for (const item of invoice.items) {
        oldQtyMap.set(item.productId, (oldQtyMap.get(item.productId) || 0) + item.qty);
      }
      const newQtyMap = new Map<string, number>();
      for (const item of input.items) {
        newQtyMap.set(item.productId, (newQtyMap.get(item.productId) || 0) + item.qty);
      }

      const allProdIds = Array.from(new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]));
      const nextRevisionNum = (await tx.invoiceRevision.count({ where: { invoiceId: invoice.id } })) + 1;

      for (const pid of allProdIds) {
        const oldQty = oldQtyMap.get(pid) || 0;
        const newQty = newQtyMap.get(pid) || 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          // More stock needed -> Deduct additional via MovementType.SALE
          await stockService.postMovement(
            {
              type: MovementType.SALE,
              productId: pid,
              fromLocationId: invoice.locationId,
              toLocationId: null,
              qty: delta,
              referenceType: "INVOICE_EDIT",
              referenceId: invoice.id,
              reason: `Invoice #${invoice.number} edit (Rev ${nextRevisionNum}): +${delta} pcs`,
              idempotencyKey: `edit_${invoice.id}_rev${nextRevisionNum}_inc_${pid}_${Date.now()}`,
              actorId,
              effectiveDate: targetDate,
            },
            tx
          );
        } else if (delta < 0) {
          // Less stock needed -> Restore stock via MovementType.SALE_CANCEL
          const restoreQty = Math.abs(delta);
          await stockService.postMovement(
            {
              type: MovementType.SALE_CANCEL,
              productId: pid,
              fromLocationId: null,
              toLocationId: invoice.locationId,
              qty: restoreQty,
              referenceType: "INVOICE_EDIT",
              referenceId: invoice.id,
              reason: `Invoice #${invoice.number} edit (Rev ${nextRevisionNum}): restore ${restoreQty} pcs`,
              idempotencyKey: `edit_${invoice.id}_rev${nextRevisionNum}_dec_${pid}_${Date.now()}`,
              actorId,
              effectiveDate: targetDate,
            },
            tx
          );
        }
      }

      // 3. Ledger adjustments for linked parties
      const effectivePartyId = input.partyId !== undefined ? input.partyId : invoice.partyId;
      const totalDifferencePaise = invoiceTotals.totalPaise - invoice.totalPaise;

      if (effectivePartyId && totalDifferencePaise !== 0) {
        if (totalDifferencePaise > 0) {
          // Party owes more -> Debit ledger
          await tx.ledgerEntry.create({
            data: {
              partyId: effectivePartyId,
              kind: LedgerKind.INVOICE,
              debitPaise: totalDifferencePaise,
              creditPaise: 0,
              createdAt: targetDate,
              effectiveDate: targetDate,
              referenceType: "INVOICE_EDIT",
              referenceId: invoice.id,
            },
          });
        } else {
          // Party owes less -> Credit ledger
          await tx.ledgerEntry.create({
            data: {
              partyId: effectivePartyId,
              kind: LedgerKind.RECEIPT,
              debitPaise: 0,
              creditPaise: Math.abs(totalDifferencePaise),
              createdAt: targetDate,
              effectiveDate: targetDate,
              referenceType: "INVOICE_EDIT",
              referenceId: invoice.id,
            },
          });
        }
      }

      // 4. Replace invoice items
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: invoice.id },
      });

      await tx.invoiceItem.createMany({
        data: input.items.map((it, idx) => {
          const prod = prodMap.get(it.productId);
          const gstRes = gstLines[idx];
          return {
            invoiceId: invoice.id,
            productId: it.productId,
            qty: it.qty,
            mrpPaise: gstRes.mrpPaise,
            unitPricePaise: gstRes.unitPricePaise,
            discountBp: gstRes.discountBp,
            taxablePaise: gstRes.taxablePaise,
            taxPaise: gstRes.taxPaise,
            gstRateBp: gstRes.gstRateBp,
            hsn: prod?.hsn || "21069099",
          };
        }),
      });

      // 5. Update invoice record
      const totalPaidPaise = invoice.payments.reduce((sum, p) => sum + p.amountPaise, 0);
      const newPaymentStatus =
        totalPaidPaise >= invoiceTotals.totalPaise
          ? PaymentStatus.PAID
          : totalPaidPaise > 0
          ? PaymentStatus.PARTIAL
          : PaymentStatus.PENDING;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          partyId: effectivePartyId,
          customerName: input.customerName !== undefined ? input.customerName : invoice.customerName,
          customerPhone: input.customerPhone !== undefined ? input.customerPhone : invoice.customerPhone,
          customerAddress: input.customerAddress !== undefined ? input.customerAddress : invoice.customerAddress,
          invoiceDate: targetDate,
          dateChangeReason: input.dateChangeReason || invoice.dateChangeReason,
          subtotalPaise: invoiceTotals.subtotalPaise,
          discountPaise: invoiceTotals.lineDiscountPaise + invoiceTotals.orderDiscountPaise,
          taxablePaise: invoiceTotals.taxablePaise,
          cgstPaise: invoiceTotals.cgstPaise,
          sgstPaise: invoiceTotals.sgstPaise,
          igstPaise: invoiceTotals.igstPaise,
          roundOffPaise: invoiceTotals.roundOffPaise,
          totalPaise: invoiceTotals.totalPaise,
          paymentStatus: newPaymentStatus,
          notes: input.notes !== undefined ? input.notes : invoice.notes,
          version: invoice.version + 1,
          isRevised: true,
        },
        include: {
          items: { include: { product: true } },
          payments: true,
          party: true,
          revisions: true,
        },
      });

      // 6. Record InvoiceRevision
      const afterSnapshot = {
        invoice: {
          number: updatedInvoice.number,
          partyId: updatedInvoice.partyId,
          customerName: updatedInvoice.customerName,
          customerPhone: updatedInvoice.customerPhone,
          customerAddress: updatedInvoice.customerAddress,
          invoiceDate: updatedInvoice.invoiceDate,
          subtotalPaise: updatedInvoice.subtotalPaise,
          discountPaise: updatedInvoice.discountPaise,
          taxablePaise: updatedInvoice.taxablePaise,
          cgstPaise: updatedInvoice.cgstPaise,
          sgstPaise: updatedInvoice.sgstPaise,
          igstPaise: updatedInvoice.igstPaise,
          roundOffPaise: updatedInvoice.roundOffPaise,
          totalPaise: updatedInvoice.totalPaise,
          version: updatedInvoice.version,
        },
        items: gstLines,
      };

      await tx.invoiceRevision.create({
        data: {
          invoiceId: invoice.id,
          revisionNumber: nextRevisionNum,
          beforeSnapshot: JSON.parse(JSON.stringify(beforeSnapshot)) as Prisma.InputJsonValue,
          afterSnapshot: JSON.parse(JSON.stringify(afterSnapshot)) as Prisma.InputJsonValue,
          diff: {
            totalDiffPaise: totalDifferencePaise,
            itemCountDiff: input.items.length - invoice.items.length,
            reason: input.reason,
          },
          reason: input.reason,
          editorUserId: actorId || null,
        },
      });

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          actorId: actorId || null,
          action: "INVOICE_MODIFIED",
          entity: "Invoice",
          entityId: invoice.id,
          after: {
            invoiceNumber: invoice.number,
            revisionNumber: nextRevisionNum,
            reason: input.reason,
            totalBefore: invoice.totalPaise,
            totalAfter: invoiceTotals.totalPaise,
          },
        },
      });

      return updatedInvoice;
    });
  }
}

export const invoiceEditService = new InvoiceEditService();
