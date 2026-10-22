import { Metadata } from "next";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { WholesaleEnquiryClient } from "@/components/store/WholesaleEnquiryClient";

export const metadata: Metadata = {
  title: "Become an Authorized Retailer | JMD Cart Saharsa",
  description:
    "Apply for a verified kirana retailer account. Get access to Price A/B lists, 15-day commercial credit, and scheduled morning delivery routes.",
  openGraph: {
    title: "Become a JMD Cart Retailer Partner",
    description: "Exclusive B2B commercial benefits for grocery shopkeepers in Saharsa.",
    url: "https://jmdcart.com/wholesale-enquiry",
  },
  alternates: {
    canonical: "/wholesale-enquiry",
  },
};

export default function WholesaleEnquiryPage() {
  return (
    <StoreShell>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Wholesale", href: "/wholesale" },
            { label: "Become an Authorized Retailer" },
          ]}
        />

        <div className="border-b border-outline-variant/15 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Partnership &amp; Credit Program
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-on-surface mt-1">
            Become an Authorized JMD Cart Retailer
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
            Unlock exclusive wholesale distributor pricing, commercial billing credit lines, and priority morning truck delivery directly to your shop in Saharsa and surrounding areas.
          </p>
        </div>

        {/* 3 Partner Perks */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2">
            <span className="material-symbols-outlined text-primary text-3xl">currency_rupee</span>
            <h3 className="font-bold text-sm text-on-surface">Deepest Kirana Margins</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Price A &amp; B rate lists designed to maximize your shop&apos;s daily profit margins on high-rotation staples.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2">
            <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
            <h3 className="font-bold text-sm text-on-surface">Dedicated Shop Delivery</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Heavy sacks and cartons unloaded directly at your store counter by our trained delivery team.
            </p>
          </div>

          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-outline-variant/20 shadow-sm space-y-2">
            <span className="material-symbols-outlined text-primary text-3xl">credit_score</span>
            <h3 className="font-bold text-sm text-on-surface">Working Capital Credit</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Eligible established retailers can apply for 7 to 15-day rotational credit facility after 3 successful orders.
            </p>
          </div>
        </div>

        {/* Client Application Form */}
        <WholesaleEnquiryClient />
      </main>
    </StoreShell>
  );
}
