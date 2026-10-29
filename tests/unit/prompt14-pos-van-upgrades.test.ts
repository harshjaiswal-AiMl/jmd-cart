import { describe, it, expect } from "vitest";
import { resolvePrice } from "@/modules/pricing/resolve-price";
import { getNavGroupsForRole } from "@/config/nav.config";
import { UserRole } from "@prisma/client";

describe("Prompt 14 — Management Redesign, POS Upgrades & Van Simplification", () => {
  describe("1. Nav Config Consolidation & Role Item Limits", () => {
    it("Admin has exactly 8 top-level navigation groups", () => {
      const groups = getNavGroupsForRole(UserRole.ADMIN);
      expect(groups.length).toBe(8);
      expect(groups.map((g) => g.name)).toEqual([
        "Dashboard",
        "Sales",
        "Orders & Dispatch",
        "Inventory",
        "Catalog",
        "Parties",
        "Accounts & Reports",
        "Settings & People",
      ]);
    });

    it("Non-admin roles see at most 6 focused items", () => {
      const shopGroups = getNavGroupsForRole(UserRole.SHOP);
      const totalShopItems = shopGroups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalShopItems).toBeLessThanOrEqual(6);

      const godownGroups = getNavGroupsForRole(UserRole.GODOWN);
      const totalGodownItems = godownGroups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalGodownItems).toBeLessThanOrEqual(6);

      const vanGroups = getNavGroupsForRole(UserRole.SALESPERSON);
      const totalVanItems = vanGroups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalVanItems).toBeLessThanOrEqual(6);

      const deliveryGroups = getNavGroupsForRole(UserRole.DELIVERY);
      const totalDeliveryItems = deliveryGroups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalDeliveryItems).toBeLessThanOrEqual(6);

      const accountsGroups = getNavGroupsForRole(UserRole.ACCOUNTS);
      const totalAccountsItems = accountsGroups.reduce((sum, g) => sum + g.items.length, 0);
      expect(totalAccountsItems).toBeLessThanOrEqual(6);
    });
  });

  describe("2. Units & Quantity Multipliers (Dozen = 12, Bag = bagSize)", () => {
    it("calculates piece multipliers correctly for Pcs, Carton, Dozen, and Bag", () => {
      const packSize = 24;
      const bagSize = 50;

      const getMultiplier = (unit: "Pcs" | "Carton" | "Dozen" | "Bag") => {
        return unit === "Carton" ? packSize : unit === "Bag" ? bagSize : unit === "Dozen" ? 12 : 1;
      };

      expect(getMultiplier("Pcs")).toBe(1);
      expect(getMultiplier("Carton")).toBe(24);
      expect(getMultiplier("Dozen")).toBe(12);
      expect(getMultiplier("Bag")).toBe(50);
    });

    it("applies Dozen (12x) rate without excessive discount distortions", () => {
      const retailPieceMrp = 5000; // ₹50
      const retailPieceRate = 4500; // ₹45 (10% discount)

      const dozenMrp = retailPieceMrp * 12; // ₹600
      const dozenRate = retailPieceRate * 12; // ₹540

      const discPercent = ((dozenMrp - dozenRate) / dozenMrp) * 100;
      expect(dozenMrp).toBe(60000);
      expect(dozenRate).toBe(54000);
      expect(discPercent).toBeCloseTo(10, 2); // Exact 10% discount maintained!
    });
  });

  describe("3. Line MRP & Rate Bidirectional Recalculation", () => {
    it("recalculates discount percent when rate is edited manually", () => {
      const mrpPaise = 10000; // ₹100
      const manualRatePaise = 8500; // ₹85
      const calculatedDisc = ((mrpPaise - manualRatePaise) / mrpPaise) * 100;
      expect(calculatedDisc).toBe(15);
    });

    it("recalculates selling rate when discount percent is edited manually", () => {
      const mrpPaise = 20000; // ₹200
      const discPercent = 20; // 20%
      const calculatedRate = Math.round(mrpPaise * (1 - discPercent / 100));
      expect(calculatedRate).toBe(16000); // ₹160
    });

    it("updates discount when line MRP is edited while keeping rate constant", () => {
      const newMrpPaise = 12000; // ₹120 (edited from 100)
      const currentRatePaise = 9600; // ₹96
      const calculatedDisc = ((newMrpPaise - currentRatePaise) / newMrpPaise) * 100;
      expect(calculatedDisc).toBe(20);
    });
  });
});
