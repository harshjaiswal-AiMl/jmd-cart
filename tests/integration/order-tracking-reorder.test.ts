import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import { billingService } from "@/modules/billing/billing.service";
import {
  UserRole,
  LocationType,
  OrderStatus,
  PaymentMode,
  PartyType,
} from "@prisma/client";

describe("Order Tracking, Reorder & Invoice Download (Task 3.8)", () => {
  let adminUser: any;
  let buyerUser: any;
  let otherBuyerUser: any;
  let deliveryUser: any;
  let productA: any;
  let productB: any;
  let shopLocation: any;
  let godownLocation: any;

  beforeEach(async () => {
    // 1. Users
    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          phone: "9999988888",
          name: "Admin Tester",
          passwordHash: "hash",
          role: UserRole.SUPER_ADMIN,
        },
      });
    }

    deliveryUser = await prisma.user.findFirst({
      where: { role: UserRole.DELIVERY },
    });
    if (!deliveryUser) {
      deliveryUser = await prisma.user.create({
        data: {
          phone: "9999955555",
          name: "Driver Vijay",
          passwordHash: "hash",
          role: UserRole.DELIVERY,
        },
      });
    }

    buyerUser = await prisma.user.upsert({
      where: { phone: "9876500002" },
      update: {},
      create: {
        phone: "9876500002",
        name: "Ramesh Trader",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
      },
    });

    otherBuyerUser = await prisma.user.upsert({
      where: { phone: "9876500003" },
      update: {},
      create: {
        phone: "9876500003",
        name: "Stranger Retailer",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
      },
    });

    // 2. Locations
    shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN },
    });

    // 3. Products
    productA = await prisma.product.upsert({
      where: { shortCode: "TRACK_PROD_A" },
      update: { active: true },
      create: {
        shortCode: "TRACK_PROD_A",
        name: "Bikaji Rasgulla Can 1kg",
        hsn: "21069099",
        mrpPaise: 25000,
        packSize: 8,
        branchId: 1,
        active: true,
      },
    });

    productB = await prisma.product.upsert({
      where: { shortCode: "TRACK_PROD_B" },
      update: { active: true },
      create: {
        shortCode: "TRACK_PROD_B",
        name: "India Gate Dubar 5kg",
        hsn: "10063020",
        mrpPaise: 38000,
        packSize: 1,
        branchId: 1,
        active: true,
      },
    });

    // Stock balances
    if (godownLocation) {
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: productA.id,
            locationId: godownLocation.id,
          },
        },
        update: { qty: 200 },
        create: {
          productId: productA.id,
          locationId: godownLocation.id,
          qty: 200,
          branchId: 1,
        },
      });
    }

    if (shopLocation) {
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: productB.id,
            locationId: shopLocation.id,
          },
        },
        update: { qty: 100 },
        create: {
          productId: productB.id,
          locationId: shopLocation.id,
          qty: 100,
          branchId: 1,
        },
      });
    }
  });

  async function placeOrder() {
    await cartService.clearCart(buyerUser.id);
    await cartService.addToCart(buyerUser.id, productA.id, 16); // 2 cartons
    await cartService.addToCart(buyerUser.id, productB.id, 3); // 3 pcs

    return orderService.createOrderFromCart(buyerUser.id, {
      deliveryZoneCode: "SAHARSA_TOWN",
      deliveryAddress: "Shankar Chowk, Saharsa",
      contactPhone: "9876500002",
      customerNotes: "Call when at chowk",
    });
  }

  it("tracks order journey through PENDING -> CONFIRMED -> PROCESSING -> DISPATCHED -> DELIVERED", async () => {
    const order = await placeOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.assignedDeliveryUserId).toBeNull();
    expect(order.invoiceId).toBeNull();

    // 1. Confirm
    await orderService.updateOrderStatus(adminUser.role, adminUser.id, order.id, OrderStatus.CONFIRMED);
    let current = await orderService.getOrderById(order.id);
    expect(current?.status).toBe(OrderStatus.CONFIRMED);

    // 2. Generate Invoice (transitions to PROCESSING)
    await orderService.generateOrderInvoice(adminUser.role, adminUser.id, order.id);
    current = await orderService.getOrderById(order.id);
    expect(current?.status).toBe(OrderStatus.PROCESSING);
    expect(current?.invoiceId).toBeTruthy();
    expect(current?.invoiceNumber).toMatch(/^INV\/\d{2}-\d{2}\/\d{6}$/);

    // 3. Assign Driver (transitions to DISPATCHED)
    await orderService.assignDeliveryStaff(adminUser.role, adminUser.id, {
      orderId: order.id,
      deliveryStaffId: deliveryUser.id,
    });
    current = await orderService.getOrderById(order.id);
    expect(current?.status).toBe(OrderStatus.DISPATCHED);
    expect(current?.assignedDeliveryUserId).toBe(deliveryUser.id);
    expect(current?.assignedDeliveryUserName).toBe(deliveryUser.name);

    // 4. Mark Delivered & Payment collected
    await orderService.recordOrderDeliveryAndPayment(deliveryUser.role, deliveryUser.id, {
      orderId: order.id,
      paymentMode: PaymentMode.CASH,
      notes: "Cash collected at counter",
    });
    current = await orderService.getOrderById(order.id);
    expect(current?.status).toBe(OrderStatus.DELIVERED);
    expect(current?.deliveredAt).not.toBeNull();
    expect(current?.paymentMode).toBe(PaymentMode.CASH);
  });

  it("reorders items from past order into user cart with live pricing and original quantities", async () => {
    const order = await placeOrder();

    // Clear active cart to test reorder filling it back up
    await cartService.clearCart(buyerUser.id);
    let cart = await cartService.getCartSummary(buyerUser.id);
    expect(cart?.itemsCount || 0).toBe(0);

    // Reorder items
    const reorderResult = await orderService.reorderItems(buyerUser.role, buyerUser.id, order.id);
    expect(reorderResult.addedCount).toBe(2);
    expect(reorderResult.skippedCount).toBe(0);

    // Verify cart now contains the 2 items with quantities 16 and 3
    cart = await cartService.getCartSummary(buyerUser.id);
    expect(cart?.lines.length).toBe(2);

    const itemA = cart?.lines.find((l) => l.productId === productA.id);
    const itemB = cart?.lines.find((l) => l.productId === productB.id);

    expect(itemA?.qty).toBe(16);
    expect(itemB?.qty).toBe(3);
  });

  it("skips inactive or discontinued products gracefully when reordering", async () => {
    const order = await placeOrder();

    // Deactivate product B
    await prisma.product.update({
      where: { id: productB.id },
      data: { active: false },
    });

    await cartService.clearCart(buyerUser.id);

    const reorderResult = await orderService.reorderItems(buyerUser.role, buyerUser.id, order.id);
    expect(reorderResult.addedCount).toBe(1);
    expect(reorderResult.skippedCount).toBe(1);
    expect(reorderResult.skippedNames[0]).toBe(productB.name);

    // Restore product B
    await prisma.product.update({
      where: { id: productB.id },
      data: { active: true },
    });
  });

  it("blocks unauthorized customers from reordering orders belonging to other users", async () => {
    const order = await placeOrder();

    // otherBuyerUser attempts to reorder buyerUser's order
    await expect(
      orderService.reorderItems(otherBuyerUser.role, otherBuyerUser.id, order.id)
    ).rejects.toThrow(/cannot reorder items from another customer/i);
  });

  it("allows buyers to retrieve official invoice details for completed orders", async () => {
    const order = await placeOrder();
    await orderService.generateOrderInvoice(adminUser.role, adminUser.id, order.id);

    const updatedOrder = await orderService.getOrderById(order.id);
    expect(updatedOrder?.invoiceId).toBeTruthy();

    const invoice = await billingService.getInvoiceById(updatedOrder!.invoiceId!);
    expect(invoice).not.toBeNull();
    expect(invoice?.number).toBe(updatedOrder?.invoiceNumber);
    expect(invoice?.items.length).toBe(2);
  });
});
