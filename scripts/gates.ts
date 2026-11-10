import { execSync, spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { setup as setupTestDb, teardown as teardownTestDb } from "../tests/global-setup";
import { Permission, ROLE_PERMISSIONS } from "../src/modules/auth/permissions";

interface GateResult {
  gate: string;
  status: "PASS" | "FAIL";
  evidence: string;
  artifactPath: string;
}

const artifactsDir = path.resolve(process.cwd(), "artifacts");
const baselineDir = path.join(artifactsDir, "baseline");
const baselineScreenshotsDir = path.join(baselineDir, "screenshots");
const currentScreenshotsDir = path.join(artifactsDir, "x1-screenshots");

fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(currentScreenshotsDir, { recursive: true });

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/idms_test?schema=public";
const AUTH_SECRET =
  process.env.AUTH_SECRET || "local-e2e-test-secret-key-at-least-32-chars";
const BASE_URL = "http://127.0.0.1:3000";

function runSync(
  cmd: string,
  extraEnv: Record<string, string> = {}
): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
      maxBuffer: 20 * 1024 * 1024,
    });
    return { success: true, output };
  } catch (err: any) {
    return {
      success: false,
      output: (err.stdout || "") + "\n" + (err.stderr || "") + "\n" + err.message,
    };
  }
}

async function waitForHealth(url: string, timeoutMs = 45000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function checkPermissionSnapshotDiff(): { passed: boolean; evidence: string } {
  const snapPath = path.join(baselineDir, "permissions-snapshot.json");
  if (!fs.existsSync(snapPath)) {
    return { passed: false, evidence: "Missing artifacts/baseline/permissions-snapshot.json" };
  }
  const baseline = JSON.parse(fs.readFileSync(snapPath, "utf8"));
  const allowedNewKeys = new Set(["pos.deleteBill", "invoice.void"]);
  const diffs: string[] = [];

  const curPerms = Object.values(Permission);
  const newPerms = curPerms.filter((p) => !baseline.permissions.includes(p));
  const removedPerms = baseline.permissions.filter((p: string) => !curPerms.includes(p as Permission));
  for (const p of newPerms) {
    if (!allowedNewKeys.has(p)) diffs.push(`Unexpected new permission: ${p}`);
  }
  for (const p of removedPerms) {
    diffs.push(`Removed permission: ${p}`);
  }

  for (const [role, oldList] of Object.entries(baseline.rolePermissions as Record<string, string[]>)) {
    const curList = (ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] || []).filter(
      (p) => !allowedNewKeys.has(p)
    );
    const oldSet = new Set(oldList);
    const curSet = new Set(curList);
    for (const p of oldList) {
      if (!curSet.has(p as Permission)) diffs.push(`${role} lost ${p}`);
    }
    for (const p of curList) {
      if (!oldSet.has(p)) diffs.push(`${role} gained unexpected ${p}`);
    }
  }

  if (diffs.length > 0) {
    return { passed: false, evidence: diffs.slice(0, 3).join("; ") };
  }
  return {
    passed: true,
    evidence: `Exact match across ${Object.keys(baseline.rolePermissions).length} roles (+${newPerms.length} R1 perms)`,
  };
}

async function compareBaselineScreenshots(): Promise<{ passed: boolean; evidence: string }> {
  if (!fs.existsSync(baselineScreenshotsDir)) {
    return { passed: false, evidence: "Baseline screenshots missing" };
  }
  const files = fs.readdirSync(baselineScreenshotsDir).filter((f) => f.endsWith(".png"));
  if (files.length < 12) {
    return { passed: false, evidence: `Expected 12 baseline PNGs, found ${files.length}` };
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  const firstProd = await prisma.product.findFirst({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  await prisma.$disconnect();

  const routes: Array<{ name: string; url: string }> = [
    { name: "dashboard", url: "/admin" },
    { name: "products", url: "/admin/catalog" },
    { name: "invoices-list", url: "/shop/invoices" },
    { name: "stock", url: "/godown/stock" },
    { name: "parties", url: "/admin/parties" },
    { name: "orders", url: "/admin/orders" },
    { name: "dispatch", url: "/godown/dispatch" },
    { name: "reports", url: "/reports" },
    { name: "settings", url: "/admin/settings" },
    { name: "storefront-home", url: "/" },
    { name: "storefront-product", url: firstProd ? `/store/products/${firstProd.id}` : "/store" },
    { name: "storefront-cart", url: "/store/cart" },
  ];

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  let maxDiffPct = 0;
  let worstRoute = "";
  const routeDiffs: Record<string, number> = {};

  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "load" });
    const submit = page.locator('button[type="submit"]');
    await submit.waitFor({ state: "visible" });
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await submit.click();
    await page.waitForURL("**/admin**", { timeout: 30000, waitUntil: "commit" });
    await page.waitForLoadState("networkidle").catch(() => {});

    for (const r of routes) {
      await page.goto(`${BASE_URL}${r.url}`, { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(300);
      const curPath = path.join(currentScreenshotsDir, `${r.name}.png`);
      await page.screenshot({ path: curPath, fullPage: false });

      const baseImg = await sharp(path.join(baselineScreenshotsDir, `${r.name}.png`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const curImg = await sharp(curPath)
        .resize(baseImg.info.width, baseImg.info.height)
        .ensureAlpha()
        .raw()
        .toBuffer();

      const totalPixels = baseImg.info.width * baseImg.info.height;
      let changedPixels = 0;
      for (let i = 0; i < totalPixels; i++) {
        const off = i * 4;
        if (
          Math.abs(baseImg.data[off] - curImg[off]) > 4 ||
          Math.abs(baseImg.data[off + 1] - curImg[off + 1]) > 4 ||
          Math.abs(baseImg.data[off + 2] - curImg[off + 2]) > 4
        ) {
          changedPixels++;
        }
      }
      const diffPct = Number(((changedPixels / totalPixels) * 100).toFixed(4));
      routeDiffs[r.name] = diffPct;
      if (diffPct > maxDiffPct) {
        maxDiffPct = diffPct;
        worstRoute = r.name;
      }
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(artifactsDir, "x1-screenshot-diff.json"), JSON.stringify(routeDiffs, null, 2));
  const passed = maxDiffPct <= 0.1;
  return {
    passed,
    evidence: `${routes.length} routes checked, max pixel diff ${maxDiffPct}% (${worstRoute || "none"}, target <= 0.1%)`,
  };
}

async function main() {
  const isRepeat = process.argv.includes("--repeat");
  const needRebuild = process.argv.includes("--rebuild") || !fs.existsSync(path.resolve(".next/BUILD_ID"));

  console.log("=== Prompt 09 Gates Harness (Scope-Locked) ===");
  const typecheck = runSync("pnpm typecheck");
  fs.writeFileSync(path.join(artifactsDir, "typecheck.log"), typecheck.output, "utf8");

  const lint = runSync("pnpm lint");
  fs.writeFileSync(path.join(artifactsDir, "lint.log"), lint.output, "utf8");

  const unitRes = runSync("pnpm exec vitest --config vitest.unit.config.ts run tests/unit/smart-search.test.ts tests/unit/party-search.test.ts tests/unit/search-everywhere.test.ts tests/unit/gst.test.ts", {
    VITEST_UNIT: "true",
  });
  fs.writeFileSync(path.join(artifactsDir, "vitest-units.log"), unitRes.output, "utf8");

  if (needRebuild) {
    const buildRes = runSync("pnpm build", {
      DATABASE_URL: TEST_DB_URL,
      AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      NEXTAUTH_URL: BASE_URL,
    });
    fs.writeFileSync(path.join(artifactsDir, "build.log"), buildRes.output, "utf8");
    if (!buildRes.success) {
      console.error("Build failed! Check artifacts/build.log");
      process.exit(1);
    }
  }

  await setupTestDb();

  let serverProc: ChildProcess | null = null;
  let pwReport: any = { suites: [] };
  let x1ScreenshotDiff = { passed: false, evidence: "Not run" };

  try {
    serverProc = spawn("cmd.exe", ["/c", "pnpm start -H 127.0.0.1 -p 3000"], {
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
        AUTH_SECRET,
        NEXTAUTH_SECRET: AUTH_SECRET,
        NEXTAUTH_URL: BASE_URL,
        PORT: "3000",
      },
      stdio: "ignore",
    });

    const healthy = await waitForHealth(`${BASE_URL}/api/health`, 45000);
    if (!healthy) {
      throw new Error("Server failed to become healthy within 45s");
    }

    const repeatFlag = isRepeat ? "--repeat-each=5" : "--repeat-each=1";
    const pwRes = runSync(
      `pnpm exec playwright test -c playwright.prompt09.config.ts ${repeatFlag}`,
      {
        PLAYWRIGHT_BASE_URL: BASE_URL,
        DATABASE_URL: TEST_DB_URL,
      }
    );
    fs.writeFileSync(path.join(artifactsDir, "prompt09-playwright.log"), pwRes.output, "utf8");

    const pwJsonPath = path.join(artifactsDir, "prompt09-pw-report.json");
    if (fs.existsSync(pwJsonPath)) {
      pwReport = JSON.parse(fs.readFileSync(pwJsonPath, "utf8"));
    }

    x1ScreenshotDiff = await compareBaselineScreenshots();
  } finally {
    if (serverProc?.pid) {
      try {
        execSync(`taskkill /PID ${serverProc.pid} /T /F`, { stdio: "ignore" });
      } catch {}
    }
    await teardownTestDb();
  }

  const findPw = (prefix: string): { passed: boolean; msg: string } => {
    const specs: any[] = [];
    const walk = (s: any) => {
      for (const sp of s.specs || []) specs.push(sp);
      for (const ch of s.suites || []) walk(ch);
    };
    for (const s of pwReport.suites || []) walk(s);
    const matched = specs.filter((s) => String(s.title).startsWith(prefix));
    if (matched.length === 0) return { passed: false, msg: "Playwright test not found" };
    const total = matched.reduce((a, s) => a + (s.tests?.length || 0), 0);
    const ok = matched.reduce(
      (a, s) => a + (s.tests?.filter((t: any) => t.status === "expected").length || 0),
      0
    );
    const err = matched[0]?.tests?.[0]?.results?.[0]?.error?.message?.split("\n")[0] || "";
    return {
      passed: total > 0 && ok === total,
      msg: ok === total ? `${ok}/${total} Playwright PASS` : `${ok}/${total} PASS (${err.slice(0, 70)})`,
    };
  };

  const permDiff = checkPermissionSnapshotDiff();

  const results: GateResult[] = [
    {
      gate: "X0 Baseline & Type/Lint",
      status: typecheck.success && lint.success && fs.existsSync(path.join(baselineDir, "permissions-snapshot.json")) ? "PASS" : "FAIL",
      evidence: `typecheck=${typecheck.success ? "0 err" : "FAIL"}, lint=${lint.success ? "0 err" : "FAIL"}`,
      artifactPath: "artifacts/typecheck.log",
    },
    {
      gate: "R1 Roles Matrix Editable",
      status: findPw("R1:").passed ? "PASS" : "FAIL",
      evidence: findPw("R1:").msg,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "R2 Cashier Delete Bill / Void",
      status: findPw("R2:").passed ? "PASS" : "FAIL",
      evidence: findPw("R2:").msg,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "R5 POS Credit Default",
      status: findPw("R5:").passed ? "PASS" : "FAIL",
      evidence: findPw("R5:").msg,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "R6 One Product Search Engine",
      status: findPw("R6:").passed && unitRes.success ? "PASS" : "FAIL",
      evidence: `${findPw("R6:").msg}; unit=${unitRes.success ? "PASS" : "FAIL"}`,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "R3 Van App Fully Hindi",
      status: findPw("R3:").passed ? "PASS" : "FAIL",
      evidence: findPw("R3:").msg,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "R4 Thermal 3in Bill & Logo",
      status: findPw("R4:").passed ? "PASS" : "FAIL",
      evidence: findPw("R4:").msg,
      artifactPath: "artifacts/prompt09-pw-report.json",
    },
    {
      gate: "X1 Scope Lock (Perms + UI)",
      status: permDiff.passed && x1ScreenshotDiff.passed ? "PASS" : "FAIL",
      evidence: `${permDiff.evidence} | ${x1ScreenshotDiff.evidence}`,
      artifactPath: "artifacts/x1-screenshot-diff.json",
    },
  ];

  console.log("\n=================== PROMPT 09 GATES REPORT ===================");
  console.log("| gate | PASS/FAIL | evidence | artifact path |");
  console.log("|---|---|---|---|");
  for (const r of results) {
    console.log(`| ${r.gate} | **${r.status}** | ${r.evidence} | \`${r.artifactPath}\` |`);
  }
  console.log("==============================================================\n");

  const beforePath = path.join(baselineDir, "gates-before.json");
  if (!fs.existsSync(beforePath)) {
    fs.writeFileSync(beforePath, JSON.stringify(results, null, 2));
    console.log("Saved initial Step 0 baseline table to artifacts/baseline/gates-before.json");
  }
  fs.writeFileSync(path.join(artifactsDir, "gates-latest.json"), JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
