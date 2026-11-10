import { chromium } from "@playwright/test";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const artifactsDir = path.resolve(process.cwd(), "artifacts");
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

async function measureTtfb(url: string, count = 10): Promise<{ medianMs: number; samples: number[] }> {
  const times: number[] = [];
  for (let i = 0; i < count; i++) {
    try {
      const res = execSync(`curl.exe -s -o NUL -w "%{time_starttransfer}" "${url}"`, {
        encoding: "utf8",
        timeout: 15000,
      });
      const sec = parseFloat(res.trim());
      if (!isNaN(sec)) times.push(Math.round(sec * 1000));
    } catch {
      // ignore failed sample
    }
  }
  return { medianMs: median(times), samples: times };
}

interface RequestSummary {
  url: string;
  resourceType: string;
  status: number;
  encodedDataLength: number;
  cacheControl: string;
  cfCacheStatus: string;
}

async function capturePageNetworkAndVitals(
  urlPath: string,
  harName: string,
  options: { isMobile?: boolean; waitNetworkIdle?: boolean; loggedInContext?: any } = {}
) {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = options.loggedInContext
    ? options.loggedInContext
    : await browser.newContext({
        viewport: options.isMobile ? { width: 412, height: 915 } : { width: 1440, height: 900 },
        isMobile: Boolean(options.isMobile),
        recordHar: { path: path.join(artifactsDir, harName), mode: "minimal" },
      });

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Performance.enable");

  const reqMap = new Map<string, Partial<RequestSummary>>();
  let recordRequests = true;
  cdp.on("Network.requestWillBeSent", (params: any) => {
    if (!recordRequests) return;
    reqMap.set(params.requestId, {
      url: params.request.url,
      resourceType: params.type || "Other",
    });
  });
  cdp.on("Network.responseReceived", (params: any) => {
    if (!recordRequests) return;
    const entry = reqMap.get(params.requestId) || {};
    entry.status = params.response.status;
    entry.resourceType = params.type || entry.resourceType || "Other";
    const h = params.response.headers || {};
    entry.cacheControl = h["cache-control"] || h["Cache-Control"] || "";
    entry.cfCacheStatus = h["cf-cache-status"] || h["CF-Cache-Status"] || "";
    reqMap.set(params.requestId, entry);
  });
  cdp.on("Network.loadingFinished", (params: any) => {
    if (!recordRequests) return;
    const entry = reqMap.get(params.requestId) || {};
    entry.encodedDataLength = params.encodedDataLength || 0;
    reqMap.set(params.requestId, entry);
  });

  const start = Date.now();
  await page.goto(`${BASE_URL}${urlPath}`, {
    waitUntil: "load",
    timeout: 45000,
  });
  let networkIdleReached = true;
  if (options.waitNetworkIdle) {
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {
      networkIdleReached = false;
    });
  }
  const loadMs = Date.now() - start;

  // Web vitals & DOM checks
  const vitals = await page.evaluate(async () => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const fcpEntry = performance.getEntriesByName("first-contentful-paint")[0];
    const imgs = Array.from(document.querySelectorAll("img"));
    const missingDims = imgs.filter((img) => !img.getAttribute("width") || !img.getAttribute("height")).length;

    let lcpMs = 0;
    try {
      lcpMs = await new Promise<number>((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            resolve(entries[entries.length - 1].startTime);
          }
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 500);
      });
    } catch {}

    return {
      ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
      fcpMs: fcpEntry ? Math.round(fcpEntry.startTime) : 0,
      lcpMs: Math.round(lcpMs),
      totalImages: imgs.length,
      imgsMissingWidthHeight: missingDims,
    };
  });

  const perfMetrics = await cdp.send("Performance.getMetrics");
  const taskDurationSec = perfMetrics.metrics.find((m: any) => m.name === "TaskDuration")?.value || 0;

  // Freeze request capture before navigating to /store for bfcache check
  recordRequests = false;

  // Test bfcache back/forward on anonymous store pages
  let bfcacheRestored = false;
  if (!options.loggedInContext && urlPath === "/") {
    await page.goto(`${BASE_URL}/store`, { waitUntil: "domcontentloaded" });
    await page.goBack({ waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(300);
    // Check via Lighthouse audit or navigation entry type
    bfcacheRestored = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      return nav?.type === "back_forward";
    }).catch(() => false);
  }

  const allReqs = Array.from(reqMap.values())
    .map((r) => ({
      url: r.url || "",
      resourceType: r.resourceType || "Other",
      status: r.status || 0,
      encodedDataLength: r.encodedDataLength || 0,
      cacheControl: r.cacheControl || "",
      cfCacheStatus: r.cfCacheStatus || "",
    }))
    .sort((a, b) => b.encodedDataLength - a.encodedDataLength);

  const totalBytes = allReqs.reduce((s, r) => s + r.encodedDataLength, 0);
  const imageBytes = allReqs
    .filter((r) => r.resourceType === "Image")
    .reduce((s, r) => s + r.encodedDataLength, 0);

  if (!options.loggedInContext) {
    await context.close();
    await browser.close();
  } else {
    await page.close();
  }

  return {
    urlPath,
    loadMs,
    vitals,
    mainThreadMs: Math.round(taskDurationSec * 1000),
    totalRequests: allReqs.length,
    totalTransferKb: Math.round((totalBytes / 1024) * 10) / 10,
    imageTransferKb: Math.round((imageBytes / 1024) * 10) / 10,
    bfcacheRestored,
    top25Requests: allReqs.slice(0, 25),
  };
}

function runLighthouseMobile(targetUrl: string, outFile: string) {
  try {
    const outPath = path.join(artifactsDir, outFile);
    execSync(
      `npx --no-install lighthouse "${targetUrl}" --output=json --output-path="${outPath}" --only-categories=performance,accessibility --chrome-flags="--headless=new --no-sandbox"`,
      { encoding: "utf8", timeout: 90000, stdio: ["pipe", "pipe", "pipe"] }
    );
    const report = JSON.parse(fs.readFileSync(outPath, "utf8"));
    return {
      performanceScore: Math.round((report.categories?.performance?.score || 0) * 100),
      accessibilityScore: Math.round((report.categories?.accessibility?.score || 0) * 100),
      fcpMs: Math.round(report.audits?.["first-contentful-paint"]?.numericValue || 0),
      lcpMs: Math.round(report.audits?.["largest-contentful-paint"]?.numericValue || 0),
      tbtMs: Math.round(report.audits?.["total-blocking-time"]?.numericValue || 0),
      cls: Number((report.audits?.["cumulative-layout-shift"]?.numericValue || 0).toFixed(3)),
      speedIndexMs: Math.round(report.audits?.["speed-index"]?.numericValue || 0),
      mainThreadMs: Math.round(report.audits?.["mainthread-work-breakdown"]?.numericValue || 0),
      totalByteWeightKb: Math.round((report.audits?.["total-byte-weight"]?.numericValue || 0) / 1024),
      bfcacheFailed: (report.audits?.["bf-cache"]?.score ?? 1) < 1,
    };
  } catch (err: any) {
    return {
      error: err.message,
      performanceScore: 0,
      accessibilityScore: 0,
      fcpMs: 0,
      lcpMs: 0,
      tbtMs: 0,
      cls: 0,
      speedIndexMs: 0,
      mainThreadMs: 0,
      totalByteWeightKb: 0,
      bfcacheFailed: true,
    };
  }
}

async function main() {
  console.log("=== Running JMD Cart Speed & Payload Diagnostics ===");

  // 1. Live site curl TTFB (median of 10)
  const liveTtfb = await measureTtfb("https://jmdcart.com/", 10);

  // 2. Store home Playwright + CDP capture
  const storeHome = await capturePageNetworkAndVitals("/", "speed-store.har", {
    isMobile: true,
    waitNetworkIdle: true,
  });

  // 3. Lighthouse mobile median of 3 on local production build home page
  const lhRuns = [
    runLighthouseMobile(`${BASE_URL}/`, "lighthouse-home-1.json"),
    runLighthouseMobile(`${BASE_URL}/`, "lighthouse-home-2.json"),
    runLighthouseMobile(`${BASE_URL}/`, "lighthouse-home-3.json"),
  ];
  const validLh = lhRuns.filter((r) => r.performanceScore > 0);
  const lhMedian = {
    performanceScore: median(validLh.map((r) => r.performanceScore)),
    accessibilityScore: median(validLh.map((r) => r.accessibilityScore)),
    fcpMs: median(validLh.map((r) => r.fcpMs)),
    lcpMs: median(validLh.map((r) => r.lcpMs)),
    tbtMs: median(validLh.map((r) => r.tbtMs)),
    cls: median(validLh.map((r) => r.cls)),
    speedIndexMs: median(validLh.map((r) => r.speedIndexMs)),
    mainThreadMs: median(validLh.map((r) => r.mainThreadMs)),
    totalByteWeightKb: median(validLh.map((r) => r.totalByteWeightKb)),
  };

  // 4. Management screens timing (authenticated)
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const mgmtContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loginPage = await mgmtContext.newPage();
  const loginStart = Date.now();
  await loginPage.goto(`${BASE_URL}/login`);
  await loginPage.fill('input[name="phone"]', "9999900001");
  await loginPage.fill('input[name="password"]', "e2eadmin123");
  await loginPage.click('button[type="submit"]');
  await loginPage.waitForURL("**/admin", { timeout: 30000 });
  const loginToDashboardMs = Date.now() - loginStart;
  await loginPage.close();

  const adminPerf = await capturePageNetworkAndVitals("/admin", "speed-admin.har", {
    waitNetworkIdle: true,
    loggedInContext: mgmtContext,
  });
  const posPerf = await capturePageNetworkAndVitals("/shop/pos", "speed-pos.har", {
    waitNetworkIdle: true,
    loggedInContext: mgmtContext,
  });
  const catalogPerf = await capturePageNetworkAndVitals("/admin/catalog", "speed-catalog.har", {
    waitNetworkIdle: true,
    loggedInContext: mgmtContext,
  });

  await mgmtContext.close();
  await browser.close();

  const summary = {
    timestamp: new Date().toISOString(),
    liveTtfb,
    lighthouseHomeMedian: lhMedian,
    lighthouseRuns: lhRuns,
    storeHome,
    management: {
      loginToDashboardMs,
      adminLoadMs: adminPerf.loadMs,
      posLoadMs: posPerf.loadMs,
      catalogLoadMs: catalogPerf.loadMs,
      posImageKb: posPerf.imageTransferKb,
      catalogImageKb: catalogPerf.imageTransferKb,
    },
    top25StoreRequests: storeHome.top25Requests,
  };

  fs.writeFileSync(path.join(artifactsDir, "speed-report.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log("Speed report saved to artifacts/speed-report.json");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
