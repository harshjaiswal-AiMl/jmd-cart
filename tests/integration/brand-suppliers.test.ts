import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { ensureSupplierParty } from "@/modules/party/party.service";
import { PartyType, UserRole } from "@prisma/client";
import { purchaseService } from "@/modules/purchase/purchase.service";

describe("Part C Integration Tests: Brands as GRN Suppliers", () => {
  const brandName1 = "NESTLE TEST BRAND";
  const brandName2 = "AMUL TEST BRAND";

  beforeEach(async () => {
    // Clean up test data
    await prisma.party.deleteMany({
      where: {
        name: { in: [brandName1, brandName2, "NESTLE RENAMED BRAND", "UNLINKED SUPPLIER"] },
      },
    });
    await prisma.company.deleteMany({
      where: {
        name: { in: [brandName1, brandName2, "NESTLE RENAMED BRAND"] },
      },
    });
  });

  it("creates a linked SUPPLIER party when a brand is created", async () => {
    const company = await prisma.company.create({
      data: {
        name: brandName1,

      },
    });

    const supplierParty = await ensureSupplierParty(company);

    expect(supplierParty).toBeDefined();
    expect(supplierParty.companyId).toBe(company.id);
    expect(supplierParty.type).toBe(PartyType.SUPPLIER);
    expect(supplierParty.name).toBe(brandName1);

    // Verify idempotent re-call does not duplicate
    const reCall = await ensureSupplierParty(company);
    expect(reCall.id).toBe(supplierParty.id);
  });

  it("renames linked supplier party when brand is renamed", async () => {
    const company = await prisma.company.create({
      data: {
        name: brandName1,

      },
    });

    const supplierParty = await ensureSupplierParty(company);
    expect(supplierParty.name).toBe(brandName1);

    // Rename brand
    const renamedCompany = await prisma.company.update({
      where: { id: company.id },
      data: { name: "NESTLE RENAMED BRAND" },
    });

    const updatedParty = await ensureSupplierParty(renamedCompany, undefined, {
      oldName: brandName1,
    });

    expect(updatedParty.name).toBe("NESTLE RENAMED BRAND");
    expect(updatedParty.id).toBe(supplierParty.id);
  });

  it("deactivates linked supplier party when brand is deactivated", async () => {
    const company = await prisma.company.create({
      data: {
        name: brandName2,
        active: true,
      },
    });

    const party = await ensureSupplierParty(company);
    expect(party.active).toBe(true);

    const deactivated = await prisma.company.update({
      where: { id: company.id },
      data: { active: false },
    });

    const updatedParty = await ensureSupplierParty(deactivated);
    expect(updatedParty.active).toBe(false);
  });

  it("merges existing unlinked supplier party when brand name matches", async () => {
    // Pre-existing supplier party without companyId
    const existingParty = await prisma.party.create({
      data: {
        name: "UNLINKED SUPPLIER",
        type: PartyType.SUPPLIER,
        creditLimitPaise: 0,
        creditDays: 0,
      },
    });

    const newCompany = await prisma.company.create({
      data: {
        name: "UNLINKED SUPPLIER",
      },
    });

    const mergedParty = await ensureSupplierParty(newCompany);

    expect(mergedParty.id).toBe(existingParty.id);
    expect(mergedParty.companyId).toBe(newCompany.id);
  });

  it("GRN purchase service formData includes brand-linked suppliers and products", async () => {
    const company = await prisma.company.create({
      data: {
        name: brandName1,
      },
    });
    await ensureSupplierParty(company);

    const formData = await purchaseService.getFormData(UserRole.ADMIN);

    expect(formData.suppliers.length).toBeGreaterThan(0);
    const found = formData.suppliers.find((s) => s.companyId === company.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe(brandName1);
  });
});
