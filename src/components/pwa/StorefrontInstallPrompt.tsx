"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Share, Smartphone, Sparkles, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function StorefrontInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStorefront, setIsStorefront] = useState(false);

  useEffect(() => {
    // Only show on storefront domain (jmdcart.com or localhost), not on management.jmdcart.com
    if (typeof window !== "undefined") {
      const host = window.location.host.toLowerCase();
      const isMgmt = host.startsWith("management") || window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/shop") || window.location.pathname.startsWith("/godown") || window.location.pathname.startsWith("/van");
      setIsStorefront(!isMgmt);

      // Check standalone mode
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);

      // Check if dismissed in this session
      const dismissed = sessionStorage.getItem("jmd_pwa_dismissed");
      if (dismissed === "1") {
        setIsDismissed(true);
      }

      // iOS detection
      const ua = window.navigator.userAgent.toLowerCase();
      const isIosDevice = /iphone|ipad|ipod/.test(ua) && !isStandaloneMode;
      setIsIOS(isIosDevice);

      // Register service worker if available
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
      }

      // Capture beforeinstallprompt
      const handleBeforeInstall = (e: Event) => {
        (window as any).__pwa_prompt = e;
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("jmd_pwa_dismissed", "1");
    } catch {}
  };

  // Do not render if not on storefront, already installed, or dismissed
  if (!isStorefront || isStandalone || isInstalled || isDismissed) {
    return null;
  }

  // Render on mobile / desktop when prompt is ready or on iOS
  return (
    <>
      {/* Floating Bottom App Install Banner */}
      <aside
        aria-label="Install JMD CART App"
        className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-300 p-4 animate-in fade-in slide-in-from-bottom-5 duration-300"
      >
        <div className="flex items-start gap-3.5">
          {/* Official JMD CART Logo */}
          <div className="w-13 h-13 rounded-2xl bg-amber-50 border border-amber-200 p-1 flex items-center justify-center shrink-0 shadow-xs">
            <img
              src="/brand/jmd-cart-logo.png"
              alt="JMD CART Logo"
              className="w-full h-full object-contain"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-headline font-black text-slate-900 text-sm tracking-tight">
                JMD CART
              </span>
              <span className="inline-flex items-center gap-0.5 bg-amber-500 text-slate-950 font-black text-[9px] uppercase px-1.5 py-0.2 rounded-full">
                <Sparkles className="w-2.5 h-2.5" /> Fast App
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 leading-snug">
              Install the official <strong className="text-slate-900 font-bold">JMD CART</strong> app for instant ordering &amp; wholesale discounts in Saharsa.
            </p>

            <div className="flex items-center gap-2 mt-2.5">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#b91c1c] hover:bg-[#991b1b] active:scale-95 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App (ऐप इंस्टॉल करें)</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Dismiss"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* iOS Step Guide Popup */}
        {showIosGuide && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 animate-in fade-in duration-150">
            <div className="font-bold text-slate-900 mb-1 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              <span>How to install on iPhone / iPad:</span>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
              <li>
                Tap the <Share className="w-3 h-3 inline text-blue-600 mx-0.5" /> <strong>Share</strong> button at bottom of Safari.
              </li>
              <li>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </li>
              <li>
                Tap <strong>Add</strong> in top right. JMD CART is now installed!
              </li>
            </ol>
          </div>
        )}
      </aside>
    </>
  );
}
