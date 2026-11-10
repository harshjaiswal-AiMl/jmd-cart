"use client";

import React from "react";
import { Globe } from "lucide-react";
import { useVanLanguage } from "@/lib/i18n/van-language-context";

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

  // Default: Segmented dual toggle with English and हिंदी side-by-side
  return (
    <div
      className={`inline-flex items-center rounded-xl bg-slate-100/90 dark:bg-slate-800 p-0.5 border border-slate-300/80 shadow-2xs select-none ${className}`}
      role="group"
      aria-label="Select Language"
    >
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
          language === "en"
            ? "bg-[#12355B] text-white shadow-xs font-black"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <span>English</span>
      </button>
      <button
        type="button"
        onClick={() => setLanguage("hi")}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
          language === "hi"
            ? "bg-amber-500 text-slate-950 shadow-xs font-black"
            : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <span>हिंदी</span>
      </button>
    </div>
  );
}
