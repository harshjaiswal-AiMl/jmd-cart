"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, UserPlus, X, Building, Store, User, ArrowRight } from "lucide-react";
import { searchParties } from "@/lib/search/party-search";

export interface PartyPopupItem {
  id: string;
  name: string;
  type: string;
  phone: string | null;
  address?: string | null;
  gstin?: string | null;
  creditEnabled: boolean;
  creditLimitPaise: number;
  creditDays?: number;
  currentOutstandingPaise: number;
}

interface PartySearchModalProps {
  isOpen: boolean;
  parties: PartyPopupItem[];
  currentPartyId: string;
  onSelectParty: (party: PartyPopupItem | null) => void;
  onAddNewParty: (initialName?: string) => void;
  onClose: () => void;
}

export function PartySearchModal({
  isOpen,
  parties,
  currentPartyId,
  onSelectParty,
  onAddNewParty,
  onClose,
}: PartySearchModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus & select search input cleanly on open
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);

    const focusInput = () => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    };
    focusInput();
    const t1 = setTimeout(focusInput, 15);
    const t2 = requestAnimationFrame(focusInput);
    return () => {
      clearTimeout(t1);
      cancelAnimationFrame(t2);
    };
  }, [isOpen]);

  // Filter across name, phone, area/address, and GSTIN
  const filteredParties = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return parties.slice(0, 60);
    }
    const ranked = searchParties(q, parties, 60);
    const rankedIds = new Set(ranked.map((p) => p.id));
    // Also include matches on address or gstin that rankParties might not cover
    const extraMatches = parties.filter(
      (p) =>
        !rankedIds.has(p.id) &&
        ((p.address && p.address.toLowerCase().includes(q)) ||
          (p.gstin && p.gstin.toLowerCase().includes(q)))
    );
    return [...ranked, ...extraMatches].slice(0, 60);
  }, [parties, query]);

  // Index 0 = Counter Sale (Walk-in) when query is empty or matches "counter"/"walk"
  const showCounterSaleFirst =
    !query.trim() ||
    "counter sale (walk-in)".includes(query.trim().toLowerCase());

  // Build flat option list for clean keyboard navigation
  const options = useMemo(() => {
    const list: Array<
      | { kind: "counter" }
      | { kind: "party"; party: PartyPopupItem }
      | { kind: "add" }
    > = [];
    if (showCounterSaleFirst) {
      list.push({ kind: "counter" });
    }
    for (const p of filteredParties) {
      list.push({ kind: "party", party: p });
    }
    list.push({ kind: "add" });
    return list;
  }, [showCounterSaleFirst, filteredParties]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keep active row scrolled into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(
      `[data-party-idx="${selectedIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Capture phase keyboard navigation when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.altKey && (e.code === "KeyN" || e.key.toLowerCase() === "n")) {
        e.preventDefault();
        e.stopPropagation();
        onAddNewParty(query.trim());
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, options.length));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex(
          (prev) => (prev - 1 + options.length) % Math.max(1, options.length)
        );
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const chosen = options[selectedIndex];
        if (!chosen || chosen.kind === "counter") {
          onSelectParty(null);
        } else if (chosen.kind === "party") {
          onSelectParty(chosen.party);
        } else if (chosen.kind === "add") {
          onAddNewParty(query.trim());
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, options, selectedIndex, query, onSelectParty, onAddNewParty, onClose]);

  if (!isOpen) return null;

  const getTypeBadge = (type: string) => {
    if (type === "WHOLESALER") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
          <Building className="w-3 h-3" /> Wholesaler (A)
        </span>
      );
    }
    if (type === "RETAILER") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
          <Store className="w-3 h-3" /> Retailer (B)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
        <User className="w-3 h-3" /> Customer (C)
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
      onClick={onClose}
      data-testid="pos-party-popup"
      role="dialog"
      aria-modal="true"
      aria-label="Select Party"
    >
      <div
        className="bg-[#FEFDF7] border-2 border-[#790E11] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#790E11] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-lg tracking-tight">Select Party / Customer</h2>
            <kbd className="px-2 py-0.5 rounded bg-white/15 text-xs font-mono font-bold text-[#FDAF18]">
              Alt+P
            </kbd>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAddNewParty(query.trim())}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FDAF18] hover:bg-[#FC830D] text-slate-950 font-bold text-xs shadow-xs cursor-pointer transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ New Party (Alt+N)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 cursor-pointer"
              aria-label="Close Party popup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-5 h-5 text-[#790E11] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={inputRef}
              id="pos-party-search-input"
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search party by name, mobile, city/area, or GSTIN..."
              className="w-full pl-11 pr-4 py-3 text-base font-semibold bg-[#FEFDF7] border-2 border-[#790E11] rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#FDAF18]/40"
            />
          </div>
        </div>

        {/* Results List */}
        <div ref={listRef} className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
          {options.map((opt, idx) => {
            const isSelected = idx === selectedIndex;
            if (opt.kind === "counter") {
              return (
                <button
                  key="counter-sale"
                  type="button"
                  data-party-idx={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => onSelectParty(null)}
                  className={`w-full text-left px-5 py-3.5 flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? "bg-[#FEF3C7] border-l-4 border-l-[#790E11]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-950">
                        Counter Sale (Walk-in)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 text-xs font-bold">
                        Cash / UPI Default
                      </span>
                      {!currentPartyId && (
                        <span className="px-2 py-0.5 rounded bg-[#790E11]/10 text-[#790E11] text-xs font-bold">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Press Enter or Esc to continue with Counter Sale (List C MRP)
                    </p>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#790E11] bg-white px-2.5 py-1 rounded border border-[#790E11]/30 shadow-2xs">
                      <span>↵ Select</span>
                    </span>
                  )}
                </button>
              );
            }

            if (opt.kind === "add") {
              return (
                <button
                  key="add-new-party"
                  type="button"
                  data-party-idx={idx}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => onAddNewParty(query.trim())}
                  className={`w-full text-left px-5 py-3.5 flex items-center justify-between transition cursor-pointer ${
                    isSelected
                      ? "bg-[#FEF3C7] border-l-4 border-l-[#790E11]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-[#790E11] font-bold text-base">
                    <UserPlus className="w-5 h-5" />
                    <span>
                      + New Party {query.trim() ? `"${query.trim()}"` : ""}{" "}
                      <span className="text-xs font-mono text-slate-500">[Alt+N]</span>
                    </span>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#790E11]" />
                </button>
              );
            }

            const p = opt.party;
            const balRupees = Math.abs(p.currentOutstandingPaise) / 100;
            return (
              <button
                key={p.id}
                type="button"
                data-party-idx={idx}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => onSelectParty(p)}
                className={`w-full text-left px-5 py-3 flex items-center justify-between gap-3 transition cursor-pointer ${
                  isSelected
                    ? "bg-[#FEF3C7] border-l-4 border-l-[#790E11]"
                    : "hover:bg-slate-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-slate-950 truncate">
                      {p.name}
                    </span>
                    {getTypeBadge(p.type)}
                    {currentPartyId === p.id && (
                      <span className="px-2 py-0.5 rounded bg-[#790E11]/10 text-[#790E11] text-xs font-bold">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 mt-0.5">
                    {p.phone && <span className="font-mono font-semibold">{p.phone}</span>}
                    {p.address && <span className="truncate max-w-xs">{p.address}</span>}
                    {p.gstin && <span className="font-mono text-xs text-slate-700">GSTIN: {p.gstin}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 flex items-center gap-3">
                  <div>
                    <div className="text-sm font-mono font-bold text-slate-900">
                      {p.currentOutstandingPaise === 0
                        ? "₹0"
                        : `₹${balRupees.toLocaleString("en-IN")} ${
                            p.currentOutstandingPaise > 0 ? "Dr" : "Cr"
                          }`}
                    </div>
                    {p.creditEnabled ? (
                      <div className="text-xs font-semibold text-emerald-800">
                        Credit: ₹{(p.creditLimitPaise / 100).toLocaleString("en-IN")}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500">Cash / UPI only</div>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-xs font-bold text-[#790E11] bg-white px-2 py-1 rounded border border-[#790E11]/30">
                      ↵
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Hints */}
        <div className="px-5 py-2.5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select &amp; Go to Items</span>
            <span>Esc Counter Sale / Close</span>
          </div>
          <span>{filteredParties.length} matching parties</span>
        </div>
      </div>
    </div>
  );
}
