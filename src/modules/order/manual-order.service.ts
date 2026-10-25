import { Prisma, OrderStatus, OrderChannel, PartyType, PaymentMode, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import { allocationService } from "@/modules/stock/allocation.service";
import { auditService } from "@/modules/audit/audit.service";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { ForbiddenError } from "@/modules/auth/permissions";

export interface CreateManualOrderLine {
  productId: string;
  cartons: number;
  loose: number;
  overrideUnitPricePaise?: number;
  overrideFromShop?: number;
  overrideFromGodown?: number;
}

export interface CreateManualOrderInput {
  partyId: string;
  lines: CreateManualOrderLine[];
  deliveryAddress: string;
  contactPhone: string;
  deliveryZoneCode?: string;
  deliveryZoneName?: string;
  slot?: string;
  paymentMode: PaymentMode;
  paymentReference?: string;
  customerNotes?: string;
  assignedDeliveryUserId?: string;
}

export class ManualOrderService {
  /**
   * Create an order on behalf of a party by Warehouse Manager or Super Admin (Section 5b).
   */
  async createManualOrder(
    input: CreateManualOrderInput,
    actor: { id: string; role: UserRole; name: string }
  ) {
    if (
      actor.role !== UserRole.SUPER_ADMIN &&
      actor.role !== UserRole.ADMIN &&
      actor.role !== UserRole.WAREHOUSE_MANAGER
    ) {
      throw new ForbiddenError("Only Warehouse Manager and Admins can create manual orders");
    }

    if (!input.lines || input.lines.length === 0) {
      throw new Error("Manual order must have at least one product line");
    }

    const party = await prisma.party.findUnique({
      where: { id: input.partyId },
      include: { users: true },
    });

    if (!party) {
      throw new Error("Selected party was not found");
    }

    // Product lookup and pricing
    const productIds = input.lines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Check pricing and compute pieces
    const itemsToAllocate: Array<{
      productId: string;
      requestedPieces: number;
      packSize: number;
      overrideFromShop?: number;
      overrideFromGodown?: number;
    }> = [];

    interface ProcessedLine {
      productId: string;
      productName: string;
      qty: number;
      mrpPaise: number;
      unitPricePaise: number;
      gstRateBp: number;
      taxablePaise: number;
      cgstPaise: number;
      sgstPaise: number;
      igstPaise: number;
      taxPaise: number;
      totalPaise: number;
      hsn: string;
    }

    const processedLines: ProcessedLine[] = [];
    let subtotalPaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalTaxablePaise = 0;

    for (const line of input.lines) {
      const prod = productMap.get(line.productId);
      if (!prod) {
        throw new Error(`Product ${line.productId} not found`);
      }

      const packSize = Math.max(1, prod.packSize || 1);
      const totalPieces = line.cartons * packSize + line.loose;
      if (totalPieces <= 0) {
        throw new Error(`Line quantity for ${prod.name} must be greater than zero`);
      }

      // Resolve price based on party type (Wholesaler=A, Retailer=B, Customer=C)
      const resolved = resolvePrice(
        {
          mrpPaise: prod.mrpPaise,
          priceAPaise: prod.priceAPaise,
          priceBPaise: prod.priceBPaise,
          priceCPaise: prod.priceCPaise,
        },
        party.type
      );

      let unitPricePaise = resolved.unitPricePaise;
      if (line.overrideUnitPricePaise !== undefined) {
        if (actor.role !== UserRole.SUPER_ADMIN && actor.role !== UserRole.ADMIN) {
          throw new ForbiddenError("Only Super Admin or Admin can override tier prices");
        }
        unitPricePaise = line.overrideUnitPricePaise;
      }

      const lineTotalPaise = totalPieces * unitPricePaise;
      const gstRateBp = prod.gstRateBp || 0;
      // GST calculation (intra-state Bihar)
      const lineTaxablePaise = Math.round((lineTotalPaise * 10000) / (10000 + gstRateBp));
      const lineTaxPaise = lineTotalPaise - lineTaxablePaise;
      const cgstPaise = Math.round(lineTaxPaise / 2);
      const sgstPaise = lineTaxPaise - cgstPaise;

      subtotalPaise += lineTotalPaise;
      totalTaxablePaise += lineTaxablePaise;
      totalCgstPaise += cgstPaise;
      totalSgstPaise += sgstPaise;

      processedLines.push({
        productId: prod.id,
        productName: prod.name,
        qty: totalPieces,
        mrpPaise: prod.mrpPaise ?? unitPricePaise,
        unitPricePaise,
        gstRateBp,
        taxablePaise: lineTaxablePaise,
        cgstPaise,
        sgstPaise,
        igstPaise: 0,
        taxPaise: lineTaxPaise,
        totalPaise: lineTotalPaise,
        hsn: prod.hsn || "0000",
      });

      itemsToAllocate.push({
        productId: prod.id,
        requestedPieces: totalPieces,
        packSize,
        overrideFromShop: line.overrideFromShop,
        overrideFromGodown: line.overrideFromGodown,
      });
    }

    const orderTotalPaise = subtotalPaise;

    // Credit limit check
    if (input.paymentMode === PaymentMode.CREDIT) {
      if (!party.creditEnabled) {
        if (actor.role !== UserRole.SUPER_ADMIN) {
          throw new ForbiddenError(`Credit is not enabled for party ${party.name}`);
        }
      } else {
        // Calculate current outstanding
        const ledgerSummary = await prisma.ledgerEntry.aggregate({
          where: { partyId: party.id },
          _sum: { debitPaise: true, creditPaise: true },
        });
        const currentBalance =
          (ledgerSummary._sum.debitPaise ?? 0) - (ledgerSummary._sum.creditPaise ?? 0);
        if (currentBalance + orderTotalPaise > party.creditLimitPaise) {
          if (actor.role !== UserRole.SUPER_ADMIN) {
            throw new ForbiddenError(
              `Credit limit exceeded for ${party.name}. Limit: ₹${(party.creditLimitPaise / 100).toFixed(2)}, Current: ₹${(currentBalance / 100).toFixed(2)}, Order: ₹${(orderTotalPaise / 100).toFixed(2)}`
            );
          }
        }
      }
    }

    // Allocate stock across Shop and Godown
    const allocations = await allocationService.computeAllocation("MANUAL", itemsToAllocate);

    // Verify all lines can be fulfilled
    for (const alloc of allocations) {
      const allocatedTotal = alloc.fromShopPieces + alloc.fromGodownPieces;
      if (allocatedTotal < alloc.requestedPieces) {
        throw new Error(
          `Insufficient stock to fulfill ${alloc.requestedPieces} pieces for product ${alloc.productId}. Allocated: ${allocatedTotal}`
        );
      }
    }

    // Target customer user: Use existing user account if linked to party, else actor
    const targetUserId = party.users[0]?.id || actor.id;

    // Create order and reservations atomically in a transaction
    const createdOrder = await prisma.$transaction(async (tx) => {
      const seq = await getNextSequenceNumber(tx, "ORD");
      const order = await tx.order.create({
        data: {
          orderNumber: seq.number,
          branchId: 1,
          userId: targetUserId,
          partyId: party.id,
          channel: OrderChannel.MANUAL,
          createdByUserId: actor.id,
          status: OrderStatus.CONFIRMED,
          deliveryZoneCode: input.deliveryZoneCode || "ZONE-1",
          deliveryZoneName: input.deliveryZoneName || "Saharsa Town",
          deliveryAddress: input.deliveryAddress || party.address || "Saharsa",
          contactPhone: input.contactPhone || party.phone || "0000000000",
          subtotalPaise,
          taxablePaise: totalTaxablePaise,
          cgstPaise: totalCgstPaise,
          sgstPaise: totalSgstPaise,
          igstPaise: 0,
          totalPaise: orderTotalPaise,
          buyerTag: party.type,
          paymentMode: input.paymentMode,
          paymentReference: input.paymentReference,
          customerNotes: input.customerNotes,
          assignedDeliveryUserId: input.assignedDeliveryUserId,
          items: {
            create: processedLines.map((line) => ({
              productId: line.productId,
              qty: line.qty,
              mrpPaise: line.mrpPaise,
              unitPricePaise: line.unitPricePaise,
              taxablePaise: line.taxablePaise,
              gstRateBp: line.gstRateBp,
              taxPaise: line.taxPaise,
              hsn: line.hsn,
            })),
          },
        },
        include: {
          items: true,
          party: true,
          createdByUser: {
            select: { id: true, name: true, role: true },
          },
        },
      });

      // Reserve stock per location (shop and godown)
      await allocationService.reserveOrderStock(order.id, allocations, tx);

      return order;
    });

    // Audit log
    await auditService.log({
      actorId: actor.id,
      action: "CREATE_MANUAL_ORDER",
      entity: "Order",
      entityId: createdOrder.id,
      after: {
        orderNumber: createdOrder.orderNumber,
        partyName: party.name,
        partyType: party.type,
        totalPaise: createdOrder.totalPaise,
        channel: OrderChannel.MANUAL,
        createdByName: actor.name,
        allocations,
      },
    });

    return {
      order: createdOrder,
      allocations,
    };
  }
}

export const manualOrderService = new ManualOrderService();
