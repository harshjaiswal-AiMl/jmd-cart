"use client";

import React, { useState, useEffect } from "react";
import { MessageChannel } from "@prisma/client";
import { sendBillMessageAction } from "@/app/actions/messaging-actions";

interface BillMessagingCardProps {
  invoiceId: string;
  invoiceNumber: string;
  defaultPhone?: string | null;
  billUrl?: string | null;
  waMeUrl?: string | null;
  initialSkipped?: boolean;
  initialReason?: string;
  className?: string;
  compact?: boolean;
}

export function BillMessagingCard({
  invoiceId,
  invoiceNumber,
  defaultPhone,
  billUrl: initialBillUrl,
  waMeUrl: initialWaMeUrl,
  initialSkipped,
  initialReason,
  className = "",
  compact = false,
}: BillMessagingCardProps) {
  const [phone, setPhone] = useState(defaultPhone || "");
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [sending, setSending] = useState(false);
  const [billUrl, setBillUrl] = useState(initialBillUrl || "");
  const [waMeUrl, setWaMeUrl] = useState(initialWaMeUrl || "");
  const [status, setStatus] = useState<"IDLE" | "QUEUED" | "SENT" | "FAILED" | "SKIPPED">(
    initialSkipped ? "SKIPPED" : initialBillUrl ? "QUEUED" : "IDLE"
  );
  const [statusMessage, setStatusMessage] = useState(
    initialReason === "NO_VALID_PHONE" ? "No phone provided" : ""
  );
  const [copied, setCopied] = useState(false);

  // Sync if props change
  useEffect(() => {
    if (defaultPhone && !phone) setPhone(defaultPhone);
    if (initialBillUrl && !billUrl) setBillUrl(initialBillUrl);
    if (initialWaMeUrl && !waMeUrl) setWaMeUrl(initialWaMeUrl);
  }, [defaultPhone, initialBillUrl, initialWaMeUrl]);

  // Keyboard shortcut listener (Alt+W for wa.me, Alt+M for resend)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        handleOpenWhatsApp();
      } else if (e.altKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [waMeUrl, phone, sendWhatsApp, sendSms]);

  const handleOpenWhatsApp = () => {
    if (waMeUrl) {
      window.open(waMeUrl, "_blank");
    } else if (phone && phone.replace(/\D/g, "").length >= 10) {
      const digits = phone.replace(/\D/g, "");
      const normalized = digits.length === 10 ? `91${digits}` : digits;
      const url = `https://wa.me/${normalized}?text=${encodeURIComponent(
        `Namaste, JMD Cart se aapka bill ${invoiceNumber}. Bill dekhein: ${billUrl || "https://jmdcart.com"}`
      )}`;
      window.open(url, "_blank");
    }
  };

  const handleSend = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setStatus("FAILED");
      setStatusMessage("Enter a valid 10-digit mobile number");
      return;
    }

    setSending(true);
    setStatusMessage("");

    const channels: MessageChannel[] = [];
    if (sendWhatsApp) channels.push(MessageChannel.WHATSAPP);
    if (sendSms) channels.push(MessageChannel.SMS);

    if (channels.length === 0) {
      setStatusMessage("Select at least WhatsApp or SMS");
      setSending(false);
      return;
    }

    try {
      const res = await sendBillMessageAction({
        invoiceId,
        phone: digits,
        channels,
      });

      if (res.success) {
        const data = res as any;
        if (data.skipped) {
          setStatus("SKIPPED");
          setStatusMessage(data.reason || "Skipped");
        } else {
          setStatus("QUEUED");
          setStatusMessage("Bill queued for delivery");
          if (data.billUrl) setBillUrl(data.billUrl);
          if (data.waMeUrl) setWaMeUrl(data.waMeUrl);
        }
      } else {
        setStatus("FAILED");
        setStatusMessage(res.error || "Failed to queue message");
      }
    } catch (err: any) {
      setStatus("FAILED");
      setStatusMessage(err.message || "Network error");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    if (!billUrl) return;
    try {
      await navigator.clipboard.writeText(billUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className={`bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📱</span>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
              Send Bill to Customer
            </h4>
            <p className="text-[10px] text-slate-500">WhatsApp &amp; In-House SMS Delivery</p>
          </div>
        </div>

        {/* Status Chip */}
        {status === "QUEUED" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Queued
          </span>
        )}
        {status === "SENT" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            ✓ Sent
          </span>
        )}
        {status === "SKIPPED" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
            Skipped
          </span>
        )}
        {status === "FAILED" && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            Failed
          </span>
        )}
      </div>

      {/* Phone Number Input & Channels */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
            +91
          </span>
          <input
            type="tel"
            maxLength={10}
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            className="w-full pl-10 pr-3 py-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
          />
        </div>

        <div className="flex items-center gap-3 px-1 text-xs text-slate-700">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>WhatsApp</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={sendSms}
              onChange={(e) => setSendSms(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            <span>SMS</span>
          </label>
        </div>
      </div>

      {statusMessage && (
        <p className="text-[11px] text-slate-600 font-medium">{statusMessage}</p>
      )}

      {/* Action Buttons Grid */}
      <div className="flex flex-wrap gap-2 pt-1">
        {/* Open WhatsApp (wa.me) Click-to-chat */}
        <button
          type="button"
          onClick={handleOpenWhatsApp}
          className="flex-1 min-w-[130px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
          title="Direct click-to-chat link with zero ban risk (Alt+W)"
        >
          <span>💬</span>
          <span>Open WhatsApp</span>
          <span className="text-[9px] opacity-75 font-mono">Alt+W</span>
        </button>

        {/* Resend / Queue Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="px-3 py-2 bg-[#12355B] hover:bg-[#0E2843] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
          title="Send or resend via automatic gateway (Alt+M)"
        >
          {sending ? (
            <span className="animate-spin text-xs">⏳</span>
          ) : (
            <span>📤</span>
          )}
          <span>{status === "QUEUED" ? "Resend" : "Send Bill"}</span>
          <span className="text-[9px] opacity-75 font-mono">Alt+M</span>
        </button>

        {/* Copy Link */}
        {billUrl && (
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition shadow-xs cursor-pointer"
            title="Copy public customer bill link"
          >
            <span>{copied ? "✓ Copied" : "🔗 Copy Link"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
