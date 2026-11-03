"use client";

import React, { useState, useEffect } from "react";

export function MessagingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testChannel, setTestChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const loadHealth = async () => {
    try {
      const res = await fetch("/api/messaging/status");
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || testPhone.replace(/\D/g, "").length < 10) {
      setTestResult({ success: false, error: "Enter valid 10-digit mobile" });
      return;
    }

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/messaging/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone, channel: testChannel }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({ success: true });
        loadHealth();
      } else {
        setTestResult({ success: false, error: data.error || "Failed to send test message" });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || "Network error" });
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span>💬</span> Bill Messaging &amp; Gateways
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time status of WhatsApp (Open-WA) &amp; in-house Android SIM gateway.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            loadHealth();
          }}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
        >
          Refresh
        </button>
      </div>

      {/* Gateway Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WhatsApp Gateway Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              WhatsApp Gateway (Open-WA)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                healthData?.whatsApp?.ok
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : healthData?.whatsApp?.status === "NEEDS_QR_SCAN"
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {healthData?.whatsApp?.status || (loading ? "Checking..." : "DISCONNECTED")}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Dedicated private service on Compute Engine VM. Uses business number.
          </p>

          {healthData?.whatsApp?.details?.qr && (
            <div className="p-3 bg-white border border-amber-200 rounded-lg text-center space-y-2">
              <p className="text-xs font-bold text-amber-800">Scan QR Code with WhatsApp:</p>
              <img
                src={healthData.whatsApp.details.qr}
                alt="WhatsApp QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
          )}

          <div className="text-[11px] text-slate-500 font-mono">
            Fallback: Instant wa.me click-to-chat links always available for cashiers.
          </div>
        </div>

        {/* SMS Gateway Device Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              In-House SMS Gateway (Android SIM)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                healthData?.sms?.ok
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {healthData?.sms?.status || (loading ? "Checking..." : "STANDBY")}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Sends directly from owner&apos;s dedicated Android phone &amp; SIM. No third-party vendor.
          </p>

          {healthData?.sms?.details?.devices && (
            <div className="space-y-1 text-xs">
              {healthData.sms.details.devices.map((d: any, idx: number) => (
                <div key={idx} className="flex justify-between p-2 bg-white rounded border border-slate-200">
                  <span className="font-medium text-slate-800">{d.label}</span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Today: {d.dailySent} msgs
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="text-[11px] text-slate-500">
            Endpoint: <code className="bg-slate-200 px-1 rounded text-slate-700">/api/messaging/sms/pull</code>
          </div>
        </div>
      </div>

      {/* Queue Metrics */}
      {healthData?.queueStats && (
        <div className="grid grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="block text-xs text-slate-500 font-medium">Queued</span>
            <span className="text-lg font-black text-slate-900 font-mono">
              {healthData.queueStats.queued}
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
            <span className="block text-xs text-amber-700 font-medium">Sending</span>
            <span className="text-lg font-black text-amber-900 font-mono">
              {healthData.queueStats.sending}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
            <span className="block text-xs text-emerald-700 font-medium">Sent</span>
            <span className="text-lg font-black text-emerald-900 font-mono">
              {healthData.queueStats.sent}
            </span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
            <span className="block text-xs text-rose-700 font-medium">Failed</span>
            <span className="text-lg font-black text-rose-900 font-mono">
              {healthData.queueStats.failed}
            </span>
          </div>
        </div>
      )}

      {/* Test Message Form */}
      <form onSubmit={handleSendTest} className="border-t border-slate-100 pt-4 space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          Send Test Message
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
              +91
            </span>
            <input
              type="tel"
              maxLength={10}
              placeholder="Admin 10-digit mobile number"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, ""))}
              className="w-full pl-11 pr-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900"
            />
          </div>

          <select
            value={testChannel}
            onChange={(e) => setTestChannel(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800"
          >
            <option value="WHATSAPP">WhatsApp</option>
            <option value="SMS">SMS (In-House)</option>
          </select>

          <button
            type="submit"
            disabled={sendingTest}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50"
          >
            {sendingTest ? "Sending..." : "Send Test"}
          </button>
        </div>

        {testResult && (
          <p
            className={`text-xs font-semibold ${
              testResult.success ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {testResult.success
              ? "✓ Test message sent successfully!"
              : `✕ Error: ${testResult.error}`}
          </p>
        )}
      </form>
    </div>
  );
}
