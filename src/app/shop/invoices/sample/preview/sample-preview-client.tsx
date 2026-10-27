"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BusinessDetails } from "@/modules/settings/settings.types";
import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { InvoiceChannel, InvoiceStatus, PaymentMode, PaymentStatus } from "@prisma/client";
import { CashReceiptSlip } from "@/components/printing/cash-receipt-slip";
import { A5Invoice } from "@/components/printing/a5-invoice";
import { ThermalReceipt } from "@/components/printing/thermal-receipt";

interface SamplePreviewClientProps {
  business: BusinessDetails;
}

const RAW_SAMPLE_INVOICE = {
  id: "sample-inv-001",
  branchId: 1,
  number: "INV/2026-27/000128",
  fy: "2026-27",
  status: InvoiceStatus.FINAL,
  channel: InvoiceChannel.SHOP,
  locationId: "loc-shop-01",
  partyId: "party-sample-01",
  buyerType: "RETAILER",
  notes: "Sample preview invoice (no database modifications)",
  creditOverride: false,
  creditOverrideBy: null,
  creditOverrideReason: null,
  subtotalPaise: 48000,
  discountPaise: 4500,
  taxablePaise: 41428,
  cgstPaise: 1036,
  sgstPaise: 1036,
  igstPaise: 0,
  roundOffPaise: 0,
  totalPaise: 43550, // ₹435.50
  paymentStatus: PaymentStatus.PAID,
  irn: null,
  ackNo: null,
  ackDate: null,
  qrCodeUrl: null,
  customerName: "M/s Maa Durga Kirana Store",
  customerPhone: "9876543210",
  customerAddress: "Ward No 12, Naya Bazar, Saharsa, Bihar - 852201",
  agentUserId: "user-agent-01",
  agentCodeSnapshot: "AG001",
  createdAt: new Date("2026-10-27T10:30:00.000Z"),
  updatedAt: new Date("2026-10-27T10:30:00.000Z"),
  finalizedAt: new Date("2026-10-27T10:30:00.000Z"),
  createdBy: "user-agent-01",
  idempotencyKey: "sample-idempotency-key",
  location: {
    id: "loc-shop-01",
    branchId: 1,
    name: "Main Retail Counter",
    type: "SHOP" as any,
    active: true,
    assignedUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  party: {
    id: "party-sample-01",
    branchId: 1,
    companyId: null,
    name: "M/s Maa Durga Kirana Store",
    phone: "9876543210",
    email: null,
    address: "Ward No 12, Naya Bazar, Saharsa, Bihar - 852201",
    gstin: "10AABCM1234F1Z1",
    type: "CUSTOMER" as any,
    creditEnabled: true,
    creditLimitPaise: 5000000,
    creditDays: 14,
    openingOutstandingPaise: 0,
    tallyRef: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  creator: {
    id: "user-agent-01",
    name: "Rajesh Kumar",
    role: "SHOP" as any,
    agentCode: "AG001",
  },
  agentUser: {
    id: "user-agent-01",
    name: "Rajesh Kumar",
    role: "SHOP" as any,
    agentCode: "AG001",
  },
  items: [
    {
      id: "line-01",
      invoiceId: "sample-inv-001",
      productId: "prod-01",
      qty: 2,
      mrpPaise: 15000,
      discountBp: 1000,
      unitPricePaise: 13500,
      taxablePaise: 25714,
      gstRateBp: 500,
      taxPaise: 1286,
      hsn: "151491",
      product: {
        id: "prod-01",
        name: "Fortune Kachi Ghani Mustard Oil 1L Pouch",
        shortCode: "FORT-1L",
        packSize: 1,
        packLabel: "Pcs",
      },
    },
    {
      id: "line-02",
      invoiceId: "sample-inv-001",
      productId: "prod-02",
      qty: 5,
      mrpPaise: 2800,
      discountBp: 700,
      unitPricePaise: 2600,
      taxablePaise: 12380,
      gstRateBp: 500,
      taxPaise: 620,
      hsn: "250100",
      product: {
        id: "prod-02",
        name: "Tata Salt Vacuum Evaporated 1 Kg Pkt",
        shortCode: "TATA-1K",
        packSize: 1,
        packLabel: "Pcs",
      },
    },
    {
      id: "line-03",
      invoiceId: "sample-inv-001",
      productId: "prod-03",
      qty: 1,
      mrpPaise: 5000,
      discountBp: 1000,
      unitPricePaise: 4500,
      taxablePaise: 4286,
      gstRateBp: 500,
      taxPaise: 214,
      hsn: "091099",
      product: {
        id: "prod-03",
        name: "MDH Chana Masala 100g Box",
        shortCode: "MDH-100G",
        packSize: 1,
        packLabel: "Pcs",
      },
    },
  ],
  payments: [
    {
      id: "pay-01",
      branchId: 1,
      invoiceId: "sample-inv-001",
      partyId: null,
      mode: PaymentMode.UPI,
      amountPaise: 43550,
      receiptNo: "REC-SAMPLE",
      notes: null,
      vanLocationId: null,
      receivedBy: null,
      createdAt: new Date(),
    },
  ],
  creditNotes: [],
};

const SAMPLE_INVOICE = RAW_SAMPLE_INVOICE as unknown as InvoiceWithDetails;

export function SamplePreviewClient({ business }: SamplePreviewClientProps) {
  const [format, setFormat] = useState<"thermal" | "a5">("thermal");

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 print:p-0 print:bg-white font-sans">
      {/* Top Controls Toolbar (Hidden during browser printing) */}
      <div className="no-print max-w-4xl mx-auto mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/shop/invoices"
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 transition"
          >
            ← Invoices
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Sample Fixture
            </span>
            <span className="text-xs text-slate-500 font-medium">
              Zero DB writes • Safe Visual Quality Inspection
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher */}
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-300 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFormat("thermal")}
              className={`px-3 py-1.5 rounded-md transition ${
                format === "thermal"
                  ? "bg-white text-emerald-800 shadow-sm font-bold border border-emerald-500/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              💵 Thermal Slip (80mm)
            </button>
            <button
              type="button"
              onClick={() => setFormat("a5")}
              className={`px-3 py-1.5 rounded-md transition flex items-center gap-1 ${
                format === "a5"
                  ? "bg-white text-rose-900 shadow-sm font-bold border border-rose-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <span>📄 A5 Invoice</span>
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / PDF (Ctrl+P)
          </button>
        </div>
      </div>

      {/* Render Selected Format */}
      <div className="flex justify-center print:block">
        {format === "thermal" && (
          <CashReceiptSlip invoice={SAMPLE_INVOICE} business={business} />
        )}
        {format === "a5" && (
          <A5Invoice invoice={SAMPLE_INVOICE} business={business} />
        )}
      </div>
    </div>
  );
}
