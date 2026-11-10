"use client";

import React from "react";
import Link from "next/link";
import {
  Truck,
  FileText,
  ShoppingCart,
  Boxes,
  CheckCircle2,
  AlertCircle,
  Globe,
} from "lucide-react";
import { VanStockView } from "./van-stock-view";
import { VanHandedOverDeliveries } from "@/components/van/van-handed-over-deliveries";
import { VanLanguageToggle } from "@/components/van/van-language-toggle";
import { useVanLanguage } from "@/lib/i18n/van-language-context";
import { OrderSummary } from "@/modules/order/order.types";

interface VanDashboardClientProps {
  van: { id: string; name: string } | null;
  stockSummary: {
    activeVanDay?: {
      id: string;
      issueSheetNo: string;
      date: Date | string;
    } | null;
    totalPieces: number;
    inventory: any[];
  } | null;
  assignedOrders: OrderSummary[];
  pendingDeliveries: OrderSummary[];
  todaySalesPaise: number;
  cashInHandPaise: number;
  pendingCashPaise: number;
  userName: string;
  formattedLoadDate?: string;
}

export function VanDashboardClient({
  van,
  stockSummary,
  assignedOrders,
  pendingDeliveries,
  todaySalesPaise,
  cashInHandPaise,
  pendingCashPaise,
  userName,
  formattedLoadDate,
}: VanDashboardClientProps) {
  const { t, language } = useVanLanguage();

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Top Banner & Vehicle Header + Language Selector */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
            <span>{t("routeSales")}</span>
            <span>/</span>
            <span>{t("handheldPortal")}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {van ? van.name : t("unassignedVan")}
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {t("saharsaDivision")}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-slate-600">
            {t("loggedInAs")} <strong className="text-slate-900">{userName}</strong> • {t("subHeader")}
          </p>
        </div>

        {/* Header Right Actions: Language Switcher + Load Sheet & Billing buttons */}
        <div className="flex items-center flex-wrap gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          {/* Prominent Language Switcher Button */}
          <VanLanguageToggle />

          {stockSummary?.activeVanDay && (
            <div className="flex items-center gap-2">
              <Link
                href={`/godown/van-issues/${stockSummary.activeVanDay.id}/print`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>{t("loadSheet")}</span>
              </Link>
              <Link
                href="/van/billing"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{t("startBilling")}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 3 HUGE PRIMARY BUTTONS FOR VAN OPERATIONS (Prompt #14) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* 1. NEW SALE */}
        <Link
          href="/van/billing"
          className="flex flex-col items-center justify-center p-5 sm:p-6 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-emerald-500"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <span className="text-lg sm:text-2xl font-black tracking-tight">{t("newSaleTitle")}</span>
          <span className="text-xs text-emerald-100 font-bold mt-1">{t("newSaleSubtitle")}</span>
        </Link>

        {/* 2. MY STOCK */}
        <a
          href="#van-stock-matrix"
          className="flex flex-col items-center justify-center p-5 sm:p-6 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-slate-700"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <Boxes className="w-6 h-6 sm:w-7 sm:h-7 text-blue-400" />
          </div>
          <span className="text-lg sm:text-2xl font-black tracking-tight">{t("myStockTitle")}</span>
          <span className="text-xs text-slate-300 font-bold mt-1">
            {t("myStockSubtitle", {
              pieces: stockSummary?.totalPieces || 0,
              products: stockSummary?.inventory.length || 0,
            })}
          </span>
        </a>

        {/* 3. END OF DAY */}
        <Link
          href="/van/reconciliation"
          className="flex flex-col items-center justify-center p-5 sm:p-6 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-3xl shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 text-center group border-2 border-amber-400"
        >
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-black/10 flex items-center justify-center mb-2.5 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-slate-950" />
          </div>
          <span className="text-lg sm:text-2xl font-black tracking-tight">{t("endOfDayTitle")}</span>
          <span className="text-xs text-amber-950 font-bold mt-1">{t("endOfDaySubtitle")}</span>
        </Link>
      </div>

      {/* Handed-Over Customer Deliveries Section */}
      <VanHandedOverDeliveries
        orders={assignedOrders}
        salespersonName={userName}
      />

      {!van ? (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-900 space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
          <h3 className="font-bold text-base text-slate-900">{t("noVanAssigned")}</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            {t("noVanAssignedMsg")}
          </p>
        </div>
      ) : (
        <>
          {/* Active Morning Load Sheet Card */}
          {stockSummary?.activeVanDay ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-slate-900 text-sm">
                    {t("activeMorningLoad")}: {stockSummary.activeVanDay.issueSheetNo}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {t("dispatched")}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  {formattedLoadDate
                    ? `${t("dispatchedMsg")} (${formattedLoadDate})`
                    : t("dispatchedMsg")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/van/billing"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs"
                >
                  <span>{t("createBill")}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <span>{t("awaitingMorningDispatch")}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {t("awaitingDispatchMsg")}
                </p>
              </div>
              <Link
                href="/godown/van-issues"
                className="hidden sm:inline-flex text-xs font-semibold text-blue-600 hover:underline"
              >
                {t("godownDispatchLink")}
              </Link>
            </div>
          )}

          {/* Key Today Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                {t("todaySales")}
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{(todaySalesPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs bg-emerald-50/20">
              <p className="text-[11px] text-emerald-800 uppercase font-bold tracking-wider">
                {t("cashInHand")}
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-1 font-mono">
                ₹{(cashInHandPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                {t("availableStock")}
              </p>
              <p className="text-xl sm:text-2xl font-black text-blue-600 mt-1">
                {stockSummary?.totalPieces || 0} {t("pcs")}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs bg-amber-50/30">
              <p className="text-[11px] text-amber-700 uppercase font-bold tracking-wider flex items-center justify-between">
                <span>{t("deliveries")}</span>
                <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.2 rounded font-bold">
                  {pendingDeliveries.length} {t("pending")}
                </span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 font-mono">
                ₹{(pendingCashPaise / 100).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </div>

          {/* Interactive Searchable Stock Matrix */}
          <div id="van-stock-matrix">
            <VanStockView
              inventory={stockSummary?.inventory || []}
              vanName={van.name}
              hasActiveLoad={!!stockSummary?.activeVanDay}
            />
          </div>
        </>
      )}
    </div>
  );
}
