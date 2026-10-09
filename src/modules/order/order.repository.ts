import { prisma } from "@/lib/prisma";
import { Order, OrderItem, OrderStatus, Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class OrderRepository {
  async findOrderById(id: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true, packSize: true } },
          },
        },
      },
    });
  }

  async findOrderByNumber(orderNumber: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { orderNumber },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true, packSize: true } },
          },
        },
      },
    });
  }

  async findOrderByIdempotencyKey(key: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { idempotencyKey: key },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true, packSize: true } },
          },
        },
      },
    });
  }

  async listUserOrders(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true, packSize: true } },
          },
        },
      },
    });
  }

  async listAllOrders(status?: OrderStatus) {
    return prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, phone: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, shortCode: true, packSize: true } },
          },
        },
      },
    });
  }

  async createOrder(
    tx: TransactionClient,
    data: Prisma.OrderCreateInput
  ): Promise<Order & { items: OrderItem[] }> {
    return tx.order.create({
      data,
      include: {
        items: true,
      },
    });
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    client: TransactionClient | typeof prisma = prisma
  ) {
    return client.order.update({
      where: { id: orderId },
      data: { status },
    });
  }
}

export const orderRepository = new OrderRepository();
