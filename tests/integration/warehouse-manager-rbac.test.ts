import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import { hasPermission, assertPermission, Permission, ForbiddenError, canAccessRoute } from "@/modules/auth/permissions";

describe("Warehouse Manager RBAC & Permission Verification", () => {
  it("allows WAREHOUSE_MANAGER to import products, manage orders, and view invoices", () => {
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.IMPORT_PRODUCTS)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.STOCK_RECEIVE)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.STOCK_ADJUST)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.STOCK_TRANSFER)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.MANAGE_ORDERS)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.VIEW_ORDERS)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.VIEW_INVOICES)).toBe(true);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.DISPATCH_MANAGE)).toBe(true);
  });

  it("blocks WAREHOUSE_MANAGER from managing users, settings, and cancelling bills (403)", () => {
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.MANAGE_USERS)).toBe(false);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.SYSTEM_ADMIN)).toBe(false);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.MANAGE_SETTINGS)).toBe(false);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.BILL_CANCEL)).toBe(false);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.OVERRIDE_CREDIT_LIMIT)).toBe(false);
    expect(hasPermission(UserRole.WAREHOUSE_MANAGER, Permission.VIEW_AUDIT_LOGS)).toBe(false);

    expect(() => {
      assertPermission(UserRole.WAREHOUSE_MANAGER, Permission.MANAGE_USERS);
    }).toThrow(ForbiddenError);

    expect(() => {
      assertPermission(UserRole.WAREHOUSE_MANAGER, Permission.BILL_CANCEL);
    }).toThrow(ForbiddenError);
  });

  it("enforces allowed routes for WAREHOUSE_MANAGER", () => {
    expect(canAccessRoute(UserRole.WAREHOUSE_MANAGER, "/godown")).toBe(true);
    expect(canAccessRoute(UserRole.WAREHOUSE_MANAGER, "/godown/dispatch")).toBe(true);
    expect(canAccessRoute(UserRole.WAREHOUSE_MANAGER, "/admin/catalog")).toBe(true);
    expect(canAccessRoute(UserRole.WAREHOUSE_MANAGER, "/shop/invoices")).toBe(true);
    expect(canAccessRoute(UserRole.WAREHOUSE_MANAGER, "/admin/users")).toBe(false);
  });
});
