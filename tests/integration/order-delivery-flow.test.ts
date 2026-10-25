import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import {
  UserRole,
  LocationType,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  MovementType,
  PartyType,
} from "@prisma/client";

describe("Order Invoicing, Delivery Assignment & Proof of Delivery (Task 3.7)", () => {
  let adminUser: any;
  let deliveryUser: any;
  let buyerUser: any;
  let creditParty: any;
  let packProduct: any;
  let looseProduct: any;
  let shopLocation: any;
  let godownLocation: any;

  beforeEach(async () => {
    // 1. Ensure Super Admin user
    adminUser = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          phone: "9999988888",
          name: "Sachin Prakash (Owner)",
          passwordHash: "hash",
          role: UserRole.SUPER_ADMIN,
        },
      });
    }

    // 2. Ensure Delivery staff user
    deliveryUser = await prisma.user.findFirst({
      where: { role: UserRole.DELIVERY },
    });
    if (!deliveryUser) {
      deliveryUser = await prisma.user.create({
        data: {
          phone: "9999955555",
          name: "Vijay Sharma Delivery",
          passwordHash: "hash",
          role: UserRole.DELIVERY,
        },
      });
    }

    // 3. Ensure party and linked buyer
    creditParty = await prisma.party.upsert({
      where: { id: "party-deliv-test" },
      update: {},
      create: {
        id: "party-deliv-test",
        name: "Saharsa Retail Traders",
        phone: "9876500001",
        type: PartyType.RETAILER,
        creditLimitPaise: 5000000,
        creditDays: 30,
        branchId: 1,
      },
    });

    buyerUser = await prisma.user.upsert({
      where: { phone: "9876500001" },
      update: { partyId: creditParty.id },
      create: {
        phone: "9876500001",
        name: "Saharsa Retail Traders",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
        partyId: creditParty.id,
      },
    });

    // 4. Ensure distribution locations
    shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    if (!shopLocation) {
      shopLocation = await prisma.location.create({
        data: {
          id: "loc-shop-test",
          name: "Shop Counter",
          type: LocationType.SHOP,
        },
      });
    }

    godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN },
    });
    if (!godownLocation) {
      godownLocation = await prisma.location.create({
        data: {
          id: "loc-godown-test",
          name: "Central Godown",
          type: LocationType.GODOWN,
        },
      });
    }

    // 5. Test products
    packProduct = await prisma.product.upsert({
      where: { shortCode: "DELIV_PACK_TEST" },
      update: { packSize: 10 },
      create: {
        shortCode: "DELIV_PACK_TEST",
        name: "Bikaji Rasgulla Master Pack",
        hsn: "21069099",
        mrpPaise: 20000,
        packSize: 10,
        branchId: 1,
      },
    });

    looseProduct = await prisma.product.upsert({
      where: { shortCode: "DELIV_LOOSE_TEST" },
      update: { packSize: 1 },
      create: {
        shortCode: "DELIV_LOOSE_TEST",
        name: "MDH Haldi Powder 500g",
        hsn: "09103030",
        mrpPaise: 12000,
        packSize: 1,
        branchId: 1,
      },
    });

    // Stock balances
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: packProduct.id,
          locationId: godownLocation.id,
        },
      },
      update: { qty: 200 },
      create: {
        productId: packProduct.id,
        locationId: godownLocation.id,
        qty: 200,
        branchId: 1,
      },
    });

    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: looseProduct.id,
          locationId: shopLocation.id,
        },
      },
      update: { qty: 100 },
      create: {
        productId: looseProduct.id,
        locationId: shopLocation.id,
        qty: 100,
        branchId: 1,
      },
    });
  });

  async function createSampleOrder() {
    await cartService.clearCart(buyerUser.id);
    await cartService.addToCart(buyerUser.id, packProduct.id, 20); // 2 full cartons
    await cartService.addToCart(buyerUser.id, looseProduct.id, 5); // 5 loose units

    return orderService.createOrderFromCart(buyerUser.id, {
      deliveryZoneCode: "SAHARSA_TOWN",
      deliveryAddress: "Ward No 12, Main Bazar, Saharsa",
      contactPhone: "9876500001",
      customerNotes: "Deliver before 4 PM",
    });
  }

  it("generates a single gapless invoice, deducts stock, and seals prices atomically", async () => {
    const order = await createSampleOrder();
    expect(order.invoiceId).toBeNull();

    const godownBalBefore = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: packProduct.id,
          locationId: godownLocation.id,
        },
      },
    });
    const shopBalBefore = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: looseProduct.id,
          locationId: shopLocation.id,
        },
      },
    });

    // Generate Invoice
    const invoicedOrder = await orderService.generateOrderInvoice(
      adminUser.role,
      adminUser.id,
      order.id
    );

    expect(invoicedOrder.invoiceId).toBeTruthy();
    expect(invoicedOrder.invoiceNumber).toMatch(/^INV\/\d{2}-\d{2}\/\d{6}$/);

    // Verify stock deduction (SALE movement)
    const godownBalAfter = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: packProduct.id,
          locationId: godownLocation.id,
        },
      },
    });
    const shopBalAfter = await prisma.stockBalance.findUnique({
      where: {
        productId_locationId: {
          productId: looseProduct.id,
          locationId: shopLocation.id,
        },
      },
    });

    // 20 pcs of packProduct deducted from Godown
    expect(godownBalAfter!.qty).toBe(godownBalBefore!.qty - 20);
    // 5 pcs of looseProduct deducted from Shop
    expect(shopBalAfter!.qty).toBe(shopBalBefore!.qty - 5);

    // Verify Invoice record
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoicedOrder.invoiceId! },
      include: { items: true },
    });
    expect(invoice).not.toBeNull();
    expect(invoice?.paymentStatus).toBe(PaymentStatus.PENDING);
    expect(invoice?.totalPaise).toBe(order.totalPaise);
    expect(invoice?.items.length).toBe(2);
  });

  it("enforces PRD rule: exactly one invoice per order and rejects duplicate invoicing", async () => {
    const order = await createSampleOrder();

    // First invoice generation
    await orderService.generateOrderInvoice(
      adminUser.role,
      adminUser.id,
      order.id
    );

    // Second attempt must fail
    await expect(
      orderService.generateOrderInvoice(
        adminUser.role,
        adminUser.id,
        order.id
      )
    ).rejects.toThrow(/already has invoice/i);
  });

  it("assigns delivery staff to order and updates order status to DISPATCHED", async () => {
    const order = await createSampleOrder();

    // Invoicing first
    await orderService.generateOrderInvoice(
      adminUser.role,
      adminUser.id,
      order.id
    );

    // Assign delivery personnel
    const assigned = await orderService.assignDeliveryStaff(
      adminUser.role,
      adminUser.id,
      {
        orderId: order.id,
        deliveryStaffId: deliveryUser.id,
      }
    );

    expect(assigned.assignedDeliveryUserId).toBe(deliveryUser.id);
    expect(assigned.assignedDeliveryUserName).toBe(deliveryUser.name);
    expect(assigned.status).toBe(OrderStatus.DISPATCHED);

    // Check staff's assigned deliveries list
    const staffDeliveries = await orderService.listOrdersForDelivery(deliveryUser.id);
    expect(staffDeliveries.some((d) => d.id === order.id)).toBe(true);
  });

  it("records delivery completion, payment collection, marks invoice PAID and posts ledger receipt", async () => {
    const order = await createSampleOrder();

    // 1. Generate Invoice
    await orderService.generateOrderInvoice(
      adminUser.role,
      adminUser.id,
      order.id
    );

    // 2. Assign Delivery Staff
    await orderService.assignDeliveryStaff(
      adminUser.role,
      adminUser.id,
      {
        orderId: order.id,
        deliveryStaffId: deliveryUser.id,
      }
    );

    // 3. Record Delivery & Payment Collection
    const delivered = await orderService.recordOrderDeliveryAndPayment(
      deliveryUser.role,
      deliveryUser.id,
      {
        orderId: order.id,
        paymentMode: PaymentMode.UPI,
        paymentReference: "UPI-UTR-991283741",
        notes: "Delivered to shop cashier",
      }
    );

    expect(delivered.status).toBe(OrderStatus.DELIVERED);
    expect(delivered.deliveredAt).not.toBeNull();
    expect(delivered.paymentMode).toBe(PaymentMode.UPI);
    expect(delivered.paymentReference).toBe("UPI-UTR-991283741");
    expect(delivered.paymentNotes).toBe("Delivered to shop cashier");

    // 4. Verify Invoice is marked PAID
    const invoice = await prisma.invoice.findUnique({
      where: { id: delivered.invoiceId! },
      include: { payments: true },
    });
    expect(invoice?.paymentStatus).toBe(PaymentStatus.PAID);
    expect(invoice?.payments.length).toBe(1);
    expect(invoice?.payments[0].mode).toBe(PaymentMode.UPI);
    expect(invoice?.payments[0].amountPaise).toBe(order.totalPaise);

    // 5. Verify customer ledger entry posted (RECEIPT credit)
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        partyId: creditParty.id,
        referenceId: delivered.invoiceId!,
      },
    });
    // One INVOICE debit and one PAYMENT receipt credit
    expect(ledgerEntries.length).toBe(2);
    const receiptEntry = ledgerEntries.find((e) => e.kind === "RECEIPT");
    expect(receiptEntry).toBeDefined();
    expect(receiptEntry?.creditPaise).toBe(order.totalPaise);
  });

  it("blocks duplicate delivery attempts once marked DELIVERED", async () => {
    const order = await createSampleOrder();
    await orderService.generateOrderInvoice(adminUser.role, adminUser.id, order.id);
    await orderService.assignDeliveryStaff(adminUser.role, adminUser.id, {
      orderId: order.id,
      deliveryStaffId: deliveryUser.id,
    });

    await orderService.recordOrderDeliveryAndPayment(deliveryUser.role, deliveryUser.id, {
      orderId: order.id,
      paymentMode: PaymentMode.CASH,
    });

    // Second delivery attempt must throw
    await expect(
      orderService.recordOrderDeliveryAndPayment(deliveryUser.role, deliveryUser.id, {
        orderId: order.id,
        paymentMode: PaymentMode.CASH,
      })
    ).rejects.toThrow(/already marked as DELIVERED/i);
  });
});
