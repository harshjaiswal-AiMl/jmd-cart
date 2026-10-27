import { describe, it, expect } from "vitest";
import { normalizeIndianMobile, isValidIndianMobile } from "@/lib/phone";

describe("normalizeIndianMobile", () => {
  it("normalizes standard 10-digit mobile", () => {
    expect(normalizeIndianMobile("9876543210")).toBe("9876543210");
  });

  it("strips +91 country prefix", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("+91-9876543210")).toBe("9876543210");
  });

  it("strips 91 prefix without plus", () => {
    expect(normalizeIndianMobile("919876543210")).toBe("9876543210");
  });

  it("strips leading 0", () => {
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
  });

  it("handles formatting with spaces and brackets", () => {
    expect(normalizeIndianMobile("(+91) 9876-543-210")).toBe("9876543210");
  });

  it("returns null for invalid numbers", () => {
    expect(normalizeIndianMobile(null)).toBeNull();
    expect(normalizeIndianMobile("")).toBeNull();
    expect(normalizeIndianMobile("12345")).toBeNull();
    expect(normalizeIndianMobile("5876543210")).toBeNull(); // Starts with 5
    expect(normalizeIndianMobile("abcdefghij")).toBeNull();
  });

  it("validates with isValidIndianMobile", () => {
    expect(isValidIndianMobile("7979749009")).toBe(true);
    expect(isValidIndianMobile("+91 7979749009")).toBe(true);
    expect(isValidIndianMobile("12345")).toBe(false);
  });
});
