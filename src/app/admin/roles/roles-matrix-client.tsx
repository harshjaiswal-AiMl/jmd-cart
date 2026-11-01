"use client";

import React, { useState } from "react";
import { UserRole } from "@prisma/client";
import { Permission, ROLE_PERMISSIONS } from "@/modules/auth/permissions";
import { ShieldCheck, Check, X, Lock, Users, Info, ChevronRight } from "lucide-react";

interface RoleMatrixClientProps {
  userRole: UserRole;
  userCounts: Record<string, number>;
}

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

export function RolesMatrixClient({ userRole, userCounts }: RoleMatrixClientProps) {
  const [activeTab, setActiveTab] = useState<"MATRIX" | "FIELD_RULES" | "CHANGELOG">("MATRIX");

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
          <span>Role: {userRole} ({userRole === "SUPER_ADMIN" ? "Editable" : "Read-Only"})</span>
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
                    {grp.permissions.map((perm) => (
                      <tr key={perm.key} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900">{perm.label}</div>
                          <div className="text-[11px] text-slate-400 font-sans">{perm.desc}</div>
                        </td>
                        {DISPLAY_ROLES.map((r) => {
                          const has = ROLE_PERMISSIONS[r.role]?.includes(perm.key);
                          return (
                            <td key={r.role} className="py-2.5 px-2 text-center">
                              {has ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-800">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-300">
                                  <X className="w-3 h-3 stroke-[2]" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
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
          <h2 className="text-base font-bold text-slate-900">Roles &amp; Permissions Changelog (Prompt #18)</h2>
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
    </div>
  );
}
