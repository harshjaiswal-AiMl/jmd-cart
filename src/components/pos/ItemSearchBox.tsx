"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search } from "lucide-react";
import {
  searchItems,
  buildProductSearchIndex,
  SearchableProduct,
  SearchIndexItem,
} from "@/lib/search/smart-search";

interface ItemSearchBoxProps {
  products: SearchableProduct[];
  onSelect: (product: SearchableProduct) => void;
  onHighlight?: (product: SearchableProduct | null) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export function ItemSearchBox({
  products,
  onSelect,
  onHighlight,
  inputRef,
  placeholder = "Search items by name, weight, code... (e.g. 'bhuj 400')",
  className = "",
  autoFocus = false,
}: ItemSearchBoxProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedRef = inputRef || internalInputRef;

  // Pre-build index once in memory
  const searchIndex: SearchIndexItem[] = useMemo(() => {
    return buildProductSearchIndex(products);
  }, [products]);

  // Execute fast smart search on term change
  const results = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return searchItems(searchTerm, searchIndex, { limit: 15 });
  }, [searchTerm, searchIndex]);

  // Keep dropdown open when there are results
  useEffect(() => {
    if (results.length > 0) {
      setIsOpen(true);
      setSelectedIndex(0);
      if (onHighlight) {
        onHighlight(results[0] || null);
      }
    } else {
      setIsOpen(false);
      if (onHighlight) {
        onHighlight(null);
      }
    }
  }, [results, onHighlight]);

  // Update highlighted item when selection index changes
  const handleIndexChange = (newIdx: number) => {
    setSelectedIndex(newIdx);
    if (onHighlight && results[newIdx]) {
      onHighlight(results[newIdx]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (results.length > 0) {
        e.preventDefault();
        const nextIdx = (selectedIndex + 1) % results.length;
        handleIndexChange(nextIdx);
      }
    } else if (e.key === "ArrowUp") {
      if (results.length > 0) {
        e.preventDefault();
        const prevIdx = (selectedIndex - 1 + results.length) % results.length;
        handleIndexChange(prevIdx);
      }
    } else if (e.key === "Enter") {
      if (results.length > 0) {
        e.preventDefault();
        const chosen = results[selectedIndex] || results[0];
        if (chosen) {
          onSelect(chosen);
          setSearchTerm("");
          setIsOpen(false);
        }
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={resolvedRef}
          type="text"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="w-full pl-9 sm:pl-11 pr-20 py-2 sm:py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a] focus:border-[#0f172a] shadow-2xs transition font-sans"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setIsOpen(false);
                if (onHighlight) onHighlight(null);
              }}
              className="p-1 text-slate-400 hover:text-slate-600 text-xs font-black mr-0.5"
            >
              ✕
            </button>
          )}
          <span className="hidden sm:inline-block font-mono text-[10px] font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            Ctrl+K
          </span>
        </div>
      </div>

      {/* Busy-Style Minimal Autocomplete Dropdown (Part C) */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-72 overflow-y-auto divide-y divide-slate-100 font-sans">
          {results.map((p, pIdx) => {
            const isHighlighted = pIdx === selectedIndex;
            const inStock = (p.shopStockQty ?? 0) + (p.godownStockQty ?? 0) > 0;
            const weightText = p.weight ? ` ${p.weight}` : (p.weightValue ? ` ${p.weightValue}${p.weightUnit || "g"}` : "");
            const fullTitle = `${p.name}${weightText}`;

            return (
              <div
                key={p.id}
                onMouseEnter={() => handleIndexChange(pIdx)}
                onClick={() => {
                  onSelect(p);
                  setSearchTerm("");
                  setIsOpen(false);
                }}
                className={`px-3 py-2 sm:py-2.5 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition ${
                  isHighlighted
                    ? "bg-[#0f172a] text-white font-semibold"
                    : "bg-white text-slate-900 hover:bg-slate-50"
                }`}
              >
                {/* Left: Item name + weight plain text */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{fullTitle}</span>
                  {!inStock && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                        isHighlighted
                          ? "bg-rose-950 text-rose-200 border border-rose-800"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      Out
                    </span>
                  )}
                </div>

                {/* Right: Company / Brand in muted text */}
                <div
                  className={`text-xs shrink-0 ml-3 ${
                    isHighlighted ? "text-slate-300" : "text-slate-500 font-medium"
                  }`}
                >
                  {p.companyName || "Generic"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
