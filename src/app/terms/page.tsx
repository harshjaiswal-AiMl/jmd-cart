import type { Metadata } from "next";
import Link from "next/link";
import { LegalPolicyLayout } from "@/components/store/LegalPolicyLayout";

export const metadata: Metadata = {
  title: "Terms and Conditions | JMD Cart Saharsa",
  description:
    "Review the Terms and Conditions of JMD Cart Saharsa governing retail grocery purchases, B2B wholesale distribution, pricing slabs, billing, and credit terms.",
};

export default function TermsAndConditionsPage() {
  return (
    <LegalPolicyLayout
      title="Terms and Conditions"
      subtitle="Standard operational and commercial terms governing all retail purchases and B2B wholesale orders placed with JMD Cart Saharsa."
      lastUpdated="25 October 2026"
      activePath="/terms"
    >
      <section id="acceptance" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          1. Acceptance of Terms
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          These Terms and Conditions (&ldquo;Terms&rdquo;) constitute a legally binding agreement between you (whether an individual retail consumer or a business entity/kirana merchant) and <strong>JMD Cart</strong> (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) governing your access to and use of <a href="https://jmdcart.com" className="text-primary underline">jmdcart.com</a>, our mobile storefront, and our delivery services.
        </p>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          By registering an account, placing a purchase order, or accepting delivery of goods, you explicitly agree to be bound by these Terms, our <Link href="/privacy" className="text-primary underline font-medium">Privacy Policy</Link>, and our <Link href="/refund-policy" className="text-primary underline font-medium">Refund Policy</Link>.
        </p>
      </section>

      <section id="eligibility" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          2. Eligibility & Serviceable Delivery Area
        </h2>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Age Requirement:</strong> You must be at least 18 years of age or possess legal capacity under the Indian Contract Act, 1872 to enter into commercial transactions.</li>
          <li><strong>Service Boundary:</strong> Regular delivery is strictly confined to <strong>Saharsa municipal limits (Wards 1 through 40)</strong> and designated rural distribution routes covered by our van fleet. Orders outside serviceable zones will be cancelled with notice.</li>
          <li><strong>Business Verification:</strong> Kirana stores seeking wholesale rate slabs (Tier A / B) must furnish trade details and valid GSTIN or trade documentation for verification.</li>
        </ul>
      </section>

      <section id="pricing-taxes" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          3. Pricing, Wholesale Slabs & GST
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          All prices on JMD Cart are denominated in <strong>Indian Rupees (INR)</strong> and calculated to the exact integer paise:
        </p>
        <div className="space-y-2 text-xs sm:text-sm text-on-surface-variant">
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
            <span className="font-bold text-primary block">Taxes & GST Compliance</span>
            <p>
              Prices shown in your cart include applicable Goods and Services Tax (GST: 0%, 5%, 12%, 18%) per the CGST and SGST schedules. B2B buyers with registered GSTINs receive legally compliant tax invoices valid for Input Tax Credit (ITC).
            </p>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
            <span className="font-bold text-secondary block">Wholesale Slabs & Pack Quantities</span>
            <p>
              Wholesale pricing applies on full unopened carton quantities or bulk thresholds. Slabs are applied automatically in real time based on your approved party tier (Tier A, Tier B, or Tier C Walk-in).
            </p>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-1">
            <span className="font-bold text-tertiary block">Price Corrections</span>
            <p>
              In the rare event of a system typographical error, we reserve the right to notify you before dispatch to confirm the correct rate or cancel the affected line item.
            </p>
          </div>
        </div>
      </section>

      <section id="orders-billing" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          4. Orders & Invoice Immutability
        </h2>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Order Placement:</strong> When you place an order, our inventory management system immediately reserves the required stock from our central warehouse.</li>
          <li><strong>Gapless Sequencing:</strong> All invoices receive a locked, chronological, gapless invoice number (e.g., <code>INV/26-27/000123</code>) generated exclusively by our ledger system.</li>
          <li><strong>Invoice Immutability:</strong> In accordance with statutory accounting standards, finalized invoices cannot be edited, deleted, or back-dated. Any adjustments or cancellations are processed strictly via formal Credit Notes.</li>
        </ul>
      </section>

      <section id="payment-terms" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          5. Payment Modes & Merchant Credit Terms
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
              Direct Settlement (Retail)
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              We accept Cash on Delivery (COD), UPI QR scan at doorstep, and authorized RuPay/Debit card payments through delivery terminals.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">account_balance</span>
              Merchant Khata (Credit Facility)
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Approved kiranas receive an allocated credit limit with 7-to-15 day credit terms. Van drivers issue atomic, sequentially numbered collection receipts for all debt settlements.
            </p>
          </div>
        </div>
        <p className="text-xs text-outline pt-1">
          <strong>Default on Credit:</strong> Overdue merchant balances beyond agreed credit limits will result in an automated hold on new dispatches until outstanding balances are cleared.
        </p>
      </section>

      <section id="delivery-inspection" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          6. Delivery & Physical Inspection
        </h2>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Turnaround:</strong> Standard local orders in Saharsa are targeted for same-day delivery within 30 to 120 minutes depending on order volume and weather conditions.</li>
          <li><strong>Carton Handover:</strong> For wholesale deliveries, the buyer or their authorized representative must physically inspect carton tape seals and count packages upon handover.</li>
          <li><strong>Damaged Packaging:</strong> If any container or master carton exhibits tampering or leakage, notify the delivery agent immediately before signing the proof-of-delivery slip.</li>
        </ul>
      </section>

      <section id="returns-cancellation" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          7. Returns & Cancellations
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Order cancellations and returns are subject to the conditions detailed in our comprehensive <Link href="/refund-policy" className="text-primary underline font-bold">Refund & Cancellation Policy</Link>. Perishable and unsealed edible items cannot be returned once accepted at the doorstep.
        </p>
      </section>

      <section id="prohibited-use" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          8. Prohibited Conduct
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Users agree not to:
        </p>
        <ul className="space-y-1.5 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li>Submit fake or unverified GSTIN details to claim illicit input tax credit.</li>
          <li>Place fraudulent Cash on Delivery orders with malicious intent to reject upon arrival.</li>
          <li>Attempt unauthorized penetration, scraping, or load-testing against our web infrastructure.</li>
          <li>Impersonate any JMD Cart delivery personnel or staff member.</li>
        </ul>
      </section>

      <section id="governing-law" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          9. Governing Law & Dispute Jurisdiction
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          These Terms and all transactions executed through JMD Cart shall be governed by and construed in accordance with the laws of <strong>India</strong>.
        </p>
        <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs text-on-surface-variant">
          <strong>Exclusive Jurisdiction:</strong> Any dispute, claim, or controversy arising out of or in connection with these Terms or the breach, termination, or validity thereof shall be subject to the exclusive jurisdiction of the competent courts situated in <strong>Saharsa, Bihar, India</strong>.
        </div>
      </section>
    </LegalPolicyLayout>
  );
}
