import type { Metadata } from "next";
import Link from "next/link";
import { LegalPolicyLayout } from "@/components/store/LegalPolicyLayout";

export const metadata: Metadata = {
  title: "Cookie Policy | JMD Cart Saharsa",
  description:
    "Learn about how JMD Cart uses essential cookies, authentication session tokens, and local storage to deliver a fast and secure grocery shopping experience.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPolicyLayout
      title="Cookie & Storage Policy"
      subtitle="Complete transparency on the session tokens, local storage, and essential cookies used to power JMD Cart Saharsa."
      lastUpdated="25 October 2026"
      activePath="/cookie-policy"
    >
      <section id="what-are-cookies" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          1. What Are Cookies and Local Storage?
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          Cookies are small text files placed on your computer, tablet, or smartphone when you visit a website. In addition to HTTP cookies, modern web applications utilize <strong>HTML5 Local Storage</strong> to persist small data structures (such as your shopping cart items) directly inside your web browser.
        </p>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          At JMD Cart, we believe in minimal data footprint. We use cookies and local storage <strong>strictly for essential functional and security needs</strong>—such as keeping your items in your bag while you browse, and maintaining a secure login session.
        </p>
      </section>

      <section id="how-we-use" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          2. How We Use Cookies
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Strictly Necessary & Security
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              These cookies are essential for you to authenticate, prevent Cross-Site Request Forgery (CSRF) attacks, and securely complete checkout transactions. The website cannot function safely without them.
            </p>
          </div>

          <div className="p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/40 text-xs space-y-1.5">
            <div className="font-bold text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">shopping_cart</span>
              Functional Shopping Experience
            </div>
            <p className="text-on-surface-variant leading-relaxed">
              Local storage remembers your chosen products, quantities, and recent searches even if your mobile internet momentarily drops on the go in Saharsa.
            </p>
          </div>
        </div>
      </section>

      <section id="cookie-inventory" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          3. Complete Cookie & Storage Inventory
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          The table below outlines all first-party cookies and browser storage keys utilized across <a href="https://jmdcart.com" className="text-primary underline font-medium">jmdcart.com</a>:
        </p>

        <div className="overflow-x-auto rounded-xl border border-outline-variant/40 shadow-2xs">
          <table className="w-full text-left text-xs text-on-surface">
            <thead className="bg-surface-container-low text-[11px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/40">
              <tr>
                <th className="py-2.5 px-3">Name / Key</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Purpose</th>
                <th className="py-2.5 px-3">Lifespan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-xs">
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-mono font-bold text-primary">__Host-authjs.csrf-token</td>
                <td className="py-2.5 px-3 font-medium">HTTP Cookie (Secure)</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Protects forms, logins, and API actions against Cross-Site Request Forgery (CSRF).</td>
                <td className="py-2.5 px-3 text-outline">Session</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-mono font-bold text-primary">__Secure-authjs.session-token</td>
                <td className="py-2.5 px-3 font-medium">HTTP Cookie (Secure, HttpOnly)</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Stores your authenticated user session securely so you stay logged in while navigating.</td>
                <td className="py-2.5 px-3 text-outline">30 Days</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-mono font-bold text-secondary">jmd_local_cart</td>
                <td className="py-2.5 px-3 font-medium">Browser LocalStorage</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Preserves your guest cart items and piece counts so your shopping bag is never lost.</td>
                <td className="py-2.5 px-3 text-outline">Persistent (Until Cleared)</td>
              </tr>
              <tr className="hover:bg-surface-container-low/50">
                <td className="py-2.5 px-3 font-mono font-bold text-tertiary">jmd-van-pwa-v1</td>
                <td className="py-2.5 px-3 font-medium">Service Worker Cache</td>
                <td className="py-2.5 px-3 text-on-surface-variant">Caches essential application shells and brand logos to accelerate loading on low-bandwidth mobile devices.</td>
                <td className="py-2.5 px-3 text-outline">Until App Revision</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="third-party" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          4. Zero Third-Party Advertising Trackers
        </h2>
        <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/40 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-tertiary text-sm">
            <span className="material-symbols-outlined text-[18px]">verified</span>
            Strict No-Tracking Guarantee
          </div>
          <p className="text-on-surface-variant leading-relaxed">
            Unlike many commercial websites, <strong>JMD Cart does NOT deploy third-party advertising pixels, cross-site tracking beacons, or behavioral marketing cookies</strong> (such as Facebook Pixel or cross-domain ad retargeters). Your shopping and browsing history in Saharsa is your private business.
          </p>
        </div>
      </section>

      <section id="managing-cookies" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          5. How to Manage & Disable Cookies
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          You can restrict or block cookies at any time through your browser settings. However, please note that disabling strictly necessary cookies will prevent you from signing into your customer or merchant account.
        </p>
        <ul className="space-y-2 text-xs text-on-surface-variant list-disc list-inside">
          <li><strong>Google Chrome (Android / Desktop):</strong> Settings → Privacy and Security → Third-Party Cookies.</li>
          <li><strong>Apple Safari (iOS / Mac):</strong> Settings → Safari → Advanced → Block All Cookies.</li>
          <li><strong>Mozilla Firefox:</strong> Settings → Privacy & Security → Cookies and Site Data.</li>
          <li><strong>Clear Local Storage:</strong> You can clear your cart at any time by tapping &ldquo;Clear Cart&rdquo; on the cart page or clearing site data in browser settings.</li>
        </ul>
      </section>

      <section id="updates" className="space-y-3">
        <h2 className="text-lg sm:text-xl font-bold font-headline text-primary border-b border-outline-variant/40 pb-2">
          6. Updates to This Policy
        </h2>
        <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
          We may update our Cookie Policy periodically to reflect technological improvements or regulatory adjustments. Any revisions will be published on this page with an updated &ldquo;Last updated&rdquo; timestamp.
        </p>
        <p className="text-xs text-on-surface-variant">
          For questions regarding our cookie practices, please contact our support desk at <a href="mailto:support@jmdcart.com" className="text-primary underline font-medium">support@jmdcart.com</a> or visit our <Link href="/privacy" className="text-primary underline font-medium">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPolicyLayout>
  );
}
