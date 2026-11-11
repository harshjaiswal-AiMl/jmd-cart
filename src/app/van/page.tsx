import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole, LocationType, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { vanService } from "@/modules/van/van.service";
import { orderService } from "@/modules/order/order.service";
import { OrderSummary } from "@/modules/order/order.types";
import { formatDDMMYYYY } from "@/lib/date";
import { tHi } from "@/lib/i18n/messages/hi";
import { VanDashboardClient } from "./van-dashboard-client";

export const dynamic = "force-dynamic";

export default async function SalespersonVanPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (
    session.user.role !== UserRole.SALESPERSON &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/login");
  }

  // Find assigned van for this salesperson, or fallback to first van for admin
  let van = await prisma.location.findFirst({
    where: {
      type: LocationType.VAN,
      assignedUserId: session.user.id,
      active: true,
    },
    include: { assignedUser: true },
  });

  if (!van && session.user.role === UserRole.SUPER_ADMIN) {
    van = await prisma.location.findFirst({
      where: { type: LocationType.VAN, active: true },
      include: { assignedUser: true },
    });
  }

  const stockSummary = van
    ? await vanService.getVanStockSummary(session.user.role, van.id)
    : null;

  // Fetch handed-over customer deliveries assigned to this salesperson / van
  let assignedOrders: OrderSummary[] = [];
  try {
    if (session.user.role === UserRole.SALESPERSON) {
      assignedOrders = await orderService.listOrdersForDelivery(session.user.id);
    } else if (session.user.role === UserRole.SUPER_ADMIN) {
      if (van?.assignedUserId) {
        assignedOrders = await orderService.listOrdersForDelivery(van.assignedUserId);
      }
      if (assignedOrders.length === 0) {
        const all = await orderService.listAllOrders();
        assignedOrders = all.filter(
          (o) => o.status === OrderStatus.DISPATCHED || o.status === OrderStatus.PROCESSING
        );
      }
    }
  } catch (err) {
    console.error("Failed to load assigned delivery orders:", err);
  }

  const pendingDeliveries = assignedOrders.filter(
    (o) => o.status !== OrderStatus.DELIVERED && o.status !== OrderStatus.CANCELLED
  );
  const pendingCashPaise = pendingDeliveries.reduce((sum, o) => sum + o.totalPaise, 0);

  // Today's Van Sales & Cash Collection metrics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayInvoices = van
    ? await prisma.invoice.findMany({
        where: {
          locationId: van.id,
          createdAt: { gte: todayStart },
          status: "FINAL",
        },
        select: { totalPaise: true },
      })
    : [];
  const todaySalesPaise = todayInvoices.reduce((sum, inv) => sum + inv.totalPaise, 0);

  const todayPayments = van
    ? await prisma.payment.findMany({
        where: {
          invoice: { locationId: van.id },
          mode: "CASH",
          createdAt: { gte: todayStart },
        },
        select: { amountPaise: true },
      })
    : [];
  const cashInHandPaise = todayPayments.reduce((sum, p) => sum + p.amountPaise, 0);

  const formattedLoadDate = stockSummary?.activeVanDay?.date
    ? formatDDMMYYYY(stockSummary.activeVanDay.date)
    : undefined;

  return (
    <VanDashboardClient
      van={van ? { id: van.id, name: van.name } : null}
      stockSummary={stockSummary}
      assignedOrders={assignedOrders}
      pendingDeliveries={pendingDeliveries}
      todaySalesPaise={todaySalesPaise}
      cashInHandPaise={cashInHandPaise}
      pendingCashPaise={pendingCashPaise}
      userName={session.user.name || tHi("salespersonFallback")}
      formattedLoadDate={formattedLoadDate}
    />
  );
}
