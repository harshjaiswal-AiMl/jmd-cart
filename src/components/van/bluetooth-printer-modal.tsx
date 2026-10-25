"use client";

import React, { useState, useEffect } from "react";
import {
  bluetoothPrinter,
  isBluetoothSupported,
  BluetoothPrinterInfo,
} from "@/lib/bluetooth-printer";
import { formatTestPrintEscPos } from "@/lib/escpos-invoice";
import { getBusinessDetailsForPrintAction } from "@/app/van/billing/actions";
import { BusinessDetails } from "@/modules/settings/settings.types";
import {
  Printer,
  Bluetooth,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
  HelpCircle,
  RefreshCw,
} from "lucide-react";

interface BluetoothPrinterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BluetoothPrinterModal({ isOpen, onClose }: BluetoothPrinterModalProps) {
  const [printerInfo, setPrinterInfo] = useState<BluetoothPrinterInfo>({
    status: "disconnected",
    paperWidth: 58,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe((info) => {
      setPrinterInfo(info);
      if (info.status === "connected") {
        setIsConnecting(false);
      }
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;

  const supported = isBluetoothSupported();

  const handleConnect = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsConnecting(true);

    try {
      const res = await bluetoothPrinter.connect();
      if (!res.success) {
        setErrorMessage(res.error || "Failed to connect to printer.");
      } else {
        setSuccessMessage(`Connected to ${res.deviceName || "Bluetooth Printer"}!`);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    await bluetoothPrinter.disconnect();
    setSuccessMessage("Printer disconnected.");
  };

  const handleTestPrint = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsTestPrinting(true);

    try {
      const bizRes = await getBusinessDetailsForPrintAction();
      const business: BusinessDetails = bizRes.success && bizRes.business
        ? bizRes.business
        : {
            tradeName: "JMD CART",
            legalName: "",
            gstin: "",
            fssai: "",
            address: "",
            phone: "",
            email: "",
            upiId: "",
          };

      const testBytes = formatTestPrintEscPos(business, {
        paperWidth: printerInfo.paperWidth,
      });

      const printRes = await bluetoothPrinter.printData(testBytes);
      if (!printRes.success) {
        setErrorMessage(printRes.error || "Test print failed.");
      } else {
        setSuccessMessage("Test slip printed successfully!");
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Test print failed.");
    } finally {
      setIsTestPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Bluetooth Thermal Printer</h2>
              <p className="text-xs text-slate-400">Mobile Van ESC/POS Hardware</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* Web Bluetooth Support Warning */}
          {!supported && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold">Web Bluetooth Unavailable</p>
                <p className="mt-0.5 text-amber-400/90 leading-relaxed">
                  Your current browser does not support Web Bluetooth. Please use Google Chrome on
                  Android or Desktop. Browser print fallback remains available.
                </p>
              </div>
            </div>
          )}

          {/* Connection Status Card */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  printerInfo.status === "connected"
                    ? "bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse"
                    : printerInfo.status === "connecting"
                    ? "bg-amber-500 animate-ping"
                    : "bg-slate-600"
                }`}
              />
              <div>
                <p className="text-xs text-slate-400 font-medium">Status</p>
                <p className="text-sm font-bold text-white capitalize">
                  {printerInfo.status === "connected"
                    ? `Connected: ${printerInfo.deviceName || "Printer"}`
                    : printerInfo.status === "connecting"
                    ? "Searching / Connecting..."
                    : "Disconnected"}
                </p>
              </div>
            </div>

            {printerInfo.status === "connected" ? (
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition"
              >
                Disconnect
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting || !supported}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition flex items-center gap-1.5 shadow-md shadow-blue-600/30"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Bluetooth className="w-3.5 h-3.5" />
                    Pair Printer
                  </>
                )}
              </button>
            )}
          </div>

          {/* Paper Width Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">Thermal Roll Width</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => bluetoothPrinter.setPaperWidth(58)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-0.5 ${
                  printerInfo.paperWidth === 58
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xs font-black">58mm (2-inch)</span>
                <span className="text-[10px] text-slate-500">Handheld / Belt Van Printer (32 cols)</span>
              </button>
              <button
                type="button"
                onClick={() => bluetoothPrinter.setPaperWidth(80)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-0.5 ${
                  printerInfo.paperWidth === 80
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/40"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xs font-black">80mm (3-inch)</span>
                <span className="text-[10px] text-slate-500">Wide Desktop POS Roll (48 cols)</span>
              </button>
            </div>
          </div>

          {/* Test Print Action */}
          <div>
            <button
              onClick={handleTestPrint}
              disabled={printerInfo.status !== "connected" || isTestPrinting}
              className="w-full py-2.5 px-4 rounded-2xl text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition flex items-center justify-center gap-2 border border-slate-700"
            >
              {isTestPrinting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Printing Test Slip...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  Print Test Slip via Bluetooth
                </>
              )}
            </button>
            {printerInfo.status !== "connected" && (
              <p className="text-[10px] text-slate-500 text-center mt-1">
                Connect printer above to enable test printing
              </p>
            )}
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Setup & Pairing Guide Accordion */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/60">
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              className="w-full p-3.5 text-left flex items-center justify-between text-xs font-bold text-slate-300 hover:text-white"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" />
                <span>Handheld Printer Pairing Guide</span>
              </div>
              <span className="text-slate-500 text-[10px]">{showGuide ? "Hide" : "Show"}</span>
            </button>

            {showGuide && (
              <div className="p-3.5 pt-0 text-[11px] text-slate-400 space-y-2 border-t border-slate-800/60">
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Turn on printer power switch (LED blinks blue).</li>
                  <li>Ensure Bluetooth and Location are ON in Android settings.</li>
                  <li>Tap <strong>&ldquo;Pair Printer&rdquo;</strong> button above.</li>
                  <li>Select your printer model (e.g. <em>Everycom, RPP02N, PT-210, MPT-II</em>) in the pop-up.</li>
                  <li>If prompted for Bluetooth PIN, enter <strong>0000</strong> or <strong>1234</strong>.</li>
                </ol>
                <p className="text-[10px] text-slate-500 mt-2">
                  Tip: Web Bluetooth requires HTTPS or localhost. Works natively in Chrome on Android delivery phones.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
