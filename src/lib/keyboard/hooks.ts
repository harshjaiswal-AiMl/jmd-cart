"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { calculateNextListIndex } from "./navigation";

export function useRovingFocus(itemCount: number, initialIndex = 0) {
  const [focusedIndex, setFocusedIndex] = useState(initialIndex);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount <= 0) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % itemCount);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + itemCount) % itemCount);
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusedIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusedIndex(itemCount - 1);
      }
    },
    [itemCount]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === focusedIndex ? 0 : -1),
  };
}

export function useListboxKeyboard<T>(
  items: T[],
  onSelect: (item: T) => void,
  onClose?: () => void,
  isOpen = true
) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    const container = listContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector(`[data-listbox-index="${selectedIndex}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isOpen, items.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (!isOpen || items.length === 0) return;

      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "PageDown" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        setSelectedIndex((prev) => calculateNextListIndex(prev, e.key, items.length));
      } else if (e.key === "Enter") {
        if (items[selectedIndex]) {
          e.preventDefault();
          onSelect(items[selectedIndex]);
        }
      } else if (e.key === "Escape") {
        if (onClose) {
          e.preventDefault();
          onClose();
        }
      }
    },
    [isOpen, items, selectedIndex, onSelect, onClose]
  );

  return {
    selectedIndex,
    setSelectedIndex,
    handleKeyDown,
    listContainerRef,
  };
}
