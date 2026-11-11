import { describe, it, expect } from "vitest";
import { Permission, ROLE_PERMISSIONS } from "@/modules/auth/permissions";

describe("R1: Roles Matrix New Permissions & Baseline Defaults", () => {
  it("defines pos.deleteBill and invoice.void enabled only for SUPER_ADMIN and ADMIN by default", () => {
    expect((Permission as Record<string, string>).POS_DELETE_BILL).toBe("pos.deleteBill");
    expect((Permission as Record<string, string>).INVOICE_VOID).toBe("invoice.void");

    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain("pos.deleteBill");
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain("invoice.void");
    expect(ROLE_PERMISSIONS.ADMIN).toContain("pos.deleteBill");
    expect(ROLE_PERMISSIONS.ADMIN).toContain("invoice.void");

    expect(ROLE_PERMISSIONS.SHOP).not.toContain("pos.deleteBill");
    expect(ROLE_PERMISSIONS.SHOP).not.toContain("invoice.void");
    expect(ROLE_PERMISSIONS.SALESPERSON).not.toContain("pos.deleteBill");
    expect(ROLE_PERMISSIONS.SALESPERSON).not.toContain("invoice.void");
  });
});
