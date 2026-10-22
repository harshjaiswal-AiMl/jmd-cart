"use client";

import { useState } from "react";

export function WholesaleEnquiryClient() {
  const [businessName, setBusinessName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("KIRANA");
  const [gstin, setGstin] = useState("");
  const [address, setAddress] = useState("");
  const [estimatedMonthlyVolume, setEstimatedMonthlyVolume] = useState("50000_100000");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!businessName.trim() || !contactPerson.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage("Please complete all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const messageContent = `Business Name: ${businessName}
Contact Person: ${contactPerson}
Business Type: ${businessType}
GSTIN: ${gstin || "Not provided / Unregistered"}
Address: ${address}
Estimated Monthly Volume: ${estimatedMonthlyVolume}`;

      const res = await fetch("/api/store/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactPerson,
          phone,
          subject: `Wholesale Application: ${businessName} (${businessType})`,
          message: messageContent,
          type: "wholesale_application",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit application. Please try again.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-3xl border border-outline-variant/20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-tertiary-fixed/30 text-tertiary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl">verified</span>
        </div>
        <h3 className="text-xl font-bold font-serif text-on-surface">Application Submitted!</h3>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">
          Thank you for applying to become an authorized JMD Cart wholesale partner. Our commercial sales manager will review your shop details and contact you via WhatsApp to configure your Price A/B tier account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-6 sm:p-8 rounded-3xl border border-outline-variant/20 shadow-sm space-y-5">
      <h2 className="text-lg font-bold font-serif text-on-surface flex items-center gap-2 border-b border-outline-variant/15 pb-3">
        <span className="material-symbols-outlined text-primary text-xl">store</span>
        Retailer Onboarding &amp; B2B Credit Application
      </h2>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Shop / Business Trade Name *
          </label>
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Gupta Kirana Stores"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Proprietor / Contact Name *
          </label>
          <input
            type="text"
            required
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. Ramesh Kumar Gupta"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Mobile Number (WhatsApp Enabled) *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-xs font-bold text-on-surface-variant">+91</span>
            <input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              placeholder="98765 43210"
              className="w-full bg-surface-container-low text-on-surface pl-11 pr-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono font-medium"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Type of Business *
          </label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold cursor-pointer"
          >
            <option value="KIRANA">Retail Kirana / Grocery Store</option>
            <option value="WHOLESALER">Semi-Wholesaler / Sub-Distributor</option>
            <option value="CATERER">Halwai / Catering Service</option>
            <option value="HOTEL_RESTAURANT">Hotel / Restaurant / Dhaba</option>
            <option value="INSTITUTION">School / Hostel / Institution</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            GSTIN (If Registered)
          </label>
          <input
            type="text"
            maxLength={15}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="e.g. 10AAECJ3829K1ZT"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono uppercase font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Estimated Monthly Order Value
          </label>
          <select
            value={estimatedMonthlyVolume}
            onChange={(e) => setEstimatedMonthlyVolume(e.target.value)}
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-semibold cursor-pointer"
          >
            <option value="25000_50000">₹25,000 – ₹50,000 / month</option>
            <option value="50000_100000">₹50,000 – ₹1,00,000 / month</option>
            <option value="100000_300000">₹1,00,000 – ₹3,00,000 / month</option>
            <option value="300000_plus">₹3,00,000+ / month (Master Truck Load)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Shop Address &amp; Delivery Location in Saharsa *
          </label>
          <textarea
            required
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Enter market name, ward, village/block and landmark..."
            className="w-full bg-surface-container-low text-on-surface p-3.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span>Submit Retailer Application</span>
          </>
        )}
      </button>
    </form>
  );
}
