import fs from "fs";
import path from "path";
import { NAV_ITEMS, NavGroupName } from "../src/config/nav.config";
import { UserRole } from "@prisma/client";

// 1. Scan all routes under src/app
function scanAppRoutes(dir: string, baseRoute = ""): string[] {
  const routes: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Group routes e.g. (auth) do not add to path
      const routeSegment = entry.name.startsWith("(") && entry.name.endsWith(")")
        ? ""
        : entry.name;
      const nextBase = routeSegment ? `${baseRoute}/${routeSegment}` : baseRoute;
      routes.push(...scanAppRoutes(fullPath, nextBase));
    } else if (entry.name === "page.tsx" || entry.name === "page.ts" || entry.name === "page.js") {
      routes.push(baseRoute || "/");
    } else if (entry.name === "route.ts" || entry.name === "route.js") {
      routes.push(`[API] ${baseRoute}`);
    }
  }

  return Array.from(new Set(routes)).sort();
}

// 2. Scan server actions in src
function scanServerActions(dir: string): { file: string; actions: string[] }[] {
  const results: { file: string; actions: string[] }[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanServerActions(fullPath));
    } else if (
      (entry.name.endsWith("actions.ts") || entry.name.endsWith("action.ts")) &&
      !entry.name.includes(".test.")
    ) {
      const content = fs.readFileSync(fullPath, "utf8");
      if (content.includes('"use server"') || content.includes("'use server'")) {
        const exportedFunctions = Array.from(
          content.matchAll(/export\s+async\s+function\s+([a-zA-Z0-9_]+)/g)
        ).map((m) => m[1]);
        results.push({
          file: path.relative(process.cwd(), fullPath).replace(/\\/g, "/"),
          actions: exportedFunctions,
        });
      }
    }
  }

  return results;
}

// 3. Scan API routes
function scanApiRoutes(dir: string): { path: string; methods: string[] }[] {
  const apiDir = path.join(dir, "api");
  if (!fs.existsSync(apiDir)) return [];

  const results: { path: string; methods: string[] }[] = [];
  function walk(current: string, routePath = "/api") {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${routePath}/${entry.name}`);
      } else if (entry.name === "route.ts" || entry.name === "route.js") {
        const content = fs.readFileSync(full, "utf8");
        const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"].filter((m) =>
          content.includes(`export async function ${m}`) || content.includes(`export function ${m}`)
        );
        results.push({ path: routePath, methods });
      }
    }
  }
  walk(apiDir);
  return results;
}

// 4. Role nav mapping
function buildRoleNavInventory() {
  const allRoles = Object.values(UserRole);
  const roleInventory: Record<string, { totalItems: number; groups: Record<string, string[]> }> = {};

  for (const role of allRoles) {
    const accessible = NAV_ITEMS.filter((item) => item.roles.includes(role));
    const groups: Record<string, string[]> = {};
    for (const item of accessible) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(`${item.label} (${item.href})`);
    }
    roleInventory[role] = {
      totalItems: accessible.length,
      groups,
    };
  }

  return roleInventory;
}

// 5. Baseline Task Effort Metrics (clicks / taps / keystrokes)
const taskEffortBaseline = {
  counter_bill_3_items: {
    name: "Counter bill with 3 items (Shop POS)",
    baselineClicks: 4,
    baselineKeystrokes: 18,
    targetClicks: 0, // 0 clicks with keyboard-only mode
    targetKeystrokes: 14,
    unit: "keystrokes + clicks",
  },
  van_sale_workflow: {
    name: "Van Sale (Customer -> Items -> Payment -> Receipt)",
    baselineSteps: 6,
    baselineTaps: 12,
    targetSteps: 3, // 3-step visible stepper (Part 5)
    targetTaps: 6, // 50% fewer taps with big tiles and preselected units
  },
  receive_stock_grn: {
    name: "Receive Goods / Stock GRN Creation",
    baselineClicks: 6,
    baselineKeystrokes: 22,
    targetClicks: 3,
  },
  carton_dispatch_order: {
    name: "Pack and handover carton order on Dispatch board",
    baselineClicks: 5,
    targetClicks: 3,
  },
  collect_pending_payment: {
    name: "Record pending party collection",
    baselineClicks: 4,
    baselineKeystrokes: 10,
    targetClicks: 2,
  },
  add_catalog_product: {
    name: "Add product to catalog",
    baselineClicks: 8,
    baselineKeystrokes: 35,
    targetClicks: 5,
  },
  find_party_ledger: {
    name: "Find party ledger",
    baselineClicks: 3,
    targetClicks: 1, // Direct Ctrl+K or search chip
  },
  run_day_end: {
    name: "Run Van Day-End Reconciliation",
    baselineSteps: 4,
    targetSteps: 2,
  },
};

// 6. Performance baseline estimates (based on Next.js build stats)
const performanceBaseline = {
  firstLoadSharedJsKb: 87.3,
  middlewareKb: 98.5,
  routes: {
    "/shop/pos": { sizeKb: 20.3, totalKb: 150 },
    "/van/billing": { sizeKb: 11.8, totalKb: 139 },
    "/godown/stock/update": { sizeKb: 13.5, totalKb: 108 },
    "/godown/operations": { sizeKb: 10.9, totalKb: 105 },
    "/admin": { sizeKb: 2.1, totalKb: 96.5 },
    "/godown/van-issues/[id]/edit": { sizeKb: 4.63, totalKb: 98.8 },
  },
  throttledLoadTimeSecTarget: {
    dashboard: 1.2,
    pos: 1.4,
    van_home: 1.1,
  },
};

async function main() {
  const appDir = path.join(process.cwd(), "src", "app");
  const baselineDir = path.join(process.cwd(), "tests", "baseline");
  if (!fs.existsSync(baselineDir)) {
    fs.mkdirSync(baselineDir, { recursive: true });
  }

  const allRoutes = scanAppRoutes(appDir);
  const serverActions = scanServerActions(path.join(process.cwd(), "src"));
  const apiRoutes = scanApiRoutes(appDir);
  const roleNav = buildRoleNavInventory();

  const inventory = {
    capturedAt: new Date().toISOString(),
    totalRoutes: allRoutes.length,
    routes: allRoutes,
    totalServerActionFiles: serverActions.length,
    serverActions,
    totalApiRoutes: apiRoutes.length,
    apiRoutes,
    roleNav,
  };

  fs.writeFileSync(
    path.join(baselineDir, "feature-inventory.json"),
    JSON.stringify(inventory, null, 2),
    "utf8"
  );
  console.log(`[PASS] tests/baseline/feature-inventory.json generated (${allRoutes.length} routes, ${serverActions.length} action files)`);

  fs.writeFileSync(
    path.join(baselineDir, "task-effort.json"),
    JSON.stringify(taskEffortBaseline, null, 2),
    "utf8"
  );
  console.log(`[PASS] tests/baseline/task-effort.json generated`);

  fs.writeFileSync(
    path.join(baselineDir, "performance.json"),
    JSON.stringify(performanceBaseline, null, 2),
    "utf8"
  );
  console.log(`[PASS] tests/baseline/performance.json generated`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
