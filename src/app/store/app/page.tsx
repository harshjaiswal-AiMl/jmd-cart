import React from "react";
import Link from "next/link";

export default function AppDownloadPage() {
  return (
    <div className="min-h-screen bg-[#FFF9F1] text-gray-800 flex flex-col justify-between p-6 md:p-12">
      <div className="max-w-xl mx-auto w-full bg-white rounded-3xl shadow-sm border border-amber-100 p-8 text-center">
        <div className="w-20 h-20 bg-[#7A2433] rounded-2xl mx-auto flex items-center justify-center text-white text-4xl font-bold font-serif mb-6 shadow-md">
          J
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-[#7A2433] mb-2 font-serif">
          JMD Cart Mobile App
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Online Kirana & Wholesale at Lowest Rates in Saharsa & Patna
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 text-left">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-2">
            <span>✨</span> App Highlights:
          </div>
          <ul className="text-xs text-amber-800 space-y-2 ml-4 list-disc">
            <li><strong>Wholesale Tier B & A Savings:</strong> Buy in cartons/sacks directly at godown wholesale prices.</li>
            <li><strong>30-Minute Doorstep Delivery:</strong> Live order tracking with driver contact.</li>
            <li><strong>Bilingual Toggle:</strong> Use comfortably in English or हिन्दी.</li>
            <li><strong>Khata / Store Credit:</strong> Built-in credit ledger for approved kirana retailers.</li>
            <li><strong>Lightweight:</strong> Only 5.1 MB download size, fast start on all Android phones.</li>
          </ul>
        </div>

        <a
          href="/downloads/JMD-Cart-Customer.apk"
          download="JMD-Cart-Customer.apk"
          className="block w-full py-4 bg-[#F28C28] hover:bg-[#E0720A] text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all text-base mb-4 cursor-pointer"
        >
          ⬇️ Download Official Android APK (5.1 MB)
        </a>

        <div className="text-xs text-gray-500 mb-6">
          Version 1.0.0 • Supports Android 8.0 to Android 15 • Package: <code className="bg-gray-100 px-1 py-0.5 rounded">com.jmdcart.shop</code>
        </div>

        <div className="border-t border-gray-100 pt-6 text-left">
          <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
            Quick Installation Guide:
          </h2>
          <ol className="text-xs text-gray-600 space-y-2 ml-4 list-decimal">
            <li>Tap the <strong>Download Official Android APK</strong> button above.</li>
            <li>When prompted, tap <strong>Download anyway</strong> or <strong>Keep file</strong>.</li>
            <li>Open the downloaded APK and tap <strong>Install</strong> (Allow installation from this source if requested).</li>
            <li>Open JMD Cart, log in with your phone number via OTP, and enjoy lowest grocery rates!</li>
          </ol>
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mt-8">
        © {new Date().getFullYear()} JMD Cart • <Link href="/delete-account" className="underline hover:text-gray-600">Account Deletion</Link>
      </div>
    </div>
  );
}
