"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wifi,
  WifiOff,
  Download,
  ExternalLink,
  ChevronDown,
  Store,
  Warehouse,
  Truck,
  Bike,
  Calculator,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

interface RoleAppShellProps {
  user: {
    id: string;
    name?: string | null;
    role: string;
    agentCode?: string | null;
  };
  children: React.ReactNode;
}

const APPS_FOR_SWITCHER = [
  { role: "shop", label: "JMD POS (Cashier)", icon: Store, path: "/app/shop" },
  { role: "godown", label: "JMD Godown (Warehouse)", icon: Warehouse, path: "/app/godown" },
  { role: "van", label: "JMD Van (Route Sales)", icon: Truck, path: "/app/van" },
  { role: "delivery", label: "JMD Delivery (Driver)", icon: Bike, path: "/app/delivery" },
  { role: "accounts", label: "JMD Accounts (Accountant)", icon: Calculator, path: "/app/accounts" },
  { role: "owner", label: "JMD Owner (Executive)", icon: ShieldCheck, path: "/app/owner" },
];

export function RoleAppShell({ user, children }: RoleAppShellProps) {
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState(true);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  // Derive current app from path
  const currentAppKey = pathname.split("/")[2] || "shop";
  const currentApp = APPS_FOR_SWITCHER.find((a) => a.role === currentAppKey) || APPS_FOR_SWITCHER[0];

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);

      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // Listen for PWA install prompt
      const handleBeforeInstall = (e: any) => {
        e.preventDefault();
        setInstallPrompt(e);
      };
      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      // Check if running in standalone mode
      if (window.matchMedia("(display-mode: standalone)").matches) {
        setIsInstalled(true);
      }

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      alert("To install this app on iOS Safari: Tap the Share button below, then 'Add to Home Screen'.");
      return;
    }
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-900 flex flex-col font-sans selection:bg-[#12355B]/15">
      {/* Dynamic Role Manifest Link injected into head */}
      <link rel="manifest" href={`/app/${currentAppKey}/manifest.webmanifest`} />
      <meta name="theme-color" content="#12355B" />

      {/* Top App Header & Server Sync Status Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
          {/* App Title & Role Switcher */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#12355B] text-white flex items-center justify-center font-black text-sm shadow-xs">
              <currentApp.icon className="w-4 h-4" />
            </div>

            <div className="relative">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setSwitcherOpen(!switcherOpen)}
                  className="flex items-center gap-1 font-black text-sm text-[#12355B] hover:text-[#0E2843] transition-colors"
                >
                  <span>{currentApp.label}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
              ) : (
                <div className="font-black text-sm text-[#12355B]">{currentApp.label}</div>
              )}
              <div className="text-[10px] text-slate-500 font-medium">
                {user.name || "Staff"} • {user.role}
              </div>

              {/* Admin App Switcher Dropdown */}
              {isAdmin && switcherOpen && (
                <div
                  className="absolute left-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setSwitcherOpen(false)}
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Switch Role App
                  </div>
                  {APPS_FOR_SWITCHER.map((app) => (
                    <Link
                      key={app.role}
                      href={app.path}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                        currentAppKey === app.role
                          ? "bg-[#12355B] text-white"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <app.icon className="w-3.5 h-3.5" />
                      <span>{app.label}</span>
                    </Link>
                  ))}
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <Link
                      href="/admin"
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                    >
                      <span>Open Full Panel</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sync Status Badge & Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                isOnline
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {isOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  <span className="hidden sm:inline">Connected •</span>
                  <span>Server Sync</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-600" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Install PWA Button */}
            {!isInstalled && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#12355B]/10 hover:bg-[#12355B]/20 text-[#12355B] transition-colors border border-[#12355B]/20"
                title="Install App"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Install</span>
              </button>
            )}

            {/* Open Full Desktop Panel Link for Admins */}
            {isAdmin && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition-colors"
              >
                <span>Full Panel</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main App Content View */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4 pb-24">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-lg safe-area-pb">
        <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around text-slate-600">
          {currentAppKey === "shop" && (
            <>
              <Link href="/shop/pos" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <Store className="w-5 h-5 mb-0.5" />
                <span>Bill</span>
              </Link>
              <Link href="/shop/invoices" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <RotateCcw className="w-5 h-5 mb-0.5" />
                <span>Invoices</span>
              </Link>
              <Link href="/godown/stock" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Warehouse className="w-5 h-5 mb-0.5" />
                <span>Stock</span>
              </Link>
              <Link href="/shop/my-incentives" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Calculator className="w-5 h-5 mb-0.5" />
                <span>Earnings</span>
              </Link>
            </>
          )}

          {currentAppKey === "godown" && (
            <>
              <Link href="/godown/dispatch" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <Warehouse className="w-5 h-5 mb-0.5" />
                <span>Pack Queue</span>
              </Link>
              <Link href="/godown/stock" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Store className="w-5 h-5 mb-0.5" />
                <span>Stock</span>
              </Link>
              <Link href="/godown/receive-goods" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Download className="w-5 h-5 mb-0.5" />
                <span>Receive</span>
              </Link>
              <Link href="/godown/van-issues" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Truck className="w-5 h-5 mb-0.5" />
                <span>Van Issue</span>
              </Link>
            </>
          )}

          {currentAppKey === "van" && (
            <>
              <Link href="/van/billing" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <Store className="w-5 h-5 mb-0.5" />
                <span>Counter</span>
              </Link>
              <Link href="/van/bills" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <RotateCcw className="w-5 h-5 mb-0.5" />
                <span>Bills</span>
              </Link>
              <Link href="/van/collections" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Calculator className="w-5 h-5 mb-0.5" />
                <span>Cash</span>
              </Link>
              <Link href="/van/reconciliation" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Truck className="w-5 h-5 mb-0.5" />
                <span>EOD Close</span>
              </Link>
            </>
          )}

          {currentAppKey === "delivery" && (
            <>
              <Link href="/delivery" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <Bike className="w-5 h-5 mb-0.5" />
                <span>Deliveries</span>
              </Link>
              <Link href="/delivery/zones" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Store className="w-5 h-5 mb-0.5" />
                <span>Zones</span>
              </Link>
              <Link href="/shop/my-incentives" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Calculator className="w-5 h-5 mb-0.5" />
                <span>Incentives</span>
              </Link>
            </>
          )}

          {currentAppKey === "accounts" && (
            <>
              <Link href="/app/accounts" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <Calculator className="w-5 h-5 mb-0.5" />
                <span>Pending</span>
              </Link>
              <Link href="/admin/crud/receipts" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Store className="w-5 h-5 mb-0.5" />
                <span>Receipts</span>
              </Link>
              <Link href="/admin/parties" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Warehouse className="w-5 h-5 mb-0.5" />
                <span>Ledgers</span>
              </Link>
              <Link href="/admin/reports" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <RotateCcw className="w-5 h-5 mb-0.5" />
                <span>Reports</span>
              </Link>
            </>
          )}

          {currentAppKey === "owner" && (
            <>
              <Link href="/app/owner" className="flex flex-col items-center py-1 px-2 text-[10px] font-bold text-[#12355B]">
                <ShieldCheck className="w-5 h-5 mb-0.5" />
                <span>Dashboard</span>
              </Link>
              <Link href="/godown/dispatch" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Warehouse className="w-5 h-5 mb-0.5" />
                <span>Queue</span>
              </Link>
              <Link href="/admin/incentives" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <Calculator className="w-5 h-5 mb-0.5" />
                <span>Incentives</span>
              </Link>
              <Link href="/admin" className="flex flex-col items-center py-1 px-2 text-[10px] font-medium hover:text-[#12355B]">
                <ExternalLink className="w-5 h-5 mb-0.5" />
                <span>Full Panel</span>
              </Link>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
