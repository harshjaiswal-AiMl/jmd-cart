"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X } from "lucide-react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: "green" | "gray" | "blue" | "red" | "amber";
  inStock?: boolean;
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
  popoverWidthClass?: string;
  allowClear?: boolean;
  autoSortInStock?: boolean;
  required?: boolean;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Type to search...",
  disabled = false,
  name,
  className = "",
  popoverWidthClass = "w-full min-w-[280px]",
  allowClear = false,
  autoSortInStock = true,
  required = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filter and sort options
  const filteredOptions = useMemo(() => {
    let list = options;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) ||
          (opt.subLabel && opt.subLabel.toLowerCase().includes(q)) ||
          (opt.badge && opt.badge.toLowerCase().includes(q))
      );
    }

    if (autoSortInStock) {
      // Sort in-stock before out-of-stock, keeping original sequence within each group
      list = [...list].sort((a, b) => {
        const aStock = a.inStock === undefined ? 1 : a.inStock ? 1 : 0;
        const bStock = b.inStock === undefined ? 1 : b.inStock ? 1 : 0;
        if (aStock !== bStock) {
          return bStock - aStock; // 1 before 0
        }
        return 0;
      });
    }

    return list;
  }, [options, search, autoSortInStock]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const renderBadge = (badge: string, color?: "green" | "gray" | "blue" | "red" | "amber") => {
    let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
    if (color === "green") colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (color === "blue") colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    if (color === "red") colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    if (color === "amber") colorClass = "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${colorClass}`}>
        {badge}
      </span>
    );
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for native form compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required && !value}
        />
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setSearch("");
          }
        }}
        className={`w-full text-left text-xs font-medium py-2 px-3 border rounded-lg flex items-center justify-between gap-2 transition shadow-sm ${
          disabled
            ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
            : isOpen
            ? "bg-white border-blue-600 ring-2 ring-blue-100 text-gray-900"
            : "bg-white border-gray-300 text-gray-900 hover:border-gray-400 hover:bg-gray-50/50"
        }`}
      >
        <div className="truncate flex items-center gap-1.5 flex-1 min-w-0">
          {selectedOption ? (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-gray-900 truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <span className="text-[11px] text-gray-500 truncate shrink-0">
                  {selectedOption.subLabel}
                </span>
              )}
              {selectedOption.badge &&
                renderBadge(selectedOption.badge, selectedOption.badgeColor)}
            </div>
          ) : (
            <span className="text-gray-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-gray-400">
          {allowClear && value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:text-gray-700 hover:bg-gray-100 rounded"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute z-50 left-0 mt-1.5 bg-white border border-gray-200 rounded-xl shadow-xl p-2 space-y-2 animate-in fade-in-0 zoom-in-95 duration-100 ${popoverWidthClass}`}
        >
          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setIsOpen(false);
                } else if (e.key === "Enter" && filteredOptions.length > 0) {
                  e.preventDefault();
                  handleSelect(filteredOptions[0].value);
                }
              }}
              className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium bg-gray-50/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100 overscroll-contain">
            {filteredOptions.length === 0 ? (
              <div className="text-xs text-gray-500 py-6 text-center">
                No matches found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                const isOos = opt.inStock === false;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left p-2.5 transition flex items-center justify-between gap-2 text-xs ${
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-semibold"
                        : isOos
                        ? "opacity-60 bg-gray-50/70 hover:bg-gray-100/80 text-gray-700"
                        : "hover:bg-gray-50 text-gray-800"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && renderBadge(opt.badge, opt.badgeColor)}
                      </div>
                      {opt.subLabel && (
                        <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
