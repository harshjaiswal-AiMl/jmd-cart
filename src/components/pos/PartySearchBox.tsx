"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, UserPlus, Phone, MapPin, X, Building, Store, User } from "lucide-react";
import { searchParties, SearchableParty, formatPartyBalance } from "@/lib/search/party-search";

export interface PartySearchBoxProps<T extends SearchableParty> {
  parties: T[];
  selectedPartyId: string;
  onSelect: (party: T) => void;
  onAddNewParty?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function PartySearchBox<T extends SearchableParty>({
  parties,
  selectedPartyId,
  onSelect,
  onAddNewParty,
  placeholder = "Search party by name, phone, city, GSTIN... [Alt+P]",
  className = "",
  disabled = false,
}: PartySearchBoxProps<T>) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedParty = useMemo(
    () => parties.find((p) => p.id === selectedPartyId) || null,
    [parties, selectedPartyId]
  );

  // Search results
  const results = useMemo(() => {
    return searchParties(query, parties, 20);
  }, [query, parties]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global Alt+P shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset selectedIndex when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleSelect = (party: T) => {
    onSelect(party);
    setIsOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    const totalOptions = results.length + (onAddNewParty ? 1 : 0);

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, totalOptions));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalOptions) % Math.max(1, totalOptions));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex < results.length && results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      } else if (onAddNewParty && selectedIndex === results.length) {
        setIsOpen(false);
        onAddNewParty();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const renderTypeIcon = (type: string) => {
    if (type === "WHOLESALER") return <Building className="w-3 h-3 text-purple-600" />;
    if (type === "RETAILER") return <Store className="w-3 h-3 text-blue-600" />;
    return <User className="w-3 h-3 text-slate-500" />;
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Search Input Bar */}
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? query : (selectedParty ? selectedParty.name : "")}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setQuery("");
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-semibold bg-white border border-slate-300 rounded-xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#12355B] focus:border-transparent text-slate-800 placeholder:text-slate-400 placeholder:font-normal"
        />
        {query && isOpen && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 font-sans">
          {results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No parties matching &quot;<span className="font-bold">{query}</span>&quot;
            </div>
          ) : (
            results.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = p.id === selectedPartyId;
              const balanceText = formatPartyBalance(p.currentBalancePaise);
              const isDr = (p.currentBalancePaise ?? 0) > 0;
              const isCr = (p.currentBalancePaise ?? 0) < 0;

              return (
                <div
                  key={p.id}
                  onClick={() => handleSelect(p)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-2.5 sm:px-3 sm:py-2.5 flex items-center justify-between text-xs cursor-pointer transition ${
                    isSelected
                      ? "bg-[#0f172a] text-white"
                      : isCurrent
                      ? "bg-blue-50/80 text-blue-900 font-semibold"
                      : "bg-white text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-bold truncate text-xs sm:text-sm ${isSelected ? "text-white" : "text-slate-900"}`}>
                        {p.name}
                      </span>
                      {p.type && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider flex items-center gap-1 ${
                            isSelected
                              ? "bg-slate-800 text-slate-200 border border-slate-700"
                              : p.type === "WHOLESALER"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : p.type === "RETAILER"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {renderTypeIcon(p.type)}
                          {p.type}
                        </span>
                      )}
                      {p.creditEnabled && (
                        <span
                          className={`text-[9px] px-1 rounded font-bold uppercase ${
                            isSelected
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          Credit
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-2 mt-1 text-[11px] ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                      {p.phone && (
                        <span className="flex items-center gap-0.5 font-mono">
                          <Phone className="w-2.5 h-2.5" />
                          {p.phone}
                        </span>
                      )}
                      {(p.city || p.address) && (
                        <span className="flex items-center gap-0.5 truncate max-w-[220px]">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {p.city ? p.city : p.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Balance on Right */}
                  {p.currentBalancePaise != null && p.currentBalancePaise !== 0 && (
                    <div className="text-right shrink-0">
                      <span
                        className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${
                          isSelected
                            ? "bg-slate-800 text-white"
                            : isDr
                            ? "text-rose-700 bg-rose-50"
                            : isCr
                            ? "text-emerald-700 bg-emerald-50"
                            : "text-slate-600 bg-slate-100"
                        }`}
                      >
                        {balanceText}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Add New Party Option */}
          {onAddNewParty && (
            <div
              onClick={() => {
                setIsOpen(false);
                onAddNewParty();
              }}
              onMouseEnter={() => setSelectedIndex(results.length)}
              className={`p-2.5 px-3 flex items-center gap-2 text-xs font-bold cursor-pointer transition border-t border-slate-200 ${
                selectedIndex === results.length
                  ? "bg-blue-600 text-white"
                  : "bg-slate-50 text-blue-700 hover:bg-blue-50"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Add New Party</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
