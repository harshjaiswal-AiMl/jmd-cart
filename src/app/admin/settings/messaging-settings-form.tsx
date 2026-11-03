"use client";

import React, { useState, useEffect } from "react";
import { saveMessagingConfigAction } from "@/app/actions/messaging-actions";

export function MessagingSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<any>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testChannel, setTestChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [testProvider, setTestProvider] = useState<string>("DEFAULT");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; error?: string } | null>(null);

  // Configuration state
  const [whatsappProvider, setWhatsappProvider] = useState("CLOUD_API");
  const [smsProvider, setSmsProvider] = useState("FAST2SMS");
  const [fast2smsApiKey, setFast2smsApiKey] = useState("");
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioFrom, setTwilioFrom] = useState("");
  const [metaWaPhoneId, setMetaWaPhoneId] = useState("");
  const [metaWaToken, setMetaWaToken] = useState("");
  const [openWaUrl, setOpenWaUrl] = useState("http://127.0.0.1:8080");

  const [savingConfig, setSavingConfig] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ success?: boolean; error?: string } | null>(null);

  const loadHealth = async () => {
    try {
      const res = await fetch("/api/messaging/status");
      if (res.ok) {
        const json = await res.json();
        setHealthData(json);
        if (json.activeWaProvider) setWhatsappProvider(json.activeWaProvider);
        if (json.activeSmsProvider) setSmsProvider(json.activeSmsProvider);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setSaveStatus(null);
    try {
      const res = await saveMessagingConfigAction({
        whatsappProvider,
        smsProvider,
        fast2smsApiKey,
        twilioSid,
        twilioToken,
        twilioFrom,
        metaWaPhoneNumberId: metaWaPhoneId,
        metaWaAccessToken: metaWaToken,
        openWaGatewayUrl: openWaUrl,
      });

      if (res.success) {
        setSaveStatus({ success: true });
        loadHealth();
      } else {
        setSaveStatus({ success: false, error: res.error || "Failed to save settings" });
      }
    } catch (err: any) {
      setSaveStatus({ success: false, error: err.message || "Failed to save settings" });
    } finally {
      setSavingConfig(false);
    }
  };

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
        body: JSON.stringify({
          phone: testPhone,
          channel: testChannel,
          provider: testProvider !== "DEFAULT" ? testProvider : undefined,
        }),
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
            <span>💬</span> Automated Bill Messaging (WhatsApp &amp; SMS)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automate WhatsApp &amp; SMS dispatch for every bill with zero manual work. Free tier providers available.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            loadHealth();
          }}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
        >
          Refresh Status
        </button>
      </div>

      {/* Gateway Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* WhatsApp Gateway Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              WhatsApp Auto Gateway
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                healthData?.metaWa?.healthy || healthData?.whatsApp?.healthy
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {healthData?.activeWaProvider === "CLOUD_API"
                ? (healthData?.metaWa?.healthy ? "META CLOUD READY" : "SETUP NEEDED")
                : (healthData?.whatsApp?.healthy ? "OPEN-WA READY" : "STANDBY")}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            {healthData?.activeWaProvider === "CLOUD_API"
              ? "Meta WhatsApp Cloud API (1,000 free messages/mo). 100% automated."
              : "Open-WA / Local Web Gateway. Dedicated business session."}
          </p>

          <div className="text-[11px] text-slate-500 font-mono">
            {healthData?.metaWa?.details || healthData?.whatsApp?.details?.status || "Ready for automated background dispatch."}
          </div>
        </div>

        {/* Fast2SMS Indian Free-Tier Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Fast2SMS (Indian Free Tier)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                healthData?.fast2sms?.healthy
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {healthData?.fast2sms?.healthy ? "CONNECTED" : "KEY NEEDED"}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Popular Indian SMS service. Free credits on signup, instant API for Indian 10-digit numbers.
          </p>

          <div className="text-[11px] text-slate-500 font-mono">
            {healthData?.fast2sms?.details || "Requires Fast2SMS API Key from fast2sms.com."}
          </div>
        </div>

        {/* Twilio SMS Card */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Twilio SMS ($15 Free Trial)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                healthData?.twilio?.healthy
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {healthData?.twilio?.healthy ? "CONNECTED" : "NOT SET"}
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Global SMS platform. $15.50 free trial credits upon registration.
          </p>

          <div className="text-[11px] text-slate-500 font-mono">
            {healthData?.twilio?.details || "Twilio Account SID & Auth Token required."}
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

      {/* Provider Configuration Form */}
      <form onSubmit={handleSaveConfig} className="border-t border-slate-200 pt-5 space-y-4">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <span>⚙️</span> Configure Automated Providers
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Mode Selector */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Automatic WhatsApp Provider
            </label>
            <select
              value={whatsappProvider}
              onChange={(e) => setWhatsappProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="CLOUD_API">Meta WhatsApp Cloud API (Recommended: 1000 free/mo, No phone needed)</option>
              <option value="OPEN_WA">Open-WA / Local Web Gateway (Dedicated Browser Session)</option>
            </select>

            {whatsappProvider === "CLOUD_API" ? (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Meta Phone Number ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1092837465..."
                    value={metaWaPhoneId}
                    onChange={(e) => setMetaWaPhoneId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Meta Permanent Access Token
                  </label>
                  <input
                    type="password"
                    placeholder="EAAG..."
                    value={metaWaToken}
                    onChange={(e) => setMetaWaToken(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Tip: Get free from developers.facebook.com WhatsApp dashboard. 1,000 conversations free every month.
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Open-WA Gateway URL
                  </label>
                  <input
                    type="text"
                    placeholder="http://127.0.0.1:8080"
                    value={openWaUrl}
                    onChange={(e) => setOpenWaUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SMS Mode Selector */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Automatic SMS Provider (Free Tier Available)
            </label>
            <select
              value={smsProvider}
              onChange={(e) => setSmsProvider(e.target.value)}
              className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="FAST2SMS">Fast2SMS (Recommended for India: Free signup trial)</option>
              <option value="TWILIO">Twilio ($15.50 Free Trial Credits)</option>
              <option value="ANDROID_SMS">In-House Android SIM Phone Gateway</option>
            </select>

            {smsProvider === "FAST2SMS" && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">
                    Fast2SMS Authorization API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Enter Fast2SMS API Key from fast2sms.com"
                    value={fast2smsApiKey}
                    onChange={(e) => setFast2smsApiKey(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Sign up free at <strong>fast2sms.com</strong>, copy your API key from the Dev API section. Works instantly with 10-digit Indian numbers.
                </p>
              </div>
            )}

            {smsProvider === "TWILIO" && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Account SID</label>
                  <input
                    type="text"
                    placeholder="AC..."
                    value={twilioSid}
                    onChange={(e) => setTwilioSid(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">Auth Token</label>
                  <input
                    type="password"
                    placeholder="Auth Token"
                    value={twilioToken}
                    onChange={(e) => setTwilioToken(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600">From Phone</label>
                  <input
                    type="text"
                    placeholder="+1234567890"
                    value={twilioFrom}
                    onChange={(e) => setTwilioFrom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              </div>
            )}

            {smsProvider === "ANDROID_SMS" && (
              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                Dedicated Android SIM gateway polls <code className="bg-slate-100 px-1 rounded">/api/messaging/sms/pull</code>.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saveStatus && (
            <p className={`text-xs font-bold ${saveStatus.success ? "text-emerald-600" : "text-rose-600"}`}>
              {saveStatus.success ? "✓ Configuration saved successfully!" : `✕ ${saveStatus.error}`}
            </p>
          )}
          <button
            type="submit"
            disabled={savingConfig}
            className="ml-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
          >
            {savingConfig ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </form>

      {/* Test Message Form */}
      <form onSubmit={handleSendTest} className="border-t border-slate-200 pt-5 space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
          Send Live Test Message
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
              +91
            </span>
            <input
              type="tel"
              maxLength={10}
              placeholder="10-digit mobile (e.g. 9234937707)"
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
            <option value="SMS">SMS</option>
          </select>

          <select
            value={testProvider}
            onChange={(e) => setTestProvider(e.target.value)}
            className="px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800"
          >
            <option value="DEFAULT">Default Active Provider</option>
            <option value="FAST2SMS">Fast2SMS</option>
            <option value="TWILIO">Twilio</option>
            <option value="CLOUD_API">Meta WhatsApp Cloud</option>
            <option value="OPEN_WA">Open-WA Gateway</option>
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
              ? "✓ Test message dispatched successfully!"
              : `✕ Error: ${testResult.error}`}
          </p>
        )}
      </form>
    </div>
  );
}
