import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OrderAlertState } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Continuous polling endpoint for always-on native Android Godown background service.
 * Returns all active, unaccepted orders that are not snoozed.
 */
export async function GET(req: NextRequest) {
  return handlePoll(req);
}

export async function POST(req: NextRequest) {
  return handlePoll(req);
}

async function handlePoll(req: NextRequest) {
  try {
    const headerToken = req.headers.get("x-device-token");
    const searchToken = req.nextUrl.searchParams.get("deviceToken");
    const deviceToken = headerToken || searchToken;

    if (!deviceToken) {
      return NextResponse.json({ error: "Device token required" }, { status: 400 });
    }

    const now = new Date();

    // 1. Update heartbeat asynchronously
    prisma.pushSubscription.updateMany({
      where: { deviceToken },
      data: { lastSeenAt: now },
    }).catch(() => {});

    // 2. Query active, unaccepted alerts that are NOT snoozed
    const rawAlerts = await prisma.orderAlert.findMany({
      where: {
        state: { in: [OrderAlertState.NOTIFIED, OrderAlertState.SEEN] },
        OR: [
          { snoozedUntil: null },
          { snoozedUntil: { lte: now } },
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            status: true,
            orderNumber: true,
            customerNotes: true,
            contactPhone: true,
            totalPaise: true,
            createdAt: true,
            party: { select: { id: true, name: true, phone: true } },
            items: {
              select: {
                id: true,
                qty: true,
                product: {
                  select: {
                    id: true,
                    name: true,
                    weight: true,
                    packSize: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    // 3. Strict Deduplication by Unique Order/Invoice ID:
    // When an order is created, an OrderAlert record is created for every warehouse manager.
    // We MUST deduplicate by unique orderId / invoiceId so staff never see duplicate copies!
    const uniqueAlertMap = new Map<string, typeof rawAlerts[0]>();
    const finishedAlertIds: string[] = [];

    for (const alert of rawAlerts) {
      // Auto-dismiss alerts for orders that are already dispatched, completed, or cancelled
      if (alert.order) {
        const st = String(alert.order.status).toUpperCase();
        if (st === "DISPATCHED" || st === "COMPLETED" || st === "DELIVERED" || st === "CANCELLED") {
          finishedAlertIds.push(alert.id);
          continue;
        }
      }

      const key = alert.orderId || alert.invoiceId || alert.id;
      if (!uniqueAlertMap.has(key)) {
        uniqueAlertMap.set(key, alert);
      }
    }

    // Auto-clean any already-dispatched order alerts in background
    if (finishedAlertIds.length > 0) {
      prisma.orderAlert.updateMany({
        where: { id: { in: finishedAlertIds } },
        data: { state: OrderAlertState.ACCEPTED, acceptedAt: now },
      }).catch(() => {});
    }

    const activeAlerts = Array.from(uniqueAlertMap.values());

    if (activeAlerts.length === 0) {
      return NextResponse.json({
        success: true,
        hasPendingAlerts: false,
        pendingCount: 0,
        alerts: [],
      });
    }

    // Populate invoice details for invoice-based alerts
    const invoiceIds = activeAlerts.map((a) => a.invoiceId).filter((id): id is string => Boolean(id));
    let invoiceMap = new Map<string, any>();
    if (invoiceIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: {
          id: true,
          number: true,
          totalPaise: true,
          createdAt: true,
          party: { select: { name: true, phone: true } },
          items: {
            select: {
              id: true,
              qty: true,
              product: {
                select: {
                  id: true,
                  name: true,
                  weight: true,
                  packSize: true,
                },
              },
            },
          },
        },
      });
      invoiceMap = new Map(invoices.map((inv) => [inv.id, inv]));
    }

    const formattedAlerts = activeAlerts.map((alert: any) => {
      let orderId = alert.orderId || alert.invoiceId || alert.id;
      let orderNumber = "Order";
      let customerName = "Customer";
      let contactPhone = "";
      let amountPaise = 0;
      let cartonCount = 0;
      let looseCount = 0;
      let totalPieces = 0;

      if (alert.order) {
        orderNumber = alert.order.orderNumber;
        customerName = alert.order.party?.name || alert.order.customerNotes || "Customer";
        contactPhone = alert.order.party?.phone || alert.order.contactPhone || "";
        amountPaise = alert.order.totalPaise;

        for (const item of alert.order.items) {
          const ps = item.product?.packSize && item.product.packSize > 0 ? item.product.packSize : 24;
          const pieces = item.qty;
          totalPieces += pieces;
          cartonCount += Math.floor(pieces / ps);
          looseCount += pieces % ps;
        }
      } else if (alert.invoiceId && invoiceMap.has(alert.invoiceId)) {
        const inv = invoiceMap.get(alert.invoiceId);
        orderNumber = inv.number;
        customerName = inv.party?.name || "Counter Customer";
        contactPhone = inv.party?.phone || "";
        amountPaise = inv.totalPaise;

        for (const line of inv.items) {
          const ps = line.product?.packSize && line.product.packSize > 0 ? line.product.packSize : 24;
          const pieces = line.qty;
          totalPieces += pieces;
          cartonCount += Math.floor(pieces / ps);
          looseCount += pieces % ps;
        }
      } else {
        orderNumber = alert.title?.replace("🚨 New Order: ", "").replace("🚨 Godown Dispatch: ", "") || "New Order";
        customerName = alert.body || "Customer";
        amountPaise = 0;
        cartonCount = 1;
        totalPieces = 1;
      }

      return {
        alertId: alert.id,
        orderId,
        orderNumber,
        customerName,
        contactPhone,
        amountPaise,
        cartonCount,
        looseCount,
        totalPieces,
        createdAt: alert.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      hasPendingAlerts: formattedAlerts.length > 0,
      pendingCount: formattedAlerts.length,
      alerts: formattedAlerts,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to poll alerts" },
      { status: 500 }
    );
  }
}
