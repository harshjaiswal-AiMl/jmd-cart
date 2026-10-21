import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { UserRole } from "@prisma/client";
import {
  NAV_ITEMS,
  NAV_GROUP_ORDER,
  getNavGroupsForRole,
  canRoleAccessNavHref,
} from "@/config/nav.config";

describe("Part 4 — Sidebar Navigation & Route Verification (nav.config.ts)", () => {
  it("1. exposes all 10 groups and every nav item to SUPER_ADMIN and ADMIN", () => {
    const superGroups = getNavGroupsForRole(UserRole.SUPER_ADMIN);
    const adminGroups = getNavGroupsForRole(UserRole.ADMIN);

    expect(superGroups.map((g) => g.name)).toEqual(
      NAV_GROUP_ORDER.map((g) => g.name)
    );
    expect(adminGroups.map((g) => g.name)).toEqual(
      NAV_GROUP_ORDER.map((g) => g.name)
    );

    const totalSuperItems = superGroups.reduce(
      (sum, g) => sum + g.items.length,
      0
    );
    const totalAdminItems = adminGroups.reduce(
      (sum, g) => sum + g.items.length,
      0
    );

    expect(totalSuperItems).toBe(NAV_ITEMS.length);
    expect(totalAdminItems).toBe(NAV_ITEMS.length);
  });

  it("2. restricts GODOWN (Warehouse Manager) to Dashboard, Inventory, Van, Catalog (read-only + stock upload), and Reports", () => {
    const godownGroups = getNavGroupsForRole(UserRole.GODOWN);
    const groupNames = godownGroups.map((g) => g.name);

    expect(groupNames).toEqual([
      "Dashboard",
      "Inventory",
      "Van",
      "Catalog",
      "Reports",
    ]);
    expect(groupNames).not.toContain("Admin");
    expect(groupNames).not.toContain("Accounts");
    expect(groupNames).not.toContain("Sales");

    // Verify Update Stock & Excel Upload is visible to GODOWN
    const invGroup = godownGroups.find((g) => g.name === "Inventory")!;
    expect(
      invGroup.items.some((i) => i.href === "/godown/stock/update")
    ).toBe(true);

    // Verify Catalog items visible to GODOWN are marked readOnlyForRoles: [GODOWN]
    const catGroup = godownGroups.find((g) => g.name === "Catalog")!;
    for (const item of catGroup.items) {
      expect(item.readOnlyForRoles).toContain(UserRole.GODOWN);
    }

    // Verify route guard helper
    expect(canRoleAccessNavHref(UserRole.GODOWN, "/godown/stock/update")).toBe(
      true
    );
    expect(canRoleAccessNavHref(UserRole.GODOWN, "/admin/catalog/import")).toBe(
      false
    );
    expect(canRoleAccessNavHref(UserRole.GODOWN, "/admin/crud/users")).toBe(
      false
    );
  });

  it("3. verifies every single href in NAV_ITEMS resolves to a real Next.js page in src/app (zero 404s)", () => {
    const appDir = path.resolve(process.cwd(), "src/app");

    for (const item of NAV_ITEMS) {
      const cleanPath = item.href.split("?")[0];
      const segments = cleanPath.split("/").filter(Boolean);

      // Direct page path e.g. src/app/admin/catalog/page.tsx
      const directPagePath = path.join(appDir, ...segments, "page.tsx");

      // Dynamic [entity] route e.g. /admin/crud/companies -> src/app/admin/crud/[entity]/page.tsx
      const dynamicCrudPagePath =
        segments[0] === "admin" &&
        segments[1] === "crud" &&
        segments.length === 3
          ? path.join(appDir, "admin", "crud", "[entity]", "page.tsx")
          : null;

      const exists =
        fs.existsSync(directPagePath) ||
        (dynamicCrudPagePath !== null && fs.existsSync(dynamicCrudPagePath));

      expect(
        exists,
        `Expected route ${item.href} (${item.label}) to have a page.tsx at ${directPagePath}`
      ).toBe(true);
    }
  });
});
