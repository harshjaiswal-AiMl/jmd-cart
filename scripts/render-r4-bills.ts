import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { renderDirectPrintHtml } from "../src/lib/printing/bill-html";
import { InvoiceChannel, InvoiceStatus, PaymentMode, PaymentStatus } from "@prisma/client";

const sampleProductNames = [
  "Aashirvaad Shudh Chakki Atta 10kg Polybag Pack",
  "Fortune Kachi Ghani Pure Mustard Oil 1 Ltr Bottle",
  "Bikaji Bikaneri Bhujia Namkeen 400g Family Pouch",
  "MDH Deggi Mirch Mirchi Powder 100g Carton Box",
  "Tata Salt Vacuum Evaporated Iodised Crystal 1kg",
  "Daawat Rozana Gold Super Basmati Rice 5kg Sack",
  "Saloni Double Filtered Mustard Oil 500ml Pouch",
  "Britannia Good Day Cashew Cookies Super Saver Pack",
  "Parle-G Original Gluco Biscuits Big Family Carton",
  "Everest Haldi Turmeric Pure Masala 200g Packet",
];

function makeFixtureInvoice(opts: {
  id: string;
  number: string;
  lineCount: number;
  isCredit: boolean;
  isCancelled?: boolean;
  longNames?: boolean;
}): any {
  const items = Array.from({ length: opts.lineCount }, (_, idx) => {
    const baseName = sampleProductNames[idx % sampleProductNames.length];
    const name = opts.longNames
      ? `${baseName} Extra Long Wholesale Distributor Edition Variant #${idx + 1}`
      : baseName;
    const qty = (idx % 4) + 1;
    const unitPricePaise = 4500 + (idx % 7) * 1250;
    const lineTotal = qty * unitPricePaise;
    return {
      id: `item-${idx + 1}`,
      invoiceId: opts.id,
      productId: `prod-${idx + 1}`,
      qty,
      mrpPaise: unitPricePaise + 500,
      discountBp: 0,
      unitPricePaise,
      taxablePaise: Math.round(lineTotal / 1.05),
      taxPaise: lineTotal - Math.round(lineTotal / 1.05),
      gstRateBp: 500,
      hsn: "2106",
      unitLabel: idx % 3 === 0 ? "Carton" : "Pcs",
      product: {
        id: `prod-${idx + 1}`,
        name,
        nameHi: "हिंदी नाम बिल पर नहीं आएगा",
        shortCode: `SKU${String(idx + 1).padStart(3, "0")}`,
        weight: "",
        packSize: idx % 3 === 0 ? 10 : 1,
        packLabel: idx % 3 === 0 ? "Carton" : "Pcs",
      },
    };
  });

  const totalPaise = items.reduce((s, it) => s + it.taxablePaise + it.taxPaise, 0);
  return {
    id: opts.id,
    branchId: 1,
    number: opts.number,
    fy: "2026-27",
    status: opts.isCancelled ? InvoiceStatus.CANCELLED : InvoiceStatus.FINAL,
    channel: InvoiceChannel.SHOP,
    locationId: "loc-shop",
    partyId: "party-1",
    buyerType: "RETAILER",
    notes: null,
    subtotalPaise: totalPaise,
    discountPaise: 0,
    taxablePaise: items.reduce((s, it) => s + it.taxablePaise, 0),
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise,
    paymentStatus: opts.isCredit ? PaymentStatus.PENDING : PaymentStatus.PAID,
    documentType: "RETAIL",
    customerName: "Gupta Kirana & Provision Store",
    customerPhone: "9876543210",
    customerAddress: "Purab Bazar, Saharsa",
    agentCodeSnapshot: null,
    createdBy: "u1",
    createdAt: new Date("2026-11-11T05:30:00Z"),
    updatedAt: new Date("2026-11-11T05:30:00Z"),
    finalizedAt: new Date("2026-11-11T05:30:00Z"),
    party: {
      id: "party-1",
      name: "Gupta Kirana & Provision Store",
      nameHi: "गुप्ता किराना स्टोर",
      phone: "9876543210",
      address: "Purab Bazar, Saharsa",
      gstin: null,
    },
    items,
    payments: [
      {
        id: "pay-1",
        mode: opts.isCredit ? PaymentMode.CREDIT : PaymentMode.CASH,
        amountPaise: totalPaise,
      },
    ],
    creditNotes: [],
  };
}

export async function renderR4ThermalArtifacts(baseUrl = "http://127.0.0.1:3000") {
  const outDir = path.resolve(process.cwd(), "artifacts/r4-bills");
  fs.mkdirSync(outDir, { recursive: true });

  const biz: any = {
    tradeName: "JMD CART",
    legalName: "JAI MATA DI",
    gstin: "",
    fssai: "",
    address: "Station Road, Purab Bazar, Saharsa",
    phone: "7979749009",
    email: "",
    upiId: "",
  };

  const fixtures = [
    { name: "01-cash-5-line", inv: makeFixtureInvoice({ id: "r4-c5", number: "INV/26-27/001001", lineCount: 5, isCredit: false }) },
    { name: "02-cash-20-line", inv: makeFixtureInvoice({ id: "r4-c20", number: "INV/26-27/001002", lineCount: 20, isCredit: false }) },
    { name: "03-credit-10-line", inv: makeFixtureInvoice({ id: "r4-cr10", number: "INV/26-27/001003", lineCount: 10, isCredit: true }) },
    { name: "04-credit-40-long", inv: makeFixtureInvoice({ id: "r4-cr40", number: "INV/26-27/001004", lineCount: 40, isCredit: true, longNames: true }) },
    { name: "05-voided-bill", inv: makeFixtureInvoice({ id: "r4-void", number: "INV/26-27/001005", lineCount: 5, isCredit: false, isCancelled: true }) },
  ];

  const logoB64 = fs
    .readFileSync(path.resolve(process.cwd(), "public/brand/jmd-cart-logo-thermal.png"))
    .toString("base64");
  const logoDataUri = `data:image/png;base64,${logoB64}`;

  const allMetrics: Array<{ name: string; scrollWidth: number; clientWidth: number; cellOverflowCount: number; minFontPx: number; maxFontPx: number; imgNatWidth: number; bodyHeightPx: number }> = [];

  const browser = await chromium.launch({ headless: true });
  try {
    // 288px CSS viewport * deviceScaleFactor 2 = 576px wide thermal bitmap PNG!
    const ctx = await browser.newContext({
      viewport: { width: 288, height: 100 },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();

    for (const fx of fixtures) {
      let html = renderDirectPrintHtml(fx.inv, biz, "thermal");
      html = html.replace(/\/brand\/jmd-cart-logo-thermal\.png/g, logoDataUri);
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForTimeout(100);

      const metrics = await page.evaluate(() => {
        const sheet = document.querySelector('[data-testid="bill-document"]') as HTMLElement;
        const sizes: number[] = [];
        const walk = (el: Element) => {
          const cs = window.getComputedStyle(el);
          if (el.textContent && el.textContent.trim().length > 0 && el.children.length === 0) {
            sizes.push(parseFloat(cs.fontSize));
          }
          for (const ch of Array.from(el.children)) walk(ch);
        };
        if (sheet) walk(sheet);
        const cells = Array.from(sheet?.querySelectorAll("td, th") || []) as HTMLElement[];
        const cellOverflowCount = cells.filter((c) => c.scrollWidth > c.clientWidth + 1).length;
        const img = document.querySelector("img") as HTMLImageElement | null;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          cellOverflowCount,
          minFontPx: sizes.length ? Math.min(...sizes) : 0,
          maxFontPx: sizes.length ? Math.max(...sizes) : 0,
          imgNatWidth: img?.naturalWidth || 0,
          bodyHeightPx: sheet?.scrollHeight || document.body.scrollHeight,
        };
      });

      const pngPath = path.join(outDir, `${fx.name}.png`);
      await page.locator('[data-testid="bill-document"]').first().screenshot({ path: pngPath });
      const pdfPath = path.join(outDir, `${fx.name}.pdf`);
      await page.pdf({
        path: pdfPath,
        width: "80mm",
        height: `${Math.max(80, Math.ceil(metrics.bodyHeightPx * 0.28) + 14)}mm`,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
        printBackground: true,
      });

      allMetrics.push({ name: fx.name, ...metrics });
    }

    // 6. Real /shop/invoices/sample/preview (at 288px*2 = 576px)
    await page.goto(`${baseUrl}/login`, { waitUntil: "load" });
    await page.fill('input[name="phone"]', "9876543210");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin**", { timeout: 25000, waitUntil: "commit" });

    await page.goto(`${baseUrl}/shop/invoices/sample/preview`, { waitUntil: "load" });
    await page.waitForSelector('[data-testid="bill-document"]', { timeout: 10000 });
    const bill = page.locator('[data-testid="bill-document"]').first();
    await bill.screenshot({ path: path.join(outDir, "06-sample-preview.png") });
    await page.pdf({
      path: path.join(outDir, "06-sample-preview.pdf"),
      width: "80mm",
      height: "200mm",
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
  return allMetrics;
}

if (require.main === module) {
  renderR4ThermalArtifacts(process.env.E2E_BASE_URL || "http://127.0.0.1:3000").catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
