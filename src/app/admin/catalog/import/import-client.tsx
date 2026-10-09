"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { importCatalogAction, ImportActionResult } from "./actions";
import Link from "next/link";

const SAMPLE_CSV = `name,shortCode,company,category,hsn,gstRate,mrp,packSize,packLabel,reorderLevel
Bikaji Bhujia 400g,BIK-BHU-400,Bikaji,Snacks,21069099,12,110,24,Carton,48
MDH Deggi Mirch 100g,MDH-DEG-100,MDH,Spices,09042010,5,95,24,Carton,48
India Gate Basmati 5kg,IG-BAS-5K,India Gate,Grains,10063020,5,650,4,Bag,20
Engine Mustard Oil 1L,ENG-OIL-1L,Engine,Edible Oils,15149100,5,175,15,Tin,30`;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
    >
      {pending ? "Processing Import..." : "Import Products"}
    </button>
  );
}

export function CatalogImportClient() {
  const [activeTab, setActiveTab] = useState<"file" | "paste">("file");
  const [rawText, setRawText] = useState("");

  const [state, formAction] = useFormState<ImportActionResult | undefined, FormData>(
    importCatalogAction,
    undefined
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/catalog"
          className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          ← Back to Catalog
        </Link>
      </div>

      {/* Import Form Card */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Upload Product Master CSV</h2>
          <p className="text-sm text-gray-500">
            Upload a spreadsheet or Tally product export (.csv). Existing products with matching short codes will be updated automatically.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("file")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "file"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Upload CSV File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "paste"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Paste CSV Text
          </button>
        </div>

        {state?.error && (
          <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {activeTab === "file" ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              <p className="mt-2 text-xs text-gray-400">Select any CSV file formatted with headers</p>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  CSV Text
                </label>
                <button
                  type="button"
                  onClick={() => setRawText(SAMPLE_CSV)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Load Sample CSV
                </button>
              </div>
              <textarea
                name="rawText"
                rows={8}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste CSV rows here..."
                className="w-full font-mono text-xs p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          <div className="flex justify-end pt-2">
            <SubmitButton />
          </div>
        </form>
      </div>

      {/* Import Results Banner */}
      {state?.result && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Import Summary</h3>
              <p className="text-xs text-gray-500">Processed in {state.result.durationMs}ms</p>
            </div>
            <span
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                state.result.failedCount === 0
                  ? "bg-green-100 text-green-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {state.result.failedCount === 0 ? "100% Success" : "Completed with errors"}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-xs text-gray-500 block uppercase">Total Rows</span>
              <span className="text-xl font-bold text-gray-900">{state.result.totalRows}</span>
            </div>
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <span className="text-xs text-green-700 block uppercase">Created</span>
              <span className="text-xl font-bold text-green-800">{state.result.importedCount}</span>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
              <span className="text-xs text-blue-700 block uppercase">Updated</span>
              <span className="text-xl font-bold text-blue-800">{state.result.updatedCount}</span>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
              <span className="text-xs text-red-700 block uppercase">Failed</span>
              <span className="text-xl font-bold text-red-800">{state.result.failedCount}</span>
            </div>
          </div>

          {/* Row Errors Table */}
          {state.result.errors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-red-800">Row-Level Errors to Resolve</h4>
              <div className="overflow-x-auto border border-red-200 rounded-lg">
                <table className="min-w-full divide-y divide-red-200 text-xs">
                  <thead className="bg-red-50 text-red-900 text-left font-semibold">
                    <tr>
                      <th className="px-3 py-2">Row #</th>
                      <th className="px-3 py-2">Column</th>
                      <th className="px-3 py-2">Provided Value</th>
                      <th className="px-3 py-2">Error Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100 bg-white">
                    {state.result.errors.map((err, idx) => (
                      <tr key={idx} className="hover:bg-red-50/50">
                        <td className="px-3 py-2 font-mono font-bold text-red-700">Row {err.rowNumber}</td>
                        <td className="px-3 py-2 font-mono text-gray-700">{err.field || "—"}</td>
                        <td className="px-3 py-2 font-mono text-gray-500">{err.value || "—"}</td>
                        <td className="px-3 py-2 text-red-700 font-medium">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
