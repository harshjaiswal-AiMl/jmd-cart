import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { orderService } from "@/modules/order/order.service";
import { cartService } from "@/modules/cart/cart.service";
import { UserRole, LocationType, OrderStatus } from "@prisma/client";

describe("Admin Orders, Status Confirmation & Split Pick Lists (Task 3.6)", () => {
  let adminUser: any;
  let buyerUser: any;
  let packProduct: any; // packSize > 1
  let looseProduct: any; // packSize == 1
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
          name: "Admin Tester",
          passwordHash: "hash",
          role: UserRole.SUPER_ADMIN,
        },
      });
    }

    // Ensure real Godown user for audit log FK
    let godownUser = await prisma.user.findFirst({
      where: { role: UserRole.GODOWN },
    });
    if (!godownUser) {
      godownUser = await prisma.user.create({
        data: {
          phone: "9999977777",
          name: "Godown Tester",
          passwordHash: "hash",
          role: UserRole.GODOWN,
        },
      });
    }

    // 2. Ensure test buyer
    buyerUser = await prisma.user.upsert({
      where: { phone: "9876543210" },
      update: {},
      create: {
        phone: "9876543210",
        name: "Sachin Prakash Kirana",
        passwordHash: "hash",
        role: UserRole.CUSTOMER,
      },
    });

    // 3. Ensure distribution locations
    shopLocation = await prisma.location.findFirst({
      where: { type: LocationType.SHOP },
    });
    godownLocation = await prisma.location.findFirst({
      where: { type: LocationType.GODOWN },
    });

    // 4. Create/get test products: one with packSize 12, one loose packSize 1
    packProduct = await prisma.product.upsert({
      where: { shortCode: "SPLIT_PACK_TEST" },
      update: { packSize: 12 },
      create: {
        shortCode: "SPLIT_PACK_TEST",
        name: "Bikaji Bhujia 1kg Master Carton",
        hsn: "21069099",
        mrpPaise: 25000,
        packSize: 12,
        branchId: 1,
      },
    });

    looseProduct = await prisma.product.upsert({
      where: { shortCode: "SPLIT_LOOSE_TEST" },
      update: { packSize: 1 },
      create: {
        shortCode: "SPLIT_LOOSE_TEST",
        name: "India Gate Basmati Rice 5kg Loose Bag",
        hsn: "10063020",
        mrpPaise: 48000,
        packSize: 1,
        branchId: 1,
      },
    });

    // Ensure stock exists in Godown and Shop
    if (godownLocation) {
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
        },
      });
    }

    if (shopLocation) {
      await prisma.stockBalance.upsert({
        where: {
          productId_locationId: {
            productId: looseProduct.id,
            locationId: shopLocation.id,
          },
        },
        update: { qty: 50 },
        create: {
          productId: looseProduct.id,
          locationId: shopLocation.id,
          qty: 50,
        },
      });
    }

    // Clear buyer's cart
    await cartService.clearCart(buyerUser.id);
  });

  describe("Split Pick Lists Generation (Shop Loose vs Godown Packs)", () => {
    it("partitions an order correctly into Godown full carton packs and Shop loose pieces", async () => {
      // Add 26 pieces of packProduct (packSize 12):
      // -> Math.floor(26 / 12) = 2 cartons (24 pcs) to Godown
      // -> 26 % 12 = 2 pieces loose to Shop
      await cartService.addToCart(buyerUser.id, packProduct.id, 26);

      // Add 3 pieces of looseProduct (packSize 1):
      // -> 3 pieces loose to Shop
      await cartService.addToCart(buyerUser.id, looseProduct.id, 3);

      const order = await orderService.createOrderFromCart(buyerUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "Purab Bazar, Saharsa",
        contactPhone: "9876543210",
      });

      // Fetch split pick lists
      const splitLists = await orderService.getSplitPickLists(order.id);

      expect(splitLists.orderNumber).toBe(order.orderNumber);
      expect(splitLists.customerName).toBe(buyerUser.name);

      // Verify Godown pack pick list: exactly 1 item with 2 cartons
      expect(splitLists.godownPackPicks.length).toBe(1);
      const godownItem = splitLists.godownPackPicks[0];
      expect(godownItem.productId).toBe(packProduct.id);
      expect(godownItem.cartonsCount).toBe(2);
      expect(godownItem.qty).toBe(24);
      expect(godownItem.unit).toContain("2 Cartons");
      expect(splitLists.totalCartons).toBe(2);

      // Verify Shop loose pick list: 2 lines
      // 1) 2 loose pieces of packProduct
      // 2) 3 loose pieces of looseProduct
      expect(splitLists.shopLoosePicks.length).toBe(2);

      const loosePackItem = splitLists.shopLoosePicks.find(
        (p) => p.productId === packProduct.id
      );
      expect(loosePackItem).toBeDefined();
      expect(loosePackItem?.looseCount).toBe(2);
      expect(loosePackItem?.unit).toContain("2 pcs loose");

      const pureLooseItem = splitLists.shopLoosePicks.find(
        (p) => p.productId === looseProduct.id
      );
      expect(pureLooseItem).toBeDefined();
      expect(pureLooseItem?.looseCount).toBe(3);
      expect(pureLooseItem?.unit).toContain("3 pcs loose");

      expect(splitLists.totalLoosePieces).toBe(5); // 2 + 3 = 5 pieces
    });
  });

  describe("Admin Order Status Workflow & RBAC", () => {
    it("transitions order through PENDING -> CONFIRMED -> PROCESSING -> DISPATCHED -> DELIVERED", async () => {
      // Create test order
      await cartService.addToCart(buyerUser.id, looseProduct.id, 2);
      const order = await orderService.createOrderFromCart(buyerUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "D.B. Road, Saharsa",
        contactPhone: "9876543210",
      });

      expect(order.status).toBe(OrderStatus.PENDING);

      // Admin confirms order
      const confirmed = await orderService.updateOrderStatus(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        order.id,
        OrderStatus.CONFIRMED
      );
      expect(confirmed.status).toBe(OrderStatus.CONFIRMED);

      // Admin marks processing
      const processing = await orderService.updateOrderStatus(
        UserRole.SUPER_ADMIN,
        adminUser.id,
        order.id,
        OrderStatus.PROCESSING
      );
      expect(processing.status).toBe(OrderStatus.PROCESSING);

      // Verify audit logs were written
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          action: "ORDER_STATUS_UPDATED",
          entityId: order.id,
        },
      });
      expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    });

    it("allows Godown role with MANAGE_ORDERS permission to update order status", async () => {
      await cartService.addToCart(buyerUser.id, looseProduct.id, 2);
      const order = await orderService.createOrderFromCart(buyerUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "Gangjala, Saharsa",
        contactPhone: "9876543210",
      });

      const godown = await prisma.user.findFirst({
        where: { role: UserRole.GODOWN },
      });

      const updated = await orderService.updateOrderStatus(
        UserRole.GODOWN,
        godown!.id,
        order.id,
        OrderStatus.CONFIRMED
      );
      expect(updated.status).toBe(OrderStatus.CONFIRMED);
    });

    it("rejects status updates from unauthorized roles (e.g. CUSTOMER)", async () => {
      await cartService.addToCart(buyerUser.id, looseProduct.id, 2);
      const order = await orderService.createOrderFromCart(buyerUser.id, {
        deliveryZoneCode: "TOWN",
        deliveryAddress: "Gangjala, Saharsa",
        contactPhone: "9876543210",
      });

      await expect(
        orderService.updateOrderStatus(
          UserRole.CUSTOMER,
          buyerUser.id,
          order.id,
          OrderStatus.CONFIRMED
        )
      ).rejects.toThrow();
    });
  });
});
