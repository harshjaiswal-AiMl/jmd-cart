"use client";

import React, { useState, useEffect } from "react";
import {
  bluetoothPrinter,
  isBluetoothSupported,
  BluetoothPrinterInfo,
} from "@/lib/bluetooth-printer";
import { formatCollectionReceiptForEscPos } from "@/lib/escpos-invoice";
import { getCollectionForPrintAction } from "@/app/van/collections/actions";
import { BluetoothPrinterModal } from "./bluetooth-printer-modal";
import { Printer, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface BluetoothCollectionPrintButtonProps {
  receiptId: string;
  receiptNo?: string;
  className?: string;
  variant?: "primary" | "secondary" | "compact";
}

export function BluetoothCollectionPrintButton({
  receiptId,
  receiptNo,
  className = "",
  variant = "primary",
}: BluetoothCollectionPrintButtonProps) {
  const [printerInfo, setPrinterInfo] = useState<BluetoothPrinterInfo>({
    status: "disconnected",
    paperWidth: 58,
  });
  const [isPrinting, setIsPrinting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = bluetoothPrinter.subscribe(setPrinterInfo);
    return unsubscribe;
  }, []);

  const handlePrint = async () => {
    setFeedback(null);

    if (!isBluetoothSupported()) {
      setFeedback({
        type: "error",
        message: "Web Bluetooth is not supported on this browser.",
      });
      return;
    }

    if (printerInfo.status !== "connected") {
      setModalOpen(true);
      return;
    }

    setIsPrinting(true);
    try {
      const res = await getCollectionForPrintAction(receiptId);
      if (!res.success || !res.receipt || !res.business) {
        throw new Error(res.error || "Could not load collection receipt data.");
      }

      const receiptData = {
        ...res.receipt,
        createdAt: new Date(res.receipt.createdAt),
      };

      const bytes = formatCollectionReceiptForEscPos(receiptData, res.business, {
        paperWidth: printerInfo.paperWidth,
      });

      const printRes = await bluetoothPrinter.printData(bytes);
      if (!printRes.success) {
        throw new Error(printRes.error || "Failed to transmit data to printer.");
      }

      setFeedback({
        type: "success",
        message: `Printed receipt #${receiptNo || res.receipt.receiptNo} on ${
          printerInfo.deviceName || "Printer"
        }!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Print failed";
      setFeedback({ type: "error", message: msg });
    } finally {
      setIsPrinting(false);
    }
  };

  const isConnected = printerInfo.status === "connected";

  if (variant === "compact") {
    return (
      <>
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
            isConnected
              ? "bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20"
              : "bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20"
          } ${className}`}
          title="Print Receipt via Bluetooth"
        >
          {isPrinting ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Printer className="w-3.5 h-3.5" />
          )}
          <span>Print Slip</span>
        </button>

        <BluetoothPrinterModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePrint}
        disabled={isPrinting}
        className={`w-full py-3 px-4 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md ${
          variant === "primary"
            ? isConnected
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
              : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
            : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
        } ${className}`}
      >
        {isPrinting ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Printing Receipt Slip...</span>
          </>
        ) : (
          <>
            <Printer className="w-4 h-4" />
            <span>
              {isConnected
                ? `Print Receipt Slip (${printerInfo.deviceName || "Bluetooth"})`
                : "Print Receipt via Bluetooth"}
            </span>
          </>
        )}
      </button>

      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-[11px] flex items-center justify-between gap-2 animate-in fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-[10px]"
          >
            ✕
          </button>
        </div>
      )}

      <BluetoothPrinterModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
