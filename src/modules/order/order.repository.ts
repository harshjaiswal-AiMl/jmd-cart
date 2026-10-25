import { prisma } from "@/lib/prisma";
import { Order, OrderItem, OrderStatus, PaymentMode, Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

const defaultOrderInclude = {
  user: { select: { id: true, name: true, phone: true } },
  assignedDeliveryUser: { select: { id: true, name: true, phone: true } },
  invoice: { select: { id: true, number: true, paymentStatus: true, totalPaise: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, shortCode: true, packSize: true } },
    },
  },
};

export class OrderRepository {
  async findOrderById(id: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { id },
      include: defaultOrderInclude,
    });
  }

  async findOrderByNumber(orderNumber: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { orderNumber },
      include: defaultOrderInclude,
    });
  }

  async findOrderByIdempotencyKey(key: string, client: TransactionClient | typeof prisma = prisma) {
    return client.order.findUnique({
      where: { idempotencyKey: key },
      include: defaultOrderInclude,
    });
  }

  async listUserOrders(userId: string) {
    return prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: defaultOrderInclude,
    });
  }

  async listAllOrders(status?: OrderStatus) {
    return prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      include: defaultOrderInclude,
    });
  }

  async listOrdersForDeliveryStaff(staffId: string, status?: OrderStatus) {
    return prisma.order.findMany({
      where: {
        assignedDeliveryUserId: staffId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: defaultOrderInclude,
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

  async assignDeliveryStaff(
    orderId: string,
    deliveryStaffId: string,
    client: TransactionClient | typeof prisma = prisma
  ) {
    return client.order.update({
      where: { id: orderId },
      data: { assignedDeliveryUserId: deliveryStaffId },
      include: defaultOrderInclude,
    });
  }

  async linkInvoiceToOrder(
    orderId: string,
    invoiceId: string,
    client: TransactionClient | typeof prisma = prisma
  ) {
    return client.order.update({
      where: { id: orderId },
      data: { invoiceId },
      include: defaultOrderInclude,
    });
  }

  async recordOrderDelivery(
    orderId: string,
    data: {
      status: OrderStatus;
      deliveredAt: Date;
      paymentMode: PaymentMode;
      paymentReference?: string | null;
      paymentNotes?: string | null;
    },
    client: TransactionClient | typeof prisma = prisma
  ) {
    return client.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        deliveredAt: data.deliveredAt,
        paymentMode: data.paymentMode,
        paymentReference: data.paymentReference,
        paymentNotes: data.paymentNotes,
      },
      include: defaultOrderInclude,
    });
  }
}

export const orderRepository = new OrderRepository();
