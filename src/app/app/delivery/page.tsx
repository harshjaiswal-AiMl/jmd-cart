import React from "react";
import Link from "next/link";
import { Bike, Package, CheckCircle2, AlertTriangle, ArrowRight, MapPin, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function DeliveryAppPage() {
  const session = await auth();

  // Find assigned orders for delivery
  const assignedOrders = await prisma.order.findMany({
    where: {
      status: { in: ["OUT_FOR_DELIVERY", "PACKED", "CONFIRMED"] },
      ...(session?.user?.id ? { assignedDeliveryUserId: session.user.id } : {}),
    },
    include: {
      party: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">Home Delivery</div>
            <h2 className="text-2xl font-black mt-0.5">JMD Delivery</h2>
          </div>
          <Link
            href="/delivery"
            className="px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Bike className="w-4 h-4" />
            <span>My Runs</span>
          </Link>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/70">Assigned Orders:</span>
          <span className="font-bold text-amber-300 font-mono text-sm">
            {assignedOrders.length} pending delivery
          </span>
        </div>
      </div>

      {/* Assigned Orders List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
          <span>Active Delivery Orders</span>
          <Link href="/delivery" className="text-[#12355B] hover:underline">
            View All
          </Link>
        </div>

        {assignedOrders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
            No orders currently assigned to you for delivery.
          </div>
        ) : (
          assignedOrders.map((order) => (
            <div
              key={order.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-black text-sm text-slate-900">{order.orderNumber}</div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {order.party?.name || "Customer"} {order.party?.phone && `• ${order.party.phone}`}
                  </div>
                </div>
                <div className="font-mono font-bold text-[#12355B] text-sm">
                  ₹{(order.totalPaise / 100).toFixed(2)}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {order.status}
                </span>

                <Link
                  href={`/delivery`}
                  className="px-3 py-1.5 rounded-xl bg-[#12355B] text-white text-xs font-bold hover:bg-[#0E2843] transition-colors"
                >
                  Deliver &amp; Collect
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
