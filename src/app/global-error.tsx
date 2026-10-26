"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#FEFDF7] min-h-screen flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-red-600 text-2xl font-black">
            !
          </div>

          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Application Error
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              A critical layout error occurred. Please reload the page to restore system state.
            </p>
            {error.digest && (
              <div className="mt-2 text-[10px] font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 inline-block">
                Ref ID: <span className="font-bold text-slate-700">{error.digest.slice(0, 12)}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="w-full py-2.5 px-4 rounded-xl bg-[#12355B] hover:bg-blue-900 text-white font-bold text-xs transition shadow-sm"
            >
              Reload System
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
