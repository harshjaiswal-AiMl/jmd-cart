"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, FileText, X, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createBillScanAction } from "../actions";

interface LocationOption {
  id: string;
  name: string;
  type: string;
}

interface CompanyOption {
  id: string;
  name: string;
  supplierPartyId?: string | null;
}

interface ScanUploadFormProps {
  locations: LocationOption[];
  companies: CompanyOption[];
}

export function ScanUploadForm({ locations, companies }: ScanUploadFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [locationId, setLocationId] = useState<string>(locations[0]?.id || "");
  const [companyId, setCompanyId] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    setSelectedFiles((prev) => [...prev, ...filesArray]);

    // Create object URLs for preview
    const newPreviews = filesArray.map((f) => {
      if (f.type.startsWith("image/")) {
        return URL.createObjectURL(f);
      }
      return ""; // PDF indicator
    });
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFiles.length === 0) {
      setError("Please take at least one photo of the bill or upload a PDF document.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("locationId", locationId);

      const comp = companies.find((c) => c.id === companyId);
      if (companyId) {
        formData.set("companyId", companyId);
        if (comp?.supplierPartyId) {
          formData.set("supplierPartyId", comp.supplierPartyId);
        }
      }

      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await createBillScanAction(formData);
      if (res.error) {
        setError(res.error);
      } else if (res.scanId) {
        router.push(`/godown/receive-goods/${res.scanId}`);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
        {/* Top Controls: Location & Supplier */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Receiving Location <span className="text-red-500">*</span>
            </label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Supplier / Brand (Optional)
            </label>
            <select
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Auto-Detect from Bill (or select)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 mt-1">
              Selecting the brand speeds up OCR and pre-filters product matches.
            </p>
          </div>
        </div>

        {/* Capture / Upload Area */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
            Supplier Bill Photos or PDF <span className="text-red-500">*</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="bill-file-input"
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 p-6 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-2 text-blue-700 transition active:scale-99"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Camera className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-bold">Take Photo with Phone Camera</span>
              <span className="text-xs text-blue-500">Hold steady in good light</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 p-6 border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100/80 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-700 transition active:scale-99"
            >
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <Upload className="w-6 h-6 text-gray-600" />
              </div>
              <span className="text-sm font-bold">Upload Photos or PDF File</span>
              <span className="text-xs text-gray-500">Select multi-page images or PDF</span>
            </button>
          </div>
        </div>

        {/* Selected Files Thumbnails */}
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-gray-700">
              Captured Pages ({selectedFiles.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="relative group border border-gray-200 rounded-xl overflow-hidden bg-gray-100 p-2 text-center"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white hover:bg-red-600 transition z-10"
                    title="Remove page"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>

                  {previews[idx] ? (
                    <img
                      src={previews[idx]}
                      alt={`Page ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center gap-1 text-gray-500">
                      <FileText className="w-8 h-8 text-rose-600" />
                      <span className="text-[11px] font-mono truncate max-w-[120px]">
                        {file.name}
                      </span>
                    </div>
                  )}
                  <div className="mt-1 text-[11px] font-bold text-gray-700">
                    Page {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Bar */}
        <div className="pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <Link
            href="/godown/receive-goods"
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Cancel
          </Link>

          <button
            type="submit"
            disabled={isPending || selectedFiles.length === 0}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
          >
            {isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Reading Bill &amp; OCR Parsing...
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                Process Bill (Offline OCR) →
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
