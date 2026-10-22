import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";

export const metadata: Metadata = {
  title: "Order Placed Successfully | JMD Cart Saharsa",
  description: "Your grocery order has been confirmed. Dispatch initiated from Saharsa Central Godown.",
  robots: {
    index: false,
    follow: false,
  },
};

interface OrderSuccessProps {
  searchParams: {
    orderId?: string;
    phone?: string;
  };
}

export default function OrderSuccessPage({ searchParams }: OrderSuccessProps) {
  const orderId = searchParams.orderId || "JMD-" + Math.floor(100000 + Math.random() * 900000);
  const phone = searchParams.phone || "";

  return (
    <StoreShell>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-6 sm:p-10 shadow-sm space-y-6">
          <div className="w-20 h-20 rounded-full bg-tertiary-fixed/40 text-tertiary flex items-center justify-center mx-auto shadow-inner">
            <span className="material-symbols-outlined text-5xl">check_circle</span>
          </div>

          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-tertiary">
              Order Confirmed
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface mt-1">
              Thank You for Your Order!
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              Your order has been forwarded to the Saharsa Central warehouse dispatch team.
            </p>
          </div>

          <div className="bg-surface-container-low p-5 rounded-2xl border border-outline-variant/20 text-left space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant font-medium">Order Number:</span>
              <span className="font-mono font-bold text-primary text-base">{orderId}</span>
            </div>

            {phone && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-on-surface-variant font-medium">Customer Phone:</span>
                <span className="font-mono font-bold text-on-surface">+91 {phone}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant font-medium">Dispatch Status:</span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-tertiary bg-tertiary-fixed/30 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                Packing in Godown
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant font-medium">Estimated Delivery:</span>
              <span className="font-bold text-on-surface">Within 2 Hours (Today)</span>
            </div>
          </div>

          {/* WhatsApp Support CTA */}
          <div className="p-4 rounded-xl bg-primary-fixed/20 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-green-600 text-3xl">chat</span>
              <div>
                <div className="font-bold text-sm text-on-surface">Need live updates on WhatsApp?</div>
                <div className="text-xs text-on-surface-variant">
                  Message our Saharsa Mandi desk directly with your Order ID
                </div>
              </div>
            </div>

            <a
              href={`https://wa.me/919934200000?text=Hi%20JMD%20Cart,%20my%20order%20is%20${orderId}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shrink-0"
            >
              Chat on WhatsApp
            </a>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm"
            >
              Continue Shopping
            </Link>

            <Link
              href="/orders"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container transition-colors"
            >
              View Order History
            </Link>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
