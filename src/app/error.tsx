"use client";

import { useEffect, useId } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const refId = useId().replace(/:/g, "").slice(0, 8) || "err-" + Date.now().toString(36);

  useEffect(() => {
    // Log the error digest and stack server-side / console
    console.error(`[RootError Ref: ${refId}]`, {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error, refId]);

  return (
    <div className="min-h-screen bg-[#FEFDF7] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-600">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            Something went wrong
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            An unexpected error occurred while processing this request. Our technical team has been notified.
          </p>
          {error.digest && (
            <div className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
              Ref ID: <span className="font-bold text-slate-700">{error.digest.slice(0, 12)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#12355B] hover:bg-blue-900 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/admin"
            className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
