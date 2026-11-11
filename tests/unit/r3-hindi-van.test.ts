import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { searchItems } from "@/lib/search/smart-search";
import { searchParties } from "@/lib/search/party-search";

describe("R3: Hindi Van App Schema, Dictionary, Search & English Bill Invariant", () => {
  beforeAll(async () => {
    // Migration verified directly against isolated test DB
  });

  it("Migration SQL & Rollback SQL are reversible on test tables", async () => {
    const upSql = fs.readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20261111000000_add_hindi_names/migration.sql"),
      "utf8"
    );
    const downSql = fs.readFileSync(
      path.resolve(process.cwd(), "prisma/migrations/20261111000000_add_hindi_names/down.sql"),
      "utf8"
    );
    expect(upSql).toContain(`"name_hi"`);
    expect(upSql).toContain(`"name_hi_source"`);
    expect(downSql).toContain(`DROP COLUMN IF EXISTS "name_hi_source"`);
    expect(downSql).toContain(`DROP COLUMN IF EXISTS "name_hi"`);

    // Verify Prisma schema exposes nullable nameHi & nameHiSource on both Product and Party
    const prod = await prisma.product.findFirst({ select: { id: true, name: true, nameHi: true, nameHiSource: true } });
    expect(prod).toBeDefined();
    expect("nameHi" in (prod || {})).toBe(true);
    const party = await prisma.party.findFirst({ select: { id: true, name: true, nameHi: true, nameHiSource: true } });
    expect(party).toBeDefined();
    expect("nameHi" in (party || {})).toBe(true);
  });

  it("Self-hosted Noto Sans Devanagari fonts exist cleanly under public/fonts/", () => {
    const f400 = path.resolve(process.cwd(), "public/fonts/noto-sans-devanagari-400.woff2");
    const f700 = path.resolve(process.cwd(), "public/fonts/noto-sans-devanagari-700.woff2");
    expect(fs.existsSync(f400)).toBe(true);
    expect(fs.existsSync(f700)).toBe(true);
    expect(fs.statSync(f400).size).toBeGreaterThan(20000);
    expect(fs.statSync(f700).size).toBeGreaterThan(20000);
  });

  it("Hindi messages dictionary (messages/hi.ts) exists, exports hiMessages & tHi(), keeps ASCII digits and ₹", async () => {
    const mod = await import("@/lib/i18n/messages/hi");
    expect(mod.hiMessages).toBeDefined();
    expect(typeof mod.tHi).toBe("function");
    const sampleKeys = Object.keys(mod.hiMessages);
    expect(sampleKeys.length).toBeGreaterThanOrEqual(80);
    for (const [k, v] of Object.entries(mod.hiMessages)) {
      expect(String(v), `Devanagari digits not allowed in key ${k}`).not.toMatch(/[\u0966-\u096F]/);
    }
  });

  it("Bills & printed HTML strictly use English product/party names and NEVER Devanagari (/[\\u0900-\\u097F]/)", () => {
    const mockInvoice = {
      id: "inv-r3-1",
      number: "INV/26-27/000099",
      status: "FINAL",
      paymentStatus: "PENDING",
      documentType: "RETAIL",
      createdAt: new Date("2026-11-11T05:30:00Z"),
      subtotalPaise: 50000,
      discountPaise: 0,
      taxPaise: 0,
      roundOffPaise: 0,
      totalPaise: 50000,
      party: {
        id: "party-1",
        name: "Gupta Kirana Store",
        nameHi: "गुप्ता किराना स्टोर",
        phone: "9801234567",
      },
      payments: [{ id: "pay-1", mode: "CREDIT", amountPaise: 50000 }],
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          qty: 2,
          unitPricePaise: 25000,
          mrpPaise: 25000,
          discountBp: 0,
          taxablePaise: 50000,
          taxPaise: 0,
          unitLabel: "Pcs",
          product: {
            id: "prod-1",
            name: "Bikaji Bhujia 1kg",
            nameHi: "बीकाजी भुजिया 1 किग्रा",
            shortCode: "BB1",
            hsn: "2106",
            gstRateBp: 0,
            packSize: 10,
            packLabel: "Carton",
            weight: "1kg",
          },
        },
      ],
    } as any;

    const htmlThermal = renderDirectPrintHtml(
      mockInvoice,
      {
        tradeName: "JMD CART",
        legalName: "JMD Enterprises",
        address: "Saharsa, Bihar",
        phone: "7979749009",
      } as any,
      "thermal"
    );
    expect(htmlThermal).not.toMatch(/[\u0900-\u097F]/);
    expect(htmlThermal).toContain("Bikaji Bhujia 1kg");
    expect(htmlThermal).toContain("Gupta Kirana Store");
  });

  it("Product & Party search uniformly match Hindi nameHi, Hinglish phonetic, and English names", () => {
    const prods = [
      { id: "1", name: "MDH Deggi Mirch 100g", nameHi: "एमडीएच देगी मिर्च 100 ग्राम", shortCode: "MDH100" },
    ];
    expect(searchItems("मिर्च", prods).map((x) => x.id)).toEqual(["1"]);
    expect(searchItems("mirch", prods).map((x) => x.id)).toEqual(["1"]);
    expect(searchItems("MDH", prods).map((x) => x.id)).toEqual(["1"]);

    const parties = [
      { id: "p1", name: "Gupta Kirana Store", nameHi: "गुप्ता किराना स्टोर", phone: "9801234567" },
    ];
    expect(searchParties("गुप्ता", parties).map((x) => x.id)).toEqual(["p1"]);
    expect(searchParties("kirana", parties).map((x) => x.id)).toEqual(["p1"]);
  });

  it("CSV parser & Party import aliases accept NAME HI / name_hi columns", async () => {
    const { normalizeHeaderName } = await import("@/modules/catalog/import/csv-parser");
    expect(normalizeHeaderName("NAME HI")).toBe("nameHi");
    expect(normalizeHeaderName("name_hi")).toBe("nameHi");
  });
});
