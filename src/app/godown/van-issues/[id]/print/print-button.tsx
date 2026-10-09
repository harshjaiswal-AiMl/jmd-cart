"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-semibold shadow-sm"
    >
      🖨️ Print Load Sheet
    </button>
  );
}
