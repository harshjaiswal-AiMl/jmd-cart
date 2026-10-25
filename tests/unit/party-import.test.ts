import { describe, it, expect } from "vitest";
import { parseTallyBalanceToPaise } from "@/modules/party/party-import.service";
import { createPartySchema } from "@/modules/party/party.types";
import { PartyType } from "@prisma/client";

describe("Task 2.1 Unit Tests: Party & Tally Import Parser", () => {
  describe("parseTallyBalanceToPaise", () => {
    it("should parse plain positive numbers to paise", () => {
      expect(parseTallyBalanceToPaise("1500")).toBe(150000);
      expect(parseTallyBalanceToPaise("10.50")).toBe(1050);
      expect(parseTallyBalanceToPaise("0")).toBe(0);
    });

    it("should parse formatted currency strings with commas and symbols", () => {
      expect(parseTallyBalanceToPaise("₹25,000")).toBe(2500000);
      expect(parseTallyBalanceToPaise("1,25,000.75")).toBe(12500075);
    });

    it("should parse Tally Dr (Debit) as positive paise", () => {
      expect(parseTallyBalanceToPaise("12500 Dr")).toBe(1250000);
      expect(parseTallyBalanceToPaise("12,500.00 Dr.")).toBe(1250000);
    });

    it("should parse Tally Cr (Credit) as negative paise", () => {
      expect(parseTallyBalanceToPaise("5000 Cr")).toBe(-500000);
      expect(parseTallyBalanceToPaise("5,000.00 Cr.")).toBe(-500000);
    });

    it("should handle empty or malformed input gracefully", () => {
      expect(parseTallyBalanceToPaise("")).toBe(0);
      expect(parseTallyBalanceToPaise("   ")).toBe(0);
      expect(parseTallyBalanceToPaise("invalid")).toBe(0);
    });
  });

  describe("createPartySchema Validation", () => {
    it("should accept valid customer with credit terms", () => {
      const valid = createPartySchema.safeParse({
        name: "Shyam General Store",
        type: PartyType.CUSTOMER,
        phone: "9876543210",
        gstin: "10ABCDE1234F1Z5",
        creditEnabled: true,
        creditLimitPaise: 5000000,
        creditDays: 15,
        openingOutstandingPaise: 1250000,
      });

      expect(valid.success).toBe(true);
    });

    it("should reject name shorter than 2 characters", () => {
      const res = createPartySchema.safeParse({
        name: "A",
      });
      expect(res.success).toBe(false);
    });

    it("should reject invalid mobile numbers", () => {
      const res = createPartySchema.safeParse({
        name: "Test Party",
        phone: "12345", // too short
      });
      expect(res.success).toBe(false);

      const res2 = createPartySchema.safeParse({
        name: "Test Party",
        phone: "4876543210", // starts with 4 (invalid Indian mobile)
      });
      expect(res2.success).toBe(false);
    });

    it("should reject invalid GSTIN format", () => {
      const res = createPartySchema.safeParse({
        name: "Test Party",
        gstin: "INVALIDGST123",
      });
      expect(res.success).toBe(false);
    });

    it("should reject negative credit limit or excessive credit days", () => {
      const res1 = createPartySchema.safeParse({
        name: "Test Party",
        creditLimitPaise: -100,
      });
      expect(res1.success).toBe(false);

      const res2 = createPartySchema.safeParse({
        name: "Test Party",
        creditDays: 400, // > 365
      });
      expect(res2.success).toBe(false);
    });
  });
});
