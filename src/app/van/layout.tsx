import React from "react";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { PwaInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { VanBottomNav } from "./van-nav";
import { Truck, LogOut } from "lucide-react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "JMD Cart • Van Sales PWA",
  description: "On-Van Billing, Distribution & Inventory System",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Van Sales",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function VanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only SALESPERSON and SUPER_ADMIN can enter the Van workspace
  if (
    session.user.role !== UserRole.SALESPERSON &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Branding */}
          <Link
            href="/van"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-sm tracking-tight text-white">JMD CART</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 rounded uppercase">
                  VAN PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate max-w-[140px] sm:max-w-none">
                {session.user.name || "Salesperson"} ({session.user.role})
              </p>
            </div>
          </Link>

          {/* Center: Desktop Quick Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 text-xs">
            <Link
              href="/van"
              className="px-3 py-1.5 rounded-md font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Van Stock
            </Link>
            <Link
              href="/van/billing"
              className="px-3 py-1.5 rounded-md font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              + New Bill
            </Link>
            <Link
              href="/van/bills"
              className="px-3 py-1.5 rounded-md font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Today&apos;s Invoices
            </Link>
            <Link
              href="/van/reconciliation"
              className="px-3 py-1.5 rounded-md font-semibold text-slate-200 hover:text-white hover:bg-slate-700 transition-colors"
            >
              Reconciliation
            </Link>
          </nav>

          {/* Right: Connectivity & Install & Profile Actions */}
          <div className="flex items-center gap-2">
            <PwaInstallPrompt />

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                title="Sign out"
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-700"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Van Screen Workspace */}
      <main className="flex-1 pb-24 sm:pb-10">
        {children}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <VanBottomNav />
    </div>
  );
}
