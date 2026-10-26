import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { PartyType } from "@prisma/client";

describe("B8 & B9: Quick party creation and brand metadata audit", () => {
  it("ensures 30-min claims are completely absent from layout files and management titles are accurate (B9)", () => {
    const rootLayout = fs.readFileSync(path.join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(rootLayout).not.toContain("30-Min Fast Delivery");
    expect(rootLayout).not.toContain("Rapid 30-minute delivery");
    expect(rootLayout).toContain('default: "JMD Cart — Saharsa Grocery & Bulk Wholesale"');

    // Management layout files
    const managementLayouts = [
      "src/app/admin/layout.tsx",
      "src/app/godown/layout.tsx",
      "src/app/shop/layout.tsx",
      "src/app/van/layout.tsx",
      "src/app/delivery/layout.tsx",
      "src/app/reports/layout.tsx",
    ];

    for (const relPath of managementLayouts) {
      const content = fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
      expect(content).toContain('title: "JMD Cart Management"');
    }
  });

  it("verifies quick party creation creates valid parties with roles for van & POS (B8)", async () => {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testPartyName = `Van Quick Buyer ${uniqueSuffix}`;
    const testPhone = `9811${uniqueSuffix}`;

    const { partyRepository } = await import("@/modules/party/party.repository");
    const created = await partyRepository.createParty({
      name: testPartyName,
      phone: testPhone,
      type: PartyType.RETAILER,
      address: "Mandi Gate, Saharsa",
      creditEnabled: false,
      creditLimitPaise: 0,
      creditDays: 0,
      active: true,
    });

    expect(created).toBeDefined();
    expect(created.name).toBe(testPartyName);
    expect(created.type).toBe(PartyType.RETAILER);
    expect(created.phone).toBe(testPhone);

    const fetched = await prisma.party.findUnique({
      where: { id: created.id },
    });
    expect(fetched).not.toBeNull();
    expect(fetched?.name).toBe(testPartyName);
  });
});
