"use client";

import { useState } from "react";
import Link from "next/link";
import { importPartiesFromTallyAction } from "../actions";
import { TallyPartyImportResult } from "@/modules/party/party.types";

export function PartyImportClient() {
  const [tab, setTab] = useState<"upload" | "paste">("paste");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TallyPartyImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rawText.trim()) {
      setErrorMessage("Please select a file or paste CSV text first.");
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setResult(null);

    const res = await importPartiesFromTallyAction(rawText);

    if (res.success && res.data) {
      setResult(res.data);
    } else {
      setErrorMessage(res.error || "Import failed. Please check the CSV format.");
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Import Parties from Tally ERP / Prime</h2>
          <p className="text-sm text-gray-600 mt-1">
            Seamlessly import your party master (Sundry Debtors & Sundry Creditors) from Tally exports.
            Existing parties are matched by Tally Ref or Mobile Number, ensuring idempotent, duplicate-free re-runs.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setTab("paste")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === "paste"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Paste CSV Text
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              tab === "upload"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Upload CSV File
          </button>
        </div>

        {tab === "paste" ? (
          <div>
            <textarea
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste comma-separated party records here..."
              className="w-full p-3 font-mono text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
              <div className="text-3xl">📄</div>
              <div className="text-sm font-medium text-gray-700">
                {fileName ? fileName : "Click to select a CSV file from Tally"}
              </div>
              <p className="text-xs text-gray-500">Supports comma, semicolon, or tab-delimited files</p>
            </label>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Link
            href="/admin/parties"
            className="text-xs font-medium text-gray-600 hover:text-gray-900"
          >
            ← Back to Party Directory
          </Link>
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shadow-sm disabled:opacity-50"
          >
            {loading ? "Importing & Validating..." : "Import Parties"}
          </button>
        </div>
      </div>

      {/* Import Result Diagnostics */}
      {result && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <h3 className="text-base font-semibold text-gray-900">Import Summary</h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-3 rounded border border-gray-200">
              <p className="text-xs text-gray-500">Total Rows</p>
              <p className="text-xl font-bold text-gray-900">{result.total}</p>
            </div>
            <div className="bg-green-50 p-3 rounded border border-green-200">
              <p className="text-xs text-green-700 font-medium">New Parties Created</p>
              <p className="text-xl font-bold text-green-700">{result.created}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-xs text-blue-700 font-medium">Existing Updated</p>
              <p className="text-xl font-bold text-blue-700">{result.updated}</p>
            </div>
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <p className="text-xs text-red-700 font-medium">Failed / Skipped</p>
              <p className="text-xl font-bold text-red-700">{result.failed}</p>
            </div>
          </div>

          {result.errors.length > 0 ? (
            <div className="space-y-2 mt-4">
              <h4 className="text-sm font-semibold text-red-800">
                Validation & Parsing Diagnostics ({result.errors.length})
              </h4>
              <div className="overflow-x-auto border border-red-200 rounded">
                <table className="min-w-full divide-y divide-red-200 text-xs">
                  <thead className="bg-red-50 text-red-900 font-semibold">
                    <tr>
                      <th className="px-3 py-2 text-left">Row #</th>
                      <th className="px-3 py-2 text-left">Column</th>
                      <th className="px-3 py-2 text-left">Given Value</th>
                      <th className="px-3 py-2 text-left">Issue / Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {result.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50">
                        <td className="px-3 py-2 font-mono font-medium text-gray-800">{err.row}</td>
                        <td className="px-3 py-2 text-gray-700">{err.column || "-"}</td>
                        <td className="px-3 py-2 font-mono text-gray-600">{err.value || "-"}</td>
                        <td className="px-3 py-2 text-red-700 font-medium">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded text-sm font-medium">
              All parties imported and reconciled successfully with zero errors!
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Link
              href="/admin/parties"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-medium"
            >
              View Parties Directory →
            </Link>
          </div>
        </div>
      )}

      {/* Format Reference Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-xs text-blue-900 space-y-3">
        <h3 className="font-bold text-sm text-blue-950">Tally Column Mapping Guide</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-blue-800">
          <div>
            <p className="font-semibold text-blue-950">Supported Tally Aliases:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li><strong>Name:</strong> <code>name</code>, <code>ledger name</code>, <code>party name</code></li>
              <li><strong>Type / Group:</strong> <code>parent</code>, <code>group</code> (Sundry Debtors / Creditors)</li>
              <li><strong>Contact:</strong> <code>phone</code>, <code>mobile</code>, <code>contact</code></li>
              <li><strong>Tax ID:</strong> <code>gstin</code>, <code>gstin/uin</code></li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-blue-950">Credit & Balances:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li><strong>Credit Limit:</strong> <code>credit limit</code>, <code>limit</code> (in ₹)</li>
              <li><strong>Credit Period:</strong> <code>credit days</code>, <code>credit period</code> (in days)</li>
              <li><strong>Opening Balance:</strong> <code>opening balance</code> (e.g. <code>12000 Dr</code> or <code>5000 Cr</code>)</li>
              <li><strong>Tally Alias:</strong> <code>tally ref</code>, <code>guid</code>, <code>alias</code></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
