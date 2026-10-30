"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";

export type FontScale = "SMALL" | "DEFAULT" | "LARGE" | "XLARGE";

export const FONT_SCALE_CONFIG: Record<FontScale, { label: string; percent: string; factor: number }> = {
  SMALL: { label: "Small (87.5%)", percent: "87.5%", factor: 0.875 },
  DEFAULT: { label: "Default (100%)", percent: "100%", factor: 1.0 },
  LARGE: { label: "Large (112.5%)", percent: "112.5%", factor: 1.125 },
  XLARGE: { label: "Extra Large (125%)", percent: "125%", factor: 1.25 },
};

const SCALE_ORDER: FontScale[] = ["SMALL", "DEFAULT", "LARGE", "XLARGE"];

interface FontSizeContextType {
  scale: FontScale;
  setScale: (scale: FontScale) => void;
  increase: () => void;
  decrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
  thermalBasePx: number;
  setThermalBasePx: (px: number) => void;
  a5BasePt: number;
  setA5BasePt: (pt: number) => void;
}

const FontSizeContext = createContext<FontSizeContextType>({
  scale: "DEFAULT",
  setScale: () => {},
  increase: () => {},
  decrease: () => {},
  canIncrease: true,
  canDecrease: true,
  thermalBasePx: 12,
  setThermalBasePx: () => {},
  a5BasePt: 10,
  setA5BasePt: () => {},
});

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [scale, setScaleState] = useState<FontScale>("DEFAULT");
  const [thermalBasePx, setThermalBasePx] = useState<number>(12);
  const [a5BasePt, setA5BasePt] = useState<number>(10);
  const [, startTransition] = useTransition();

  useEffect(() => {
    // Read from localStorage or cookie
    const saved = localStorage.getItem("app_font_scale") as FontScale;
    if (saved && FONT_SCALE_CONFIG[saved]) {
      setScaleState(saved);
      document.documentElement.style.fontSize = FONT_SCALE_CONFIG[saved].percent;
    }
    const savedThermal = localStorage.getItem("app_thermal_font_px");
    if (savedThermal) setThermalBasePx(parseInt(savedThermal, 10) || 12);
    const savedA5 = localStorage.getItem("app_a5_font_pt");
    if (savedA5) setA5BasePt(parseInt(savedA5, 10) || 10);
  }, []);

  const applyScale = (newScale: FontScale) => {
    startTransition(() => {
      setScaleState(newScale);
      try {
        localStorage.setItem("app_font_scale", newScale);
        document.cookie = `app_font_scale=${newScale}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.style.fontSize = FONT_SCALE_CONFIG[newScale].percent;
      } catch {
        // storage disabled
      }
    });
  };

  const currentIndex = SCALE_ORDER.indexOf(scale);
  const canIncrease = currentIndex < SCALE_ORDER.length - 1;
  const canDecrease = currentIndex > 0;

  const increase = () => {
    if (canIncrease) {
      applyScale(SCALE_ORDER[currentIndex + 1]);
    }
  };

  const decrease = () => {
    if (canDecrease) {
      applyScale(SCALE_ORDER[currentIndex - 1]);
    }
  };

  const handleSetThermalPx = (px: number) => {
    const clamped = Math.min(16, Math.max(10, px));
    setThermalBasePx(clamped);
    try {
      localStorage.setItem("app_thermal_font_px", String(clamped));
    } catch {}
  };

  const handleSetA5Pt = (pt: number) => {
    const clamped = Math.min(14, Math.max(8, pt));
    setA5BasePt(clamped);
    try {
      localStorage.setItem("app_a5_font_pt", String(clamped));
    } catch {}
  };

  return (
    <FontSizeContext.Provider
      value={{
        scale,
        setScale: applyScale,
        increase,
        decrease,
        canIncrease,
        canDecrease,
        thermalBasePx,
        setThermalBasePx: handleSetThermalPx,
        a5BasePt,
        setA5BasePt: handleSetA5Pt,
      }}
    >
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  return useContext(FontSizeContext);
}

/**
 * Quick A- / A+ Font Size Toggle Pill for Headers
 */
export function FontSizeToggle({ className = "" }: { className?: string }) {
  const { scale, increase, decrease, canIncrease, canDecrease } = useFontSize();

  return (
    <div
      className={`inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-300 rounded-lg p-0.5 shadow-xs transition ${className}`}
      title={`Current UI Font Size: ${FONT_SCALE_CONFIG[scale].label}`}
    >
      <button
        type="button"
        onClick={decrease}
        disabled={!canDecrease}
        className="px-1.5 py-0.5 text-xs font-bold text-slate-700 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition"
        aria-label="Decrease Font Size"
      >
        A−
      </button>
      <span className="text-[10px] font-black text-slate-800 px-1 min-w-[28px] text-center font-mono">
        {scale === "DEFAULT" ? "100%" : scale === "SMALL" ? "88%" : scale === "LARGE" ? "113%" : "125%"}
      </span>
      <button
        type="button"
        onClick={increase}
        disabled={!canIncrease}
        className="px-1.5 py-0.5 text-xs font-bold text-slate-700 hover:bg-white rounded disabled:opacity-30 disabled:hover:bg-transparent transition"
        aria-label="Increase Font Size"
      >
        A+
      </button>
    </div>
  );
}
