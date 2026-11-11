"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useVanLanguage } from "@/lib/i18n/van-language-context";
import { tHi } from "@/lib/i18n/messages/hi";

interface VanLanguageToggleProps {
  className?: string;
  variant?: "pill" | "compact" | "segmented";
}

export function VanLanguageToggle({
  className = "",
  variant = "segmented",
}: VanLanguageToggleProps) {
  const { language, setLanguage, toggleLanguage } = useVanLanguage();

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all active:scale-95 shadow-2xs ${
          language === "hi"
            ? "bg-amber-500 text-slate-950 border-amber-400 font-black"
            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
        } ${className}`}
        title={language === "hi" ? "Switch to English" : "हिंदी में बदलें"}
      >
        <Globe className="w-3.5 h-3.5 opacity-80" />
        <span>{language === "hi" ? "हिंदी" : "English"}</span>
      </button>
    );
  }

  void setLanguage;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500 text-slate-950 border border-amber-400 text-sm font-black shadow-2xs select-none ${className}`}
      aria-label={tHi("langName")}
    >
      <Globe className="w-4 h-4 opacity-80" />
      <span>{tHi("langName")}</span>
    </span>
  );
}
