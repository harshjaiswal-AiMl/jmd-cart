import { prisma } from "@/lib/prisma";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { pricingService } from "@/modules/pricing/pricing.service";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { cartService } from "@/modules/cart/cart.service";
import { auditService } from "@/modules/audit/audit.service";
import { LocationType } from "@prisma/client";
import {
  CreateOrderInput,
  createOrderInputSchema,
  OrderSummary,
  OrderItemSummary,
  OrderStatus,
} from "./order.types";
import { orderRepository, OrderRepository } from "./order.repository";

export class OrderService {
  constructor(private readonly repo: OrderRepository = orderRepository) {}

  /**
   * Creates an online store order from the user's active shopping cart:
   * 1. Validates cart has items.
   * 2. Checks and verifies stock availability across Shop and Godown locations.
   * 3. Calculates slab pricing, GST, and delivery charges.
   * 4. Enforces minimum order limits for the selected delivery zone.
   * 5. Atomically generates a gapless sequential order number (ORD/<FY>/<6 digits>).
   * 6. Creates the Order and OrderItem records, and clears the user's active cart.
   * 7. Logs the audit event.
   */
  async createOrderFromCart(
    userId: string,
    input: CreateOrderInput,
    ip?: string
  ): Promise<OrderSummary> {
    const validated = createOrderInputSchema.parse(input);

    // 1. Idempotency check: if key already exists, return existing order immediately
    if (validated.idempotencyKey) {
      const existing = await this.repo.findOrderByIdempotencyKey(validated.idempotencyKey);
      if (existing) {
        return this.mapOrderToSummary(existing);
      }
    }

    // 2. Check user and cart
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { party: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const cart = await cartService.getCartSummary(userId);
    if (!cart || cart.itemsCount === 0 || cart.lines.length === 0) {
      throw new Error("Cannot checkout an empty shopping cart");
    }

    // 2. Resolve delivery zone & fee
    const zone = await deliveryService.getZoneByCode(validated.deliveryZoneCode);
    const zoneCode = zone?.code || validated.deliveryZoneCode.toUpperCase();
    const zoneName = zone?.name || "Saharsa Delivery";

    const deliveryCalc = await deliveryService.calculateDeliveryFee(
      zoneCode,
      cart.totalPaise
    );

    // Validate minimum order if zone specifies one
    if (zone && cart.totalPaise < zone.minOrderPaise) {
      throw new Error(
        `Minimum order requirement for ${zone.name} is ₹${(zone.minOrderPaise / 100).toFixed(0)}. Current order: ₹${(cart.totalPaise / 100).toFixed(2)}`
      );
    }

    // 3. Verify stock availability (Shop + Godown) for each product
    const shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
    });

    const locationIds = [shopLocation?.id, godownLocation?.id].filter(
      (id): id is string => Boolean(id)
    );

    for (const item of cart.lines) {
      const balances = await prisma.stockBalance.findMany({
        where: {
          productId: item.productId,
          locationId: { in: locationIds },
        },
      });

      const totalAvailable = balances.reduce((acc, b) => acc + b.qty, 0);
      if (totalAvailable < item.qty) {
        throw new Error(
          `Insufficient stock for "${item.productName}". Requested: ${item.qty}, Available in distribution centers: ${totalAvailable}`
        );
      }
    }

    // 4. Fetch product master HSN codes for order items
    const productIds = cart.lines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, hsn: true },
    });
    const hsnMap = new Map(products.map((p) => [p.id, p.hsn]));

    // 5. Calculate total payable including delivery charge
    const deliveryFeePaise = deliveryCalc.deliveryFeePaise;
    const finalTotalPaise = cart.totalPaise + deliveryFeePaise;

    // 6. Execute transactional creation with sequential order numbering and idempotency check
    const order = await prisma.$transaction(async (tx) => {
      // Idempotency check if key provided
      if (validated.idempotencyKey) {
        const existing = await this.repo.findOrderByIdempotencyKey(
          validated.idempotencyKey,
          tx
        );
        if (existing) {
          return existing;
        }
      }

      // Generate gapless sequential order number: ORD/26-27/000001
      const seq = await getNextSequenceNumber(tx, "ORD");

      // Create Order and nested items
      const created = await tx.order.create({
        data: {
          orderNumber: seq.number,
          branchId: 1,
          userId,
          status: OrderStatus.PENDING,
          deliveryZoneCode: zoneCode,
          deliveryZoneName: zoneName,
          deliveryFeePaise,
          subtotalPaise: cart.subtotalPaise,
          lineDiscountPaise: cart.lineDiscountPaise,
          taxablePaise: cart.taxablePaise,
          cgstPaise: Math.round(cart.totalTaxPaise / 2),
          sgstPaise: Math.round(cart.totalTaxPaise / 2),
          igstPaise: 0,
          roundOffPaise: cart.roundOffPaise,
          totalPaise: finalTotalPaise,
          buyerTag: cart.buyerTag,
          deliveryAddress: validated.deliveryAddress.trim(),
          contactPhone: validated.contactPhone.trim(),
          customerNotes: validated.customerNotes?.trim() || null,
          idempotencyKey: validated.idempotencyKey || null,
          items: {
            create: cart.lines.map((line) => {
              const hsn = hsnMap.get(line.productId) || "21069099";
              const discountPaise = (line.mrpPaise - line.pricing.unitPricePaise) * line.qty;

              return {
                productId: line.productId,
                qty: line.qty,
                mrpPaise: line.mrpPaise,
                unitPricePaise: line.pricing.unitPricePaise,
                discountBp: line.pricing.effectiveDiscountBp,
                lineDiscountPaise: Math.max(0, discountPaise),
                taxablePaise: line.pricing.taxablePaise,
                gstRateBp: line.gstRateBp,
                taxPaise: line.pricing.taxPaise,
                hsn,
              };
            }),
          },
        },
        include: {
          user: { select: { id: true, name: true, phone: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, shortCode: true, packSize: true },
              },
            },
          },
        },
      });

      // Clear the user's shopping cart upon successful order placement
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return created;
    });

    // 6. Audit logging
    await auditService.log({
      actorId: userId,
      action: "ORDER_CREATED",
      entity: "Order",
      entityId: order.id,
      after: {
        orderNumber: order.orderNumber,
        status: order.status,
        totalPaise: order.totalPaise,
        buyerTag: order.buyerTag,
        itemCount: order.items.length,
      },
      ip,
    });

    return this.mapOrderToSummary(order);
  }

  async getOrderById(orderId: string): Promise<OrderSummary | null> {
    const order = await this.repo.findOrderById(orderId);
    if (!order) return null;
    return this.mapOrderToSummary(order);
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderSummary | null> {
    const order = await this.repo.findOrderByNumber(orderNumber);
    if (!order) return null;
    return this.mapOrderToSummary(order);
  }

  async listUserOrders(userId: string): Promise<OrderSummary[]> {
    const orders = await this.repo.listUserOrders(userId);
    return orders.map((o) => this.mapOrderToSummary(o));
  }

  async listAllOrders(status?: OrderStatus): Promise<OrderSummary[]> {
    const orders = await this.repo.listAllOrders(status);
    return orders.map((o) => this.mapOrderToSummary(o));
  }

  private mapOrderToSummary(order: any): OrderSummary {
    const items: OrderItemSummary[] = order.items.map((line: any) => {
      const packSize = line.product?.packSize || 1;
      const cartons = Math.floor(line.qty / packSize);
      const loosePieces = line.qty % packSize;

      return {
        id: line.id,
        productId: line.productId,
        productName: line.product?.name || "Unknown Product",
        shortCode: line.product?.shortCode || "",
        packSize,
        qty: line.qty,
        cartons,
        loosePieces,
        mrpPaise: line.mrpPaise,
        unitPricePaise: line.unitPricePaise,
        discountBp: line.discountBp,
        lineDiscountPaise: line.lineDiscountPaise,
        taxablePaise: line.taxablePaise,
        gstRateBp: line.gstRateBp,
        taxPaise: line.taxPaise,
        hsn: line.hsn,
      };
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      userId: order.userId,
      customerName: order.user?.name || "Customer",
      customerPhone: order.user?.phone || order.contactPhone,
      status: order.status,
      deliveryZoneCode: order.deliveryZoneCode,
      deliveryZoneName: order.deliveryZoneName,
      deliveryFeePaise: order.deliveryFeePaise,
      subtotalPaise: order.subtotalPaise,
      lineDiscountPaise: order.lineDiscountPaise,
      taxablePaise: order.taxablePaise,
      cgstPaise: order.cgstPaise,
      sgstPaise: order.sgstPaise,
      igstPaise: order.igstPaise,
      roundOffPaise: order.roundOffPaise,
      totalPaise: order.totalPaise,
      buyerTag: order.buyerTag,
      deliveryAddress: order.deliveryAddress,
      contactPhone: order.contactPhone,
      customerNotes: order.customerNotes,
      invoiceId: order.invoiceId,
      items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export const orderService = new OrderService();
