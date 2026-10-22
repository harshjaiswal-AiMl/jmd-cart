import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "Live Order Tracking | JMD Cart Saharsa",
  robots: { index: false, follow: false },
};

interface OrderTrackProps {
  params: { id: string };
}

export default async function OrderTrackPage({ params }: OrderTrackProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/orders/${params.id}/track`);
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
  });

  if (!order || (order.userId && order.userId !== session.user.id)) {
    notFound();
  }

  const stages = [
    { label: "Order Received", desc: "Received at Saharsa Central Mandi desk", status: "COMPLETED" },
    { label: "Godown Packing", desc: "Items picked and packed from Purab Bazar dock", status: order.status === "PENDING" ? "CURRENT" : "COMPLETED" },
    { label: "Out for Delivery", desc: "Assigned to electric tempo dispatch fleet", status: order.status === "DISPATCHED" ? "CURRENT" : order.status === "DELIVERED" ? "COMPLETED" : "UPCOMING" },
    { label: "Delivered", desc: "Handover completed at your counter/home", status: order.status === "DELIVERED" ? "COMPLETED" : "UPCOMING" },
  ];

  return (
    <StoreShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Orders", href: "/orders" },
            { label: "Tracking" },
          ]}
        />

        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-tertiary">
                Live Dispatch Journey
              </span>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-on-surface mt-1">
                Tracking Order #{order.orderNumber || order.id.slice(0, 8)}
              </h1>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-tertiary-fixed/30 text-tertiary">
              {order.status}
            </span>
          </div>

          {/* Timeline Visualizer */}
          <div className="py-4 space-y-8 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-outline-variant/30">
            {stages.map((stage, idx) => {
              const isCompleted = stage.status === "COMPLETED";
              const isCurrent = stage.status === "CURRENT";

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  <div
                    className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-xs ${
                      isCompleted
                        ? "bg-tertiary text-on-tertiary shadow-sm"
                        : isCurrent
                        ? "bg-primary text-on-primary ring-4 ring-primary/20 animate-pulse"
                        : "bg-surface-container-low text-outline border border-outline-variant/30"
                    }`}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-lg">check</span>
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div className="pt-1">
                    <h3
                      className={`text-sm sm:text-base font-bold ${
                        isCurrent ? "text-primary" : isCompleted ? "text-on-surface" : "text-outline"
                      }`}
                    >
                      {stage.label}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warehouse and WhatsApp Helpline */}
          <div className="pt-4 border-t border-outline-variant/15 bg-surface-container-low p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-on-surface">
              <span className="material-symbols-outlined text-primary text-xl">hub</span>
              <span>Central Warehouse: <strong>Purab Bazar Dhalan, Saharsa</strong></span>
            </div>

            <a
              href="https://wa.me/919934200000?text=Hi%20JMD%20Cart,%20tracking%20update%20for%20order"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-primary text-on-primary font-bold hover:bg-primary-container transition-colors shrink-0 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">chat</span>
              WhatsApp Mandi Desk
            </a>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
