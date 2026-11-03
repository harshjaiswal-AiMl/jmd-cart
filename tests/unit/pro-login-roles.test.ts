import { describe, it, expect, beforeEach } from "vitest";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { authService } from "@/modules/auth/auth.service";
import {
  getDefaultDashboard,
  getDefaultAppForRole,
  ROLE_PERMISSIONS,
  ROLE_ALLOWED_ROUTES,
  canAccessRoute,
} from "@/modules/auth/permissions";

describe("Prompt #19 Part A: PRO Login & Role Exhaustiveness", () => {
  const testPassword = "Password@123";

  it("proves getDefaultDashboard returns /app/pro for PRO role", () => {
    const dashboard = getDefaultDashboard(UserRole.PRO);
    expect(dashboard).toBe("/app/pro");
  });

  it("proves getDefaultAppForRole returns /app/pro for PRO role", () => {
    const app = getDefaultAppForRole(UserRole.PRO);
    expect(app).toBe("/app/pro");
  });

  it("proves PRO can access /app/pro route", () => {
    expect(canAccessRoute(UserRole.PRO, "/app/pro")).toBe(true);
    expect(canAccessRoute(UserRole.PRO, "/app/pro/orders")).toBe(true);
  });

  it("verifies compile-time exhaustiveness: EVERY role in UserRole enum has a valid home dashboard and app route", () => {
    const allRoles = Object.values(UserRole);
    expect(allRoles.length).toBeGreaterThan(0);

    for (const role of allRoles) {
      const dashboard = getDefaultDashboard(role);
      expect(dashboard, `Role ${role} must have a defined dashboard route, got ${dashboard}`).not.toBe("/login");
      expect(dashboard.startsWith("/"), `Role ${role} dashboard must be absolute path`).toBe(true);

      const app = getDefaultAppForRole(role);
      expect(app, `Role ${role} must have a defined app route, got ${app}`).not.toBe("/login");
      expect(app.startsWith("/"), `Role ${role} app route must be absolute path`).toBe(true);

      expect(ROLE_PERMISSIONS[role], `Role ${role} must have defined permissions in ROLE_PERMISSIONS`).toBeDefined();
      expect(Array.isArray(ROLE_PERMISSIONS[role]), `Role ${role} permissions must be array`).toBe(true);

      expect(ROLE_ALLOWED_ROUTES[role], `Role ${role} must have defined routes in ROLE_ALLOWED_ROUTES`).toBeDefined();
      expect(Array.isArray(ROLE_ALLOWED_ROUTES[role]), `Role ${role} allowed routes must be array`).toBe(true);
    }
  });

  describe("Authentication behavior across roles", () => {
    let passwordHash: string;

    beforeEach(async () => {
      passwordHash = await bcrypt.hash(testPassword, 10);
    });

    it("authenticates PRO user and returns proper user and home dashboard", async () => {
      const proUser = await prisma.user.upsert({
        where: { phone: "9876599999" },
        update: { active: true, role: UserRole.PRO, passwordHash },
        create: {
          phone: "9876599999",
          name: "Test PRO Officer",
          role: UserRole.PRO,
          passwordHash,
          active: true,
        },
      });

      const authenticated = await authService.authenticateWithCredentials("9876599999", testPassword);
      expect(authenticated.id).toBe(proUser.id);
      expect(authenticated.role).toBe(UserRole.PRO);
      expect(getDefaultDashboard(authenticated.role)).toBe("/app/pro");
    });

    it("rejects inactive user with descriptive error", async () => {
      await prisma.user.upsert({
        where: { phone: "9876599998" },
        update: { active: false, role: UserRole.PRO, passwordHash },
        create: {
          phone: "9876599998",
          name: "Inactive PRO",
          role: UserRole.PRO,
          passwordHash,
          active: false,
        },
      });

      await expect(
        authService.authenticateWithCredentials("987659998", testPassword)
      ).rejects.toThrow("Invalid");
    });

    it("rejects wrong password with descriptive error", async () => {
      await prisma.user.upsert({
        where: { phone: "9876599999" },
        update: { active: true, role: UserRole.PRO, passwordHash },
        create: {
          phone: "9876599999",
          name: "Test PRO Officer",
          role: UserRole.PRO,
          passwordHash,
          active: true,
        },
      });

      await expect(
        authService.authenticateWithCredentials("9876599999", "WrongPassword123!")
      ).rejects.toThrow("Invalid");
    });

    it("iterates all UserRole values and proves valid credentials authenticate and resolve dashboard", async () => {
      const allRoles = Object.values(UserRole);

      for (let i = 0; i < allRoles.length; i++) {
        const role = allRoles[i];
        const phone = `98765001${String(i).padStart(2, "0")}`;

        await prisma.user.upsert({
          where: { phone },
          update: { active: true, role, passwordHash },
          create: {
            phone,
            name: `Test User ${role}`,
            role,
            passwordHash,
            active: true,
          },
        });

        const auth = await authService.authenticateWithCredentials(phone, testPassword);
        expect(auth.role).toBe(role);

        const home = getDefaultDashboard(auth.role);
        expect(home).not.toBe("/login");
        expect(home.startsWith("/")).toBe(true);
      }
    });
  });
});
