"use client";

import React, { useState, useEffect } from "react";

const DEFAULT_PACK_LABELS = [
  "Carton",
  "Pcs",
  "Bag",
  "Box",
  "Case",
  "Tin",
  "Jar",
  "Bucket",
  "Bora",
];

interface PackLabelSelectorProps {
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  allowUnchanged?: boolean;
}

export function PackLabelSelector({
  name = "packLabel",
  id,
  value: controlledValue,
  defaultValue = "Carton",
  onChange,
  required = false,
  className = "",
  allowUnchanged = false,
}: PackLabelSelectorProps) {
  const [options, setOptions] = useState<string[]>(() => {
    const list = [...DEFAULT_PACK_LABELS];
    const initial = controlledValue ?? defaultValue;
    if (initial && !list.includes(initial) && initial !== "__ADD_CUSTOM__" && initial !== "") {
      list.push(initial);
    }
    return list;
  });

  const [currentVal, setCurrentVal] = useState<string>(() => {
    return controlledValue !== undefined ? controlledValue : defaultValue;
  });

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  useEffect(() => {
    if (controlledValue !== undefined) {
      setCurrentVal(controlledValue);
      if (controlledValue && !options.includes(controlledValue) && controlledValue !== "") {
        setOptions((prev) => [...prev, controlledValue]);
      }
    }
  }, [controlledValue]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__ADD_CUSTOM__") {
      setIsAddingCustom(true);
      setCustomInput("");
    } else {
      setIsAddingCustom(false);
      setCurrentVal(val);
      onChange?.(val);
    }
  };

  const handleApplyCustom = (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const trimmed = customInput.trim();
    if (!trimmed) {
      setIsAddingCustom(false);
      return;
    }
    if (!options.includes(trimmed)) {
      setOptions((prev) => [...prev, trimmed]);
    }
    setCurrentVal(trimmed);
    onChange?.(trimmed);
    setIsAddingCustom(false);
    setCustomInput("");
  };

  const handleCancelCustom = () => {
    setIsAddingCustom(false);
    setCustomInput("");
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {!isAddingCustom ? (
        <div className="relative">
          <select
            name={name}
            id={id}
            value={currentVal}
            onChange={handleSelectChange}
            required={required}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-1 focus:ring-[#790E11] focus:border-[#790E11]"
          >
            {allowUnchanged && <option value="">-- Keep Unchanged --</option>}
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="__ADD_CUSTOM__" className="font-bold text-[#790E11] bg-amber-50">
              ➕ + Add Custom Pack Label...
            </option>
          </select>
        </div>
      ) : (
        <div className="mt-1 flex items-center gap-1.5 animate-in fade-in duration-150">
          <input
            type="text"
            autoFocus
            placeholder="e.g. Cartoon, Tray, Pouch, Roll"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleApplyCustom();
              } else if (e.key === "Escape") {
                e.preventDefault();
                handleCancelCustom();
              }
            }}
            className="flex-1 px-3 py-2 border border-[#790E11] rounded-lg text-sm bg-amber-50/30 focus:ring-1 focus:ring-[#790E11] focus:border-[#790E11]"
          />
          <button
            type="button"
            onClick={handleApplyCustom}
            disabled={!customInput.trim()}
            className="px-3 py-2 bg-[#790E11] hover:bg-[#5E0A0D] text-white text-xs font-bold rounded-lg shadow-sm disabled:opacity-50 transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleCancelCustom}
            className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg border border-gray-200 transition-colors"
            title="Cancel"
          >
            ✕
          </button>
          {/* Fallback hidden input to guarantee form data has the custom value on direct submit */}
          <input type="hidden" name={name} value={customInput.trim() || currentVal} />
        </div>
      )}
    </div>
  );
}
