"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { VanLanguage, VAN_TRANSLATIONS, VanTranslationStrings } from "./van-translations";

const STORAGE_KEY = "jmd_van_lang";
const LANG_CHANGE_EVENT = "jmd_van_lang_change";

interface VanLanguageContextValue {
  language: VanLanguage;
  setLanguage: (lang: VanLanguage) => void;
  toggleLanguage: () => void;
  t: (key: keyof VanTranslationStrings, params?: Record<string, string | number>) => string;
}

const VanLanguageContext = createContext<VanLanguageContextValue | null>(null);

export function VanLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<VanLanguage>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "hi" || stored === "en") {
        setLanguageState(stored);
      }
    } catch {
      // localStorage may fail in private mode
    }

    const handleExternalChange = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "hi" || stored === "en") {
          setLanguageState(stored);
        }
      } catch {}
    };

    window.addEventListener(LANG_CHANGE_EVENT, handleExternalChange);
    window.addEventListener("storage", handleExternalChange);

    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, handleExternalChange);
      window.removeEventListener("storage", handleExternalChange);
    };
  }, []);

  const setLanguage = useCallback((lang: VanLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      window.dispatchEvent(new Event(LANG_CHANGE_EVENT));
    } catch {}
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "en" ? "hi" : "en");
  }, [language, setLanguage]);

  const t = useCallback(
    (key: keyof VanTranslationStrings, params?: Record<string, string | number>): string => {
      const strings = VAN_TRANSLATIONS[language] || VAN_TRANSLATIONS.en;
      let text = strings[key] || VAN_TRANSLATIONS.en[key] || String(key);
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        });
      }
      return text;
    },
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t]
  );

  return (
    <VanLanguageContext.Provider value={value}>
      {children}
    </VanLanguageContext.Provider>
  );
}

export function useVanLanguage() {
  const context = useContext(VanLanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    return {
      language: "en" as VanLanguage,
      setLanguage: () => {},
      toggleLanguage: () => {},
      t: (key: keyof VanTranslationStrings, params?: Record<string, string | number>) => {
        let text = VAN_TRANSLATIONS.en[key] || String(key);
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
          });
        }
        return text;
      },
    };
  }
  return context;
}
