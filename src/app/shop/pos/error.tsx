"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";

export default function ShopPosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ShopPosError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#EEF4F8] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 text-center space-y-4">
        <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mx-auto text-amber-600">
          <AlertCircle className="w-7 h-7" />
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight">
            POS Counter Interrupted
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            An error occurred while communicating with the billing engine. Your held bills and active session are preserved.
          </p>
          {error.digest && (
            <div className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
              Reference Digest: <span className="font-bold text-slate-700">{error.digest}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#12355B] hover:bg-blue-900 text-white font-bold text-xs transition shadow-sm flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore Counter</span>
          </button>
          <Link
            href="/shop/invoices"
            className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Invoices</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
