"use client";

import React, { useRef, useState } from "react";
import { UserRole } from "@prisma/client";
import { Permission, ROLE_PERMISSIONS } from "@/modules/auth/permissions";
import { ShieldCheck, Check, X, RotateCcw, AlertTriangle, Lock } from "lucide-react";
import type { RoleChangelogItem } from "@/modules/auth/role-matrix.service";

interface RoleMatrixClientProps {
  userRole: UserRole;
  userCounts: Record<string, number>;
  initialMatrix?: Record<UserRole, Permission[]>;
  initialChangelog?: RoleChangelogItem[];
}

const SENSITIVE_KEYS = new Set<Permission>([
  Permission.SYSTEM_ADMIN,
  Permission.MANAGE_SETTINGS,
  Permission.MANAGE_USERS,
]);

const SUPER_ADMIN_LOCKED_KEYS = new Set<Permission>([
  Permission.SYSTEM_ADMIN,
  Permission.MANAGE_SETTINGS,
  Permission.MANAGE_USERS,
]);

const PERMISSION_GROUPS: Array<{
  group: string;
  permissions: Array<{ key: Permission; label: string; desc: string }>;
}> = [
  {
    group: "System & Administration",
    permissions: [
      { key: Permission.SYSTEM_ADMIN, label: "System Admin", desc: "Full root access and system controls" },
      { key: Permission.MANAGE_SETTINGS, label: "Manage Settings", desc: "Configure store parameters and limits" },
      { key: Permission.MANAGE_USERS, label: "Manage Users", desc: "Create and assign staff user roles" },
      { key: Permission.VIEW_AUDIT_LOGS, label: "View Audit Logs", desc: "Inspect immutable audit log history" },
    ],
  },
  {
    group: "Catalog & Pricing",
    permissions: [
      { key: Permission.VIEW_PRODUCTS, label: "View Products", desc: "Search and view products and prices" },
      { key: Permission.MANAGE_PRODUCTS, label: "Manage Products", desc: "Create, edit products, companies, categories" },
      { key: Permission.IMPORT_PRODUCTS, label: "Import Catalog", desc: "Excel upload products and prices" },
    ],
  },
  {
    group: "Stock & Godown Operations",
    permissions: [
      { key: Permission.STOCK_VIEW, label: "View Stock", desc: "View stock balances across locations" },
      { key: Permission.STOCK_RECEIVE, label: "Receive Goods (GRN)", desc: "Scan Bill and Purchase receipts" },
      { key: Permission.STOCK_TRANSFER, label: "Stock Transfers", desc: "Transfer stock between Godown, Shop, Van" },
      { key: Permission.STOCK_ADJUST, label: "Adjust Stock", desc: "Stock corrections, counts and adjustments" },
      { key: Permission.STOCK_CARTON_BREAK, label: "Carton Conversion", desc: "Carton to loose pieces conversion" },
      { key: Permission.STOCK_AUDIT, label: "Stock Auditing", desc: "Physical inventory audit logging" },
    ],
  },
  {
    group: "Shop POS & Invoicing",
    permissions: [
      { key: Permission.POS_BILL, label: "Create Bills (POS)", desc: "Counter sales voucher entry and prints" },
      { key: Permission.POS_HOLD_RESUME, label: "Hold / Resume Bills", desc: "Multi-tab voucher holding" },
      { key: Permission.POS_CASH_CLOSE, label: "POS Cash Close", desc: "Day end cashier reconciliation" },
      { key: Permission.BILL_CANCEL, label: "Cancel Invoices", desc: "Cancel issued invoices with audit reason" },
      { key: Permission.VIEW_INVOICES, label: "View Invoices", desc: "Browse, view, reprint past invoices" },
    ],
  },
  {
    group: "Sales & Billing",
    permissions: [
      { key: Permission.POS_DELETE_BILL, label: "Delete bill (POS)", desc: "Discard current unsaved bill in Shop POS (F8)" },
      { key: Permission.INVOICE_VOID, label: "Delete (void) invoice", desc: "Void finalized invoice with stock/ledger reversal & reason" },
    ],
  },
  {
    group: "Parties & Credit Control",
    permissions: [
      { key: Permission.VIEW_PARTIES, label: "View Parties", desc: "View retail/wholesale buyers and suppliers" },
      { key: Permission.MANAGE_PARTIES, label: "Manage Parties", desc: "Create/edit party master data and limits" },
      { key: Permission.VIEW_LEDGER, label: "View Ledger", desc: "Inspect party accounts and statement" },
      { key: Permission.RECORD_COLLECTION, label: "Record Collection", desc: "Accept payments against ledger balances" },
      { key: Permission.OVERRIDE_CREDIT_LIMIT, label: "Override Credit Limit", desc: "Authorize sale exceeding credit limits" },
    ],
  },
  {
    group: "Dispatch & Van Sales",
    permissions: [
      { key: Permission.DISPATCH_MANAGE, label: "Manage Dispatch", desc: "Dispatch board and packing queue" },
      { key: Permission.VAN_ISSUE_LOAD, label: "Van Morning Issue", desc: "Dispatch morning load sheet to van" },
      { key: Permission.VAN_BILL, label: "Van Counter Billing", desc: "Salesperson route billing from van" },
      { key: Permission.VAN_RECONCILE, label: "Van EOD Reconciliation", desc: "Reconcile van stock and cash" },
      { key: Permission.CONFIRM_CASH_HANDOVER, label: "Confirm Cash Handover", desc: "Accounts sign-off for van cash" },
    ],
  },
  {
    group: "Reports & Accounts",
    permissions: [
      { key: Permission.ACCOUNTS_VIEW, label: "View Accounts", desc: "Access accounts overview and receipts" },
      { key: Permission.REPORTS_VIEW, label: "View Reports", desc: "Access daybook, GST and sales analytics" },
      { key: Permission.RETURN_TO_COMPANY, label: "Returns to Company", desc: "Debit notes and vendor returns" },
    ],
  },
];

const ALL_PERMISSION_ROWS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

const DISPLAY_ROLES: Array<{ role: UserRole; label: string; badgeColor: string }> = [
  { role: UserRole.SUPER_ADMIN, label: "Super Admin", badgeColor: "bg-red-100 text-red-900 border-red-300" },
  { role: UserRole.ADMIN, label: "Admin", badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  { role: UserRole.ACCOUNTS, label: "Accountant", badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { role: UserRole.WAREHOUSE_MANAGER, label: "Wh. Manager", badgeColor: "bg-blue-100 text-blue-900 border-blue-300" },
  { role: UserRole.GODOWN, label: "Godown", badgeColor: "bg-cyan-100 text-cyan-900 border-cyan-300" },
  { role: UserRole.SHOP, label: "Cashier (Shop)", badgeColor: "bg-amber-100 text-amber-900 border-amber-300" },
  { role: UserRole.PRO, label: "PRO (Order Exec)", badgeColor: "bg-purple-100 text-purple-900 border-purple-300" },
  { role: UserRole.SALESPERSON, label: "Salesperson", badgeColor: "bg-teal-100 text-teal-900 border-teal-300" },
  { role: UserRole.DELIVERY, label: "Delivery", badgeColor: "bg-slate-100 text-slate-800 border-slate-300" },
];

export function RolesMatrixClient({
  userRole,
  userCounts,
  initialMatrix,
  initialChangelog = [],
}: RoleMatrixClientProps) {
  const isEditable = userRole === UserRole.SUPER_ADMIN;
  const [activeTab, setActiveTab] = useState<"MATRIX" | "FIELD_RULES" | "CHANGELOG">("MATRIX");
  const [matrix, setMatrix] = useState<Record<UserRole, Permission[]>>(
    () => initialMatrix || (ROLE_PERMISSIONS as Record<UserRole, Permission[]>)
  );
  const [changelog, setChangelog] = useState<RoleChangelogItem[]>(initialChangelog);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    undoPayload?: { targetRole: UserRole; permission: Permission; enabled: boolean };
    isError?: boolean;
  } | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    targetRole: UserRole;
    roleLabel: string;
    permission: Permission;
    permLabel: string;
    nextEnabled: boolean;
  } | null>(null);

  const cellRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (nextToast: typeof toast) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(nextToast);
    if (nextToast) {
      toastTimerRef.current = setTimeout(() => setToast(null), 5000);
    }
  };

  const applyToggle = async (
    targetRole: UserRole,
    permission: Permission,
    nextEnabled: boolean,
    allowUndo = true
  ) => {
    if (!isEditable) return;
    const prevPerms = matrix[targetRole] || [];
    const cellId = `${targetRole}:${permission}`;

    // Optimistic update
    const nextPerms = nextEnabled
      ? Array.from(new Set([...prevPerms, permission]))
      : prevPerms.filter((p) => p !== permission);

    setMatrix((prev) => ({
      ...prev,
      [targetRole]: nextPerms,
    }));
    setSavingCell(cellId);

    try {
      const res = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          permission,
          enabled: nextEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to save role permission");
      }

      if (data.matrix) {
        setMatrix(data.matrix);
      }
      if (Array.isArray(data.changelog)) {
        setChangelog(data.changelog);
      }

      showToast({
        message: "Saved",
        undoPayload: allowUndo
          ? { targetRole, permission, enabled: !nextEnabled }
          : undefined,
      });
    } catch (err: any) {
      // Revert optimistic state on failure
      setMatrix((prev) => ({
        ...prev,
        [targetRole]: prevPerms,
      }));
      showToast({
        message: err?.message || "Failed to update permission",
        isError: true,
      });
    } finally {
      setSavingCell(null);
    }
  };

  const handleCellClick = (
    targetRole: UserRole,
    roleLabel: string,
    permission: Permission,
    permLabel: string,
    currentlyEnabled: boolean
  ) => {
    if (!isEditable) return;
    if (
      targetRole === UserRole.SUPER_ADMIN &&
      SUPER_ADMIN_LOCKED_KEYS.has(permission)
    ) {
      return;
    }

    const nextEnabled = !currentlyEnabled;
    if (SENSITIVE_KEYS.has(permission)) {
      setPendingConfirm({
        targetRole,
        roleLabel,
        permission,
        permLabel,
        nextEnabled,
      });
      return;
    }

    void applyToggle(targetRole, permission, nextEnabled, true);
  };

  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    rowIdx: number,
    colIdx: number
  ) => {
    let nextRow = rowIdx;
    let nextCol = colIdx;

    if (e.key === "ArrowRight") nextCol = Math.min(DISPLAY_ROLES.length - 1, colIdx + 1);
    else if (e.key === "ArrowLeft") nextCol = Math.max(0, colIdx - 1);
    else if (e.key === "ArrowDown") nextRow = Math.min(ALL_PERMISSION_ROWS.length - 1, rowIdx + 1);
    else if (e.key === "ArrowUp") nextRow = Math.max(0, rowIdx - 1);
    else return;

    e.preventDefault();
    const targetBtn = cellRefs.current.get(`${nextRow}:${nextCol}`);
    targetBtn?.focus();
  };

  let runningRowIdx = 0;

  return (
    <div className="space-y-6">
      {/* Sub Header Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("MATRIX")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "MATRIX"
                ? "bg-[#12355B] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Permissions Matrix
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("FIELD_RULES")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "FIELD_RULES"
                ? "bg-[#12355B] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Field-Level Rules
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("CHANGELOG")}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
              activeTab === "CHANGELOG"
                ? "bg-[#12355B] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Role Changelog
          </button>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Role: {userRole} ({isEditable ? "Editable" : "Read-Only"})</span>
        </div>
      </div>

      {activeTab === "MATRIX" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs font-sans">
              <thead className="bg-slate-50 text-slate-800 font-bold sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4 min-w-[220px]">Permission</th>
                  {DISPLAY_ROLES.map((r) => (
                    <th key={r.role} className="py-3 px-2 text-center min-w-[90px]">
                      <div className="font-bold text-[11px] truncate">{r.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        ({userCounts[r.role] || 0} users)
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {PERMISSION_GROUPS.map((grp) => (
                  <React.Fragment key={grp.group}>
                    <tr className="bg-slate-100/70">
                      <td
                        colSpan={DISPLAY_ROLES.length + 1}
                        className="py-2 px-4 font-black text-slate-900 uppercase tracking-wider text-[11px]"
                      >
                        {grp.group}
                      </td>
                    </tr>
                    {grp.permissions.map((perm) => {
                      const rowIdx = runningRowIdx++;
                      return (
                        <tr key={perm.key} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{perm.label}</div>
                            <div className="text-[11px] text-slate-400 font-sans">{perm.desc}</div>
                          </td>
                          {DISPLAY_ROLES.map((r, colIdx) => {
                            const has = (matrix[r.role] || []).includes(perm.key);
                            const isLockedSafeguard =
                              r.role === UserRole.SUPER_ADMIN &&
                              SUPER_ADMIN_LOCKED_KEYS.has(perm.key);
                            const isDisabled = !isEditable || isLockedSafeguard;
                            const isSaving = savingCell === `${r.role}:${perm.key}`;

                            return (
                              <td key={r.role} className="py-2.5 px-2 text-center">
                                <button
                                  ref={(el) => {
                                    cellRefs.current.set(`${rowIdx}:${colIdx}`, el);
                                  }}
                                  type="button"
                                  role="switch"
                                  aria-checked={has}
                                  aria-label={`${perm.label} for ${r.label}`}
                                  data-role={r.role}
                                  data-permission={perm.key}
                                  disabled={isDisabled || isSaving}
                                  onClick={() =>
                                    handleCellClick(r.role, r.label, perm.key, perm.label, has)
                                  }
                                  onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                                  title={
                                    isLockedSafeguard
                                      ? "Safeguard: Super Admin retains core system controls"
                                      : !isEditable
                                      ? "Read-Only (Super Admin required)"
                                      : `Toggle ${perm.label} for ${r.label}`
                                  }
                                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition focus:outline-none focus:ring-2 focus:ring-[#12355B] focus:ring-offset-1 ${
                                    has
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-slate-100 text-slate-400"
                                  } ${
                                    isDisabled
                                      ? "opacity-75 cursor-not-allowed"
                                      : "cursor-pointer hover:scale-110"
                                  } ${isSaving ? "animate-pulse" : ""}`}
                                >
                                  {isLockedSafeguard ? (
                                    <Lock className="w-3 h-3 stroke-[2.2]" />
                                  ) : has ? (
                                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                  ) : (
                                    <X className="w-3 h-3 stroke-[2]" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "FIELD_RULES" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900">Field-Level Access Matrix</h2>
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <h3 className="font-bold text-amber-950 text-sm">Cashier (SHOP) &mdash; Party Edit Restrictions</h3>
              <p className="text-amber-900">
                Cashiers can view all parties, and can edit contact fields: <strong>Name, Phone, Address, Area</strong>.
                Sensitive fields (Credit Limit, Credit Permission, Price Tier A/B/C, GSTIN, Tally Ledger Reference) are strictly locked and can only be modified by Administrator or Accountant.
              </p>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
              <h3 className="font-bold text-purple-950 text-sm">PRO (Order Executive) &mdash; Isolation Rules</h3>
              <p className="text-purple-900">
                PRO executives can search parties, view buyer tier, and create new parties (auto-flagged <strong>needsReview: true</strong>).
                PROs can punch orders tagged as <strong>BOOKED_BY_PRO</strong> with their agent code. They have zero visibility into purchase rates, costs, profit margins, or orders booked by other PROs.
              </p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
              <h3 className="font-bold text-emerald-950 text-sm">Accountant (ACCOUNTS) &mdash; Administrative Parity</h3>
              <p className="text-emerald-900">
                Accountants possess full read/write access to products, price lists, stock adjustments, purchases (GRN), invoice creation and revisions, party ledger and collection. System security, user passwords, and role assignment remain exclusive to Super Admin and Admin.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "CHANGELOG" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900">Roles &amp; Permissions Changelog</h2>

          {changelog.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {changelog.map((item) => (
                <div
                  key={item.id}
                  data-testid="role-changelog-entry"
                  className="px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 bg-white"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-bold text-[10px] uppercase ${
                        item.afterEnabled
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {item.afterEnabled ? "Granted" : "Revoked"}
                    </span>
                    <span className="font-bold text-slate-900">{item.role}</span>
                    <span className="text-slate-400">·</span>
                    <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.permission}
                    </code>
                    <span className="text-slate-500">
                      ({item.beforeEnabled ? "ON" : "OFF"} → {item.afterEnabled ? "ON" : "OFF"})
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    By <strong className="text-slate-700">{item.actorName}</strong> ·{" "}
                    {new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 text-xs divide-y divide-slate-100">
            <div className="pt-2 space-y-1">
              <div className="font-bold text-purple-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <span>New Role: PRO (Order Executive)</span>
              </div>
              <p className="text-slate-600">
                Added dedicated order booking executive role with mobile app at <code>/app/pro</code>. Respects party price tiers and credit limits.
              </p>
            </div>

            <div className="pt-2 space-y-1">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Accountant (ACCOUNTS) Expanded Access</span>
              </div>
              <p className="text-slate-600">
                Granted full catalog, stock management, GRN, POS billing, invoice editing, and party CRUD access.
              </p>
            </div>

            <div className="pt-2 space-y-1">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <span>Cashier (SHOP) Expanded Access</span>
              </div>
              <p className="text-slate-600">
                Granted access to Purchases/GRN, Shop stock updates, contact editing for parties, and today&apos;s total sales figures.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sensitive Permission Confirmation Modal */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Sensitive Permission Change"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-sm text-slate-900">
                  Confirm Sensitive Permission Change
                </h3>
                <p className="text-xs text-slate-600">
                  Are you sure you want to{" "}
                  <strong>{pendingConfirm.nextEnabled ? "grant" : "revoke"}</strong>{" "}
                  <strong>{pendingConfirm.permLabel}</strong> for role{" "}
                  <strong>{pendingConfirm.roleLabel}</strong>?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const p = pendingConfirm;
                  setPendingConfirm(null);
                  void applyToggle(p.targetRole, p.permission, p.nextEnabled, true);
                }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#12355B] text-white hover:bg-[#0D2847]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Toast with Undo */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-3 text-xs font-bold ${
            toast.isError
              ? "bg-rose-900 text-white border-rose-700"
              : "bg-slate-900 text-white border-slate-700"
          }`}
        >
          <span>{toast.message}</span>
          {toast.undoPayload && (
            <button
              type="button"
              onClick={() => {
                const u = toast.undoPayload!;
                setToast(null);
                void applyToggle(u.targetRole, u.permission, u.enabled, false);
              }}
              className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-amber-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
