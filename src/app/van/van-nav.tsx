"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ShoppingCart, ReceiptText, ArrowLeftRight, Wallet } from "lucide-react";

export function VanBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Stock",
      href: "/van",
      icon: Package,
      exact: true,
    },
    {
      label: "New Bill",
      href: "/van/billing",
      icon: ShoppingCart,
      exact: false,
    },
    {
      label: "Collect",
      href: "/van/collections",
      icon: Wallet,
      exact: false,
    },
    {
      label: "Bills",
      href: "/van/bills",
      icon: ReceiptText,
      exact: false,
    },
    {
      label: "Day End",
      href: "/van/reconciliation",
      icon: ArrowLeftRight,
      exact: false,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 shadow-lg sm:hidden">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? "text-emerald-400 font-bold"
                  : "text-slate-400 hover:text-slate-200 font-medium"
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-transform ${
                  isActive ? "bg-emerald-500/10 scale-110" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
