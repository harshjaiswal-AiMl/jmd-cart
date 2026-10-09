"use client";

import React, { useState, useEffect } from "react";
import {
  bluetoothPrinter,
  BluetoothPrinterInfo,
} from "@/lib/bluetooth-printer";
import { BluetoothPrinterModal } from "./bluetooth-printer-modal";
import { Printer } from "lucide-react";

export function BluetoothHeaderButton() {
  const [printerInfo, setPrinterInfo] = useState<BluetoothPrinterInfo>({
    status: "disconnected",
    paperWidth: 58,
  });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe(setPrinterInfo);
    return unsubscribe;
  }, []);

  const isConnected = printerInfo.status === "connected";

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
          isConnected
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
        }`}
        title={
          isConnected
            ? `Printer connected: ${printerInfo.deviceName || "Thermal Printer"}`
            : "Bluetooth Printer Disconnected - Click to pair"
        }
      >
        <Printer className="w-3.5 h-3.5" />
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse" : "bg-slate-600"
          }`}
        />
        <span className="hidden sm:inline text-[11px]">
          {isConnected ? printerInfo.deviceName?.split(" ")[0] || "Printer" : "Printer"}
        </span>
      </button>

      <BluetoothPrinterModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
