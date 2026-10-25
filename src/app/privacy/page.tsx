import type { Metadata } from "next";
import Link from "next/link";
import { LegalPolicyLayout } from "@/components/store/LegalPolicyLayout";

export const metadata: Metadata = {
  title: "Privacy Policy | JMD Cart Saharsa",
  description:
    "Read the Privacy Policy of JMD Cart Saharsa. Learn how we collect, protect, and handle your personal and merchant business data under Indian privacy laws.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPolicyLayout
      title="Privacy Policy"
      subtitle="How JMD Cart protects, manages, and respects your personal and business data across our retail and wholesale distribution network."
      lastUpdated="25 October 2026"
      activePath="/privacy"
    >
      <section id="introduction" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          1. Introduction & Scope
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Welcome to <strong>JMD Cart</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;). We operate an FMCG retail and wholesale distribution management platform in Saharsa, Bihar (accessible via <a href="https://jmdcart.com" className="text-primary underline">jmdcart.com</a> and our mobile web interfaces).
        </p>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          This Privacy Policy describes our practices regarding the collection, use, storage, and disclosure of personal data provided by customers, kirana merchants, institutional buyers, and website visitors in compliance with the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>, and the <strong>Digital Personal Data Protection Act, 2023 (DPDP)</strong>.
        </p>
      </section>

      <section id="data-we-collect" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          2. Information We Collect
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Depending on whether you browse as a retail consumer, place grocery orders, or operate as a verified B2B wholesale merchant, we collect the following categories of information:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
            <div className="font-bold text-xs text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">person</span>
              Customer & Identity Data
            </div>
            <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
              <li>Full Name, Mobile Phone Number, and Email Address.</li>
              <li>Encrypted password credentials (bcrypt-hashed).</li>
              <li>Verification status for doorstep dispatch.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
            <div className="font-bold text-xs text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">pin_drop</span>
              Delivery & Address Information
            </div>
            <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
              <li>Street address, Landmark, Ward Number (1–40 in Saharsa).</li>
              <li>Postal PIN code (852201 and adjoining delivery zones).</li>
              <li>Alternative contact numbers for delivery coordination.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
            <div className="font-bold text-xs text-tertiary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              B2B Merchant & Tax Data
            </div>
            <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
              <li>Kirana / Business Name and Owner Name.</li>
              <li>15-character Goods and Services Tax Identification Number (GSTIN).</li>
              <li>Assigned wholesale pricing tier (List A, B, or C) and credit limit.</li>
            </ul>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-1.5">
            <div className="font-bold text-xs text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">payments</span>
              Payment & Transaction Records
            </div>
            <ul className="text-xs text-on-surface-variant space-y-1 list-disc list-inside">
              <li>Payment mode (Cash on Delivery, UPI Reference Number, RuPay/Cards).</li>
              <li>Invoice numbering sequences and payment receipt numbers.</li>
              <li><strong>Notice:</strong> We do NOT store credit/debit card numbers or UPI PINs.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="how-we-use-data" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          3. How We Use Your Information
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          We process personal data strictly for legitimate business, fulfilment, and statutory tax compliance purposes:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Order Fulfilment:</strong> Picking goods in our central godown, packing sealed cartons, and assigning dispatch routes to our delivery vehicles across Saharsa.</li>
          <li><strong>Statutory GST Billing:</strong> Generating Section 31 CGST-compliant tax invoices, e-invoices, and input tax credit (ITC) reconciliation for registered businesses.</li>
          <li><strong>Delivery Coordination:</strong> Sending SMS/WhatsApp notifications and driver phone calls for order status and delivery confirmation.</li>
          <li><strong>Credit Ledger Accounting:</strong> Maintaining running debtor ledgers and issuing gapless collection receipts for authorized credit kiranas.</li>
          <li><strong>Fraud Prevention & Audit:</strong> Logging audit trails on all stock movements, bill modifications, and authentication attempts.</li>
        </ul>
      </section>

      <section id="sharing-disclosure" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          4. Data Sharing & Disclosure
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          We maintain a strict zero-spam, zero-ad-broker policy. We never sell, rent, or trade your personal or business data to third-party telemarketers. Information is shared only with:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li><strong>Direct Logistics Fleet:</strong> Our employed delivery and van sales staff receive your name, address, and items ordered solely to execute physical handover.</li>
          <li><strong>Statutory Authorities:</strong> Where required by applicable Indian tax laws, GSTR-1 filings, or lawful government directives.</li>
          <li><strong>Infrastructure Providers:</strong> Secure cloud infrastructure (Google Cloud Platform in Mumbai, India) and Cloudflare storage for encrypted, tamper-proof system backups.</li>
        </ul>
      </section>

      <section id="data-security" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          5. Data Security & Storage
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Your data is stored within certified data centers located in <strong>Mumbai, India (`asia-south1`)</strong>. We implement industry-standard administrative, physical, and technical safeguards:
        </p>
        <ul className="space-y-1.5 text-xs sm:text-sm text-on-surface-variant list-disc list-inside">
          <li>All browser traffic is encrypted in transit using Transport Layer Security (TLS 1.3 / HTTPS).</li>
          <li>Database backups are encrypted at rest with AES-256 and stored with point-in-time recovery.</li>
          <li>Passwords are irreversibly salted and hashed using modern bcrypt cryptographic standards.</li>
          <li>Role-based access control (RBAC) restricts customer records strictly to authorized super-admins.</li>
        </ul>
      </section>

      <section id="user-rights" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          6. Your Rights & Controls
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Under Indian data protection laws, you enjoy the following rights regarding your personal information:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <h4 className="font-bold text-on-surface">Right to Access & Review</h4>
            <p className="text-on-surface-variant">View your active profile, saved addresses, and past order invoices anytime from your account dashboard.</p>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <h4 className="font-bold text-on-surface">Right to Correction</h4>
            <p className="text-on-surface-variant">Update your phone number, business trade name, or address by contacting our dispatch desk.</p>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 text-xs space-y-1">
            <h4 className="font-bold text-on-surface">Right to Erasure</h4>
            <p className="text-on-surface-variant">Request account deactivation, subject to statutory retention of past GST invoices under Indian taxation laws.</p>
          </div>
        </div>
      </section>

      <section id="cookies" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          7. Cookies & Local Storage
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          We use session cookies and browser local storage strictly for essential website functionality, such as keeping your cart items saved before you sign in. For comprehensive details on our cookie usage, please review our dedicated <Link href="/cookie-policy" className="text-primary font-bold hover:underline">Cookie Policy</Link>.
        </p>
      </section>

      <section id="grievance-officer" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          8. Grievance Officer & Contact Details
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          In accordance with the Information Technology Act, 2000 and rules made thereunder, the contact details of the Grievance Officer are provided below:
        </p>

        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2 text-xs">
          <div className="font-bold text-sm text-primary">Grievance & Privacy Desk — JMD Cart</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-on-surface-variant">
            <div><strong>Entity:</strong> JMD Cart (Jai Maa Durge Enterprises)</div>
            <div><strong>Location:</strong> Station Road, Purab Bazar, Saharsa, Bihar — 852201</div>
            <div><strong>Email:</strong> <a href="mailto:grievance@jmdcart.com" className="text-primary hover:underline">grievance@jmdcart.com</a></div>
            <div><strong>Helpline:</strong> <a href="tel:+916278223400" className="text-primary hover:underline">+91 6278 223400</a></div>
          </div>
          <p className="text-[11px] text-outline pt-1">
            We acknowledge all customer and merchant grievances within 48 hours and resolve issues within one month of receipt.
          </p>
        </div>
      </section>
    </LegalPolicyLayout>
  );
}
