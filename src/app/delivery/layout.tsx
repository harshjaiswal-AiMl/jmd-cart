import React from "react";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { LogOut, Navigation } from "lucide-react";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "JMD Cart • Delivery App",
  description: "Order Delivery Execution & Payment Collection PWA",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Delivery App",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Only DELIVERY and SUPER_ADMIN can enter the Delivery workspace
  if (
    session.user.role !== UserRole.DELIVERY &&
    session.user.role !== UserRole.SUPER_ADMIN
  ) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Branding */}
          <Link
            href="/delivery"
            className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
              <Navigation className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wide text-white flex items-center gap-1.5">
                JMD CART
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Delivery
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <span>{session.user.name || "Delivery Staff"}</span>
                <span className="text-slate-600">•</span>
                <span className="text-blue-400 font-medium">Saharsa Hub</span>
              </div>
            </div>
          </Link>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                aria-label="Logout"
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-16">{children}</main>
    </div>
  );
}
