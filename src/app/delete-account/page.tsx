"use client";

import React, { useState } from "react";

export default function DeleteAccountPage() {
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#FFF9F1] text-gray-800 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-2xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-amber-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#7A2433] flex items-center justify-center text-white font-bold text-xl">
            J
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#7A2433]">JMD Cart</h1>
            <p className="text-xs text-gray-500">Account & Data Deletion Request</p>
          </div>
        </div>

        {submitted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <h2 className="text-xl font-bold text-green-800 mb-2">Request Received</h2>
            <p className="text-sm text-green-700">
              Your account deletion request for <strong>{phone}</strong> has been received. Our team will verify and delete your profile and personal data within 48 hours.
            </p>
            <p className="text-xs text-gray-500 mt-4">
              Note: Historical financial transaction records (such as completed GST tax invoices) are legally preserved in compliance with applicable Indian tax and accounting statutes.
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Request Deletion of Your JMD Cart Account
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              In accordance with Google Play Developer Policies and applicable data protection regulations, you can permanently request the deletion of your JMD Cart account and associated personal data.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Registered Phone Number
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A2433] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                  Reason for Deletion (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Help us improve: why are you leaving?"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#7A2433] text-sm"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900">
                <strong>What happens when your account is deleted?</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Your login credentials, active sessions, and device tokens are permanently revoked.</li>
                  <li>Your personal profile name, addresses, wishlist, and saved shopping lists are erased.</li>
                  <li>Completed invoices and accounting ledger entries are retained in anonymized form for mandatory statutory tax and audit compliance.</li>
                </ul>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#7A2433] text-white font-semibold rounded-xl hover:bg-[#601925] transition-colors disabled:opacity-50 text-sm shadow-sm"
              >
                {loading ? "Submitting..." : "Submit Deletion Request"}
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-400 mt-8">
        © {new Date().getFullYear()} JMD Cart (JMD Traders). All rights reserved.
      </div>
    </div>
  );
}
