"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { evaluateMathExpression, isAtCaretBoundary } from "@/lib/keyboard/navigation";
import { ChevronDown, Calendar as CalendarIcon } from "lucide-react";

// ==========================================
// 1. Accessible Date Input (DD-MM-YYYY + / - keys)
// ==========================================

export interface AccessibleDateInputProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function AccessibleDateInput({
  value,
  onChange,
  onNavigateUp,
  onNavigateDown,
  onNavigateLeft,
  onNavigateRight,
  className = "",
  autoFocus = false,
}: AccessibleDateInputProps) {
  // Convert YYYY-MM-DD to DD-MM-YYYY for display
  const toDisplay = (iso: string) => {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return iso;
  };

  const toIso = (disp: string) => {
    const parts = disp.split("-");
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return null;
  };

  const [displayText, setDisplayText] = useState(() => toDisplay(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(toDisplay(value));
  }, [value]);

  const stepDate = useCallback(
    (days: number) => {
      try {
        const d = new Date(value || Date.now());
        d.setDate(d.getDate() + days);
        const iso = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
        onChange(iso);
      } catch (e) {
        console.error(e);
      }
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      stepDate(1);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      stepDate(-1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (onNavigateUp) onNavigateUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (onNavigateDown) onNavigateDown();
    } else if (e.key === "ArrowLeft") {
      const el = inputRef.current;
      if (el && isAtCaretBoundary(el.value, el.selectionStart, el.selectionEnd, "ArrowLeft")) {
        if (onNavigateLeft) {
          e.preventDefault();
          onNavigateLeft();
        }
      }
    } else if (e.key === "ArrowRight") {
      const el = inputRef.current;
      if (el && isAtCaretBoundary(el.value, el.selectionStart, el.selectionEnd, "ArrowRight")) {
        if (onNavigateRight) {
          e.preventDefault();
          onNavigateRight();
        }
      }
    }
  };

  const handleBlur = () => {
    const iso = toIso(displayText);
    if (iso) {
      onChange(iso);
    } else {
      setDisplayText(toDisplay(value));
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="text"
        value={displayText}
        autoFocus={autoFocus}
        onChange={(e) => setDisplayText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder="DD-MM-YYYY"
        className={`font-mono text-xs font-bold px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#790E11] focus:border-[#790E11] bg-white text-slate-900 w-28 ${className}`}
        title="Type date or press + / - to step day"
      />
      <input
        type="date"
        tabIndex={-1}
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
      />
    </div>
  );
}

// ==========================================
// 2. Accessible Unit Select (Single-Letter Keys)
// ==========================================

export type UnitOption = "Carton" | "Pcs" | "Dozen" | "Bag" | "Jar" | "Hanger";

export interface AccessibleUnitSelectProps {
  value: UnitOption;
  onChange: (unit: UnitOption) => void;
  onCommitNext?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  className?: string;
  isFocused?: boolean;
}

const UNITS: UnitOption[] = ["Carton", "Pcs", "Dozen", "Bag", "Jar", "Hanger"];

export function AccessibleUnitSelect({
  value,
  onChange,
  onCommitNext,
  onNavigateLeft,
  onNavigateRight,
  onNavigateUp,
  onNavigateDown,
  className = "",
  isFocused = false,
}: AccessibleUnitSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const cycleUnit = (direction: 1 | -1) => {
    const currIdx = UNITS.indexOf(value);
    const nextIdx = (currIdx + direction + UNITS.length) % UNITS.length;
    onChange(UNITS[nextIdx]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key.toUpperCase();

    // Single-letter unit shortcuts
    if (key === "C") {
      e.preventDefault();
      onChange("Carton");
    } else if (key === "P") {
      e.preventDefault();
      onChange("Pcs");
    } else if (key === "D") {
      e.preventDefault();
      onChange("Dozen");
    } else if (key === "B") {
      e.preventDefault();
      onChange("Bag");
    } else if (key === "J") {
      e.preventDefault();
      onChange("Jar");
    } else if (key === "H") {
      e.preventDefault();
      onChange("Hanger");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (open) {
        cycleUnit(1);
      } else if (onNavigateDown) {
        onNavigateDown();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) {
        cycleUnit(-1);
      } else if (onNavigateUp) {
        onNavigateUp();
      }
    } else if (e.key === "ArrowLeft") {
      if (onNavigateLeft) {
        e.preventDefault();
        onNavigateLeft();
      }
    } else if (e.key === "ArrowRight") {
      if (onNavigateRight) {
        e.preventDefault();
        onNavigateRight();
      }
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (onCommitNext) {
        e.preventDefault();
        onCommitNext();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative inline-block w-full text-center font-bold text-xs rounded cursor-pointer select-none focus:outline-none ${
        isFocused ? "outline-2 outline-[#790E11] bg-[#FEF3C7]" : "border border-slate-200 bg-white"
      } ${className}`}
    >
      <div
        onClick={() => setOpen((prev) => !prev)}
        className="px-1.5 py-1 flex items-center justify-between text-xs"
      >
        <span className="w-full text-center">{value}</span>
        <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-300 rounded shadow-lg z-50 py-1 text-xs divide-y divide-slate-100">
          {UNITS.map((u) => (
            <div
              key={u}
              onClick={() => {
                onChange(u);
                setOpen(false);
              }}
              className={`px-2 py-1 text-left hover:bg-amber-100 cursor-pointer flex items-center justify-between ${
                u === value ? "bg-amber-50 font-black text-[#790E11]" : ""
              }`}
            >
              <span>{u}</span>
              <kbd className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                {u[0]}
              </kbd>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. Accessible Number Input with Inline Math
// ==========================================

export interface AccessibleNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommitNext?: () => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onNavigateLeft?: () => void;
  onNavigateRight?: () => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  isFocused?: boolean;
  align?: "left" | "right" | "center";
}

export function AccessibleNumberInput({
  value,
  onChange,
  onCommitNext,
  onNavigateUp,
  onNavigateDown,
  onNavigateLeft,
  onNavigateRight,
  step = 1,
  min,
  max,
  className = "",
  isFocused = false,
  align = "right",
}: AccessibleNumberInputProps) {
  const [inputText, setInputText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputText(value);
  }, [value]);

  const commitValue = () => {
    const raw = inputText.trim();
    if (!raw) return;

    // Check if inline math expression e.g. "12*5"
    if (/[+\-*/]/.test(raw) || raw.startsWith("=")) {
      const mathResult = evaluateMathExpression(raw);
      if (mathResult !== null) {
        let finalVal = mathResult;
        if (min !== undefined) finalVal = Math.max(min, finalVal);
        if (max !== undefined) finalVal = Math.min(max, finalVal);
        const strVal = String(finalVal);
        setInputText(strVal);
        onChange(strVal);
        return;
      }
    }

    const num = parseFloat(raw);
    if (!isNaN(num)) {
      let finalVal = num;
      if (min !== undefined) finalVal = Math.max(min, finalVal);
      if (max !== undefined) finalVal = Math.min(max, finalVal);
      const strVal = String(finalVal);
      setInputText(strVal);
      onChange(strVal);
    } else {
      setInputText(value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitValue();
      if (onCommitNext) {
        e.preventDefault();
        onCommitNext();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      commitValue();
      if (onNavigateUp) onNavigateUp();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commitValue();
      if (onNavigateDown) onNavigateDown();
    } else if (e.key === "ArrowLeft") {
      const el = inputRef.current;
      if (el && isAtCaretBoundary(el.value, el.selectionStart, el.selectionEnd, "ArrowLeft")) {
        if (onNavigateLeft) {
          e.preventDefault();
          commitValue();
          onNavigateLeft();
        }
      }
    } else if (e.key === "ArrowRight") {
      const el = inputRef.current;
      if (el && isAtCaretBoundary(el.value, el.selectionStart, el.selectionEnd, "ArrowRight")) {
        if (onNavigateRight) {
          e.preventDefault();
          commitValue();
          onNavigateRight();
        }
      }
    } else if (e.key === "+" || e.key === "-") {
      // If cursor is at start and typing regular sign, allow.
      // But if user pressed + / - to step integer quantity, handle step
      const currentNum = parseFloat(inputText) || 0;
      if (e.key === "+" && !inputText.includes("+") && !inputText.includes("*")) {
        // Can be math or step
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={inputText}
      onChange={(e) => setInputText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commitValue}
      onFocus={(e) => e.target.select()}
      className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded text-${align} focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
        isFocused ? "outline-2 outline-[#790E11] bg-[#FEF3C7]" : "border border-slate-200 bg-white"
      } ${className}`}
    />
  );
}
