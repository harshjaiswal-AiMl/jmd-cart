import { prisma } from "@/lib/prisma";
import { getISTDateString, getISTDayRange } from "@/lib/date";
import { InvoiceStatus, PaymentMode } from "@prisma/client";
import {
  TallyExportFilter,
  TallySalesVoucher,
  TallyReceiptVoucher,
  TallyMasterLedger,
} from "./tally.types";

export class TallyRepository {
  /**
   * Retrieves finalized sales vouchers with full line items, party details, and GST breakdown.
   */
  async getSalesVouchers(startUtc: Date, endUtc: Date): Promise<TallySalesVoucher[]> {
    const invoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.FINAL,
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        party: {
          select: { name: true, gstin: true, address: true },
        },
        items: {
          include: {
            product: { select: { name: true, packLabel: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return invoices.map((inv) => ({
      voucherNumber: inv.number,
      date: inv.createdAt.toISOString().slice(0, 10),
      partyName: inv.party?.name || "Cash Customer",
      partyGstin: inv.party?.gstin,
      placeOfSupply: inv.party?.gstin?.slice(0, 2) ? `${inv.party.gstin.slice(0, 2)}-Bihar` : "10-Bihar",
      narration: `Sales via ${inv.channel} channel, Invoice ${inv.number}`,
      subtotalPaise: inv.subtotalPaise,
      discountPaise: inv.discountPaise,
      taxablePaise: inv.taxablePaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      igstPaise: inv.igstPaise,
      roundOffPaise: inv.roundOffPaise,
      totalPaise: inv.totalPaise,
      items: inv.items.map((item) => ({
        productName: item.product.name,
        qty: item.qty,
        ratePaise: item.unitPricePaise,
        mrpPaise: item.mrpPaise,
        unit: item.product.packLabel || "PCS",
        amountPaise: item.taxablePaise + item.taxPaise,
        discountBp: item.discountBp,
        gstRateBp: item.gstRateBp,
      })),
    }));
  }

  /**
   * Retrieves collections and payment receipts recorded in the date range.
   */
  async getReceiptVouchers(startUtc: Date, endUtc: Date): Promise<TallyReceiptVoucher[]> {
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: { gte: startUtc, lte: endUtc },
      },
      include: {
        party: { select: { name: true } },
        invoice: { select: { number: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return payments.map((p) => ({
      voucherNumber: p.receiptNo || `REC-${p.id.slice(-8).toUpperCase()}`,
      date: p.createdAt.toISOString().slice(0, 10),
      partyName: p.party?.name || "Cash Customer",
      amountPaise: p.amountPaise,
      mode: p.mode === PaymentMode.CASH ? "Cash" : p.mode === PaymentMode.UPI ? "Bank - UPI" : "Bank Transfer",
      narration: p.notes || `Collection received via ${p.mode}${p.invoice?.number ? ` against ${p.invoice.number}` : ""}`,
    }));
  }

  /**
   * Retrieves debtor party ledgers for master ledger import.
   */
  async getMasterLedgers(): Promise<TallyMasterLedger[]> {
    const parties = await prisma.party.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });

    return parties.map((p) => ({
      name: p.name,
      parent: p.type === "SUPPLIER" ? "Sundry Creditors" : "Sundry Debtors",
      gstin: p.gstin,
      phone: p.phone,
      address: p.address,
      openingBalancePaise: 0,
      creditLimitPaise: p.creditLimitPaise,
    }));
  }
}

export const tallyRepository = new TallyRepository();
