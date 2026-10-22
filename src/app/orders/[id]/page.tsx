import { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";

export const metadata: Metadata = {
  title: "Order Details | JMD Cart Saharsa",
  robots: { index: false, follow: false },
};

interface OrderDetailPageProps {
  params: { id: string };
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/orders/${params.id}`);
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!order || (order.userId && order.userId !== session.user.id)) {
    notFound();
  }

  const totalAmount = order.totalPaise / 100;
  const subtotalAmount = order.subtotalPaise / 100;
  const deliveryCharge = order.deliveryFeePaise / 100;
  const taxAmount = (order.cgstPaise + order.sgstPaise + order.igstPaise) / 100;

  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Orders", href: "/orders" },
            { label: `#${order.orderNumber || order.id.slice(0, 8)}` },
          ]}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-on-surface">
                Order #{order.orderNumber || order.id.slice(0, 8)}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-tertiary-fixed/30 text-tertiary">
                {order.status}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "full" })}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${order.id}/track`}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">local_shipping</span>
              Live Tracking
            </Link>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="p-4 bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Itemized Dispatch Details
          </div>

          <div className="divide-y divide-outline-variant/15">
            {order.items.map((item) => (
              <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center p-1 shrink-0">
                    {item.product?.imageUrl ? (
                      <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="material-symbols-outlined text-outline">inventory_2</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">
                      {item.product?.name || "Grocery Item"}
                    </h3>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      Qty: <span className="font-mono font-bold">{item.qty}</span> x ₹{(item.unitPricePaise / 100).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="font-mono font-bold text-sm text-on-surface">
                  ₹{((item.unitPricePaise * item.qty) / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="p-5 bg-surface-container-low/40 border-t border-outline-variant/15 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-on-surface-variant">
              <span>Subtotal</span>
              <span className="font-mono">₹{subtotalAmount.toFixed(2)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-on-surface-variant">
                <span>GST Tax</span>
                <span className="font-mono">₹{taxAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-on-surface-variant">
              <span>Delivery Fee</span>
              <span className="font-mono">{deliveryCharge === 0 ? "FREE" : `₹${deliveryCharge.toFixed(2)}`}</span>
            </div>
            <div className="pt-2 border-t border-outline-variant/15 flex justify-between font-bold text-base text-on-surface">
              <span>Grand Total</span>
              <span className="font-mono text-primary text-lg">₹{totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping & Payment summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2">
            <h2 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">pin_drop</span>
              Delivery Destination
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {order.deliveryAddress || "Customer address in Saharsa Central"}
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2">
            <h2 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-base">payments</span>
              Payment Terms
            </h2>
            <div className="text-xs text-on-surface-variant">
              Mode: <strong className="text-on-surface">{order.paymentMode || "Cash on Delivery"}</strong>
            </div>
            <div className="text-xs text-on-surface-variant">
              Payment Status: <strong className="text-on-surface">{order.paymentReference ? "PAID" : "PENDING"}</strong>
            </div>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
