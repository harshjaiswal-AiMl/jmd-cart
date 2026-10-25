import React, { Suspense } from "react";
import Link from "next/link";
import { StoreHeader } from "@/components/store/StoreHeader";
import { StoreFooter } from "@/components/store/StoreFooter";

interface LegalPolicyLayoutProps {
  title: string;
  subtitle: string;
  lastUpdated: string;
  badge?: string;
  activePath?: "/privacy" | "/terms" | "/cookie-policy" | "/refund-policy" | string;
  children: React.ReactNode;
}

const LEGAL_NAV_TABS = [
  { label: "Terms of Service", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund & Cancellation", href: "/refund-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

export function LegalPolicyLayout({
  title,
  subtitle,
  lastUpdated,
  badge = "Customer & Merchant Protection",
  activePath = "/terms",
  children,
}: LegalPolicyLayoutProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between text-on-surface antialiased font-body">
      <Suspense fallback={<div className="w-full h-16 md:h-20 bg-surface" />}>
        <StoreHeader />
      </Suspense>

      <main className="w-full pt-48 md:pt-40 pb-20 flex-1 bg-surface">
        {/* Hero Header Section */}
        <section className="bg-surface-container-low/70 border-b border-surface-container-high/60 py-8 md:py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Link href="/" className="hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px]">home</span>
                <span>Home</span>
              </Link>
              <span className="text-outline">/</span>
              <span className="text-on-surface-variant font-medium">Legal &amp; Compliance</span>
              <span className="text-outline">/</span>
              <span className="text-primary font-bold">{title}</span>
            </nav>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-lowest text-primary rounded-full text-xs font-bold border border-primary/20 shadow-2xs">
                  <span className="material-symbols-outlined text-[14px]">verified_user</span>
                  <span>{badge}</span>
                </div>
                <h1 className="font-headline text-2xl sm:text-3xl lg:text-4xl font-extrabold text-on-surface tracking-tight">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl leading-relaxed">
                  {subtitle}
                </p>
              </div>

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                <div className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-surface-container-high shadow-2xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-secondary">schedule</span>
                  <span>Updated: <strong className="text-on-surface font-semibold">{lastUpdated}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-xl border border-surface-container-high shadow-2xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px] text-primary">location_on</span>
                  <span className="text-on-surface font-semibold">Saharsa, Bihar</span>
                </div>
              </div>
            </div>

            {/* Seamless Legal Document Switcher Tabs */}
            <div className="pt-4 border-t border-surface-container-high flex items-center gap-2 overflow-x-auto scrollbar-none">
              {LEGAL_NAV_TABS.map((tab) => {
                const isActive = activePath === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? "bg-primary text-on-primary shadow-xs"
                        : "bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-surface-container-high"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Clean Centered Legal Document Canvas */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <article className="bg-surface-container-lowest p-6 sm:p-10 md:p-12 rounded-2xl border border-surface-container-high shadow-xs">
            <div className="space-y-8 text-on-surface">
              {children}
            </div>

            {/* Bottom Support & Merchant Assurance Cards */}
            <div className="mt-12 pt-8 border-t border-surface-container-high grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-surface-container-low/70 border border-surface-container-high flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0 text-secondary">
                  <span className="material-symbols-outlined text-[20px]">help</span>
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-on-surface">Questions regarding this policy?</h4>
                  <p className="text-on-surface-variant text-[11px] leading-relaxed">
                    Our customer desk in Purab Bazar, Saharsa is available Mon-Sat, 9 AM - 8 PM IST.
                  </p>
                  <a
                    href="tel:+916278223400"
                    className="inline-flex items-center gap-1 text-primary font-bold hover:underline pt-1"
                  >
                    <span>Call +91 6278 223400</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </a>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low/70 border border-surface-container-high flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-700">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-on-surface">GST &amp; Merchant Compliance</h4>
                  <p className="text-on-surface-variant text-[11px] leading-relaxed">
                    All orders are backed by legal tax invoices with valid HSN and GST breakdowns.
                  </p>
                  <a
                    href="mailto:support@jmdcart.com"
                    className="inline-flex items-center gap-1 text-emerald-700 font-bold hover:underline pt-1"
                  >
                    <span>support@jmdcart.com</span>
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>
      </main>

      <StoreFooter />
    </div>
  );
}
