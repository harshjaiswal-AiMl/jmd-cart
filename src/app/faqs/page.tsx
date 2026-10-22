import { Metadata } from "next";
import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";
import { Breadcrumbs } from "@/components/store/Breadcrumbs";
import { storeService } from "@/modules/store/store.service";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQs) | JMD Cart Saharsa",
  description:
    "Find answers about grocery ordering, delivery timings, minimum order value, wholesale kirana slabs, and GST invoicing in Saharsa.",
  openGraph: {
    title: "JMD Cart FAQs",
    description: "Common questions answered about grocery delivery and wholesale mandi supply in Saharsa.",
    url: "https://jmdcart.com/faqs",
  },
  alternates: {
    canonical: "/faqs",
  },
};

export const dynamic = "force-dynamic";

export default async function FaqsPage() {
  const dbFaqs = await storeService.getFaqs();

  const defaultFaqs = [
    {
      group: "Ordering & Delivery",
      question: "How fast will my grocery order be delivered in Saharsa?",
      answer:
        "Orders within Saharsa Nagar Nigam are dispatched from our Purab Bazar central warehouse within 30 minutes to 2 hours via our dedicated electric tempo fleet. Morning slots (8am - 11am) are also available.",
    },
    {
      group: "Ordering & Delivery",
      question: "Is there a minimum order value for free delivery?",
      answer:
        "Yes, orders of ₹2,000 and above receive FREE express delivery across Saharsa town. For orders below ₹2,000, a nominal delivery charge of ₹50 applies.",
    },
    {
      group: "Wholesale & Kirana",
      question: "How do volume slab discounts work for kirana stores and caterers?",
      answer:
        "When purchasing bulk quantities (such as 4+ sacks of flour or 12+ oil tins), wholesale tiered slabs automatically apply in your cart, saving up to 14% compared to standard retail prices.",
    },
    {
      group: "Wholesale & Kirana",
      question: "Can I get a GST input tax credit (ITC) invoice?",
      answer:
        "Yes, simply enter your business GSTIN and Registered Trade Name at checkout. A GST-compliant tax invoice with HSN breakdown will be dispatched with your shipment and forwarded via WhatsApp.",
    },
    {
      group: "Payments & Returns",
      question: "What payment modes are accepted?",
      answer:
        "We accept Cash on Delivery (COD) as well as UPI on Delivery (Google Pay, PhonePe, Paytm, BHIM) scanned directly on the delivery tempo's QR code. Authorized commercial parties may also access credit terms upon management approval.",
    },
    {
      group: "Payments & Returns",
      question: "What is your return policy?",
      answer:
        "Per our wholesale commercial distribution rules, we follow a strict counter inspection and no market-return policy once goods are accepted. Please inspect carton counts and seals in the presence of the delivery driver upon arrival.",
    },
  ];

  const faqsToRender = dbFaqs.length > 0 ? dbFaqs : defaultFaqs;

  // JSON-LD FAQPage Schema for high SEO scores!
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsToRender.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <StoreShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 space-y-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "FAQs" },
          ]}
        />

        <div className="border-b border-outline-variant/15 pb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Help &amp; Answers
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-serif text-on-surface mt-1">
            Frequently Asked Questions
          </h1>
          <p className="text-sm sm:text-base text-on-surface-variant mt-2 leading-relaxed">
            Everything you need to know about our products, mandi rates, delivery schedules, and wholesale procurement.
          </p>
        </div>

        <div className="space-y-4">
          {faqsToRender.map((faq, idx) => (
            <details
              key={idx}
              className="group bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-5 shadow-sm transition-colors open:bg-surface-container-low/40"
            >
              <summary className="font-bold text-sm sm:text-base text-on-surface cursor-pointer list-none flex items-center justify-between gap-4">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">help_outline</span>
                  {faq.question}
                </span>
                <span className="material-symbols-outlined text-outline group-open:rotate-180 transition-transform text-lg shrink-0">
                  expand_more
                </span>
              </summary>
              <p className="mt-3 text-xs sm:text-sm text-on-surface-variant leading-relaxed pl-7 border-t border-outline-variant/15 pt-3">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>

        {/* Still have questions card */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-base text-on-surface">Still have a question?</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Our Saharsa Mandi desk team is available every day from 7am to 9pm.
            </p>
          </div>

          <Link
            href="/contact"
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shrink-0 shadow-sm"
          >
            Contact Customer Support →
          </Link>
        </div>
      </main>
    </StoreShell>
  );
}
