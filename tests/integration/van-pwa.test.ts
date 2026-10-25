import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import manifest from "@/app/manifest";
import { UserRole } from "@prisma/client";
import {
  Permission,
  hasPermission,
  canAccessRoute,
  getDefaultDashboard,
} from "@/modules/auth/permissions";

describe("Task 2.3: Van PWA Shell, Install, and Role Routing", () => {
  describe("Web App Manifest Configuration", () => {
    it("should return valid PWA manifest metadata via manifest()", () => {
      const manifestData = manifest();

      expect(manifestData.name).toBe("JMD Cart IDMS - Van Sales");
      expect(manifestData.short_name).toBe("Van Sales");
      expect(manifestData.start_url).toBe("/van");
      expect(manifestData.display).toBe("standalone");
      expect(manifestData.theme_color).toBe("#0f172a");
      expect(manifestData.background_color).toBe("#0f172a");
      expect(manifestData.icons).toBeDefined();
      expect(manifestData.icons?.length).toBeGreaterThanOrEqual(2);

      const has192 = manifestData.icons?.some((i) => i.sizes === "192x192");
      const has512 = manifestData.icons?.some((i) => i.sizes === "512x512");
      expect(has192).toBe(true);
      expect(has512).toBe(true);
    });

    it("should have matching static public/manifest.json file", () => {
      const manifestPath = path.join(process.cwd(), "public", "manifest.json");
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      expect(content.start_url).toBe("/van");
      expect(content.display).toBe("standalone");
      expect(content.theme_color).toBe("#0f172a");
      expect(content.icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Service Worker & PWA Static Shell Assets", () => {
    it("should have public/sw.js with offline cache and navigation fallback", () => {
      const swPath = path.join(process.cwd(), "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("addEventListener(\"install\"");
      expect(content).toContain("addEventListener(\"activate\"");
      expect(content).toContain("addEventListener(\"fetch\"");
      expect(content).toContain("/van");
      expect(content).toContain("/offline");
      expect(content).toContain("SKIP_WAITING");
    });

    it("should have valid PWA icons in public/icons and favicon", () => {
      const icon192 = path.join(process.cwd(), "public", "icons", "icon-192.png");
      const icon512 = path.join(process.cwd(), "public", "icons", "icon-512.png");
      const maskable = path.join(process.cwd(), "public", "icons", "icon-maskable.png");
      const favicon = path.join(process.cwd(), "public", "favicon.ico");

      expect(fs.existsSync(icon192)).toBe(true);
      expect(fs.statSync(icon192).size).toBeGreaterThan(500);

      expect(fs.existsSync(icon512)).toBe(true);
      expect(fs.statSync(icon512).size).toBeGreaterThan(1000);

      expect(fs.existsSync(maskable)).toBe(true);
      expect(fs.statSync(maskable).size).toBeGreaterThan(1000);

      expect(fs.existsSync(favicon)).toBe(true);
      expect(fs.statSync(favicon).size).toBeGreaterThan(100);
    });
  });

  describe("Salesperson Role Routing & Redirection", () => {
    it("should route Salesperson directly to /van upon login", () => {
      expect(getDefaultDashboard(UserRole.SALESPERSON)).toBe("/van");
    });

    it("should route other staff roles to their respective dashboards", () => {
      expect(getDefaultDashboard(UserRole.SUPER_ADMIN)).toBe("/admin");
      expect(getDefaultDashboard(UserRole.GODOWN)).toBe("/godown");
      expect(getDefaultDashboard(UserRole.SHOP)).toBe("/shop");
      expect(getDefaultDashboard(UserRole.DELIVERY)).toBe("/delivery");
      expect(getDefaultDashboard(UserRole.ACCOUNTS)).toBe("/accounts");
      expect(getDefaultDashboard(UserRole.CUSTOMER)).toBe("/store");
      expect(getDefaultDashboard(undefined)).toBe("/login");
    });

    it("should allow Salesperson and Super Admin to access /van and van sub-routes", () => {
      const vanRoutes = [
        "/van",
        "/van/billing",
        "/van/bills",
        "/van/reconciliation",
      ];

      for (const route of vanRoutes) {
        expect(canAccessRoute(UserRole.SALESPERSON, route)).toBe(true);
        expect(canAccessRoute(UserRole.SUPER_ADMIN, route)).toBe(true);
      }
    });

    it("should block non-van staff from accessing /van routes", () => {
      expect(canAccessRoute(UserRole.GODOWN, "/van")).toBe(false);
      expect(canAccessRoute(UserRole.SHOP, "/van")).toBe(false);
      expect(canAccessRoute(UserRole.DELIVERY, "/van")).toBe(false);
      expect(canAccessRoute(UserRole.ACCOUNTS, "/van")).toBe(false);
      expect(canAccessRoute(UserRole.CUSTOMER, "/van")).toBe(false);
    });

    it("should block Salesperson from accessing administrative and warehouse routes", () => {
      expect(canAccessRoute(UserRole.SALESPERSON, "/admin")).toBe(false);
      expect(canAccessRoute(UserRole.SALESPERSON, "/admin/settings")).toBe(false);
      expect(canAccessRoute(UserRole.SALESPERSON, "/godown")).toBe(false);
      expect(canAccessRoute(UserRole.SALESPERSON, "/godown/purchases")).toBe(false);
      expect(canAccessRoute(UserRole.SALESPERSON, "/shop")).toBe(false);
      expect(canAccessRoute(UserRole.SALESPERSON, "/accounts")).toBe(false);
    });
  });

  describe("Salesperson Permissions Matrix", () => {
    it("should grant van billing and reconciliation permissions to Salesperson", () => {
      expect(hasPermission(UserRole.SALESPERSON, Permission.VAN_BILL)).toBe(true);
      expect(hasPermission(UserRole.SALESPERSON, Permission.VAN_RECONCILE)).toBe(true);
      expect(hasPermission(UserRole.SALESPERSON, Permission.VIEW_PRODUCTS)).toBe(true);
      expect(hasPermission(UserRole.SALESPERSON, Permission.STOCK_VIEW)).toBe(true);
      expect(hasPermission(UserRole.SALESPERSON, Permission.VIEW_PARTIES)).toBe(true);
    });

    it("should deny godown and administrative permissions to Salesperson", () => {
      expect(hasPermission(UserRole.SALESPERSON, Permission.SYSTEM_ADMIN)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.MANAGE_SETTINGS)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.STOCK_RECEIVE)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.STOCK_CARTON_BREAK)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.STOCK_ADJUST)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.POS_BILL)).toBe(false);
      expect(hasPermission(UserRole.SALESPERSON, Permission.BILL_CANCEL)).toBe(false);
    });
  });
});
