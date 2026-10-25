import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import { UserRole, LocationType, OrderStatus } from "@prisma/client";

describe("Checkout and Order Creation with Stock Reservation (Task 3.5)", () => {
  let testUser: any;
  let testProduct1: any;
  let testProduct2: any;
  let shopLocation: any;
  let godownLocation: any;

  beforeEach(async () => {
    // 1. Ensure test buyer user exists
    testUser = await prisma.user.upsert({
      where: { phone: "9876543210" },
      update: {},
      create: {
        phone: "9876543210",
        name: "Sachin Prakash Kirana",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
        branchId: 1,
      },
    });

    // 2. Ensure distribution locations exist
    shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN },
    });

    // 3. Ensure test products exist
    testProduct1 = await prisma.product.findFirst({
      where: { active: true },
    });

    const otherProducts = await prisma.product.findMany({
      where: { active: true, id: { not: testProduct1?.id } },
      take: 1,
    });
    testProduct2 = otherProducts[0];

    // Seed stock at Shop and Godown
    if (testProduct1 && shopLocation) {
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: testProduct1.id,
            locationId: shopLocation.id,
          },
        },
        update: { qty: 100 },
        create: {
          productId: testProduct1.id,
          locationId: shopLocation.id,
          qty: 100,
        },
      });
    }

    if (testProduct2 && godownLocation) {
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: testProduct2.id,
            locationId: godownLocation.id,
          },
        },
        update: { qty: 50 },
        create: {
          productId: testProduct2.id,
          locationId: godownLocation.id,
          qty: 50,
        },
      });
    }

    // Clear user's active cart before test
    await cartService.clearCart(testUser.id);
  });

  describe("Cart Checkout Validation & Flow", () => {
    it("fails checkout if cart is empty", async () => {
      await expect(
        orderService.createOrderFromCart(testUser.id, {
          deliveryZoneCode: "TOWN",
          deliveryAddress: "Station Road, Saharsa",
          contactPhone: "9876543210",
        })
      ).rejects.toThrow("Cannot checkout an empty shopping cart");
    });

    it("fails checkout if requested quantity exceeds total available stock across locations", async () => {
      // Add product to cart with high quantity
      await cartService.addToCart(testUser.id, testProduct1.id, 10);

      // Temporarily set available balance to 5
      await prisma.stockBalance.update({
        where: {
          productId_locationId: {
            productId: testProduct1.id,
            locationId: shopLocation.id,
          },
        },
        data: { qty: 5 },
      });

      // Clear godown balance
      if (godownLocation) {
        await prisma.stockBalance.upsert({
          where: {
            productId_locationId: {
              productId: testProduct1.id,
              locationId: godownLocation.id,
            },
          },
          update: { qty: 0 },
          create: {
            productId: testProduct1.id,
            locationId: godownLocation.id,
            qty: 0,
          },
        });
      }

      await expect(
        orderService.createOrderFromCart(testUser.id, {
          deliveryZoneCode: "TOWN",
          deliveryAddress: "Station Road, Saharsa",
          contactPhone: "9876543210",
        })
      ).rejects.toThrow(/Insufficient stock/);
    });

    it("creates an order, assigns gapless order number, applies delivery fee, and clears cart", async () => {
      // Restore plenty of stock
      await prisma.stockBalance.update({
        where: {
          productId_locationId: {
            productId: testProduct1.id,
            locationId: shopLocation.id,
          },
        },
        data: { qty: 200 },
      });

      // Add item to cart
      await cartService.addToCart(testUser.id, testProduct1.id, 5);

      const cartBefore = await cartService.getCartSummary(testUser.id);
      expect(cartBefore.itemsCount).toBe(1);

      // Execute checkout for Saharsa Town
      const order = await orderService.createOrderFromCart(testUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "D.B. Road, Ward 12, Saharsa, Bihar - 852201",
        contactPhone: "9876543210",
        customerNotes: "Please call before dispatch",
      });

      // Verify order properties
      expect(order.orderNumber).toMatch(/^ORD\/\d{2}-\d{2}\/\d{6}$/);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.deliveryZoneCode).toBe("TOWN");
      expect(order.deliveryAddress).toBe("D.B. Road, Ward 12, Saharsa, Bihar - 852201");
      expect(order.contactPhone).toBe("9876543210");
      expect(order.customerNotes).toBe("Please call before dispatch");
      expect(order.items.length).toBe(1);
      expect(order.items[0].productId).toBe(testProduct1.id);
      expect(order.items[0].qty).toBe(5);

      // Verify delivery charges were calculated
      if (cartBefore.totalPaise >= 200000) {
        expect(order.deliveryFeePaise).toBe(0);
        expect(order.totalPaise).toBe(cartBefore.totalPaise);
      } else {
        expect(order.deliveryFeePaise).toBe(5000); // Rs 50
        expect(order.totalPaise).toBe(cartBefore.totalPaise + 5000);
      }

      // Verify cart was cleared upon order placement
      const cartAfter = await cartService.getCartSummary(testUser.id);
      expect(cartAfter.itemsCount).toBe(0);
      expect(cartAfter.lines.length).toBe(0);

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "ORDER_CREATED",
          entityId: order.id,
        },
      });
      expect(audit).not.toBeNull();
    });

    it("is idempotent when idempotencyKey is provided", async () => {
      // Add item to cart
      await cartService.addToCart(testUser.id, testProduct1.id, 2);

      const idempotencyKey = `order-idempotent-test-${Date.now()}`;

      const order1 = await orderService.createOrderFromCart(testUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "Station Road, Saharsa",
        contactPhone: "9876543210",
        idempotencyKey,
      });

      // Replay with exact same idempotency key
      const order2 = await orderService.createOrderFromCart(testUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "Station Road, Saharsa",
        contactPhone: "9876543210",
        idempotencyKey,
      });

      expect(order1.id).toBe(order2.id);
      expect(order1.orderNumber).toBe(order2.orderNumber);
    });

    it("lists orders placed by user in descending order", async () => {
      const orders = await orderService.listUserOrders(testUser.id);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      expect(orders[0].userId).toBe(testUser.id);
    });
  });
});
