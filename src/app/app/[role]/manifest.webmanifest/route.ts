import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RoleManifestConfig {
  name: string;
  shortName: string;
  description: string;
  themeColor: string;
  shortcuts: Array<{ name: string; url: string }>;
}

const ROLE_CONFIGS: Record<string, RoleManifestConfig> = {
  shop: {
    name: "JMD POS - Counter Billing App",
    shortName: "JMD POS",
    description: "Mobile & Counter POS billing, parked tabs, and daily drawer for JMD Cart",
    themeColor: "#059669",
    shortcuts: [
      { name: "New Bill", url: "/shop/pos" },
      { name: "Today Sales", url: "/shop/invoices" },
      { name: "Incentives", url: "/shop/my-incentives" },
    ],
  },
  godown: {
    name: "JMD Godown - Warehouse & Dispatch App",
    shortName: "JMD Godown",
    description: "Warehouse packing queue, inventory management, stock counts, and van load issues",
    themeColor: "#2563EB",
    shortcuts: [
      { name: "Packing Queue", url: "/godown/dispatch" },
      { name: "Stock Overview", url: "/godown/stock" },
      { name: "Van Issues", url: "/godown/van-issues" },
    ],
  },
  van: {
    name: "JMD Van - Route Sales & Counter App",
    shortName: "JMD Van",
    description: "On-van route sales counter, instant Bluetooth receipts, and cash settlement",
    themeColor: "#D97706",
    shortcuts: [
      { name: "Van Counter", url: "/van/billing" },
      { name: "My Sales", url: "/van/bills" },
      { name: "Cash Collections", url: "/van/collections" },
    ],
  },
  delivery: {
    name: "JMD Delivery - Home Orders & Dispatch App",
    shortName: "JMD Delivery",
    description: "Assigned orders, delivery confirmations, COD collections, and customer handovers",
    themeColor: "#7C3AED",
    shortcuts: [
      { name: "My Deliveries", url: "/delivery" },
      { name: "Delivery Zones", url: "/delivery/zones" },
    ],
  },
  accounts: {
    name: "JMD Accounts - Ledger & Outstanding App",
    shortName: "JMD Accounts",
    description: "Party ledgers, pending payment collection, cash book, and Tally audit exports",
    themeColor: "#0D9488",
    shortcuts: [
      { name: "Pending Payments", url: "/app/accounts/pending" },
      { name: "Receipts", url: "/admin/crud/receipts" },
      { name: "Party Ledgers", url: "/admin/parties" },
    ],
  },
  owner: {
    name: "JMD Owner - Executive & Operations App",
    shortName: "JMD Owner",
    description: "Live sales KPIs, discount overrides, bill cancellations, and operational oversight",
    themeColor: "#12355B",
    shortcuts: [
      { name: "KPI Dashboard", url: "/admin" },
      { name: "Dispatch Queue", url: "/godown/dispatch" },
      { name: "Incentives Hub", url: "/admin/incentives" },
    ],
  },
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { role: string } }
) {
  const role = (params.role || "").toLowerCase();
  const config = ROLE_CONFIGS[role] || {
    name: `JMD Cart - ${role.toUpperCase()} App`,
    shortName: `JMD ${role}`,
    description: `Installable role app for JMD Cart ${role}`,
    themeColor: "#12355B",
    shortcuts: [{ name: "Dashboard", url: `/app/${role}` }],
  };

  const manifest = {
    id: `/app/${role}`,
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    start_url: `/app/${role}`,
    scope: `/app/${role}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF7F2",
    theme_color: config.themeColor,
    categories: ["business", "productivity", "finance"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: config.shortcuts.map((s) => ({
      name: s.name,
      url: s.url,
      icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
    })),
  };

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
