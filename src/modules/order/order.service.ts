import { prisma } from "@/lib/prisma";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { deliveryService } from "@/modules/delivery/delivery.service";
import { cartService } from "@/modules/cart/cart.service";
import { auditService } from "@/modules/audit/audit.service";
import { stockService } from "@/modules/stock/stock.service";
import {
  InvoiceChannel,
  InvoiceStatus,
  LedgerKind,
  LocationType,
  MovementType,
  PaymentMode,
  PaymentStatus,
  UserRole,
} from "@prisma/client";
import { assertPermission, hasPermission, Permission, ForbiddenError } from "@/modules/auth/permissions";
import { getEInvoiceProvider } from "@/lib/e-invoice";
import { settingsService } from "@/modules/settings/settings.service";
import { billingRepository } from "@/modules/billing/billing.repository";
import {
  CreateOrderInput,
  createOrderInputSchema,
  AssignDeliveryInput,
  assignDeliveryInputSchema,
  RecordDeliveryPaymentInput,
  recordDeliveryPaymentInputSchema,
  OrderSummary,
  OrderItemSummary,
  OrderStatus,
  SplitPickLists,
  PickListItem,
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
          assignedDeliveryUser: { select: { id: true, name: true, phone: true } },
          invoice: { select: { id: true, number: true, paymentStatus: true, totalPaise: true } },
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

  /**
   * List deliveries assigned to a specific delivery staff member.
   */
  async listOrdersForDelivery(staffId: string, status?: OrderStatus): Promise<OrderSummary[]> {
    const orders = await this.repo.listOrdersForDeliveryStaff(staffId, status);
    return orders.map((o) => this.mapOrderToSummary(o));
  }

  /**
   * Reorders items from a past order into the user's shopping cart:
   * 1. Verifies order ownership (actorId === order.userId or actorRole === SUPER_ADMIN).
   * 2. Checks active status of products.
   * 3. Adds active items into the buyer's active cart.
   * 4. Logs audit event and returns summary.
   */
  async reorderItems(
    actorRole: UserRole,
    actorId: string,
    orderId: string,
    ip?: string
  ): Promise<{ addedCount: number; skippedCount: number; skippedNames: string[] }> {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.userId !== actorId && actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenError("You cannot reorder items from another customer's order");
    }

    let addedCount = 0;
    const skippedNames: string[] = [];

    for (const item of order.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product || !product.active) {
        skippedNames.push(item.product?.name || "Discontinued item");
        continue;
      }

      await cartService.addToCart(actorId, item.productId, item.qty);
      addedCount += 1;
    }

    await auditService.log({
      actorId,
      action: "ORDER_REORDERED",
      entity: "Order",
      entityId: order.id,
      after: {
        addedCount,
        skippedCount: skippedNames.length,
      },
      ip,
    });

    return {
      addedCount,
      skippedCount: skippedNames.length,
      skippedNames,
    };
  }

  /**
   * Updates an order's status (e.g. PENDING -> CONFIRMED -> PROCESSING -> DISPATCHED -> DELIVERED or CANCELLED).
   * Guarded by MANAGE_ORDERS permission.
   */
  async updateOrderStatus(
    actorRole: UserRole,
    actorId: string,
    orderId: string,
    newStatus: OrderStatus,
    ip?: string
  ): Promise<OrderSummary> {
    assertPermission(actorRole, Permission.MANAGE_ORDERS);

    const existing = await this.repo.findOrderById(orderId);
    if (!existing) {
      throw new Error(`Order ${orderId} not found`);
    }

    const previousStatus = existing.status;
    await this.repo.updateOrderStatus(orderId, newStatus);

    await auditService.log({
      actorId,
      action: "ORDER_STATUS_UPDATED",
      entity: "Order",
      entityId: orderId,
      before: { status: previousStatus },
      after: { status: newStatus },
      ip,
    });

    const fullOrder = await this.repo.findOrderById(orderId);
    return this.mapOrderToSummary(fullOrder!);
  }

  /**
   * Assigns a delivery staff user to an order.
   * Guarded by MANAGE_ORDERS permission.
   */
  async assignDeliveryStaff(
    actorRole: UserRole,
    actorId: string,
    input: AssignDeliveryInput,
    ip?: string
  ): Promise<OrderSummary> {
    assertPermission(actorRole, Permission.MANAGE_ORDERS);
    const validated = assignDeliveryInputSchema.parse(input);

    const order = await this.repo.findOrderById(validated.orderId);
    if (!order) {
      throw new Error(`Order ${validated.orderId} not found`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error(`Cannot assign delivery to cancelled order ${order.orderNumber}`);
    }

    const staff = await prisma.user.findUnique({
      where: { id: validated.deliveryStaffId },
    });

    if (!staff || !staff.active) {
      throw new Error("Delivery staff member is not found or inactive");
    }

    if (
      staff.role !== UserRole.DELIVERY &&
      staff.role !== UserRole.SUPER_ADMIN &&
      staff.role !== UserRole.SALESPERSON
    ) {
      throw new Error(`User '${staff.name}' (${staff.role}) cannot be assigned deliveries`);
    }

    const previousAssigned = order.assignedDeliveryUserId;
    await this.repo.assignDeliveryStaff(validated.orderId, staff.id);

    // If order was in PROCESSING or CONFIRMED state, update to DISPATCHED when delivery staff is assigned
    let newStatus = order.status;
    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.PROCESSING) {
      newStatus = OrderStatus.DISPATCHED;
      await this.repo.updateOrderStatus(order.id, newStatus);
    }

    await auditService.log({
      actorId,
      action: "ORDER_DELIVERY_ASSIGNED",
      entity: "Order",
      entityId: order.id,
      before: { assignedDeliveryUserId: previousAssigned, status: order.status },
      after: {
        assignedDeliveryUserId: staff.id,
        assignedDeliveryUserName: staff.name,
        status: newStatus,
      },
      ip,
    });

    const updated = await this.repo.findOrderById(order.id);
    return this.mapOrderToSummary(updated!);
  }

  /**
   * Generates a single sales invoice for an online store order (PRD Rule 5 & 14):
   * 1. Validates that no invoice has already been issued for this order (one invoice per order).
   * 2. Issues next gapless IST FY invoice number (INV/26-27/XXXXXX) with row locking.
   * 3. Freezes prices, discounts, taxes and delivery charges.
   * 4. Deducts stock atomically via MovementType.SALE from distribution centers (Shop loose, Godown packs).
   * 5. Debits customer ledger if customer is an established party.
   * 6. Links order.invoiceId atomically.
   */
  async generateOrderInvoice(
    actorRole: UserRole,
    actorId: string,
    orderId: string,
    ip?: string
  ): Promise<OrderSummary> {
    assertPermission(actorRole, Permission.MANAGE_ORDERS);

    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    if (order.invoiceId) {
      throw new Error(
        `Order ${order.orderNumber} already has invoice #${order.invoice?.number || order.invoiceId}`
      );
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error(`Cannot generate invoice for cancelled order ${order.orderNumber}`);
    }

    const customerUser = await prisma.user.findUnique({
      where: { id: order.userId },
      include: { party: true },
    });

    const shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN, active: true },
    });

    const defaultInvoiceLocationId = shopLocation?.id || godownLocation?.id || "loc-shop-main";

    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Assign gapless sequence number: INV/26-27/XXXXXX
      const { number: invoiceNumber, fy } = await getNextSequenceNumber(tx, "INV");

      // 2. Fetch product metadata
      const productIds = order.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, hsn: true, packSize: true },
      });
      const prodMap = new Map(products.map((p) => [p.id, p]));

      // 3. Create Invoice record
      const inv = await tx.invoice.create({
        data: {
          number: invoiceNumber,
          fy,
          status: InvoiceStatus.FINAL,
          channel: InvoiceChannel.ONLINE,
          locationId: defaultInvoiceLocationId,
          partyId: customerUser?.partyId || null,
          buyerType: order.buyerTag,
          notes: `Order #${order.orderNumber}${
            order.deliveryFeePaise > 0
              ? ` (Includes ₹${(order.deliveryFeePaise / 100).toFixed(2)} delivery fee)`
              : ""
          }`,
          subtotalPaise: order.subtotalPaise,
          discountPaise: order.lineDiscountPaise,
          taxablePaise: order.taxablePaise,
          cgstPaise: order.cgstPaise,
          sgstPaise: order.sgstPaise,
          igstPaise: order.igstPaise,
          roundOffPaise: order.roundOffPaise,
          totalPaise: order.totalPaise,
          paymentStatus: PaymentStatus.PENDING,
          createdBy: actorId,
          finalizedAt: new Date(),
          items: {
            create: order.items.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              mrpPaise: item.mrpPaise,
              discountBp: item.discountBp,
              unitPricePaise: item.unitPricePaise,
              taxablePaise: item.taxablePaise,
              gstRateBp: item.gstRateBp,
              taxPaise: item.taxPaise,
              hsn: item.hsn,
            })),
          },
        },
      });

      // 4. Stock deduction (MovementType.SALE) per PRD Rule:
      // Orders fulfil from shop (loose pieces) and godown (unopened cartons)
      for (const item of order.items) {
        const prod = prodMap.get(item.productId);
        const packSize = prod?.packSize || 1;
        const cartons = Math.floor(item.qty / packSize);
        const loosePieces = item.qty % packSize;

        // A. Full cartons: Deduct from Godown (or Shop fallback)
        if (cartons > 0 && packSize > 1) {
          const cartonPcs = cartons * packSize;
          let fromLocId = godownLocation?.id;

          if (fromLocId) {
            const godownBal = await tx.stockBalance.findUnique({
              where: {
                productId_locationId: {
                  productId: item.productId,
                  locationId: fromLocId,
                },
              },
            });
            if (!godownBal || godownBal.qty < cartonPcs) {
              fromLocId = shopLocation?.id || fromLocId;
            }
          } else {
            fromLocId = shopLocation?.id || "loc-shop-main";
          }

          await stockService.postMovement(
            {
              type: MovementType.SALE,
              productId: item.productId,
              fromLocationId: fromLocId,
              toLocationId: null,
              qty: cartonPcs,
              referenceType: "INVOICE",
              referenceId: inv.id,
              reason: `Order #${order.orderNumber} (Packs) / Invoice #${invoiceNumber}`,
              idempotencyKey: `ord_${order.id}_sale_pack_${item.productId}`,
              actorId,
            },
            tx
          );
        }

        // B. Loose pieces: Deduct from Shop (or Godown fallback)
        const looseQty = packSize === 1 ? item.qty : loosePieces;
        if (looseQty > 0) {
          let fromLocId = shopLocation?.id;

          if (fromLocId) {
            const shopBal = await tx.stockBalance.findUnique({
              where: {
                productId_locationId: {
                  productId: item.productId,
                  locationId: fromLocId,
                },
              },
            });
            if (!shopBal || shopBal.qty < looseQty) {
              fromLocId = godownLocation?.id || fromLocId;
            }
          } else {
            fromLocId = godownLocation?.id || "loc-godown-main";
          }

          await stockService.postMovement(
            {
              type: MovementType.SALE,
              productId: item.productId,
              fromLocationId: fromLocId,
              toLocationId: null,
              qty: looseQty,
              referenceType: "INVOICE",
              referenceId: inv.id,
              reason: `Order #${order.orderNumber} (Loose) / Invoice #${invoiceNumber}`,
              idempotencyKey: `ord_${order.id}_sale_loose_${item.productId}`,
              actorId,
            },
            tx
          );
        }
      }

      // 5. Debit customer ledger if customer is an established credit party
      if (customerUser?.partyId) {
        await tx.ledgerEntry.create({
          data: {
            partyId: customerUser.partyId,
            kind: LedgerKind.INVOICE,
            debitPaise: order.totalPaise,
            creditPaise: 0,
            referenceType: "INVOICE",
            referenceId: inv.id,
          },
        });
      }

      // 6. Link invoice to order & advance status to PROCESSING if pending
      const nextStatus =
        order.status === OrderStatus.PENDING || order.status === OrderStatus.CONFIRMED
          ? OrderStatus.PROCESSING
          : order.status;

      await tx.order.update({
        where: { id: order.id },
        data: {
          invoiceId: inv.id,
          status: nextStatus,
        },
      });

      return inv;
    });

    // 7. E-Invoice Adapter Hook (No-op until GSP credentials per PRD 5.10 & 11)
    try {
      const fullInvoice = await billingRepository.findById(invoice.id);
      if (fullInvoice) {
        const eInvoiceProvider = getEInvoiceProvider();
        if (eInvoiceProvider.isEligible(fullInvoice)) {
          const businessDetails = await settingsService.getBusinessDetails();
          const irnResult = await eInvoiceProvider.generateIrn(fullInvoice, businessDetails);
          if (irnResult.success && irnResult.irn) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                irn: irnResult.irn,
                qr: irnResult.qrCode ?? null,
              },
            });
          }
        }
      }
    } catch (eInvoiceErr) {
      console.error(
        `[E-Invoice] Non-blocking adapter warning for order invoice ${invoice.number}:`,
        eInvoiceErr
      );
    }

    // 8. Audit logging
    await auditService.log({
      actorId,
      action: "ORDER_INVOICE_GENERATED",
      entity: "Order",
      entityId: order.id,
      after: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        totalPaise: invoice.totalPaise,
      },
      ip,
    });

    const updated = await this.repo.findOrderById(order.id);
    return this.mapOrderToSummary(updated!);
  }

  /**
   * Records proof of delivery and payment collection by delivery staff.
   * 1. Transitions order to DELIVERED with deliveredAt timestamp.
   * 2. Sets paymentMode, paymentReference, notes.
   * 3. Marks linked Invoice paymentStatus = PAID, and creates Payment record.
   * 4. If customer is a linked party, records RECEIPT credit ledger entry.
   */
  async recordOrderDeliveryAndPayment(
    actorRole: UserRole,
    actorId: string,
    input: RecordDeliveryPaymentInput,
    ip?: string
  ): Promise<OrderSummary> {
    const validated = recordDeliveryPaymentInputSchema.parse(input);

    const order = await this.repo.findOrderById(validated.orderId);
    if (!order) {
      throw new Error(`Order ${validated.orderId} not found`);
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new Error(`Order ${order.orderNumber} is already marked as DELIVERED`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new Error(`Cannot deliver cancelled order ${order.orderNumber}`);
    }

    // Authorization check: Actor must be assigned delivery staff, or have DELIVERY_EXECUTE or MANAGE_ORDERS
    const isAssignedStaff = order.assignedDeliveryUserId === actorId;
    const canExecute =
      hasPermission(actorRole, Permission.DELIVERY_EXECUTE) ||
      hasPermission(actorRole, Permission.MANAGE_ORDERS) ||
      actorRole === UserRole.SUPER_ADMIN;

    if (!isAssignedStaff && !canExecute) {
      throw new ForbiddenError(
        "You are not assigned to this delivery and lack permissions to record delivery completion"
      );
    }

    const customerUser = await prisma.user.findUnique({
      where: { id: order.userId },
      include: { party: true },
    });

    await prisma.$transaction(async (tx) => {
      // 1. Update Order status and delivery details
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          paymentMode: validated.paymentMode,
          paymentReference: validated.paymentReference?.trim() || null,
          paymentNotes: validated.notes?.trim() || null,
        },
      });

      // 2. If Invoice is attached, record Payment and mark invoice PAID
      if (order.invoiceId) {
        await tx.invoice.update({
          where: { id: order.invoiceId },
          data: { paymentStatus: PaymentStatus.PAID },
        });

        await tx.payment.create({
          data: {
            invoiceId: order.invoiceId,
            partyId: customerUser?.partyId || null,
            mode: validated.paymentMode,
            amountPaise: order.totalPaise,
            receivedBy: actorId,
            notes: `Collected on delivery for Order #${order.orderNumber}${
              validated.paymentReference ? ` (Ref: ${validated.paymentReference})` : ""
            }`,
          },
        });

        // 3. Post RECEIPT credit entry to party ledger if customer is an established party
        if (customerUser?.partyId) {
          await tx.ledgerEntry.create({
            data: {
              partyId: customerUser.partyId,
              kind: LedgerKind.RECEIPT,
              debitPaise: 0,
              creditPaise: order.totalPaise,
              referenceType: "PAYMENT",
              referenceId: order.invoiceId,
            },
          });
        }
      }
    });

    // 4. Audit logging
    await auditService.log({
      actorId,
      action: "ORDER_DELIVERED",
      entity: "Order",
      entityId: order.id,
      after: {
        status: OrderStatus.DELIVERED,
        paymentMode: validated.paymentMode,
        paymentReference: validated.paymentReference,
        amountCollectedPaise: order.totalPaise,
      },
      ip,
    });

    const updated = await this.repo.findOrderById(order.id);
    return this.mapOrderToSummary(updated!);
  }

  /**
   * Generates split pick lists for an order:
   * - Shop Pick List: loose items needed for fulfilment (qty % packSize > 0, or packSize == 1)
   * - Godown Pick List: whole unopened cartons/packs needed for fulfilment (Math.floor(qty / packSize) > 0)
   */
  async getSplitPickLists(orderId: string): Promise<SplitPickLists> {
    const order = await this.repo.findOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const shopLoosePicks: PickListItem[] = [];
    const godownPackPicks: PickListItem[] = [];

    let totalCartons = 0;
    let totalLoosePieces = 0;

    for (const item of order.items) {
      const packSize = item.product.packSize || 1;
      const cartons = Math.floor(item.qty / packSize);
      const loosePieces = item.qty % packSize;

      // If full cartons exist, add to Godown Pack pick list
      if (cartons > 0 && packSize > 1) {
        godownPackPicks.push({
          productId: item.productId,
          productName: item.product.name,
          shortCode: item.product.shortCode,
          packSize,
          qty: cartons * packSize,
          unit: `${cartons} ${cartons === 1 ? "Carton" : "Cartons"} (${cartons * packSize} pcs)`,
          cartonsCount: cartons,
          looseCount: 0,
          orderNumber: order.orderNumber,
        });
        totalCartons += cartons;
      }

      // If loose pieces exist (or product packSize is 1), add to Shop Loose pick list
      if (loosePieces > 0 || packSize === 1) {
        const looseQty = packSize === 1 ? item.qty : loosePieces;
        shopLoosePicks.push({
          productId: item.productId,
          productName: item.product.name,
          shortCode: item.product.shortCode,
          packSize,
          qty: looseQty,
          unit: `${looseQty} pcs loose`,
          cartonsCount: 0,
          looseCount: looseQty,
          orderNumber: order.orderNumber,
        });
        totalLoosePieces += looseQty;
      }
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.user?.name || "Customer",
      customerPhone: order.user?.phone || order.contactPhone,
      deliveryAddress: order.deliveryAddress,
      deliveryZoneName: order.deliveryZoneName,
      status: order.status,
      createdAt: order.createdAt,
      shopLoosePicks,
      godownPackPicks,
      totalCartons,
      totalLoosePieces,
    };
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
      invoiceNumber: order.invoice?.number || null,
      assignedDeliveryUserId: order.assignedDeliveryUserId,
      assignedDeliveryUserName: order.assignedDeliveryUser?.name || null,
      assignedDeliveryUserPhone: order.assignedDeliveryUser?.phone || null,
      deliveredAt: order.deliveredAt,
      paymentMode: order.paymentMode,
      paymentReference: order.paymentReference,
      paymentNotes: order.paymentNotes,
      items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export const orderService = new OrderService();
