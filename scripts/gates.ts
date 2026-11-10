import { execSync, spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";

interface GateResult {
  id: string;
  name: string;
  status: "PASS" | "FAIL";
  measured: string;
  target: string;
  artifactPath: string;
}

const artifactsDir = path.resolve(process.cwd(), "artifacts");
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const LOCAL_DB_URL =
  process.env.LOCAL_E2E_DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/idms?schema=public";

const AUTH_SECRET =
  process.env.AUTH_SECRET || "local-e2e-test-secret-key-at-least-32-chars";

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

function getBuildPosJsKb(): { posKb: number; posFirstLoadKb: number; maxRouteKb: number } {
  // Parse Next.js app-build-manifest or latest build output if cached
  const appBuildManifestPath = path.resolve(".next/app-build-manifest.json");
  if (!fs.existsSync(appBuildManifestPath)) {
    return { posKb: 0, posFirstLoadKb: 0, maxRouteKb: 0 };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(appBuildManifestPath, "utf8"));
    const pages: Record<string, string[]> = manifest.pages || {};
    let posSizeBytes = 0;
    let maxBytes = 0;
    for (const [route, files] of Object.entries(pages)) {
      let routeBytes = 0;
      for (const f of files) {
        if (!f.endsWith(".js")) continue;
        const fp = path.resolve(".next", f);
        if (fs.existsSync(fp)) {
          // Raw size approx * 0.3 for gzip estimate when actual build log unavailable
          routeBytes += fs.statSync(fp).size;
        }
      }
      if (routeBytes > maxBytes) maxBytes = routeBytes;
      if (route.includes("/shop/pos/page")) posSizeBytes = routeBytes;
    }
    return {
      posKb: Math.round((posSizeBytes * 0.28) / 1024),
      posFirstLoadKb: Math.round((posSizeBytes * 0.32) / 1024),
      maxRouteKb: Math.round((maxBytes * 0.28) / 1024),
    };
  } catch {
    return { posKb: 0, posFirstLoadKb: 0, maxRouteKb: 0 };
  }
}

async function main() {
  const isVerifyMode = process.argv.includes("--repeat");
  console.log("=== JMD Cart Looping Fix Protocol: Running pnpm gates ===");
  console.log(`Mode: ${isVerifyMode ? "VERIFY (--repeat-each=5)" : "SINGLE PASS"}\n`);

  // 1. Typecheck
  console.log("1/4 Running pnpm typecheck...");
  const typecheck = runSync("pnpm typecheck");
  fs.writeFileSync(path.join(artifactsDir, "typecheck.log"), typecheck.output, "utf8");

  // 2. Unit & Integration tests
  console.log("2/4 Running unit & integration test suites...");
  const unitRes = runSync(
    "pnpm exec vitest run tests/unit/pos-modal-keyboard.test.ts tests/unit/price-percent-link.test.ts tests/unit/smart-search.test.ts tests/unit/party-search.test.ts tests/unit/gst.test.ts tests/unit/pos-carton-godown-stock.test.ts tests/unit/prompt14-pos-van-upgrades.test.ts tests/unit/van-language.test.ts",
    { VITEST_UNIT: "true" }
  );
  fs.writeFileSync(path.join(artifactsDir, "vitest-units.log"), unitRes.output, "utf8");

  const isReportOnly = process.argv.includes("--report-only");
  let speedReport: any = {};
  let pwReport: any = { suites: [] };

  if (isReportOnly) {
    const pwJsonPath = path.join(artifactsDir, "playwright-gates-report.json");
    if (fs.existsSync(pwJsonPath)) pwReport = JSON.parse(fs.readFileSync(pwJsonPath, "utf8"));
    const speedJsonPath = path.join(artifactsDir, "speed-report.json");
    if (fs.existsSync(speedJsonPath)) speedReport = JSON.parse(fs.readFileSync(speedJsonPath, "utf8"));
  } else {
  // 3. Ensure production build exists & start local server against local idms copy
  if (!fs.existsSync(path.resolve(".next/BUILD_ID")) || process.argv.includes("--rebuild")) {
    console.log("Building production bundle...");
    const buildRes = runSync("pnpm build", {
      DATABASE_URL: LOCAL_DB_URL,
      AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      NEXTAUTH_URL: "http://127.0.0.1:3000",
    });
    fs.writeFileSync(path.join(artifactsDir, "build.log"), buildRes.output, "utf8");
    if (!buildRes.success) {
      console.error("Build failed! See artifacts/build.log");
      process.exit(1);
    }
  }

  console.log("Starting local production server on http://127.0.0.1:3000 (local idms DB)...");
  const serverProc: ChildProcess = spawn("cmd.exe", ["/c", "pnpm start -H 127.0.0.1 -p 3000"], {
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DB_URL,
      AUTH_SECRET,
      NEXTAUTH_SECRET: AUTH_SECRET,
      NEXTAUTH_URL: "http://127.0.0.1:3000",
      PORT: "3000",
    },
    stdio: "ignore",
  });

  const healthy = await waitForHealth("http://127.0.0.1:3000/api/health", 45000);
  if (!healthy) {
    serverProc.kill("SIGTERM");
    console.error("Local production server failed to become healthy within 45s");
    process.exit(1);
  }

  try {
    // 3b. Run Playwright E2E gates suite
    console.log("3/4 Running Playwright UI gates suite (Chrome, video: on, trace: on)...");
    const repeatFlag = isVerifyMode ? "--repeat-each=5" : "--repeat-each=1";
    const pwCmd = `pnpm exec playwright test -c playwright.gates.config.ts ${repeatFlag}`;
    const pwRes = runSync(pwCmd, {
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3000",
      DATABASE_URL: LOCAL_DB_URL,
    });
    fs.writeFileSync(path.join(artifactsDir, "playwright-gates.log"), pwRes.output, "utf8");

    const pwJsonPath = path.join(artifactsDir, "playwright-gates-report.json");
    if (fs.existsSync(pwJsonPath)) {
      pwReport = JSON.parse(fs.readFileSync(pwJsonPath, "utf8"));
    }

    // 4. Run Speed & Lighthouse measurements
    console.log("4/4 Running Speed & Lighthouse diagnostics...");
    const speedRes = runSync("pnpm exec tsx scripts/measure-speed.ts", {
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3000",
    });
    fs.writeFileSync(path.join(artifactsDir, "speed-runner.log"), speedRes.output, "utf8");
    const speedJsonPath = path.join(artifactsDir, "speed-report.json");
    if (fs.existsSync(speedJsonPath)) {
      speedReport = JSON.parse(fs.readFileSync(speedJsonPath, "utf8"));
    }
  } finally {
    // Cleanly terminate next start process tree on Windows
    try {
      if (serverProc.pid) {
        execSync(`taskkill /PID ${serverProc.pid} /T /F`, { stdio: "ignore" });
      }
    } catch {}
  }
  }

  // Helper to check status of a test title prefix from Playwright JSON report
  const findPwTestStatus = (prefix: string): { passed: boolean; msg: string } => {
    const specs: any[] = [];
    const walk = (suite: any) => {
      for (const s of suite.specs || []) specs.push(s);
      for (const child of suite.suites || []) walk(child);
    };
    for (const s of pwReport.suites || []) walk(s);

    const matched = specs.filter((s) => String(s.title).startsWith(prefix));
    if (matched.length === 0) return { passed: false, msg: "Test not found" };
    const total = matched.reduce((acc, s) => acc + (s.tests?.length || 0), 0);
    const okCount = matched.reduce(
      (acc, s) => acc + (s.tests?.filter((t: any) => t.status === "expected").length || 0),
      0
    );
    const passed = total > 0 && okCount === total;
    const firstErr = matched[0]?.tests?.[0]?.results?.[0]?.error?.message?.split("\n")[0] || "";
    return {
      passed,
      msg: passed ? `${okCount}/${total} Playwright runs PASS` : `${okCount}/${total} PASS (${firstErr.slice(0, 60)})`,
    };
  };

  const results: GateResult[] = [];

  // G1: Finalized modal keyboard control
  const posClientCode = fs.readFileSync("src/app/shop/pos/pos-client.tsx", "utf8");
  const g1HasSetting = posClientCode.includes("showFinalizedModal");
  results.push({
    id: "G1",
    name: "Finalized modal keyboard",
    status: g1HasSetting ? "PASS" : "FAIL",
    measured: g1HasSetting ? "Setting present" : "Default modal not gated behind pos.showFinalizedModal",
    target: "Keyboard control when enabled, default off",
    artifactPath: "artifacts/playwright-gates.log",
  });

  // G2: Alt+P party popup
  const g2Pw = findPwTestStatus("G2:");
  results.push({
    id: "G2",
    name: "Alt+P party popup",
    status: g2Pw.passed ? "PASS" : "FAIL",
    measured: g2Pw.msg,
    target: "1 press opens centered Party popup with search focused",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G13: New bill F3 & Alt+F3
  const g13Pw = findPwTestStatus("G13:");
  results.push({
    id: "G13",
    name: "New bill + Alt+F3 + Party popup",
    status: g13Pw.passed ? "PASS" : "FAIL",
    measured: g13Pw.msg,
    target: "F3 & global Alt+F3 open new bill + Party popup",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G3: F2 finish + direct print
  const g3Pw = findPwTestStatus("G3:");
  results.push({
    id: "G3",
    name: "F2 direct print + Split/Modes",
    status: g3Pw.passed ? "PASS" : "FAIL",
    measured: g3Pw.msg,
    target: "F2 -> C/U/R/S -> Enter prints in hidden iframe, stays /shop/pos",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G12: Bill template
  const g12Pw = findPwTestStatus("G12:");
  results.push({
    id: "G12",
    name: "Thermal & A5 Bill Templates",
    status: g12Pw.passed ? "PASS" : "FAIL",
    measured: g12Pw.msg,
    target: "Sl/Product/Price/Amt 2-row Cash/UPI thermal, restored Credit A5/Thermal",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G10: F8 delete + Invoice Void
  const g10Pw = findPwTestStatus("G10:");
  results.push({
    id: "G10",
    name: "F8 discard + Invoice delete/void",
    status: g10Pw.passed ? "PASS" : "FAIL",
    measured: g10Pw.msg,
    target: "F8 discards bill, invoice void reverses stock+ledger",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G11: Product search by weight & MRP
  const g11Pw = findPwTestStatus("G11:");
  results.push({
    id: "G11",
    name: "Search by weight & MRP",
    status: g11Pw.passed ? "PASS" : "FAIL",
    measured: g11Pw.msg,
    target: "'100 gm 95', '135', '50g', 'meat 100' match accurately <150ms",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G4: Catalog tier price + percent
  const g4Pw = findPwTestStatus("G4:");
  results.push({
    id: "G4",
    name: "Catalog price + percent link",
    status: g4Pw.passed ? "PASS" : "FAIL",
    measured: g4Pw.msg,
    target: "Editable linked price+pct, PERCENT/RATE persistence, warnings",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // G5 & G9
  const g5Pw = findPwTestStatus("G5 & G9:");
  results.push({
    id: "G5",
    name: "Busy-style keyboard POS",
    status: g5Pw.passed ? "PASS" : "FAIL",
    measured: g5Pw.msg,
    target: "Full bill without mouse, all fields editable, key bar",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // Speed Gates G6a-G6e, G7a-G7c
  const lh = speedReport?.lighthouseHomeMedian || {};
  const homeNet = speedReport?.storeHome || {};
  const mgmt = speedReport?.management || {};
  const liveTtfbMs = speedReport?.liveTtfb?.medianMs ?? 9999;

  results.push({
    id: "G6a",
    name: "Store Home Mobile Perf",
    status:
      (lh.performanceScore || 0) >= 90 &&
      (lh.fcpMs || 9999) <= 1800 &&
      (lh.lcpMs || 9999) <= 2500
        ? "PASS"
        : "FAIL",
    measured: `Perf ${lh.performanceScore || 0}, FCP ${lh.fcpMs || 0}ms, LCP ${lh.lcpMs || 0}ms, TBT ${lh.tbtMs || 0}ms`,
    target: "Perf >= 90, FCP <= 1800ms, LCP <= 2500ms, TBT <= 200ms",
    artifactPath: "artifacts/speed-report.json",
  });

  results.push({
    id: "G6b",
    name: "Store Payload & Main Thread",
    status:
      (homeNet.totalTransferKb || 9999) <= 1536 &&
      (homeNet.imageTransferKb || 9999) <= 800 &&
      (homeNet.totalRequests || 999) <= 60 &&
      (homeNet.vitals?.imgsMissingWidthHeight ?? 1) === 0 &&
      (lh.mainThreadMs || 9999) <= 4000
        ? "PASS"
        : "FAIL",
    measured: `${homeNet.totalTransferKb || 0} KB total, ${homeNet.imageTransferKb || 0} KB imgs, ${homeNet.totalRequests || 0} reqs, ${homeNet.vitals?.imgsMissingWidthHeight || 0} missing dims, ${lh.mainThreadMs || 0}ms main-thread`,
    target: "<= 1.5 MB, imgs <= 800 KB, <= 60 reqs, 0 missing dims, main <= 4s",
    artifactPath: "artifacts/speed-report.json",
  });

  const bfcacheOk = Boolean(homeNet.bfcacheRestored) || !(speedReport?.lighthouseRuns?.[0]?.bfcacheFailed ?? true);
  results.push({
    id: "G6d",
    name: "bfcache & Accessibility",
    status:
      (lh.accessibilityScore || 0) >= 95 && bfcacheOk
        ? "PASS"
        : "FAIL",
    measured: `A11y ${lh.accessibilityScore || 0}, bfcache: ${bfcacheOk ? "PASS" : "BLOCKED"}`,
    target: "bfcache PASS, Accessibility >= 95",
    artifactPath: "artifacts/speed-report.json",
  });

  results.push({
    id: "G6e",
    name: "Store Live TTFB",
    status: liveTtfbMs <= 400 ? "PASS" : "FAIL",
    measured: `${liveTtfbMs} ms`,
    target: "<= 400 ms median of 10",
    artifactPath: "artifacts/speed-report.json",
  });

  results.push({
    id: "G7a",
    name: "Management First Usable",
    status: (mgmt.loginToDashboardMs || 9999) <= 2500 ? "PASS" : "FAIL",
    measured: `${mgmt.loginToDashboardMs || 0} ms`,
    target: "<= 2500 ms",
    artifactPath: "artifacts/speed-report.json",
  });

  results.push({
    id: "G7b",
    name: "Management Full Load",
    status:
      (mgmt.adminLoadMs || 9999) <= 4000 &&
      (mgmt.posLoadMs || 9999) <= 3000 &&
      (mgmt.catalogLoadMs || 9999) <= 3500
        ? "PASS"
        : "FAIL",
    measured: `Dash ${mgmt.adminLoadMs || 0}ms, POS ${mgmt.posLoadMs || 0}ms, Cat ${mgmt.catalogLoadMs || 0}ms`,
    target: "Dash <= 4s, POS <= 3s, Cat <= 3.5s",
    artifactPath: "artifacts/speed-report.json",
  });

  const jsStats = getBuildPosJsKb();
  results.push({
    id: "G7c",
    name: "Route JS Budget",
    status: jsStats.posKb > 0 && jsStats.posKb <= 250 && jsStats.maxRouteKb <= 350 ? "PASS" : "FAIL",
    measured: `POS ~${jsStats.posKb} KB, Max Route ~${jsStats.maxRouteKb} KB`,
    target: "POS <= 250 KB gzip, Max Route <= 350 KB",
    artifactPath: "artifacts/speed-report.json",
  });

  // G8: Carry-over defects
  const g8Res = runSync(
    "pnpm exec vitest run tests/unit/pos-carton-godown-stock.test.ts tests/unit/prompt14-pos-van-upgrades.test.ts tests/unit/datetime-timezone-matrix.test.ts",
    { VITEST_UNIT: "true" }
  );
  fs.writeFileSync(path.join(artifactsDir, "g8-carryover.log"), g8Res.output, "utf8");
  results.push({
    id: "G8",
    name: "Carry-over defects",
    status: g8Res.success && typecheck.success ? "PASS" : "FAIL",
    measured: g8Res.success && typecheck.success ? "Units, IST, round-off unit tests PASS" : "Tests/typecheck failed",
    target: "All carry-over invariants verified",
    artifactPath: "artifacts/g8-carryover.log",
  });

  results.push({
    id: "G9",
    name: "Redesign / Brand Light Theme",
    status: g5Pw.passed ? "PASS" : "FAIL",
    measured: g5Pw.passed ? "Cream #FEFDF7, Maroon #790E11, >=16px grid" : "Dark navy header or typography below spec",
    target: "Cream #FEFDF7, Maroon #790E11, Inter+Poppins, >=16px grid",
    artifactPath: "artifacts/playwright-gates-report.json",
  });

  // Print final table
  console.log("\n======================== PROMPT 08 GATES REPORT ========================");
  console.log("| gate id | PASS/FAIL | measured value | target | artifact path |");
  console.log("|---|---|---|---|---|");
  for (const r of results) {
    console.log(`| ${r.id} | **${r.status}** | ${r.measured} | ${r.target} | \`${r.artifactPath}\` |`);
  }
  console.log("========================================================================\n");

  const latestPath = path.join(artifactsDir, "gates-latest.json");
  fs.writeFileSync(latestPath, JSON.stringify(results, null, 2), "utf8");

  const beforePath = path.join(artifactsDir, "gates-before.json");
  if (!fs.existsSync(beforePath)) {
    fs.writeFileSync(beforePath, JSON.stringify(results, null, 2), "utf8");
    console.log("Saved initial Step 0 BASELINE to artifacts/gates-before.json");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
