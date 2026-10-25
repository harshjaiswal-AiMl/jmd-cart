import type { Metadata } from "next";
import Link from "next/link";
import { LegalPolicyLayout } from "@/components/store/LegalPolicyLayout";

export const metadata: Metadata = {
  title: "Return, Refund & Cancellation Policy | JMD Cart Saharsa",
  description:
    "Official Return, Refund and Cancellation Policy for JMD Cart Saharsa. Transparent guidelines on FMCG grocery returns, damaged carton claims, and instant refunds.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPolicyLayout
      title="Return, Refund & Cancellation Policy"
      subtitle="Clear, fair, and transparent guidelines for grocery order returns, damaged carton claims, and prompt refunds in Saharsa."
      lastUpdated="25 October 2026"
      activePath="/refund-policy"
    >
      <section id="overview" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          1. Policy Overview
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          At <strong>JMD Cart</strong>, we take immense pride in supplying 100% genuine, manufacturer-direct groceries and staples across Saharsa town. We understand that issues such as transport damage, transit leaks, or incorrect items can occasionally occur.
        </p>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          This Policy governs the terms under which consumer and merchant orders may be cancelled, returned, or refunded in compliance with the <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>.
        </p>
      </section>

      <section id="cancellations" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          2. Order Cancellation Window
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-tertiary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Before Godown Dispatch (Full Refund)
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              You can cancel your order at <strong>zero cancellation fee</strong> anytime before the delivery van departs from our central godown. Simply call our dispatch helpline at <strong>+91 6278 223400</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              After Van Departure / In Transit
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Once an order is loaded onto a van and in transit, cancellations are evaluated upon doorstep arrival. If rejected for genuine reasons (wrong items or physical damage), no delivery charge applies.
            </p>
          </div>
        </div>
      </section>

      <section id="return-eligibility" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          3. Return Eligibility by Product Category
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Due to the hygienic nature of food commodities and packaged FMCG goods, return windows depend on the item category:
        </p>

        <div className="overflow-x-auto rounded-xl border border-outline-variant/40 shadow-2xs">
          <table className="w-full text-left text-xs text-on-surface">
            <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/40">
              <tr>
                <th className="py-2.5 px-3">Product Category</th>
                <th className="py-2.5 px-3">Eligible Conditions</th>
                <th className="py-2.5 px-3">Return Window</th>
                <th className="py-2.5 px-3">Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-xs">
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-bold text-primary">Packaged Staples (Atta, Rice, Pulses, Mustard Oil)</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Torn sack, transit leakage, seal broken, or past expiry date.</td>
                <td className="py-2.5 px-3 text-secondary font-bold">48 Hours</td>
                <td className="py-2.5 px-3 text-outline">Replacement or Full Refund</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-bold text-primary">Packaged Snacks & Spices (MDH, Bikaji, Biscuits)</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Pouch puffed, burst seal, carton crushed, or expired batch.</td>
                <td className="py-2.5 px-3 text-secondary font-bold">48 Hours</td>
                <td className="py-2.5 px-3 text-outline">Replacement or Full Refund</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-bold text-primary">Personal Care & Cleaning (Himalaya, Soaps, Detergents)</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Bottle leakage, broken pump, damaged seal, wrong variant.</td>
                <td className="py-2.5 px-3 text-secondary font-bold">48 Hours</td>
                <td className="py-2.5 px-3 text-outline">Replacement or Full Refund</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-bold text-primary">Perishable Goods & Dairy</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Spoilage or physical defect upon delivery inspection.</td>
                <td className="py-2.5 px-3 text-secondary font-bold">At Delivery Handover</td>
                <td className="py-2.5 px-3 text-outline">Instant Handover Return</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="non-returnable" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          4. Non-Returnable Items
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          In order to safeguard the health and safety of all Saharsa families, we cannot accept returns under the following circumstances:
        </p>
        <ul className="space-y-1.5 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li>Items with missing original manufacturer packaging, tags, or altered batch numbers/barcodes.</li>
          <li>Opened, partially consumed, or adulterated food items (e.g. unsealed oil tins or open flour packets).</li>
          <li>Items returned more than 48 hours following successful confirmed delivery.</li>
          <li>Goods damaged due to improper storage or handling at the customer&apos;s premises.</li>
        </ul>
      </section>

      <section id="how-to-initiate" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          5. How to Initiate a Return or Claim
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
              1
            </div>
            <h4 className="font-bold text-on-surface">Notify Helpline</h4>
            <p className="text-on-surface-variant leading-relaxed">
              Call <strong>+91 6278 223400</strong> or WhatsApp your invoice photo and picture of damaged packaging within 48 hours.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
              2
            </div>
            <h4 className="font-bold text-on-surface">Doorstep Verification</h4>
            <p className="text-on-surface-variant leading-relaxed">
              Our delivery driver will inspect the defect during the next trip in your ward and collect the sealed return package.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs">
              3
            </div>
            <h4 className="font-bold text-on-surface">Prompt Resolution</h4>
            <p className="text-on-surface-variant leading-relaxed">
              Choose an immediate replacement carton or an instant refund processed to your original payment mode.
            </p>
          </div>
        </div>
      </section>

      <section id="refund-timelines" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          6. Refund Methods & Timelines
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <span className="font-bold text-primary block">Cash on Delivery (COD)</span>
            <p className="text-on-surface-variant">Instant cash refund on doorstep pickup, or instant direct UPI transfer to your phone number.</p>
            <span className="text-[10px] text-tertiary font-bold block pt-1">⚡ Instant / Same Day</span>
          </div>

          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <span className="font-bold text-secondary block">UPI / Online Payments</span>
            <p className="text-on-surface-variant">Refund initiated within 24 hours to the original source bank account or UPI VPA.</p>
            <span className="text-[10px] text-outline font-bold block pt-1">⏱️ 2 to 4 Banking Days</span>
          </div>

          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <span className="font-bold text-tertiary block">B2B Merchant Khata</span>
            <p className="text-on-surface-variant">Official GST Credit Note issued and immediately credited to your party ledger balance.</p>
            <span className="text-[10px] text-tertiary font-bold block pt-1">⚡ Instant Ledger Credit</span>
          </div>
        </div>
      </section>

      <section id="wholesale-claims" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          7. B2B Wholesale & Master Carton Shortages
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          For bulk supply deliveries to kirana retailers and institutions:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Carton Count Sign-off:</strong> The merchant must verify the total number of physical master cartons against the accompanied GST Delivery Challan before acknowledging handover.</li>
          <li><strong>Internal Piece Shortage:</strong> If an intact factory-sealed carton contains a piece shortage, submit a claim within 3 business days. A verified Credit Note will be booked against your supplier ledger.</li>
          <li><strong>Manufacturer Expiry Debit:</strong> Slow-moving inventory near expiry can be routed for manufacturer return per brand return windows under Section 34 of the CGST Act.</li>
        </ul>
      </section>

      <section id="contact-support" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          8. Customer Returns Helpline
        </h2>
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2 text-xs">
          <div className="font-bold text-on-surface text-sm">Need Help with an Order or Return?</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-on-surface-variant">
            <div><strong>Depot Desk:</strong> Station Road, Purab Bazar, Saharsa — 852201</div>
            <div><strong>Hotline:</strong> <a href="tel:+916278223400" className="text-primary font-bold hover:underline">+91 6278 223400</a></div>
            <div><strong>Email:</strong> <a href="mailto:support@jmdcart.com" className="text-primary hover:underline">support@jmdcart.com</a></div>
            <div><strong>Hours:</strong> Mon – Sat, 9:00 AM – 8:00 PM IST</div>
          </div>
          <p className="text-[11px] text-outline pt-1">
            All return requests are handled with priority by our local Saharsa warehouse team.
          </p>
        </div>
      </section>
    </LegalPolicyLayout>
  );
}
