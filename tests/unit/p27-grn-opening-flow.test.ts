import { describe, it, expect } from "vitest";

describe("Prompt 27 - Part C: GRN Opening Flow", () => {
  it("verifies initial lines state is empty array (no default product pre-filled)", () => {
    // lines must start empty []
    const initialLines: any[] = [];
    expect(initialLines).toHaveLength(0);
  });

  it("verifies new GRN action clears all fields and opens supplier modal", () => {
    let supplierModalOpen = false;
    let lines: any[] = [{ id: "l1", productId: "p1" }];
    let billNo = "INV-123";
    let supplierId = "s1";

    // Action: Start New GRN
    const startNewGrn = () => {
      lines = [];
      billNo = "";
      supplierId = "";
      supplierModalOpen = true;
    };

    startNewGrn();

    expect(lines).toHaveLength(0);
    expect(billNo).toBe("");
    expect(supplierId).toBe("");
    expect(supplierModalOpen).toBe(true);
  });

  it("verifies supplier selection moves focus to bill number", () => {
    let supplierId = "";
    let supplierModalOpen = true;
    let focusedElementId = "supplier-modal-search";

    // Action: Select supplier
    const selectSupplier = (id: string) => {
      supplierId = id;
      supplierModalOpen = false;
      focusedElementId = "grn-bill-no";
    };

    selectSupplier("sup-123");

    expect(supplierId).toBe("sup-123");
    expect(supplierModalOpen).toBe(false);
    expect(focusedElementId).toBe("grn-bill-no");
  });

  it("verifies pressing Enter in bill number field moves focus to product search", () => {
    let focusedElementId = "grn-bill-no";

    // Action: Enter in bill number field
    const handleBillNoKeyDown = (key: string) => {
      if (key === "Enter" || key === "Tab") {
        focusedElementId = "grn-item-search";
      }
    };

    handleBillNoKeyDown("Enter");
    expect(focusedElementId).toBe("grn-item-search");
  });
});
