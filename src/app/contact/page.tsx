import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { ContactFormClient } from "@/components/store/ContactFormClient";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Contact Us & Mandi Helpline | JMD Cart Saharsa",
  description:
    "Get in touch with JMD Cart central warehouse at Purab Bazar, Saharsa. Phone, WhatsApp mandi desk, email, and live customer support.",
  openGraph: {
    title: "Contact JMD Cart Saharsa",
    description: "Helpline and warehouse location for JMD Cart grocery operations.",
    url: "https://jmdcart.com/contact",
  },
  alternates: {
    canonical: "/contact",
  },
};

export const revalidate = 300;

export default async function ContactPage() {
  const settings = await storeService.getStorefrontSettings();

  return (
    <StoreShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Contact Us" },
          ]}
        />

        <div className="border-b border-outline-variant/15 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Customer Support &amp; Mandi Desk
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-on-surface mt-1">
            Contact JMD Cart
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
            Have questions about bulk orders, wholesale accounts, deliveries, or product availability? Reach our Saharsa operations team directly.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Info Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Warehouse Address */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">location_on</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-on-surface">Central Godown &amp; Office</h2>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  {settings.address}
                </p>
              </div>
            </div>

            {/* Helpline Phone */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary-fixed/20 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">call</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-on-surface">Mandi Phone Desk</h2>
                <p className="text-xs text-on-surface-variant mt-1 font-mono font-semibold">
                  {settings.phone}
                </p>
                <div className="text-[11px] text-on-surface-variant mt-0.5">
                  {settings.operatingHours}
                </div>
              </div>
            </div>

            {/* WhatsApp Desk */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary-container/20 text-on-secondary-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">chat</span>
              </div>
              <div>
                <h2 className="font-bold text-base text-on-surface">WhatsApp Orders &amp; Inquiries</h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Send shopping lists or photos of items for instant quotation.
                </p>
                <a
                  href={`https://wa.me/${settings.whatsappNumber}?text=Hi%20JMD%20Cart,%20I%20have%20an%20inquiry`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-green-700 hover:underline"
                >
                  Chat with Mandi Manager →
                </a>
              </div>
            </div>

            {/* Statutory Details */}
            <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 text-xs text-on-surface-variant space-y-1">
              <div>FSSAI License: <strong className="font-mono text-on-surface">{settings.fssai}</strong></div>
              <div>GSTIN: <strong className="font-mono text-on-surface">{settings.gstin}</strong></div>
            </div>
          </div>

          {/* Right Form Column (7 cols) */}
          <div className="lg:col-span-7">
            <ContactFormClient />
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
