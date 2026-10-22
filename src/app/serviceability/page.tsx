import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { DeliveryPincodeChecker } from "@/components/store/DeliveryPincodeChecker";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Delivery Zones & Timings | JMD Cart Saharsa",
  description:
    "Check delivery serviceability, express 2-hour slots, and free delivery terms across Saharsa Nagar Nigam and Kosi regional blocks.",
  openGraph: {
    title: "Delivery Information | JMD Cart Saharsa",
    description: "Doorstep delivery coverage and timings in Saharsa, Bihar.",
    url: "https://jmdcart.com/serviceability",
  },
  alternates: {
    canonical: "/serviceability",
  },
};

export const dynamic = "force-dynamic";

export default async function ServiceabilityPage() {
  const settings = await storeService.getStorefrontSettings();

  return (
    <StoreShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Delivery & Serviceability" },
          ]}
        />

        <div className="border-b border-outline-variant/15 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Fast Doorstep Dispatch
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-on-surface mt-1">
            Delivery Zones &amp; Serviceability
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
            Direct dispatches from Purab Bazar Central Godown via our dedicated electric tempo fleet and delivery vans.
          </p>
        </div>

        {/* Pincode Checker Island */}
        <DeliveryPincodeChecker />

        {/* Delivery Zones Table */}
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
          <div className="p-4 bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Coverage Area &amp; Dispatch Schedules
          </div>

          <div className="divide-y divide-outline-variant/15 text-xs sm:text-sm">
            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="font-bold text-on-surface text-base block">Zone 1: Saharsa Nagar Nigam</span>
                <span className="text-xs text-on-surface-variant font-mono">Pincodes: 852201, 852202</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Time</span>
                <span className="font-bold text-primary">Within 30 Mins to 2 Hours</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Fee</span>
                <span className="font-bold text-tertiary">FREE above ₹{(settings.freeDeliveryThresholdPaise / 100).toFixed(0)}</span>
                <span className="text-outline text-xs block">(₹50 on smaller orders)</span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="font-bold text-on-surface text-base block">Zone 2: Sonbarsa &amp; Simri Bakhtiarpur</span>
                <span className="text-xs text-on-surface-variant font-mono">Pincodes: 852106, 852127</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Time</span>
                <span className="font-bold text-primary">Same-Day Morning / Evening Van Route</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Fee</span>
                <span className="font-bold text-tertiary">FREE above ₹{(settings.freeDeliveryThresholdPaise / 100).toFixed(0)}</span>
              </div>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span className="font-bold text-on-surface text-base block">Zone 3: Rural Kosi Wholesale Trucking</span>
                <span className="text-xs text-on-surface-variant">Commercial Kirana Restocks</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Time</span>
                <span className="font-bold text-on-surface">Scheduled 24-Hour Truck Dispatch</span>
              </div>
              <div>
                <span className="font-medium text-on-surface-variant block">Delivery Fee</span>
                <span className="font-bold text-on-surface">Custom Freight / Mill Billing</span>
              </div>
            </div>
          </div>
        </div>

        {/* Assurances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant space-y-1.5">
            <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">electric_rickshaw</span>
              Eco Fleet Dispatches
            </div>
            <p>Our fleet of commercial electric tempos ensures low-emission deliveries throughout Saharsa town.</p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant space-y-1.5">
            <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">package_2</span>
              Moisture-Resistant Packaging
            </div>
            <p>Cartons and sacks are sealed with protective food-grade liner to withstand local monsoon weather.</p>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-low border border-outline-variant/20 text-xs text-on-surface-variant space-y-1.5">
            <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-lg">timer</span>
              Live Dispatch Tracking
            </div>
            <p>Real-time SMS and WhatsApp notifications sent the moment your tempo leaves our Purab Bazar dock.</p>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
