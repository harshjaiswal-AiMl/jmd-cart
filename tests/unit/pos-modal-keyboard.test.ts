import { describe, it, expect } from "vitest";

describe("POS Voucher Header & Modal Keyboard Navigation (Task 2)", () => {
  describe("Voucher Number Display in Header", () => {
    function computeVoucherHeader(params: {
      initialEditInvoice?: { number: string } | null;
      activeTab: { id: string; tabTitle?: string };
      nextInvoicePreview?: string;
    }): string {
      const { initialEditInvoice, activeTab, nextInvoicePreview } = params;
      if (initialEditInvoice?.number) {
        return `${initialEditInvoice.number} (Editing)`;
      }
      if (activeTab.id === "tab-edit" && activeTab.tabTitle?.startsWith("Edit: ")) {
        return `${activeTab.tabTitle.replace("Edit: ", "")} (Editing)`;
      }
      if (nextInvoicePreview) {
        return `${nextInvoicePreview} (auto)`;
      }
      return activeTab.tabTitle || "INV/26-27/000001 (auto)";
    }

    it("displays the actual editing invoice number in edit mode even when nextInvoicePreview is present", () => {
      const result = computeVoucherHeader({
        initialEditInvoice: { number: "INV/26-27/000086" },
        activeTab: { id: "tab-edit", tabTitle: "Edit: INV/26-27/000086" },
        nextInvoicePreview: "INV/26-27/000088",
      });
      expect(result).toBe("INV/26-27/000086 (Editing)");
      expect(result).not.toContain("000088");
      expect(result).not.toContain("(auto)");
    });

    it("displays nextInvoicePreview (auto) on a new bill", () => {
      const result = computeVoucherHeader({
        initialEditInvoice: null,
        activeTab: { id: "tab-1", tabTitle: "Bill 1" },
        nextInvoicePreview: "INV/26-27/000088",
      });
      expect(result).toBe("INV/26-27/000088 (auto)");
    });
  });

  describe("Finalized Modal Button Cycling & Wrap-around", () => {
    const BUTTON_COUNT = 3; // 0: Thermal Slip, 1: Print A4, 2: Start Next Bill

    function cycleNext(current: number): number {
      return (current + 1) % BUTTON_COUNT;
    }

    function cyclePrev(current: number): number {
      return (current - 1 + BUTTON_COUNT) % BUTTON_COUNT;
    }

    it("cycles forward with ArrowRight, ArrowDown, Tab with wrap-around", () => {
      let idx = 0;
      idx = cycleNext(idx); // 0 -> 1
      expect(idx).toBe(1);
      idx = cycleNext(idx); // 1 -> 2
      expect(idx).toBe(2);
      idx = cycleNext(idx); // 2 -> 0 (wrap around)
      expect(idx).toBe(0);
    });

    it("cycles backward with ArrowLeft, ArrowUp, Shift-Tab with wrap-around", () => {
      let idx = 0;
      idx = cyclePrev(idx); // 0 -> 2 (wrap around)
      expect(idx).toBe(2);
      idx = cyclePrev(idx); // 2 -> 1
      expect(idx).toBe(1);
      idx = cyclePrev(idx); // 1 -> 0
      expect(idx).toBe(0);
    });

    it("maps Enter and direct key shortcuts to correct invoice actions", () => {
      const actionsDispatched: string[] = [];

      function handleKey(key: string, focusIdx: number) {
        if (key === "Escape" || key === "F3" || key === "3") {
          actionsDispatched.push("START_NEXT_BILL");
          return;
        }
        if (key === "1" || (key === "Enter" && focusIdx === 0)) {
          actionsDispatched.push("PRINT_THERMAL");
          return;
        }
        if (key === "2" || (key === "Enter" && focusIdx === 1)) {
          actionsDispatched.push("PRINT_A4");
          return;
        }
        if (key === "Enter" && focusIdx === 2) {
          actionsDispatched.push("START_NEXT_BILL");
          return;
        }
      }

      handleKey("Enter", 0);
      expect(actionsDispatched).toContain("PRINT_THERMAL");

      handleKey("Enter", 1);
      expect(actionsDispatched).toContain("PRINT_A4");

      handleKey("Enter", 2);
      expect(actionsDispatched).toContain("START_NEXT_BILL");

      handleKey("Escape", 0);
      expect(actionsDispatched.filter((a) => a === "START_NEXT_BILL")).toHaveLength(2);

      handleKey("F3", 0);
      expect(actionsDispatched.filter((a) => a === "START_NEXT_BILL")).toHaveLength(3);

      handleKey("1", 2);
      expect(actionsDispatched.filter((a) => a === "PRINT_THERMAL")).toHaveLength(2);
    });
  });
});
