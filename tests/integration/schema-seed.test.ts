import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

describe("Phase 1 Full Schema & Seed: Integration Tests", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seeds users for all roles with valid bcrypt password hashes", async () => {
    const roles = ["SUPER_ADMIN", "GODOWN", "SHOP", "SALESPERSON", "DELIVERY", "ACCOUNTS"];
    const users = await prisma.user.findMany({
      where: { role: { in: roles as any } },
    });

    expect(users.length).toBeGreaterThanOrEqual(6);

    // Verify Super Admin password matches 'admin123'
    const admin = users.find((u) => u.name === "Sachin Prakash") || users.find((u) => u.role === "SUPER_ADMIN");
    expect(admin).toBeDefined();
    expect(admin?.name).toBe("Sachin Prakash");
    const isMatch = await bcrypt.compare("admin123", admin!.passwordHash);
    expect(isMatch).toBe(true);

    // Verify Shop cashier password matches 'shop123'
    const shopUser = users.find((u) => u.role === "SHOP");
    expect(shopUser).toBeDefined();
    expect(await bcrypt.compare("shop123", shopUser!.passwordHash)).toBe(true);
  });

  it("seeds required business locations: Godown, Shop, Van 1, Van 2", async () => {
    const locations = await prisma.location.findMany();
    const godown = locations.find((l) => l.name === "Main Godown");
    const shop = locations.find((l) => l.name === "Retail Shop");
    const vans = locations.filter((l) => l.type === "VAN");

    expect(godown).toBeDefined();
    expect(shop).toBeDefined();
    expect(vans.length).toBeGreaterThanOrEqual(2);
    expect(godown?.type).toBe("GODOWN");
    expect(shop?.type).toBe("SHOP");
  });

  it("seeds companies, categories and products with foreign keys intact", async () => {
    const products = await prisma.product.findMany({
      include: {
        company: true,
        category: true,
      },
    });

    expect(products.length).toBeGreaterThanOrEqual(6);

    const bhujia = products.find((p) => p.shortCode === "BKJ-BHU-1K");
    expect(bhujia).toBeDefined();
    expect(bhujia?.company?.name).toBe("Bikaji Foods");
    expect(bhujia?.category?.name).toBe("Namkeen & Snacks");
    expect(bhujia?.packSize).toBe(20);
    expect(bhujia?.mrpPaise).toBe(25000);
    expect(bhujia?.gstRateBp).toBe(1200);
  });

  it("seeds business settings and initial FY sequence", async () => {
    const bizSettings = await prisma.setting.findUnique({
      where: { key: "business_details" },
    });
    expect(bizSettings).toBeDefined();
    const bizValue = bizSettings?.value as Record<string, string>;
    expect(bizValue.legalName).toBe("JMD Cart Distributors");
    expect(bizValue.gstin).toBe("10AAAAA0000A1Z5");

    const seq = await prisma.sequence.findUnique({
      where: { name_fy: { name: "INV", fy: "26-27" } },
    });
    expect(seq).toBeDefined();
    expect(seq?.nextValue).toBeGreaterThanOrEqual(1);
  });
});
