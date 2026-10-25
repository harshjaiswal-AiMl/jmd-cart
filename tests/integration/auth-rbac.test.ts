import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { authService, AccountLockedError, InvalidCredentialsError } from "@/modules/auth/auth.service";
import {
  Permission,
  ROLE_PERMISSIONS,
  assertPermission,
  canAccessRoute,
  ForbiddenError,
  hasPermission,
} from "@/modules/auth/permissions";
import { auditService, maskSensitiveData } from "@/modules/audit/audit.service";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

describe("Task 1.2: Authentication & RBAC System", () => {
  const cleanupTestUsers = async () => {
    const testPhones = ["9899999999", "9877777777"];
    const users = await prisma.user.findMany({ where: { phone: { in: testPhones } } });
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  };

  beforeEach(async () => {
    await cleanupTestUsers();
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  describe("Credentials Authentication & Lockout", () => {
    it("should authenticate seeded Super Admin with valid credentials", async () => {
      const user = await authService.authenticateWithCredentials("9876543210", "admin123");
      expect(user).toBeDefined();
      expect(user.phone).toBe("9876543210");
      expect(user.role).toBe(UserRole.SUPER_ADMIN);
      expect(user.name).toBe("Sachin Prakash");
    });

    it("should reject invalid credentials with InvalidCredentialsError", async () => {
      await expect(
        authService.authenticateWithCredentials("9876543210", "WrongPassword!")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("should enforce account lockout after 5 consecutive failed attempts", async () => {
      const testPhone = "9899999999";
      // Create a temporary user for lockout testing
      await prisma.user.create({
        data: {
          phone: testPhone,
          name: "Lockout Tester",
          passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz123456", // dummy hash
          role: UserRole.SHOP,
        },
      });

      // 4 failed attempts should throw InvalidCredentialsError
      for (let i = 0; i < 4; i++) {
        await expect(
          authService.authenticateWithCredentials(testPhone, "BadPass")
        ).rejects.toThrow(InvalidCredentialsError);
      }

      // 5th failed attempt should trigger lockout
      await expect(
        authService.authenticateWithCredentials(testPhone, "BadPass")
      ).rejects.toThrow();

      // 6th attempt should immediately throw AccountLockedError without even checking password
      await expect(
        authService.authenticateWithCredentials(testPhone, "AnyPass")
      ).rejects.toThrow(AccountLockedError);
    });
  });

  describe("Password Change Workflow", () => {
    it("should change password, clear mustChangePassword flag, and allow login with new password", async () => {
      // Find seeded super admin for actorId
      const admin = await prisma.user.findUniqueOrThrow({ where: { phone: "9876543210" } });

      // Create user with mustChangePassword = true
      const staffPhone = "9877777777";
      const user = await authService.createStaffUser(
        UserRole.SUPER_ADMIN,
        admin.id,
        {
          name: "New Staff",
          phone: staffPhone,
          role: UserRole.GODOWN,
          tempPassword: "TempPassword123!",
        }
      );

      expect(user.mustChangePassword).toBe(true);

      // Successfully authenticate with temp password
      const loggedIn = await authService.authenticateWithCredentials(staffPhone, "TempPassword123!");
      expect(loggedIn.mustChangePassword).toBe(true);

      // Change password
      await authService.changePassword(user.id, "TempPassword123!", "NewPermanentPass456!");

      // Verify user in DB has mustChangePassword = false
      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updatedUser.mustChangePassword).toBe(false);

      // Authenticate with new password succeeds
      const reLoggedIn = await authService.authenticateWithCredentials(staffPhone, "NewPermanentPass456!");
      expect(reLoggedIn.mustChangePassword).toBe(false);
    });
  });

  describe("RBAC Permissions and Route Guards", () => {
    it("should grant Super Admin all permissions", () => {
      for (const permission of Object.values(Permission)) {
        expect(hasPermission(UserRole.SUPER_ADMIN, permission)).toBe(true);
      }
    });

    it("should enforce Godown role permissions correctly", () => {
      expect(hasPermission(UserRole.GODOWN, Permission.STOCK_RECEIVE)).toBe(true);
      expect(hasPermission(UserRole.GODOWN, Permission.STOCK_TRANSFER)).toBe(true);
      expect(hasPermission(UserRole.GODOWN, Permission.POS_BILL)).toBe(false);
      expect(hasPermission(UserRole.GODOWN, Permission.BILL_CANCEL)).toBe(false);

      expect(() => assertPermission(UserRole.GODOWN, Permission.STOCK_RECEIVE)).not.toThrow();
      expect(() => assertPermission(UserRole.GODOWN, Permission.BILL_CANCEL)).toThrow(ForbiddenError);
    });

    it("should enforce Shop role permissions correctly", () => {
      expect(hasPermission(UserRole.SHOP, Permission.POS_BILL)).toBe(true);
      expect(hasPermission(UserRole.SHOP, Permission.POS_HOLD_RESUME)).toBe(true);
      expect(hasPermission(UserRole.SHOP, Permission.STOCK_ADJUST)).toBe(false);
      expect(hasPermission(UserRole.SHOP, Permission.MANAGE_SETTINGS)).toBe(false);

      expect(() => assertPermission(UserRole.SHOP, Permission.POS_BILL)).not.toThrow();
      expect(() => assertPermission(UserRole.SHOP, Permission.MANAGE_SETTINGS)).toThrow(ForbiddenError);
    });

    it("should correctly evaluate route access per role", () => {
      // Super admin can access all routes
      expect(canAccessRoute(UserRole.SUPER_ADMIN, "/admin")).toBe(true);
      expect(canAccessRoute(UserRole.SUPER_ADMIN, "/godown")).toBe(true);
      expect(canAccessRoute(UserRole.SUPER_ADMIN, "/shop")).toBe(true);

      // Godown can only access godown routes
      expect(canAccessRoute(UserRole.GODOWN, "/godown")).toBe(true);
      expect(canAccessRoute(UserRole.GODOWN, "/godown/transfers")).toBe(true);
      expect(canAccessRoute(UserRole.GODOWN, "/shop")).toBe(false);
      expect(canAccessRoute(UserRole.GODOWN, "/admin")).toBe(false);

      // Shop can only access shop routes
      expect(canAccessRoute(UserRole.SHOP, "/shop")).toBe(true);
      expect(canAccessRoute(UserRole.SHOP, "/admin")).toBe(false);
      expect(canAccessRoute(UserRole.SHOP, "/godown")).toBe(false);

      // Salesperson can only access van routes
      expect(canAccessRoute(UserRole.SALESPERSON, "/van")).toBe(true);
      expect(canAccessRoute(UserRole.SALESPERSON, "/shop")).toBe(false);
    });
  });

  describe("Audit Log & Sensitive Data Masking", () => {
    it("should mask passwords, secrets, and phone numbers in audit logs", () => {
      const payload = {
        password: "SecretPassword123!",
        userSecret: "super-confidential",
        phone: "9876543210",
        email: "test@idms.local",
        nested: {
          apiToken: "tok_12345",
          phone: "9812345678",
        },
      };

      const masked = maskSensitiveData(payload) as Record<string, any>;
      expect(masked.password).toBe("[REDACTED]");
      expect(masked.userSecret).toBe("[REDACTED]");
      expect(masked.phone).toBe("98****3210");
      expect(masked.email).toBe("test@idms.local");
      expect(masked.nested.apiToken).toBe("[REDACTED]");
      expect(masked.nested.phone).toBe("98****5678");
    });

    it("should persist audit logs to database", async () => {
      const audit = await auditService.log({
        action: "TEST_ACTION",
        entity: "TestEntity",
        entityId: "123",
        after: { sample: "value", password: "should-be-redacted" },
      });

      expect(audit.id).toBeDefined();
      expect(audit.action).toBe("TEST_ACTION");
      expect((audit.after as any).password).toBe("[REDACTED]");

      // Clean up audit log row
      await prisma.auditLog.delete({ where: { id: audit.id } });
    });
  });
});
