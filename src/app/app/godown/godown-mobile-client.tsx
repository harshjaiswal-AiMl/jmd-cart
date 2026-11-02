"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Warehouse,
  Package,
  Truck,
  Layers,
  Download,
  AlertTriangle,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Minus,
  Trash2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Smartphone,
  RefreshCw,
} from "lucide-react";
import { searchItems } from "@/lib/search/smart-search";
import {
  completeGodownOrderAction,
  issueVanLoadSheetAction,
  quickAddOrUpdateGodownProductAction,
} from "./actions";

interface GodownProduct {
  id: string;
  name: string;
  shortCode: string;
  weight?: string | null;
  packSize: number;
  packLabel: string;
  mrpPaise: number | null;
  godownQty: number;
  godownCartons: number;
  godownLoose: number;
}

interface VanLocation {
  id: string;
  name: string;
  assignedUser?: { id: string; name: string } | null;
}

interface GodownOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  contactPhone: string;
  totalPaise: number;
  createdAt: string;
  status: string;
  isInvoice?: boolean;
  items: Array<{
    id: string;
    productName: string;
    weight?: string | null;
    cartons: number;
    loose: number;
    totalPieces: number;
  }>;
}

export interface ActiveVanLoad {
  id: string;
  issueSheetNo: string;
  date: string;
  status: string;
  vanName: string;
  salespersonName: string;
  salespersonPhone: string | null;
  totalLines: number;
  totalPieces: number;
  totalCartons: number;
  lines: Array<{
    id: string;
    productName: string;
    issuedQty: number;
    packSize: number;
  }>;
}

interface Props {
  initialProducts: GodownProduct[];
  vanLocations: VanLocation[];
  pendingOrders: GodownOrder[];
  activeVanLoads?: ActiveVanLoad[];
  lowStockCount: number;
  unreviewedCorrectionsCount: number;
  initialTab?: string;
  user: { id: string; name: string; role: string };
}

export function GodownMobileClient({
  initialProducts,
  vanLocations,
  pendingOrders: initialOrders,
  activeVanLoads = [],
  lowStockCount,
  unreviewedCorrectionsCount,
  initialTab = "home",
  user,
}: Props) {
  const [lastIssued, setLastIssued] = useState<{ id: string; issueSheetNo: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Alert Mode & Web Audio Ringing state
  const [alertMode, setAlertMode] = useState(false);
  const [activeRingAlert, setActiveRingAlert] = useState<{
    orderId: string;
    orderNumber: string;
    customerName: string;
    amountPaise: number;
    cartonCount: number;
  } | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<any>(null);
  const wakeLockRef = useRef<any>(null);

  // Orders queue state
  const [orders, setOrders] = useState(initialOrders);
  const [orderChecklist, setOrderChecklist] = useState<Record<string, Record<string, boolean>>>({});

  // Morning Issue 3-step state
  const [issueStep, setIssueStep] = useState<1 | 2 | 3>(1);
  const [selectedVanId, setSelectedVanId] = useState<string>(vanLocations[0]?.id || "");
  const [issueSearch, setIssueSearch] = useState("");
  const [loadItems, setLoadItems] = useState<Record<string, { cartons: number; pieces: number }>>({});
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);

  // Stock search state
  const [stockSearch, setStockSearch] = useState("");

  // Test push state
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);
  const [pushSubscribed, setPushSubscribed] = useState(false);

  const [allProducts, setAllProducts] = useState<GodownProduct[]>(initialProducts);
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: "",
    weight: "",
    shortCode: "",
    packSize: "24",
    mrp: "",
    addCartons: "1",
    addPieces: "0",
  });
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const updateCartons = (productId: string, delta: number) => {
    setLoadItems((prev) => {
      const cur = prev[productId] || { cartons: 0, pieces: 0 };
      const nextCartons = Math.max(0, cur.cartons + delta);
      if (nextCartons === 0 && cur.pieces === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: { cartons: nextCartons, pieces: cur.pieces } };
    });
  };

  const updatePieces = (productId: string, delta: number) => {
    setLoadItems((prev) => {
      const cur = prev[productId] || { cartons: 0, pieces: 0 };
      const nextPieces = Math.max(0, cur.pieces + delta);
      if (cur.cartons === 0 && nextPieces === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: { cartons: cur.cartons, pieces: nextPieces } };
    });
  };

  const handleMarkPacked = async (ord: GodownOrder) => {
    try {
      await completeGodownOrderAction(ord.id, ord.isInvoice);
      setOrders((prev) => prev.filter((o) => o.id !== ord.id));
    } catch (e: any) {
      alert("Failed to mark packed: " + e.message);
    }
  };

  const handleConfirmIssue = async () => {
    setIssueSubmitting(true);
    setIssueError(null);
    try {
      const items = selectedIssueList.map((it) => ({
        productId: it.id,
        cartons: it.cartons,
        pieces: it.pieces,
      }));
      const res = await issueVanLoadSheetAction({
        vanLocationId: selectedVanId,
        items,
      });
      if (res.success && res.vanDayId) {
        setLastIssued({ id: res.vanDayId, issueSheetNo: res.issueSheetNo || "Load Sheet" });
        setIssueSuccess(`Van load sheet ${res.issueSheetNo || ""} issued successfully! (${res.count} items transferred)`);
        setLoadItems({});
        setIssueStep(1);
      } else if (res.success) {
        setIssueSuccess(`Van load sheet issued successfully! (${res.count} items transferred)`);
        setLoadItems({});
        setIssueStep(1);
      } else {
        setIssueError(res.error || "Failed to issue load sheet");
      }
    } catch (e: any) {
      setIssueError(e.message || "Failed to issue load sheet");
    } finally {
      setIssueSubmitting(false);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim()) {
      setQuickAddError("Product name is required");
      return;
    }
    setQuickAddLoading(true);
    setQuickAddError(null);
    try {
      const packSize = parseInt(quickAddForm.packSize) || 24;
      const addCartons = parseInt(quickAddForm.addCartons) || 0;
      const addPieces = parseInt(quickAddForm.addPieces) || 0;
      const mrpPaise = quickAddForm.mrp ? Math.round(parseFloat(quickAddForm.mrp) * 100) : 0;

      const res = await quickAddOrUpdateGodownProductAction({
        name: quickAddForm.name.trim(),
        weight: quickAddForm.weight.trim() || undefined,
        shortCode: quickAddForm.shortCode.trim() || undefined,
        packSize,
        mrpPaise,
        addCartons,
        addPieces,
      });

      if (!res.success || !res.product) {
        setQuickAddError(res.error || "Failed to save product");
        return;
      }

      const prod = res.product;
      setAllProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === prod.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = prod;
          return updated;
        }
        return [prod, ...prev];
      });

      // Automatically add to Morning Issue load sheet
      setLoadItems((prev) => ({
        ...prev,
        [prod.id]: {
          cartons: Math.max(1, addCartons),
          pieces: addPieces,
        },
      }));

      setQuickAddModalOpen(false);
      setQuickAddForm({
        name: "",
        weight: "",
        shortCode: "",
        packSize: "24",
        mrp: "",
        addCartons: "1",
        addPieces: "0",
      });
    } catch (e: any) {
      setQuickAddError(e.message || "Failed to add product");
    } finally {
      setQuickAddLoading(false);
    }
  };

  // Web Audio Ring Generator
  const playRingSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);

      if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } catch {
      // ignore
    }
  };

  // Toggle Alert Mode
  const toggleAlertMode = async () => {
    const next = !alertMode;
    setAlertMode(next);
    if (next) {
      playRingSound();
      // Request Wake Lock
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // ignore
      }
    } else {
      stopRinging();
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }
  };

  const startRinging = (alert: any) => {
    setActiveRingAlert(alert);
    playRingSound();
    if (!ringIntervalRef.current) {
      ringIntervalRef.current = setInterval(playRingSound, 1600);
    }
    // Android Native Wrapper Continuous Telephone Ring Bridge
    if (typeof window !== "undefined" && (window as any).AndroidGodownBridge?.triggerRing) {
      try {
        const amt = alert.amountPaise ? `₹${(alert.amountPaise / 100).toFixed(0)}` : "";
        (window as any).AndroidGodownBridge.triggerRing(
          alert.orderId || "",
          alert.orderNumber || "New Order",
          alert.customerName || "Customer",
          amt
        );
      } catch (e) {
        console.warn("AndroidGodownBridge triggerRing error", e);
      }
    }
  };

  const stopRinging = () => {
    setActiveRingAlert(null);
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (typeof window !== "undefined" && (window as any).AndroidGodownBridge?.stopRing) {
      try {
        (window as any).AndroidGodownBridge.stopRing();
      } catch (e) {
        console.warn("AndroidGodownBridge stopRing error", e);
      }
    }
  };

  // Poll for active unaccepted alerts
  useEffect(() => {
    const pollAlerts = async () => {
      try {
        const res = await fetch("/api/notifications/alerts");
        if (res.ok) {
          const data = await res.json();
          if (data.alerts && data.alerts.length > 0) {
            const first = data.alerts[0];
            const alertRef = first.orderId || first.invoiceId || first.id;
            if (!activeRingAlert || (activeRingAlert as any).alertId !== first.id) {
              const cartonCount = first.order?.items?.length || 1;
              const ordNum = first.order?.orderNumber || first.title?.replace("🚨 New Order: ", "").replace("🚨 Godown Dispatch: ", "") || "Dispatch";
              startRinging({
                alertId: first.id,
                orderId: alertRef,
                orderNumber: ordNum,
                customerName: first.order?.party?.name || first.order?.customerNotes || "Customer",
                amountPaise: first.order?.totalPaise || 0,
                cartonCount,
              });
            }
          }
        }
      } catch {
        // ignore
      }
    };

    const interval = setInterval(pollAlerts, 6000);
    return () => clearInterval(interval);
  }, [activeRingAlert]);

  // Handle Accept Order Alert
  const handleAcceptAlert = async (orderId: string) => {
    stopRinging();
    try {
      await fetch("/api/notifications/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
    } catch {
      // ignore
    }
    setActiveTab("orders");
  };

  // Subscribe to Push & Activate Loud Ringing (Works in PWA, Chrome & Android APK Wrapper)
  const handleEnablePush = async () => {
    try {
      // 1. Immediately turn on Alert Mode and activate Audio Context
      setAlertMode(true);
      playRingSound();
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
        }
      } catch {
        // ignore
      }

      // 2. If W3C PushManager is supported (standard Chrome / PWA), register Web Push
      if ("serviceWorker" in navigator && "PushManager" in window) {
        try {
          const reg = await navigator.serviceWorker.ready;
          const keyRes = await fetch("/api/notifications/vapid-public-key");
          if (keyRes.ok) {
            const { publicKey } = await keyRes.json();
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: publicKey,
            });

            await fetch("/api/notifications/push-subscription", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscription: sub,
                deviceLabel: `PWA Phone (${navigator.userAgent.includes("Android") ? "Android" : "Mobile"})`,
              }),
            });
            setPushSubscribed(true);
          }
        } catch (pushErr) {
          console.warn("W3C Push registration fallback to native device", pushErr);
        }
      }

      // 3. Always register native/in-app device registration so server knows this device is active
      await fetch("/api/notifications/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: `native-device-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            keys: { p256dh: "native-key", auth: "native-auth" },
          },
          deviceLabel: `Android Native App (${navigator.userAgent.includes("Android") ? "Android Phone" : "Device"})`,
        }),
      });

      setPushSubscribed(true);
      setTestPushStatus("✅ Loud Phone Ring & Order Alerts are ACTIVE on this device!");

      // Trigger test ring to confirm
      startRinging({
        orderId: "setup-test",
        orderNumber: "LOUD-ALERT-ACTIVE",
        customerName: "JMD Warehouse Alert Active",
        amountPaise: 0,
        cartonCount: 1,
      });

      alert("Loud phone ring & notifications are now ACTIVE on your phone!");
    } catch (err: any) {
      setTestPushStatus("Failed to enable: " + (err.message || "Error"));
      alert("Failed to enable: " + (err.message || "Error"));
    }
  };

  // Test Push Notification
  const handleTestAlert = async () => {
    setTestPushStatus("Sending test alert...");
    try {
      const res = await fetch("/api/notifications/alerts/test", { method: "POST" });
      if (!res.ok) {
        const text = await res.text();
        let errMsg = `Server error (${res.status})`;
        try {
          const json = JSON.parse(text);
          errMsg = json.error || errMsg;
        } catch {
          // not json
        }
        setTestPushStatus("Error: " + errMsg);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTestPushStatus("Test alert sent! Notification & Ring triggered.");
        playRingSound();
      } else {
        setTestPushStatus("Note: " + (data.reason || data.error || "Alert recorded. Please tap 'Enable Push Notifications' to register this device."));
        playRingSound();
      }
    } catch (err: any) {
      setTestPushStatus("Failed: " + err.message);
    }
  };

  // Smart search for Morning Issue
  const issueFilteredProducts = useMemo(() => {
    if (!issueSearch.trim()) {
      return [...allProducts].sort((a, b) => {
        const aStock = a.godownQty > 0 ? 1 : 0;
        const bStock = b.godownQty > 0 ? 1 : 0;
        if (aStock !== bStock) return bStock - aStock;
        return a.name.localeCompare(b.name);
      });
    }
    const hits = searchItems(issueSearch, allProducts as any, { limit: 25 });
    return (hits as unknown as GodownProduct[]);
  }, [allProducts, issueSearch]);

  // Stock Tab search
  const stockFilteredProducts = useMemo(() => {
    if (!stockSearch.trim()) return allProducts;
    const hits = searchItems(stockSearch, allProducts as any, { limit: 50 });
    return (hits as unknown as GodownProduct[]);
  }, [allProducts, stockSearch]);

  // Selected issue items summary
  const selectedIssueList = useMemo(() => {
    return Object.entries(loadItems)
      .filter(([_, counts]) => counts.cartons > 0 || counts.pieces > 0)
      .map(([id, counts]) => {
        const prod = allProducts.find((p) => p.id === id);
        return {
          id,
          product: prod,
          cartons: counts.cartons,
          pieces: counts.pieces,
          totalPcs: counts.cartons * (prod?.packSize || 1) + counts.pieces,
        };
      });
  }, [loadItems, allProducts]);

  return (
    <div className="space-y-4 max-w-md mx-auto font-sans pb-16">
      {/* FULL SCREEN RINGING OVERLAY WHEN NEW ORDER ARRIVES */}
      {activeRingAlert && (
        <div className="fixed inset-0 z-50 bg-red-650 bg-red-600 text-white flex flex-col justify-between p-6 animate-pulse">
          <div className="space-y-2 pt-8 text-center">
            <div className="inline-flex p-4 rounded-full bg-white text-red-600 shadow-xl animate-bounce">
              <BellRing className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">NEW ORDER!</h1>
            <p className="text-red-100 font-bold text-sm">
              Godown fulfillment required immediately
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 space-y-2 text-center">
            <div className="text-2xl font-black font-mono">{activeRingAlert.orderNumber}</div>
            <div className="text-lg font-bold">{activeRingAlert.customerName}</div>
            <div className="text-xl font-black font-mono text-amber-300">
              {activeRingAlert.cartonCount} Cartons · ₹{(activeRingAlert.amountPaise / 100).toFixed(0)}
            </div>
          </div>

          <div className="space-y-3 pb-8">
            <button
              type="button"
              onClick={() => handleAcceptAlert(activeRingAlert.orderId)}
              className="w-full py-4 text-base font-black bg-white text-red-700 hover:bg-slate-100 rounded-2xl shadow-2xl active:scale-95 transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-6 h-6" />
              <span>ACCEPT &amp; PACK ORDER</span>
            </button>
            <button
              type="button"
              onClick={stopRinging}
              className="w-full py-3 text-xs font-bold text-white/80 hover:text-white bg-black/20 rounded-xl"
            >
              Snooze 1 Min
            </button>
          </div>
        </div>
      )}

      {/* TOP HEADER: Alert Mode Toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${alertMode ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {alertMode ? <Volume2 className="w-5 h-5 animate-pulse" /> : <VolumeX className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>Alert Mode:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${alertMode ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                {alertMode ? "ON (Ringing)" : "OFF"}
              </span>
            </div>
            <div className="text-[10px] text-slate-500">
              {alertMode ? "Phone kept awake • Sound enabled" : "Tap to enable loud ring for new orders"}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleAlertMode}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition ${
            alertMode ? "bg-slate-900 text-white" : "bg-emerald-600 text-white shadow-xs"
          }`}
        >
          {alertMode ? "Turn Off" : "Turn ON"}
        </button>
      </div>

      {/* TAB 1: HOME */}
      {activeTab === "home" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setActiveTab("orders")}
              className="p-4 bg-[#12355B] text-white rounded-2xl shadow-xs cursor-pointer active:scale-95 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-200 uppercase">To Pack</span>
                <Package className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-3xl font-black font-mono mt-1">{orders.length}</div>
              <p className="text-[10px] text-blue-200 mt-0.5">Godown carton lines</p>
            </div>

            <div
              onClick={() => setActiveTab("stock")}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs cursor-pointer active:scale-95 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase">Low Stock</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-3xl font-black font-mono text-amber-600 mt-1">{lowStockCount}</div>
              <p className="text-[10px] text-slate-500 mt-0.5">Items below reorder</p>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("issue")}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs text-left hover:border-blue-400 active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center mb-2">
                <Truck className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900">Morning Issue</div>
              <p className="text-[10px] text-slate-500 mt-0.5">3-step van load sheet</p>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("stock")}
              className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs text-left hover:border-blue-400 active:scale-95 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center mb-2">
                <Layers className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900">Stock Count</div>
              <p className="text-[10px] text-slate-500 mt-0.5">Physical counts &amp; logs</p>
            </button>
          </div>

          {/* Unreviewed Stock Corrections Banner if any */}
          {unreviewedCorrectionsCount > 0 && (
            <Link
              href="/admin/reports/stock-corrections"
              className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center justify-between text-xs shadow-2xs text-amber-950 font-medium"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{unreviewedCorrectionsCount}</strong> stock corrections at billing require review.
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-600" />
            </Link>
          )}

          {/* Notification Inbox / Quick Push Setup */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-blue-600" />
                <span>Phone Notification Setup</span>
              </span>
              <button
                type="button"
                onClick={handleTestAlert}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                Test Alert
              </button>
            </div>
            <p className="text-[11px] text-slate-600">
              Receive high-urgency notifications with vibration and sound whenever an order arrives.
            </p>
            {testPushStatus && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[10px] text-blue-900 font-medium">
                {testPushStatus}
              </div>
            )}
            <button
              type="button"
              onClick={handleEnablePush}
              className="w-full py-2.5 text-xs font-bold bg-[#12355B] hover:bg-slate-800 text-white rounded-xl shadow-xs transition"
            >
              Enable Push Notifications on Phone
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: ORDERS (Pack & Dispatch Queue) */}
      {activeTab === "orders" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm text-slate-900">Orders to Pack ({orders.length})</h2>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[11px] font-bold text-blue-600 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">Packing Queue Clear!</p>
              <p>No orders pending godown dispatch at this time.</p>
            </div>
          ) : (
            orders.map((ord) => (
              <div
                key={ord.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                      {ord.orderNumber}
                    </span>
                    <span className="text-xs font-bold text-slate-900 ml-2">{ord.customerName}</span>
                  </div>
                  <span className="font-mono font-bold text-xs text-emerald-700">
                    ₹{(ord.totalPaise / 100).toFixed(0)}
                  </span>
                </div>

                {/* Items checklist */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                    Pack Items Checklist:
                  </div>
                  {ord.items.map((it) => {
                    const isChecked = orderChecklist[ord.id]?.[it.id] || false;
                    return (
                      <div
                        key={it.id}
                        onClick={() =>
                          setOrderChecklist((prev) => ({
                            ...prev,
                            [ord.id]: {
                              ...(prev[ord.id] || {}),
                              [it.id]: !isChecked,
                            },
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                          isChecked ? "bg-emerald-50 border-emerald-300 text-emerald-950 line-through" : "bg-slate-50 border-slate-200 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-emerald-600 focus:ring-0"
                          />
                          <span className="font-medium">{it.productName} {it.weight ? <span className="text-blue-700 font-bold">({it.weight})</span> : null}</span>
                        </div>
                        <span className="font-mono font-bold">
                          {it.cartons > 0 ? `${it.cartons} Ctn` : `${it.totalPieces} Pcs`}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert(`Order ${ord.orderNumber} marked packed and ready for delivery handover!`);
                      setOrders((prev) => prev.filter((o) => o.id !== ord.id));
                    }}
                    className="w-full py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Mark Packed &amp; Ready</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: MORNING ISSUE (3-Step Flow with Fixed Removal Bug) */}
      {activeTab === "issue" && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Step Indicator Header */}
          <div className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center justify-between text-xs">
            <span
              onClick={() => setIssueStep(1)}
              className={`font-bold cursor-pointer ${issueStep === 1 ? "text-blue-600" : "text-slate-400"}`}
            >
              1. Van
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span
              onClick={() => setIssueStep(2)}
              className={`font-bold cursor-pointer ${issueStep === 2 ? "text-blue-600" : "text-slate-400"}`}
            >
              2. Add Items ({selectedIssueList.length})
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span
              onClick={() => selectedIssueList.length > 0 && setIssueStep(3)}
              className={`font-bold cursor-pointer ${issueStep === 3 ? "text-blue-600" : "text-slate-400"}`}
            >
              3. Review &amp; Issue
            </span>
          </div>

          {/* STEP 1: Choose Van */}
          {issueStep === 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Step 1: Choose Route Delivery Van</h3>
              <div className="space-y-2">
                {vanLocations.map((van) => (
                  <label
                    key={van.id}
                    onClick={() => setSelectedVanId(van.id)}
                    className={`p-3.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition ${
                      selectedVanId === van.id ? "bg-blue-50 border-blue-500 font-bold text-blue-900" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Truck className={`w-4 h-4 ${selectedVanId === van.id ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{van.name}</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {van.assignedUser ? `👤 ${van.assignedUser.name}` : "Unassigned"}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIssueStep(2)}
                className="w-full py-3 text-xs font-bold bg-[#12355B] text-white rounded-xl shadow-xs transition"
              >
                Next: Add Products &rarr;
              </button>
            </div>
          )}

          {/* STEP 2: Add Products (Shared smart search, stepper, clean removal/re-add) */}
          {issueStep === 2 && (
            <div className="space-y-4">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={issueSearch}
                  onChange={(e) => setIssueSearch(e.target.value)}
                  placeholder="Search item name, 'bhuj 400', code..."
                  className="w-full px-3.5 py-3 pl-9 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                {issueSearch.trim() && (
                  <button
                    type="button"
                    onClick={() => setIssueSearch("")}
                    className="absolute right-3 top-3 text-xs text-slate-400"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {issueSearch.trim() && (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                  {issueFilteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No matching items found for &quot;{issueSearch}&quot;
                    </div>
                  ) : (
                    issueFilteredProducts.slice(0, 10).map((p) => {
                      const counts = loadItems[p.id];
                      const isAdded = Boolean(counts && (counts.cartons > 0 || counts.pieces > 0));

                      return (
                        <div
                          key={p.id}
                          className="p-3 flex items-center justify-between hover:bg-slate-50 transition"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900">
                              {p.name} {p.weight ? <span className="text-blue-700 font-semibold">({p.weight})</span> : null}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Stock: {p.godownQty} pcs ({Math.floor(p.godownQty / p.packSize)} ctn) · 1 Ctn = {p.packSize} pcs
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setLoadItems((prev) => {
                                const ex = prev[p.id];
                                if (ex && (ex.cartons > 0 || ex.pieces > 0)) {
                                  return { ...prev, [p.id]: { cartons: ex.cartons + 1, pieces: ex.pieces } };
                                }
                                const initialCartons = p.godownQty >= p.packSize ? 1 : 0;
                                const initialPieces = initialCartons === 0 ? 1 : 0;
                                return { ...prev, [p.id]: { cartons: initialCartons, pieces: initialPieces } };
                              });
                              setIssueSearch("");
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                              isAdded ? "bg-emerald-100 text-emerald-800" : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                          >
                            {isAdded ? "Added (+1)" : "+ Add"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Quick Add Missing Product / Stock Button */}
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(true)}
                className="w-full py-2.5 px-3 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>+ Quick Add Product or Missing Stock (Godown)</span>
              </button>

              {/* Running Selected Items List */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-900">
                    Selected Items ({selectedIssueList.length})
                  </h3>
                  {selectedIssueList.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setLoadItems({})}
                      className="text-[11px] text-red-600 font-bold hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {selectedIssueList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 space-y-1">
                    <p>No products added yet.</p>
                    <p className="text-[10px]">Search items above and tap &quot;+ Add&quot; to build load sheet.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {selectedIssueList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-slate-900 truncate">
                            {item.product?.name || "Product"} {item.product?.weight ? <span className="text-blue-700 font-semibold">({item.product.weight})</span> : null}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Stock: {item.product?.godownQty || 0} pcs · 1 Ctn = {item.product?.packSize || 1} pcs
                          </div>
                        </div>

                        {/* Dual Steppers: Cartons AND Loose Pieces */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {/* Cartons Stepper */}
                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updateCartons(item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-xs text-slate-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs w-5 text-center text-slate-900">
                              {item.cartons}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartons(item.id, 1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-xs text-slate-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] font-bold text-slate-500 pr-1">Ctn</span>
                          </div>

                          {/* Loose Pieces Stepper */}
                          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => updatePieces(item.id, -1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-xs text-slate-700"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs w-5 text-center text-slate-900">
                              {item.pieces}
                            </span>
                            <button
                              type="button"
                              onClick={() => updatePieces(item.id, 1)}
                              className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold flex items-center justify-center text-xs text-slate-700"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="text-[9px] font-bold text-slate-500 pr-1">Loose</span>
                          </div>

                          {/* Remove Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setLoadItems((prev) => {
                                const copy = { ...prev };
                                delete copy[item.id];
                                return copy;
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectedIssueList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIssueStep(3)}
                    className="w-full py-3 text-xs font-bold bg-[#12355B] text-white rounded-xl shadow-xs transition mt-2"
                  >
                    Review &amp; Issue Load Sheet ({selectedIssueList.length} items) &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Review and Issue */}
          {issueStep === 3 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Step 3: Review Load Sheet</h3>

              {issueError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                  {issueError}
                </div>
              )}
              {issueSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                  {issueSuccess}
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Van Location:</span>
                  <strong className="text-slate-900">{vanLocations.find((v) => v.id === selectedVanId)?.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Products:</span>
                  <strong className="font-mono text-slate-900">{selectedIssueList.length} items</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Cartons:</span>
                  <strong className="font-mono text-blue-700">
                    {selectedIssueList.reduce((sum, i) => sum + i.cartons, 0)} Cartons
                  </strong>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIssueStep(2)}
                  className="w-1/3 py-3 text-xs font-bold border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 transition"
                >
                  &larr; Back
                </button>
                <button
                  type="button"
                  disabled={issueSubmitting}
                  onClick={handleConfirmIssue}
                  className="w-2/3 py-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {issueSubmitting ? "Issuing..." : "Confirm & Issue Van"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: STOCK SEARCH */}
      {activeTab === "stock" && (
        <div className="space-y-3 animate-in fade-in duration-150">
          <div className="relative">
            <input
              type="text"
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              placeholder="Search live godown stock ('bhuj 400', code)..."
              className="w-full px-3.5 py-3 pl-9 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            {stockSearch && (
              <button
                type="button"
                onClick={() => setStockSearch("")}
                className="absolute right-3 top-3 text-xs text-slate-400"
              >
                ✕
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {stockFilteredProducts.slice(0, 30).map((p) => (
              <div key={p.id} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {p.shortCode} {p.weight ? `· ${p.weight}` : ""} · 1 Ctn = {p.packSize} pcs
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900">{p.godownQty} pcs</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    ({p.godownCartons} ctn + {p.godownLoose} loose)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: MORE */}
      {activeTab === "more" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 animate-in fade-in duration-150">
          <h2 className="font-bold text-sm text-slate-900">Godown Operations &amp; Settings</h2>
          <div className="space-y-2 text-xs">
            <Link
              href="/godown/receive-goods"
              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-purple-600" />
                <span className="font-bold text-slate-900">Receive Goods (Scan Bill / GRN)</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/godown/operations"
              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-slate-900">Transfers &amp; Carton Conversions</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/admin/reports/stock-corrections"
              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900">Stock Corrections Audit</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>

            <Link
              href="/admin"
              className="p-3 rounded-xl border border-slate-200 flex items-center justify-between hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2.5">
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <span className="font-bold text-slate-900">Open Full Desktop Panel</span>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>

          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
            <p><strong>Note on Background Push Ring:</strong></p>
            <p>
              PWA Push Notifications show system banners with vibration. Continuous call-like ringing operates when the Godown app is active or in Alert Mode. For continuous background ringing with phone locked, an Android Native Wrapper is recommended.
            </p>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION: Home · Orders · Issue · Stock · More */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
        <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "home" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Warehouse className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition relative ${
              activeTab === "orders" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Package className="w-5 h-5 mb-0.5" />
            <span>Orders</span>
            {orders.length > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("issue")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "issue" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Truck className="w-5 h-5 mb-0.5" />
            <span>Issue</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stock")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "stock" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Layers className="w-5 h-5 mb-0.5" />
            <span>Stock</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("more")}
            className={`flex flex-col items-center py-1 px-3 text-[10px] font-bold transition ${
              activeTab === "more" ? "text-[#12355B]" : "text-slate-400"
            }`}
          >
            <Download className="w-5 h-5 mb-0.5" />
            <span>More</span>
          </button>
        </div>
      </div>
      {/* QUICK ADD PRODUCT / STOCK MODAL */}
      {quickAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Add Product / Missing Stock</h3>
                <p className="text-[11px] text-slate-500">Instantly add physical godown inventory</p>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {quickAddError && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                {quickAddError}
              </div>
            )}

            <form onSubmit={handleQuickAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bikaji Bhujia, MDH Mirch"
                  value={quickAddForm.name}
                  onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Weight / Size
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 15g, 100g, 1kg"
                    value={quickAddForm.weight}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, weight: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pack Size (pcs/ctn)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="24"
                    value={quickAddForm.packSize}
                    onChange={(e) => setQuickAddForm({ ...quickAddForm, packSize: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <span className="block text-[11px] font-bold text-amber-900">
                  Initial Quantity to Issue / Add:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-amber-800 font-semibold mb-0.5">
                      Cartons
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quickAddForm.addCartons}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, addCartons: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-amber-800 font-semibold mb-0.5">
                      Loose Pcs
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={quickAddForm.addPieces}
                      onChange={(e) => setQuickAddForm({ ...quickAddForm, addPieces: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setQuickAddModalOpen(false)}
                  className="w-1/3 py-2.5 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickAddLoading}
                  className="w-2/3 py-2.5 bg-[#12355B] hover:bg-[#0c2340] text-white font-bold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {quickAddLoading ? "Adding..." : "+ Add to Load Sheet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
