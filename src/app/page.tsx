import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-surface p-8 rounded-card shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-primary mb-2">IDMS - Saharsa</h1>
        <p className="text-content-muted text-sm mb-6">
          Integrated Distribution Management System
        </p>
        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full py-2.5 px-4 bg-primary text-white font-medium rounded-input hover:bg-slate-800 transition"
          >
            Staff Login
          </Link>
          <a
            href="/api/health"
            className="block text-xs text-accent hover:underline"
          >
            System Health Check
          </a>
        </div>
      </div>
    </main>
  );
}
