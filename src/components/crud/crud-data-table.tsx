"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CrudEntityConfig } from "@/modules/crud/crud.registry";
import {
  crudCreateAction,
  crudUpdateAction,
  crudDeleteOrArchiveAction,
  crudRestoreAction,
} from "@/app/admin/crud/actions";

interface CrudDataTableProps {
  config: CrudEntityConfig;
  initialRecords: Array<Record<string, unknown>>;
  canWrite: boolean;
  initialShowArchived?: boolean;
}

export function CrudDataTable({
  config,
  initialRecords,
  canWrite,
  initialShowArchived = false,
}: CrudDataTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(initialShowArchived);
  const [sortKey, setSortKey] = useState<string>(config.fields[0]?.key || "id");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const listFields = useMemo(
    () => config.fields.filter((f) => f.showInList !== false),
    [config.fields]
  );
  const formFields = useMemo(
    () => config.fields.filter((f) => f.showInForm !== false),
    [config.fields]
  );

  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Drawer state for Create / Edit
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});

  // Confirm Delete / Archive / Void dialog state
  const [confirmTarget, setConfirmTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRecords
      .filter((r) => {
        if (!showArchived && r.archived) return false;
        if (!q) return true;
        return Object.values(r).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q)
        );
      })
      .sort((a, b) => {
        const va = a[sortKey];
        const vb = b[sortKey];
        if (typeof va === "number" && typeof vb === "number") {
          return sortAsc ? va - vb : vb - va;
        }
        const sa = String(va ?? "").toLowerCase();
        const sb = String(vb ?? "").toLowerCase();
        return sortAsc ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
  }, [initialRecords, search, showArchived, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const paginatedRecords = useMemo(
    () => filteredRecords.slice((page - 1) * pageSize, page * pageSize),
    [filteredRecords, page]
  );

  const openCreateDrawer = () => {
    const defaults: Record<string, unknown> = {};
    for (const f of formFields) {
      if (f.type === "boolean") defaults[f.key] = true;
      else if (f.type === "number" || f.type === "rupees") defaults[f.key] = 0;
      else if (f.type === "select" && f.options?.[0])
        defaults[f.key] = f.options[0].value;
      else defaults[f.key] = "";
    }
    setEditingId(null);
    setFormValues(defaults);
    setDrawerOpen(true);
    setBanner(null);
  };

  const openEditDrawer = (row: Record<string, unknown>) => {
    setEditingId(String(row.id));
    setFormValues({ ...row });
    setDrawerOpen(true);
    setBanner(null);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    startTransition(async () => {
      const res = editingId
        ? await crudUpdateAction(config.key, editingId, formValues)
        : await crudCreateAction(config.key, formValues);

      if (!res.success) {
        setBanner({ type: "error", text: res.error || "Operation failed" });
      } else {
        setBanner({
          type: "success",
          text: editingId
            ? `${config.singularTitle} updated and logged in Audit Log.`
            : `${config.singularTitle} created and logged in Audit Log.`,
        });
        setDrawerOpen(false);
        router.refresh();
      }
    });
  };

  const handleConfirmDeleteOrArchive = () => {
    if (!confirmTarget) return;
    setBanner(null);

    startTransition(async () => {
      const res = await crudDeleteOrArchiveAction(
        config.key,
        confirmTarget.id,
        voidReason
      );

      if (!res.success) {
        setBanner({
          type: "error",
          text: res.error || "Failed to delete/archive record",
        });
      } else {
        const actionWord =
          "action" in res ? res.action : "ARCHIVED";
        setBanner({
          type: "success",
          text: `${config.singularTitle} ${actionWord} (logged in Audit Log).`,
        });
        setConfirmTarget(null);
        setVoidReason("");
        router.refresh();
      }
    });
  };

  const handleRestore = (id: string) => {
    setBanner(null);
    startTransition(async () => {
      const res = await crudRestoreAction(config.key, id);
      if (!res.success) {
        setBanner({
          type: "error",
          text: res.error || "Failed to restore record",
        });
      } else {
        setBanner({
          type: "success",
          text: `${config.singularTitle} restored to active state.`,
        });
        router.refresh();
      }
    });
  };

  const handleExportCsv = () => {
    const visibleCols = listFields.filter((f) => !hiddenCols[f.key]);
    const header = visibleCols.map((c) => `"${c.label}"`).join(",");
    const lines = filteredRecords.map((r) =>
      visibleCols
        .map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jmd_${config.key}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`Search ${config.title}...`}
            className="w-full sm:w-72 rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-medium"
          />

          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => {
                setShowArchived(e.target.checked);
                const url = new URL(window.location.href);
                if (e.target.checked) url.searchParams.set("archived", "1");
                else url.searchParams.delete("archived");
                router.push(url.pathname + url.search);
              }}
              className="rounded border-gray-300 text-[#790E11]"
            />
            Show Archived / Voided
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-800 transition"
          >
            ⬇ Export CSV
          </button>

          {canWrite && config.allowCreate && (
            <button
              type="button"
              onClick={openCreateDrawer}
              className="px-4 py-2 rounded-xl bg-[#790E11] hover:bg-[#5f0b0d] text-white text-xs font-bold shadow-xs transition"
            >
              + Add {config.singularTitle}
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-bold ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          {banner.text}
        </div>
      )}

      {/* Column Visibility Bar */}
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600 px-1">
        <span className="font-bold uppercase text-gray-400">Columns:</span>
        {listFields.map((col) => (
          <button
            key={col.key}
            type="button"
            onClick={() =>
              setHiddenCols((prev) => ({ ...prev, [col.key]: !prev[col.key] }))
            }
            className={`px-2 py-0.5 rounded-md border font-semibold transition ${
              !hiddenCols[col.key]
                ? "bg-white border-gray-300 text-gray-800"
                : "bg-gray-100 border-gray-200 text-gray-400 line-through"
            }`}
          >
            {col.label}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      paginatedRecords.length > 0 &&
                      paginatedRecords.every((r) =>
                        selectedIds.has(String(r.id))
                      )
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(
                          new Set(paginatedRecords.map((r) => String(r.id)))
                        );
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                  />
                </th>
                {listFields
                  .filter((f) => !hiddenCols[f.key])
                  .map((f) => (
                    <th
                      key={f.key}
                      onClick={() => {
                        if (sortKey === f.key) setSortAsc(!sortAsc);
                        else {
                          setSortKey(f.key);
                          setSortAsc(true);
                        }
                      }}
                      className="py-3 px-3 font-bold cursor-pointer hover:text-gray-900 select-none"
                    >
                      {f.label}{" "}
                      {sortKey === f.key ? (sortAsc ? "↑" : "↓") : ""}
                    </th>
                  ))}
                <th className="py-3 px-3 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={listFields.length + 2}
                    className="py-10 text-center text-gray-500 font-medium"
                  >
                    No {config.title.toLowerCase()} found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row) => {
                  const id = String(row.id);
                  const isArchived = Boolean(row.archived);

                  return (
                    <tr
                      key={id}
                      className={`hover:bg-orange-50/30 transition ${
                        isArchived ? "bg-gray-50 text-gray-400" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(id)}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(id);
                            else next.delete(id);
                            setSelectedIds(next);
                          }}
                        />
                      </td>
                      {listFields
                        .filter((f) => !hiddenCols[f.key])
                        .map((f) => {
                          const val = row[f.key];
                          return (
                            <td key={f.key} className="py-2.5 px-3 font-medium">
                              {f.type === "rupees" ? (
                                <span className="font-mono font-bold">
                                  ₹{Number(val || 0).toFixed(2)}
                                </span>
                              ) : f.type === "boolean" ? (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    val
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-gray-200 text-gray-700"
                                  }`}
                                >
                                  {val ? "Yes" : "No"}
                                </span>
                                ) : val === null ||
                                  val === undefined ||
                                  String(val).trim() === "" ? (
                                  <span className="text-gray-400">—</span>
                                ) : f.key === "agentCode" ? (
                                  val ? (
                                    <span className="font-mono text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                      {String(val)}
                                    </span>
                                  ) : ["SHOP", "SALESPERSON", "DELIVERY", "GODOWN", "ACCOUNTS"].includes(String(row.role)) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-semibold" title="Staff lacks an incentive agent code">
                                      ⚠️ Missing Code
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )
                                ) : f.key === "gstin" ? (
                                  <span className="font-mono text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                                    {String(val)}
                                  </span>
                                ) : f.key === "contactPhone" ||
                                  f.key === "phone" ? (
                                  <span className="font-mono text-xs font-semibold text-gray-800">
                                    {String(val)}
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            );
                          })}

                      <td className="py-2.5 px-3 text-right space-x-2 whitespace-nowrap">
                        {canWrite ? (
                          <>
                            {config.allowEdit && (
                              <button
                                type="button"
                                onClick={() => openEditDrawer(row)}
                                className="text-[#790E11] hover:underline font-bold"
                              >
                                Edit
                              </button>
                            )}
                            {isArchived ? (
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleRestore(id)}
                                className="text-emerald-700 hover:underline font-bold"
                              >
                                Restore
                              </button>
                            ) : (
                              config.deletePolicy !== "READ_ONLY" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmTarget({
                                      id,
                                      label: String(
                                        row.name ||
                                          row.title ||
                                          row.orderNo ||
                                          row.billNo ||
                                          row.receiptNo ||
                                          id
                                      ),
                                    })
                                  }
                                  className="text-red-700 hover:underline font-bold"
                                >
                                  {config.deletePolicy === "VOID_WITH_REASON"
                                    ? "Void / Cancel"
                                    : "Delete / Archive"}
                                </button>
                              )
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400 text-[11px] font-semibold">
                            Read-only
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-gray-50 px-4 py-2.5 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
          <span>
            Showing {paginatedRecords.length} of {filteredRecords.length}{" "}
            record(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-bold"
            >
              Prev
            </button>
            <span className="font-bold">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded border border-gray-300 bg-white disabled:opacity-40 font-bold"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create / Edit Form Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setDrawerOpen(false)}
          />
          <form
            onSubmit={handleSaveForm}
            className="relative w-full max-w-md bg-white h-full shadow-2xl z-10 flex flex-col"
          >
            <div className="p-5 bg-[#790E11] text-white flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide">
                {editingId
                  ? `Edit ${config.singularTitle}`
                  : `New ${config.singularTitle}`}
              </h3>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="text-white/80 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {formFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                    {field.label} {field.required && "*"}
                  </label>
                  {field.type === "select" ? (
                    <select
                      required={field.required}
                      value={String(formValues[field.key] ?? "")}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "boolean" ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-800">
                      <input
                        type="checkbox"
                        checked={Boolean(formValues[field.key])}
                        onChange={(e) =>
                          setFormValues({
                            ...formValues,
                            [field.key]: e.target.checked,
                          })
                        }
                      />
                      Enabled
                    </label>
                  ) : (
                    <input
                      type={
                        field.type === "number" || field.type === "rupees"
                          ? "number"
                          : field.type === "password"
                          ? "password"
                          : "text"
                      }
                      step={field.type === "rupees" ? "0.01" : "1"}
                      required={field.required && !editingId}
                      value={String(formValues[field.key] ?? "")}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          [field.key]:
                            field.type === "number" || field.type === "rupees"
                              ? Number(e.target.value)
                              : e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2 rounded-xl bg-[#075828] hover:bg-emerald-900 text-white text-xs font-bold disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Record"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete / Archive / Void Dialog */}
      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setConfirmTarget(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl p-6 z-10 space-y-4">
            <h3 className="text-base font-bold text-gray-900">
              {config.deletePolicy === "VOID_WITH_REASON"
                ? `Cancel / Void ${config.singularTitle}`
                : `Delete or Archive ${config.singularTitle}`}
            </h3>
            <p className="text-xs text-gray-600">
              Target: <strong>{confirmTarget.label}</strong>.{" "}
              {config.deletePolicy === "ARCHIVE_OR_HARD_IF_UNREFERENCED"
                ? "If this record is referenced in ledger/invoices/orders, it will be safely ARCHIVED (hidden from pickers, kept in history). If it has zero references, it will be permanently deleted."
                : config.deletePolicy === "VOID_WITH_REASON"
                ? "Accounting records are never hard-deleted. This will mark the record as VOIDED/CANCELLED and reverse any stock movements."
                : "This record will be permanently removed."}
            </p>

            {config.deletePolicy === "VOID_WITH_REASON" && (
              <div>
                <label className="block text-xs font-bold uppercase text-gray-700 mb-1">
                  Mandatory Reason for Audit Log *
                </label>
                <input
                  type="text"
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Enter reason (min 3 characters)..."
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700"
              >
                Keep Record
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirmDeleteOrArchive}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isPending
                  ? "Processing..."
                  : config.deletePolicy === "VOID_WITH_REASON"
                  ? "Confirm Void"
                  : "Confirm Delete / Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
