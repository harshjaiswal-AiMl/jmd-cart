"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Percent,
  BookOpen,
  CalendarCheck,
  History,
  Settings,
} from "lucide-react";

const TABS = [
  { href: "/admin/incentives", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/incentives/rules", label: "Rules & Calculator", icon: Percent },
  { href: "/admin/incentives/ledger", label: "Audit Ledger", icon: BookOpen },
  { href: "/admin/incentives/statements", label: "Monthly Statements", icon: CalendarCheck },
  { href: "/admin/incentives/backfill", label: "Backfill Tool", icon: History },
  { href: "/admin/incentives/settings", label: "Settings", icon: Settings },
];

export function IncentivesNavTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="flex space-x-1 overflow-x-auto px-4 sm:px-6">
        {TABS.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? "border-amber-600 text-amber-900 font-semibold"
                  : "border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-amber-600" : "text-stone-400"}`} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
