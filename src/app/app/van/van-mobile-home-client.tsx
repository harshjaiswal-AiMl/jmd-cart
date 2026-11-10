"use client";

import React from "react";
import Link from "next/link";
import { Truck, Store, RotateCcw, Calculator, CheckCircle2, AlertTriangle } from "lucide-react";
import { useVanLanguage } from "@/lib/i18n/van-language-context";
import { VanLanguageToggle } from "@/components/van/van-language-toggle";

interface VanMobileHomeClientProps {
  van: { id: string; name: string } | null;
  activeVanDay: {
    id: string;
    issueSheetNo: string;
  } | null;
}

export function VanMobileHomeClient({
  van,
  activeVanDay,
}: VanMobileHomeClientProps) {
  const { t } = useVanLanguage();

  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <div className="bg-[#12355B] text-white p-5 rounded-3xl shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              {t("routeSales")}
            </div>
            <h2 className="text-2xl font-black mt-0.5">{van ? van.name : t("unassignedVan")}</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VanLanguageToggle />
            <Link
              href="/van/billing"
              className="px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
            >
              <Store className="w-4 h-4" />
              <span>{t("openCounter")}</span>
            </Link>
          </div>
        </div>

        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
          <span className="text-white/70">{t("morningLoadStatus")}</span>
          {activeVanDay ? (
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t("dispatchedSheet", { sheet: activeVanDay.issueSheetNo })}</span>
            </span>
          ) : (
            <span className="font-bold text-amber-300 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t("pendingMorningIssue")}</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Grid Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/van/billing"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] active:bg-slate-50 transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">{t("vanCounterTitle")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("vanCounterDesc")}</p>
          </div>
        </Link>

        <Link
          href="/van/bills"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] active:bg-slate-50 transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">{t("todaysBillsTitle")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("todaysBillsDesc")}</p>
          </div>
        </Link>

        <Link
          href="/van/collections"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] active:bg-slate-50 transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">{t("cashCollectionsTitle")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("cashCollectionsDesc")}</p>
          </div>
        </Link>

        <Link
          href="/van/reconciliation"
          className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#12355B] active:bg-slate-50 transition-all flex flex-col justify-between"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-slate-900">{t("dayEndCloseTitle")}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{t("dayEndCloseDesc")}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
