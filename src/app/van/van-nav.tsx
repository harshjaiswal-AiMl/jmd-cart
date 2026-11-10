"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, ReceiptText, ArrowLeftRight, Wallet } from "lucide-react";
import { useVanLanguage } from "@/lib/i18n/van-language-context";

export function VanBottomNav() {
  const pathname = usePathname();
  const { t } = useVanLanguage();

  const navItems = [
    {
      labelKey: "navStock" as const,
      defaultLabel: "Stock",
      href: "/van",
      icon: Package,
      exact: true,
    },
    {
      labelKey: "navNewBill" as const,
      defaultLabel: "New Bill",
      href: "/van/billing",
      icon: ShoppingCart,
      exact: false,
    },
    {
      labelKey: "navCollect" as const,
      defaultLabel: "Collect",
      href: "/van/collections",
      icon: Wallet,
      exact: false,
    },
    {
      labelKey: "navBills" as const,
      defaultLabel: "Bills",
      href: "/van/bills",
      icon: ReceiptText,
      exact: false,
    },
    {
      labelKey: "navDayEnd" as const,
      defaultLabel: "Day End",
      href: "/van/reconciliation",
      icon: ArrowLeftRight,
      exact: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#12355B] border-t border-[#0D2641] shadow-lg sm:hidden">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          const label = t(item.labelKey);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-[#FC830D] font-bold"
                  : "text-white/70 hover:text-white font-medium"
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? "bg-white/10 scale-105" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight truncate max-w-[64px] text-center">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
