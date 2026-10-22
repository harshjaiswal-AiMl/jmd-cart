import Link from "next/link";
import { StoreShell } from "@/components/store/StoreShell";

export default function NotFound() {
  return (
    <StoreShell>
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div className="bg-surface-container-lowest rounded-3xl border border-outline-variant/20 p-8 sm:p-12 shadow-sm space-y-6">
          <div className="w-24 h-24 rounded-full bg-primary-fixed/20 text-primary flex items-center justify-center mx-auto">
            <span className="text-4xl font-black font-serif">404</span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-on-surface">
              Page Not Found
            </h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
              The grocery item, category, or page you were looking for might have been moved or is currently unavailable.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-container transition-colors shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">home</span>
              Return to Home
            </Link>

            <Link
              href="/categories"
              className="px-6 py-3 rounded-xl bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container transition-colors"
            >
              Browse All Categories
            </Link>
          </div>
        </div>
      </main>
    </StoreShell>
  );
}
