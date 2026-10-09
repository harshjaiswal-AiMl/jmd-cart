"use client";

import React, { useState } from "react";
import { AlertTriangle, ShieldAlert, KeyRound, CheckCircle2, X } from "lucide-react";
import { verifyOwnerOverrideAction } from "@/app/shop/pos/actions";

interface CreditOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  partyName: string;
  breachReasons: string[];
  currentUserRole: string;
  currentUserId?: string;
  onApproved: (override: { approvedByUserId: string; reason: string }) => void;
}

export function CreditOverrideModal({
  isOpen,
  onClose,
  partyName,
  breachReasons,
  currentUserRole,
  currentUserId,
  onApproved,
}: CreditOverrideModalProps) {
  const isSuperAdmin = currentUserRole === "SUPER_ADMIN";

  const [phoneOrEmail, setPhoneOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
      setError("Please provide a valid override reason (at least 3 characters).");
      return;
    }

    if (isSuperAdmin && currentUserId) {
      onApproved({
        approvedByUserId: currentUserId,
        reason: cleanReason,
      });
      onClose();
      return;
    }

    if (!phoneOrEmail.trim() || !password) {
      setError("Please enter the owner's phone/email and password to verify override authorization.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOwnerOverrideAction(phoneOrEmail.trim(), password);
      if (!res.success) {
        setError(res.error || "Failed to verify owner credentials");
        return;
      }

      onApproved({
        approvedByUserId: res.user.id,
        reason: cleanReason,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-amber-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-amber-100 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-base leading-tight">Credit Limit Override</h3>
              <p className="text-xs text-amber-100">Owner Authorization Required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-amber-600/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Party and breach notice */}
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Credit Terms Breached: {partyName}</span>
            </div>
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-1 font-medium pl-1">
              {breachReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          {isSuperAdmin ? (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>You are logged in as Owner / Super Admin. Enter the override reason below to proceed.</span>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                <span>Owner / Super Admin Verification</span>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Owner Phone or Email
                </label>
                <input
                  type="text"
                  value={phoneOrEmail}
                  onChange={(e) => setPhoneOrEmail(e.target.value)}
                  placeholder="e.g. 9800000001 or admin@jmdcart.in"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Owner Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter owner password"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Mandatory Override Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Approved by Sachin Prakash; customer promised payment by tomorrow evening."
              rows={2}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm transition disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Confirm & Authorize Override"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
