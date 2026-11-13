import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";
import { renderDirectPrintHtml } from "../src/lib/printing/bill-html";
import type { InvoiceWithDetails } from "../src/modules/billing/billing.types";
import type { BusinessDetails } from "../src/modules/settings/settings.types";

const business: BusinessDetails = {
  legalName: "JAI MATA DI TRADERS",
  tradeName: "JMD CART",
  gstin: "10ABCDE1234F1Z5",
  fssai: "10422000000123",
  address: "Station Road, Forbesganj, Araria, Bihar - 854318",
  phone: "7979749009",
  email: "contact@jmdcart.com",
  upiId: "7979749009@okbizaxis",
};

function makeSampleInvoice(opts: {
  id: string;
  number: string;
  mode: "CASH" | "UPI" | "CREDIT" | "SPLIT";
  lineCount?: number;
  totalPaise?: number;
}): InvoiceWithDetails {
  const lineCount = opts.lineCount || 5;
  const items = Array.from({ length: lineCount }).map((_, idx) => {
    const isCarton = idx % 2 === 0;
    const packSize = isCarton ? 24 : 1;
    const qty = isCarton ? 5 : 12;
    const unitPricePaise = 5000;
    const taxablePaise = qty * unitPricePaise;
    const taxPaise = Math.round(taxablePaise * 0.05);

    return {
      id: `item-${idx + 1}`,
      invoiceId: opts.id,
      productId: `prod-${idx + 1}`,
      qty: isCarton ? qty * packSize : qty,
      mrpPaise: 6000,
      originalMrpPaise: 6000,
      mrpOverridden: false,
      rateOverridden: false,
      unitLabel: isCarton ? "Carton" : "Pcs",
      discountBp: 0,
      unitPricePaise,
      taxablePaise,
      gstRateBp: 500,
      taxPaise,
      hsn: "21069099",
      product: {
        id: `prod-${idx + 1}`,
        branchId: 1,
        name: `Sample FMCG Product #${idx + 1}`,
        nameHi: null,
        nameHiSource: null,
        shortCode: `P00${idx + 1}`,
        weight: "250g",
        weightValue: 250,
        weightUnit: "g",
        weightBase: 250,
        bagSize: null,
        openingStockQty: 100,
        openingStockGodownQty: 100,
        openingStockShopQty: 100,
        openingStockDate: null,
        companyId: null,
        categoryId: null,
        hsn: "21069099",
        gstRateBp: 500,
        mrpPaise: 6000,
        priceAPaise: 5000,
        priceBPaise: 5000,
        priceCPaise: 5000,
        packSize,
        packLabel: "Carton",
        reorderLevel: 10,
        imageUrl: null,
        active: true,
        createdAt: new Date(),
        needsReview: false,
        updatedAt: new Date(),
        highlights: null,
        specs: null,
        slug: null,
        description: null,
        metaTitle: null,
        metaDescription: null,
      },
    };
  });

  const subtotalPaise = items.reduce((s, it) => s + it.taxablePaise + it.taxPaise, 0);
  const totalPaise = opts.totalPaise || subtotalPaise;

  let payments: any[] = [];
  let paymentStatus: any = "PAID";

  if (opts.mode === "CASH") {
    payments = [{ id: "pay-1", branchId: 1, invoiceId: opts.id, mode: "CASH", amountPaise: totalPaise, status: "SUCCESS", reference: null, partyId: null, collectedBy: null, createdAt: new Date() }];
    paymentStatus = "PAID";
  } else if (opts.mode === "UPI") {
    payments = [{ id: "pay-1", branchId: 1, invoiceId: opts.id, mode: "UPI", amountPaise: totalPaise, status: "SUCCESS", reference: null, partyId: null, collectedBy: null, createdAt: new Date() }];
    paymentStatus = "PAID";
  } else if (opts.mode === "CREDIT") {
    payments = [{ id: "pay-1", branchId: 1, invoiceId: opts.id, mode: "CREDIT", amountPaise: totalPaise, status: "SUCCESS", reference: null, partyId: null, collectedBy: null, createdAt: new Date() }];
    paymentStatus = "PENDING";
  } else if (opts.mode === "SPLIT") {
    const half = Math.round(totalPaise / 2);
    payments = [
      { id: "pay-1", branchId: 1, invoiceId: opts.id, mode: "CASH", amountPaise: half, status: "SUCCESS", reference: null, partyId: null, collectedBy: null, createdAt: new Date() },
      { id: "pay-2", branchId: 1, invoiceId: opts.id, mode: "UPI", amountPaise: totalPaise - half, status: "SUCCESS", reference: null, partyId: null, collectedBy: null, createdAt: new Date() },
    ];
    paymentStatus = "PAID";
  }

  return {
    id: opts.id,
    branchId: 1,
    number: opts.number,
    fy: "26-27",
    status: "FINAL" as any,
    channel: "SHOP" as any,
    locationId: "loc-1",
    partyId: opts.mode === "CREDIT" ? "party-1" : null,
    customerName: opts.mode === "CREDIT" ? "Gulzar Pan Place" : "Counter Sale",
    customerPhone: "9876543210",
    customerAddress: "Main Market, Forbesganj",
    agentUserId: null,
    agentCodeSnapshot: null,
    buyerType: "RETAIL",
    documentType: "RETAIL",
    pricingTier: "AUTO",
    notes: null,
    creditOverride: false,
    creditOverrideBy: null,
    creditOverrideReason: null,
    subtotalPaise,
    discountPaise: 0,
    taxablePaise: items.reduce((s, it) => s + it.taxablePaise, 0),
    cgstPaise: Math.round(items.reduce((s, it) => s + it.taxPaise, 0) / 2),
    sgstPaise: Math.round(items.reduce((s, it) => s + it.taxPaise, 0) / 2),
    igstPaise: 0,
    roundOffPaise: 0,
    totalPaise,
    paymentStatus,
    createdBy: "admin",
    createdAt: new Date(),
    finalizedAt: new Date(),
    invoiceDate: new Date(),
    isPostDated: false,
    postDatedReason: null,
    version: 1,
    items,
    payments,
    location: { id: "loc-1", branchId: 1, name: "Shop", type: "SHOP", active: true, createdAt: new Date(), updatedAt: new Date() },
    party: opts.mode === "CREDIT" ? {
      id: "party-1",
      branchId: 1,
      name: "Gulzar Pan Place",
      phone: "9876543210",
      type: "RETAILER" as any,
      active: true,
      creditLimitPaise: 5000000,
      creditTermDays: 30,
      currentOutstandingPaise: 1500000,
      creditEnabled: true,
      address: "Main Market, Forbesganj",
      gstin: null,
      companyId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      notes: null,
    } : null,
  } as any;
}

async function main() {
  const artifactsDir = path.resolve(process.cwd(), "artifacts");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge" });
  } catch {
    try {
      browser = await chromium.launch({ channel: "chrome" });
    } catch {
      browser = await chromium.launch();
    }
  }
  const page = await browser.newPage();

  const proofs = [
    {
      file: "bill-a5-cash.pdf",
      inv: makeSampleInvoice({ id: "inv-cash", number: "INV/26-27/000291", mode: "CASH" }),
    },
    {
      file: "bill-a5-upi.pdf",
      inv: makeSampleInvoice({ id: "inv-upi", number: "INV/26-27/000292", mode: "UPI" }),
    },
    {
      file: "bill-a5-credit.pdf",
      inv: makeSampleInvoice({ id: "inv-credit", number: "INV/26-27/000293", mode: "CREDIT" }),
    },
    {
      file: "bill-a5-split.pdf",
      inv: makeSampleInvoice({ id: "inv-split", number: "INV/26-27/000294", mode: "SPLIT" }),
    },
    {
      file: "bill-a5-30-lines.pdf",
      inv: makeSampleInvoice({ id: "inv-30", number: "INV/26-27/000295", mode: "CASH", lineCount: 30 }),
    },
  ];

  for (const { file, inv } of proofs) {
    const html = renderDirectPrintHtml(inv, business, "a5");
    await page.setContent(html, { waitUntil: "networkidle" });
    const outPath = path.join(artifactsDir, file);
    await page.pdf({
      path: outPath,
      format: "A5",
      landscape: false,
      printBackground: true,
      margin: { top: "4mm", bottom: "4mm", left: "5mm", right: "5mm" },
    });
    console.log(`Generated: ${outPath}`);
  }

  await browser.close();
  console.log("All 5 proof PDFs generated successfully!");
}

main().catch(console.error);
