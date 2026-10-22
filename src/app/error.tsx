"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 text-center space-y-6 shadow-sm">
        <div className="w-20 h-20 rounded-full bg-error-container/20 text-error flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-4xl">warning</span>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-serif text-on-surface">
            Something Went Wrong
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-2 leading-relaxed">
            Our technical team has been alerted. Please try refreshing or return to the storefront homepage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-xs hover:bg-primary-container transition-colors shadow-sm"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-surface-container-low text-on-surface font-bold text-xs hover:bg-surface-container transition-colors"
          >
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
