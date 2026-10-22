"use client";

import { useState } from "react";

export function ContactFormClient() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || !phone.trim() || !message.trim()) {
      setErrorMessage("Please fill in all required fields (Name, Phone, Message)");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/store/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          subject: subject || undefined,
          message,
          type: "inquiry",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message. Please try again.");
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to submit message");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-surface-container-lowest p-8 rounded-2xl border border-outline-variant/20 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-tertiary-fixed/30 text-tertiary flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl">check_circle</span>
        </div>
        <h3 className="text-xl font-bold font-serif text-on-surface">Message Received!</h3>
        <p className="text-sm text-on-surface-variant max-w-md mx-auto">
          Thank you for reaching out. Our Saharsa Mandi desk manager will call or message you on WhatsApp shortly.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setMessage("");
            setSubject("");
          }}
          className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-container-lowest p-6 sm:p-8 rounded-2xl border border-outline-variant/20 shadow-sm space-y-4">
      <h2 className="text-lg font-bold font-serif text-on-surface flex items-center gap-2 border-b border-outline-variant/15 pb-3">
        <span className="material-symbols-outlined text-primary text-xl">mail</span>
        Send an Enquiry or Feedback
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
            Your Name *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Mobile Number *
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

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Email Address (Optional)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@example.com"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Wholesale kirana enquiry / delivery feedback"
            className="w-full bg-surface-container-low text-on-surface px-3.5 py-2.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            Your Message *
          </label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your query, requirement or feedback here..."
            className="w-full bg-surface-container-low text-on-surface p-3.5 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container disabled:opacity-50 transition-all shadow-md flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <span className="material-symbols-outlined text-lg">send</span>
            <span>Submit Message</span>
          </>
        )}
      </button>
    </form>
  );
}
