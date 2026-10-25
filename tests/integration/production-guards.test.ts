import { describe, it, expect, afterEach } from "vitest";
import {
  isLocalDatabaseHost,
  validateDatabaseHost,
  BYPASS_FLAG,
} from "../../scripts/guard-local-db";
import {
  normalizeHost,
  evaluateHostRouting,
  STAFF_ROUTES,
} from "@/lib/host-routing";
import { validateSetupToken } from "@/app/setup/setup-guard";

describe("Production Guards & Deployment Readiness Tests", () => {
  describe("1. guard-local-db: Hostname Check", () => {
    it("passes for localhost, 127.0.0.1, ::1, and 0.0.0.0", () => {
      expect(isLocalDatabaseHost("postgresql://postgres:postgres@localhost:5432/idms")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://postgres:postgres@127.0.0.1:5432/idms")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://postgres:postgres@[::1]:5432/idms")).toBe(true);
      expect(isLocalDatabaseHost("postgresql://postgres:postgres@0.0.0.0:5432/idms")).toBe(true);

      const localRes = validateDatabaseHost("postgresql://postgres:postgres@localhost:5432/idms", []);
      expect(localRes.ok).toBe(true);
    });

    it("blocks non-local hostnames (e.g. postgres.railway.internal or remote production db)", () => {
      const railwayUrl = "postgresql://postgres:secret@postgres.railway.internal:5432/railway";
      expect(isLocalDatabaseHost(railwayUrl)).toBe(false);

      const prodRes = validateDatabaseHost(railwayUrl, []);
      expect(prodRes.ok).toBe(false);
      expect(prodRes.reason).toMatch(/BLOCKED: DATABASE_URL points to non-local host/);

      const awsRes = validateDatabaseHost("postgresql://admin:secret@rds.us-east-1.amazonaws.com:5432/db", []);
      expect(awsRes.ok).toBe(false);
    });

    it("allows non-local hostname when bypass flag --i-know-this-is-not-local is supplied", () => {
      const railwayUrl = "postgresql://postgres:secret@postgres.railway.internal:5432/railway";
      const bypassed = validateDatabaseHost(railwayUrl, [BYPASS_FLAG]);
      expect(bypassed.ok).toBe(true);
    });
  });

  describe("2. Host Routing Logic", () => {
    it("normalizes hostnames by stripping port, trimming, and lowercasing", () => {
      expect(normalizeHost("jmdcart.com:3000")).toBe("jmdcart.com");
      expect(normalizeHost("  MANAGEMENT.JMDCART.COM:8080 ")).toBe("management.jmdcart.com");
      expect(normalizeHost("localhost:3000")).toBe("localhost");
      expect(normalizeHost("[::1]:3000")).toBe("::1");
      expect(normalizeHost("")).toBe("");
      expect(normalizeHost(null)).toBe("");
    });

    describe("when STOREFRONT_HOST is set", () => {
      const env = {
        storefrontHost: "jmdcart.com",
        managementHost: "management.jmdcart.com",
        appUrl: "https://jmdcart.com",
      };

      it("returns 404 for all staff routes (/admin, /godown, /shop, /van, /delivery, /reports, /setup, /management)", () => {
        for (const staffRoute of STAFF_ROUTES) {
          const decision = evaluateHostRouting("jmdcart.com", staffRoute, "", env);
          expect(decision).toEqual({ type: "404", status: 404 });

          // Sub-paths of staff routes must also return 404
          const subPathDecision = evaluateHostRouting("jmdcart.com", `${staffRoute}/sub-page`, "", env);
          expect(subPathDecision).toEqual({ type: "404", status: 404 });
        }
      });

      it("allows storefront routes: /, /store, /store/*, /login, /register, /verify-phone", () => {
        expect(evaluateHostRouting("jmdcart.com", "/", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("jmdcart.com", "/store", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("jmdcart.com", "/store/category/groceries", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("jmdcart.com", "/login", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("jmdcart.com", "/register", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("jmdcart.com", "/verify-phone", "", env)).toEqual({ type: "next" });
      });
    });

    describe("when MANAGEMENT_HOST is set", () => {
      const env = {
        storefrontHost: "jmdcart.com",
        managementHost: "management.jmdcart.com",
        appUrl: "https://jmdcart.com",
      };

      it("redirects / to /login", () => {
        const decision = evaluateHostRouting("management.jmdcart.com", "/", "", env);
        expect(decision).toEqual({ type: "redirect", destination: "/login" });
      });

      it("redirects /store and /store/* to APP_URL", () => {
        const storeDecision = evaluateHostRouting("management.jmdcart.com", "/store", "", env);
        expect(storeDecision).toEqual({
          type: "redirect",
          destination: "https://jmdcart.com/store",
        });

        const subStoreDecision = evaluateHostRouting("management.jmdcart.com", "/store/products/123", "?page=1", env);
        expect(subStoreDecision).toEqual({
          type: "redirect",
          destination: "https://jmdcart.com/store/products/123?page=1",
        });
      });

      it("allows staff routes without host restrictions", () => {
        expect(evaluateHostRouting("management.jmdcart.com", "/admin", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("management.jmdcart.com", "/godown", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("management.jmdcart.com", "/shop", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("management.jmdcart.com", "/van", "", env)).toEqual({ type: "next" });
        expect(evaluateHostRouting("management.jmdcart.com", "/setup", "", env)).toEqual({ type: "next" });
      });
    });

    describe("when no host env vars are set (or dev mode)", () => {
      it("allows both storefront and staff routes in all-in-one dev mode", () => {
        const emptyEnv = { storefrontHost: "", managementHost: "" };
        expect(evaluateHostRouting("localhost:3000", "/admin", "", emptyEnv)).toEqual({ type: "next" });
        expect(evaluateHostRouting("localhost:3000", "/store", "", emptyEnv)).toEqual({ type: "next" });
        expect(evaluateHostRouting("localhost:3000", "/", "", emptyEnv)).toEqual({ type: "next" });

        // Localhost bypasses even if production host envs are configured
        const prodEnv = {
          storefrontHost: "jmdcart.com",
          managementHost: "management.jmdcart.com",
        };
        expect(evaluateHostRouting("localhost:3000", "/admin", "", prodEnv)).toEqual({ type: "next" });
        expect(evaluateHostRouting("127.0.0.1:3000", "/admin", "", prodEnv)).toEqual({ type: "next" });
      });
    });
  });

  describe("3. Setup Token Protection", () => {
    it("blocks wrong token and missing token, returning 404 in production", () => {
      const secret = "production-super-secret-setup-token";

      // Wrong token
      const wrong = validateSetupToken("wrong-token", secret, "production");
      expect(wrong.allowed).toBe(false);
      expect(wrong.status).toBe(404);

      // Missing token
      const missing = validateSetupToken(undefined, secret, "production");
      expect(missing.allowed).toBe(false);
      expect(missing.status).toBe(404);

      // Empty token string
      const empty = validateSetupToken("", secret, "production");
      expect(empty.allowed).toBe(false);
      expect(empty.status).toBe(404);
    });

    it("allows valid token in production", () => {
      const secret = "production-super-secret-setup-token";
      const valid = validateSetupToken(secret, secret, "production");
      expect(valid.allowed).toBe(true);

      // Array format (from multi-param query string)
      const validArr = validateSetupToken([secret, "extra"], secret, "production");
      expect(validArr.allowed).toBe(true);
    });

    it("passes regardless of token in development environment", () => {
      const secret = "production-super-secret-setup-token";
      expect(validateSetupToken("wrong-token", secret, "development").allowed).toBe(true);
      expect(validateSetupToken(undefined, secret, "development").allowed).toBe(true);
    });

    it("passes in production if SETUP_TOKEN is not configured or empty", () => {
      expect(validateSetupToken("anything", "", "production").allowed).toBe(true);
      expect(validateSetupToken("anything", "   ", "production").allowed).toBe(true);
    });
  });
});
