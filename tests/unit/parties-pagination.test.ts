import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient, PartyType, UserRole } from "@prisma/client";
import { partyService } from "@/modules/party/party.service";

const prisma = new PrismaClient();

describe("Parties Pagination and Filtering (100 per page)", () => {
  beforeAll(async () => {
    // Seed test parties if needed
    const count = await prisma.party.count();
    if (count < 105) {
      const dummyParties = Array.from({ length: 110 }).map((_, i) => ({
        name: `Test Pagination Party ${String(i + 1).padStart(3, "0")}`,
        type: i < 50 ? PartyType.CUSTOMER : i < 90 ? PartyType.RETAILER : PartyType.WHOLESALER,
        active: true,
      }));
      await prisma.party.createMany({
        data: dummyParties,
        skipDuplicates: true,
      });
    }
  });

  it("should return the first page of 100 parties with total count", async () => {
    const res = await partyService.searchParties(UserRole.SUPER_ADMIN, {
      limit: 100,
      offset: 0,
      activeOnly: false,
    });

    expect(res.parties.length).toBeLessThanOrEqual(100);
    expect(res.total).toBeGreaterThanOrEqual(100);
  });

  it("should return the second page with offset 100", async () => {
    const page1 = await partyService.searchParties(UserRole.SUPER_ADMIN, {
      limit: 100,
      offset: 0,
      activeOnly: false,
    });

    const page2 = await partyService.searchParties(UserRole.SUPER_ADMIN, {
      limit: 100,
      offset: 100,
      activeOnly: false,
    });

    if (page1.total > 100) {
      expect(page2.parties.length).toBeGreaterThan(0);
      expect(page2.parties[0].id).not.toBe(page1.parties[0].id);
    }
  });

  it("should correctly filter by CUSTOMER type", async () => {
    const res = await partyService.searchParties(UserRole.SUPER_ADMIN, {
      type: PartyType.CUSTOMER,
      limit: 100,
      offset: 0,
      activeOnly: false,
    });

    expect(res.parties.every((p) => p.type === PartyType.CUSTOMER)).toBe(true);
  });

  it("should correctly filter by RETAILER type", async () => {
    const res = await partyService.searchParties(UserRole.SUPER_ADMIN, {
      type: PartyType.RETAILER,
      limit: 100,
      offset: 0,
      activeOnly: false,
    });

    expect(res.parties.every((p) => p.type === PartyType.RETAILER)).toBe(true);
  });
});
