"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  getNavGroupsForRole,
  NAV_ITEMS,
  NavGroupName,
} from "@/config/nav.config";
import {
  LayoutDashboard,
  Warehouse,
  Receipt,
  FileText,
  ShoppingBag,
  Truck,
  Boxes,
  FileSpreadsheet,
  ArrowLeftRight,
  PackageOpen,
  History,
  ClipboardCheck,
  AlertTriangle,
  Trash2,
  Sun,
  Sunset,
  CheckCircle2,
  Banknote,
  Package,
  Building2,
  Tags,
  IndianRupee,
  Layers,
  Upload,
  Users,
  Store,
  Building,
  Factory,
  CreditCard,
  FileUp,
  MapPin,
  Map,
  Calculator,
  Bike,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Clock,
  Calendar,
  Wallet,
  Download,
  BarChart3,
  RotateCcw,
  Award,
  Database,
  UserCog,
  FileCheck,
  Percent,
  Globe,
  ShieldCheck,
  HardDriveDownload,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Warehouse,
  Receipt,
  FileText,
  ShoppingBag,
  Truck,
  Boxes,
  FileSpreadsheet,
  ArrowLeftRight,
  PackageOpen,
  History,
  ClipboardCheck,
  AlertTriangle,
  Trash2,
  Sun,
  Sunset,
  CheckCircle2,
  Banknote,
  Package,
  Building2,
  Tags,
  IndianRupee,
  Layers,
  Upload,
  Users,
  Store,
  Building,
  Factory,
  CreditCard,
  FileUp,
  MapPin,
  Map,
  Calculator,
  Bike,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Clock,
  Calendar,
  Wallet,
  Download,
  BarChart3,
  RotateCcw,
  Award,
  Database,
  UserCog,
  FileCheck,
  Percent,
  Globe,
  ShieldCheck,
  HardDriveDownload,
  Settings,
};

export interface ShellBadges {
  pendingOrders: number;
  lowStock: number;
  autoConverted: number;
}

export interface ShellLocation {
  id: string;
  name: string;
  type: string;
}

export interface ShellQuickProduct {
  id: string;
  shortCode: string;
  name: string;
  brandName: string | null;
  priceCPaise: number;
}

interface ManagementShellProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
  badges: ShellBadges;
  locations: ShellLocation[];
  quickProducts: ShellQuickProduct[];
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}

export function ManagementShell({
  user,
  badges,
  locations,
  quickProducts,
  signOutAction,
  children,
}: ManagementShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    locations[0]?.id || "loc-godown-main"
  );

  const navGroups = useMemo(() => getNavGroupsForRole(user.role), [user.role]);

  const [notificationsRead, setNotificationsRead] = useState<boolean>(false);

  // Restore sidebar state from localStorage
  useEffect(() => {
    try {
      if (pathname === "/shop/pos") {
        setSidebarCollapsed(true);
      } else {
        const savedCollapsed = localStorage.getItem("jmd_sidebar_collapsed");
        if (savedCollapsed === "1") setSidebarCollapsed(true);
      }
      const savedDensity = localStorage.getItem("jmd_mgmt_density");
      if (savedDensity === "compact" || savedDensity === "comfortable") {
        setDensity(savedDensity);
      }
      const savedGroups = localStorage.getItem("jmd_sidebar_groups");
      if (savedGroups) {
        setCollapsedGroups(JSON.parse(savedGroups));
      }
      const readTimestamp = localStorage.getItem("jmd_notifs_read_at");
      if (readTimestamp) {
        const lastRead = parseInt(readTimestamp, 10);
        if (Date.now() - lastRead < 4 * 60 * 60 * 1000) {
          setNotificationsRead(true);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const markAllNotificationsRead = () => {
    setNotificationsRead(true);
    try {
      localStorage.setItem("jmd_notifs_read_at", Date.now().toString());
    } catch {
      // ignore
    }
  };

  // Ctrl+K shortcut for Command Palette (disabled on /shop/pos to allow dedicated POS item search)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (pathname === "/shop/pos" || pathname.startsWith("/shop/pos")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname, searchParams]);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("jmd_sidebar_collapsed", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  const toggleGroup = (groupName: NavGroupName) => {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [groupName]: !prev[groupName] };
      try {
        localStorage.setItem("jmd_sidebar_groups", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const fullCurrentUrl = useMemo(() => {
    const qs = searchParams?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, searchParams]);

  const isItemActive = (href: string) => {
    if (href === fullCurrentUrl) return true;
    const [itemPath, itemQs] = href.split("?");
    if (itemQs) {
      return fullCurrentUrl === href;
    }
    if (itemPath === "/admin" || itemPath === "/godown") {
      return pathname === itemPath;
    }
    return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
  };

  const activeNavItem = useMemo(() => {
    const exact = NAV_ITEMS.find((i) => i.href === fullCurrentUrl);
    if (exact) return exact;
    return NAV_ITEMS.find((i) => i.href.split("?")[0] === pathname);
  }, [fullCurrentUrl, pathname]);

  const totalNotifCount = notificationsRead
    ? 0
    : badges.pendingOrders + badges.lowStock + badges.autoConverted;
  const displayNotifCount = totalNotifCount > 99 ? "99+" : String(totalNotifCount);

  // Command palette results
  const visibleItems = useMemo(
    () => navGroups.flatMap((g) => g.items),
    [navGroups]
  );

  const filteredNavItems = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return visibleItems.slice(0, 8);
    return visibleItems.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q) ||
        i.href.toLowerCase().includes(q)
    );
  }, [visibleItems, cmdQuery]);

  const filteredProducts = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    if (!q) return quickProducts.slice(0, 5);
    return quickProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.shortCode.toLowerCase().includes(q) ||
          (p.brandName && p.brandName.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [quickProducts, cmdQuery]);

  const renderSidebarContent = (isMobile = false) => {
    const isCollapsed = !isMobile && sidebarCollapsed;

    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-900 text-slate-200 select-none border-r border-slate-800">
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <Link
            href={user.role === "GODOWN" ? "/godown" : "/admin"}
            className="flex items-center gap-2.5 overflow-hidden"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
              JMD
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <div className="font-black text-sm tracking-tight leading-none text-white">
                  JMD CART
                </div>
                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider mt-0.5">
                  Saharsa Distribution
                </div>
              </div>
            )}
          </Link>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Groups - with min-h-0 so flexbox allows scrolling to very bottom */}
        <div className="flex-1 min-h-0 overflow-y-auto py-3 px-2.5 space-y-3 overscroll-contain">
          {navGroups.map((group) => {
            const isGroupCollapsed = Boolean(collapsedGroups[group.name]);
            const GroupIcon = ICON_MAP[group.icon] || Boxes;

            return (
              <div key={group.name} className="space-y-1">
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.name)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <GroupIcon className="w-3.5 h-3.5 opacity-80" />
                      {group.name}
                    </span>
                    {isGroupCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 opacity-75" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 opacity-75" />
                    )}
                  </button>
                ) : (
                  <div
                    className="h-px bg-white/15 my-2 mx-1"
                    title={group.name}
                  />
                )}

                {(!isGroupCollapsed || isCollapsed) && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const ItemIcon = ICON_MAP[item.icon] || Package;
                      const active = isItemActive(item.href);
                      const badgeVal = item.badgeKey ? badges[item.badgeKey] : 0;
                      const isReadOnly = item.readOnlyForRoles?.includes(
                        user.role as never
                      );

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          title={
                            isCollapsed
                              ? `${group.name}: ${item.label}`
                              : undefined
                          }
                          className={`flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition ${
                            active
                              ? "bg-blue-600 text-white shadow-xs font-bold"
                              : "text-slate-300 hover:bg-slate-800 hover:text-white"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <ItemIcon className="w-4 h-4 shrink-0" />
                            {!isCollapsed && (
                              <span className="truncate">{item.label}</span>
                            )}
                          </div>

                          {!isCollapsed && (
                            <div className="flex items-center gap-1 shrink-0">
                              {isReadOnly && (
                                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/15 text-white/90 font-bold">
                                  View
                                </span>
                              )}
                              {badgeVal > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-[#FDAF18] text-gray-950">
                                  {badgeVal}
                                </span>
                              )}
                            </div>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Storefront shortcut + Role badge */}
        <div className="p-3 border-t border-white/15 space-y-2 shrink-0">
          <Link
            href="/store"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl bg-[#075828] hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs"
            title="Open Live Customer Storefront"
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Live Storefront</span>}
          </Link>
          {!isCollapsed && (
            <div className="flex items-center justify-between text-[11px] text-white/75 px-1">
              <span className="truncate font-semibold">{user.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-white/15 text-[#FDAF18] font-bold uppercase text-[10px]">
                {user.role}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#FEFDF7] text-gray-900">
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Management Sidebar"
        className={`hidden lg:flex flex-col shrink-0 transition-all duration-200 sticky top-0 h-screen z-30 print:hidden ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Over Sidebar Drawer (360px ready) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <aside
            aria-label="Mobile Navigation Drawer"
            className="relative w-72 max-w-[85vw] h-full z-10 shadow-2xl"
          >
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 print:p-0 print:m-0 print:block">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-gray-200 px-3 sm:px-6 flex items-center justify-between gap-3 print:hidden">
          {/* Left: Mobile Menu + Breadcrumbs */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav aria-label="Breadcrumb" className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold truncate">
                <span className="text-blue-700 font-bold">
                  {activeNavItem?.group || "Management"}
                </span>
                <span>/</span>
                <span className="text-gray-900 font-bold truncate">
                  {activeNavItem?.label || pathname}
                </span>
              </div>
            </nav>
          </div>

          {/* Center/Right Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Global Search Ctrl+K Trigger */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 border border-gray-200 text-xs text-gray-600 transition"
              aria-label="Search pages and products"
            >
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <span className="hidden sm:inline font-medium">
                Search pages &amp; SKUs...
              </span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-mono font-bold bg-white rounded border border-gray-300 text-gray-700">
                Ctrl+K
              </kbd>
            </button>

            {/* Location Switcher */}
            {locations.length > 0 && (
              <div className="hidden md:flex items-center gap-1.5 bg-[#FEFDF7] border border-gray-200 rounded-xl px-2.5 py-1">
                <MapPin className="w-3.5 h-3.5 text-[#790E11]" />
                <select
                  aria-label="Active Location"
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-gray-800 focus:outline-none"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Density Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = density === "comfortable" ? "compact" : "comfortable";
                setDensity(next);
                try {
                  localStorage.setItem("jmd_mgmt_density", next);
                } catch {}
              }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-xs font-semibold text-gray-700 transition"
              title={`Switch to ${density === "comfortable" ? "compact" : "comfortable"} density`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              <span className="capitalize">{density}</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((prev) => !prev);
                  setUserMenuOpen(false);
                }}
                className="relative p-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 transition"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {totalNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-[#FC830D] text-white">
                    {displayNotifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl p-4 z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="text-xs font-black uppercase text-gray-700">
                      System Alerts &amp; Notifications
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#790E11]">
                        {displayNotifCount} active
                      </span>
                      {totalNotifCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold underline cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <Link
                      href="/godown/operations?tab=convert"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200 transition"
                    >
                      <div>
                        <div className="font-bold text-amber-950">
                          Auto-Converted Cartons
                        </div>
                        <div className="text-[11px] text-amber-800">
                          Cartons automatically opened into loose pieces
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full font-black bg-[#FDAF18] text-gray-950">
                        {badges.autoConverted}
                      </span>
                    </Link>

                    <Link
                      href="/godown/stock?lowStockOnly=true"
                      onClick={() => setNotifOpen(false)}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-red-50 hover:bg-red-100/80 border border-red-200 transition"
                    >
                      <div>
                        <div className="font-bold text-red-950">
                          Low Stock Alerts
                        </div>
                        <div className="text-[11px] text-red-800">
                          SKUs at or below reorder level
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full font-black bg-red-600 text-white">
                        {badges.lowStock}
                      </span>
                    </Link>

                    {user.role !== "GODOWN" && (
                      <Link
                        href="/admin/orders"
                        onClick={() => setNotifOpen(false)}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition"
                      >
                        <div>
                          <div className="font-bold text-emerald-950">
                            Pending Online Orders
                          </div>
                          <div className="text-[11px] text-emerald-800">
                            Awaiting godown fulfillment
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-black bg-[#075828] text-white">
                          {badges.pendingOrders}
                        </span>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((prev) => !prev);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-xs font-bold text-gray-800 transition"
              >
                <span className="w-6 h-6 rounded-lg bg-[#790E11] text-white flex items-center justify-center text-[11px] font-black">
                  {(user.name || "U").slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:inline max-w-[110px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-gray-200 shadow-xl p-2 z-50 space-y-1 text-xs">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <div className="font-bold text-gray-900 truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] font-bold uppercase text-[#790E11]">
                      Role: {user.role}
                    </div>
                  </div>
                  <Link
                    href="/change-password"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-semibold text-gray-700"
                  >
                    Change Password
                  </Link>
                  <Link
                    href="/store"
                    onClick={() => setUserMenuOpen(false)}
                    className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-semibold text-gray-700"
                  >
                    View Public Storefront
                  </Link>
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 text-red-700 font-bold text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      {/* Global Command Palette Modal (Ctrl+K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setCmdOpen(false)}
          />
          <div className="relative w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden z-10">
            <div className="p-3 border-b border-gray-200 flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[#790E11]" />
              <input
                type="text"
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="Jump to any page, module, or search SKU / product..."
                className="w-full text-sm font-medium text-gray-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCmdOpen(false)}
                className="text-xs font-bold text-gray-400 hover:text-gray-700 px-2 py-1"
              >
                ESC
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-3 space-y-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-2 mb-1">
                  Navigation Pages ({filteredNavItems.length})
                </div>
                <div className="space-y-1">
                  {filteredNavItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCmdOpen(false);
                        router.push(item.href);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-orange-50 text-left text-xs transition"
                    >
                      <div>
                        <span className="font-bold text-gray-900">
                          {item.label}
                        </span>
                        <span className="text-gray-500 ml-2">
                          ({item.group})
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#790E11]">
                        {item.href}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {filteredProducts.length > 0 && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 px-2 mb-1">
                    Products ({filteredProducts.length})
                  </div>
                  <div className="space-y-1">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCmdOpen(false);
                          router.push(`/godown/stock/${p.id}`);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-left text-xs transition"
                      >
                        <div>
                          <span className="font-mono font-bold text-[#790E11] mr-2">
                            [{p.shortCode}]
                          </span>
                          <span className="font-semibold text-gray-900">
                            {p.name}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          ₹{(p.priceCPaise / 100).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
