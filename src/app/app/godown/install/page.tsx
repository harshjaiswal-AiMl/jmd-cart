import { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Install JMD Godown Native App • JMD Cart",
  description: "Download the native warehouse app for always-on order alerts",
};

export default async function GodownInstallPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-200 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto text-2xl font-black shadow-md">
            📦
          </div>
          <h1 className="text-xl font-black text-slate-900">JMD Godown Native App</h1>
          <p className="text-xs text-slate-500">
            Official Android Application with Always-On High-Priority Order Alarms.
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <span>✓</span> Always-On Telephone Ring
          </div>
          <p className="text-[11px] text-emerald-800">
            Rings continuously on the alarm stream even when the phone is locked, silenced, or the app is closed.
          </p>
        </div>

        {/* Download Button */}
        <a
          href="/downloads/JMD-Godown-Alert.apk"
          download
          className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition"
        >
          <span>⬇️</span>
          <span>Download Android APK (v1.0.0)</span>
        </a>

        {/* Installation Instructions */}
        <div className="space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
            Installation Steps:
          </h3>
          <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
            <li>Tap Download above to save the APK file.</li>
            <li>Open the downloaded file. If prompted, tap <strong>Settings</strong> and enable <em>&quot;Allow from this source&quot;</em>.</li>
            <li>Tap <strong>Install</strong>, then open the app and log in with your staff credentials.</li>
            <li>Grant <strong>Notification</strong> and <strong>Ignore Battery Optimization</strong> permissions when asked.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
