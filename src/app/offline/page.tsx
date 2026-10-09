import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl mb-4">
        📶
      </div>
      <h1 className="text-xl font-bold tracking-tight mb-2">You are currently offline</h1>
      <p className="text-sm text-slate-400 max-w-sm mb-6">
        No internet connection detected on your route. Any bills you create are saved locally as drafts and will sync as soon as network is restored.
      </p>

      <div className="space-y-3 w-full max-w-xs">
        <Link
          href="/van"
          className="block w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors"
        >
          Return to Van Workspace
        </Link>
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.location.reload();
          }}
          className="block w-full py-3 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors border border-slate-700"
        >
          Check Connection & Retry
        </button>
      </div>

      <div className="mt-8 text-xs text-slate-500">
        JMD Cart IDMS • Saharsa, Bihar
      </div>
    </div>
  );
}
