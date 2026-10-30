import { prisma } from "@/lib/prisma";
import { InvoiceStatus, InvoiceChannel, PaymentStatus } from "@prisma/client";
import { startOfIstDay, endOfIstDay } from "@/lib/datetime";

export interface InvoiceTotalsFilter {
  startDate?: string | Date;
  endDate?: string | Date;
  channel?: InvoiceChannel;
  locationId?: string;
  partyId?: string;
  paymentStatus?: PaymentStatus;
  status?: InvoiceStatus;
  search?: string;
}

export interface InvoiceTotalsSummary {
  invoiceCount: number;
  totalAmountPaise: number;
  taxablePaise: number;
  taxPaise: number;
  discountPaise: number;
  paidPaise: number;
  pendingPaise: number;
  avgBillPaise: number;
  cancelledCount: number;
  channelBreakdown: {
    shop: { count: number; totalPaise: number };
    van: { count: number; totalPaise: number };
    online: { count: number; totalPaise: number };
  };
  paymentStatusBreakdown: {
    paid: { count: number; totalPaise: number };
    pending: { count: number; totalPaise: number };
    partial: { count: number; totalPaise: number };
  };
}

export class InvoiceTotalsService {
  /**
   * Computes exact database aggregate totals across ALL invoices matching the filter.
   */
  async getInvoiceTotals(filter: InvoiceTotalsFilter): Promise<InvoiceTotalsSummary> {
    const where: Record<string, unknown> = {};

    if (filter.channel) where.channel = filter.channel;
    if (filter.locationId) where.locationId = filter.locationId;
    if (filter.partyId) where.partyId = filter.partyId;
    if (filter.paymentStatus) where.paymentStatus = filter.paymentStatus;

    if (filter.startDate || filter.endDate) {
      const dateRange: { gte?: Date; lte?: Date } = {};
      if (filter.startDate) dateRange.gte = startOfIstDay(filter.startDate);
      if (filter.endDate) dateRange.lte = endOfIstDay(filter.endDate);

      // Filter by invoiceDate or createdAt
      where.OR = [
        { invoiceDate: dateRange },
        { invoiceDate: null, createdAt: dateRange },
      ];
    }

    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { number: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
      ];
    }

    // 1. Count cancelled invoices separately
    const cancelledCount = await prisma.invoice.count({
      where: {
        ...where,
        status: InvoiceStatus.CANCELLED,
      },
    });

    // 2. Aggregate active invoices
    const activeWhere = {
      ...where,
      status: filter.status || { not: InvoiceStatus.CANCELLED },
    };

    const aggregates = await prisma.invoice.aggregate({
      where: activeWhere,
      _count: { id: true },
      _sum: {
        totalPaise: true,
        taxablePaise: true,
        cgstPaise: true,
        sgstPaise: true,
        igstPaise: true,
        discountPaise: true,
      },
    });

    const invoiceCount = aggregates._count.id || 0;
    const totalAmountPaise = aggregates._sum.totalPaise || 0;
    const taxablePaise = aggregates._sum.taxablePaise || 0;
    const cgstPaise = aggregates._sum.cgstPaise || 0;
    const sgstPaise = aggregates._sum.sgstPaise || 0;
    const igstPaise = aggregates._sum.igstPaise || 0;
    const taxPaise = cgstPaise + sgstPaise + igstPaise;
    const discountPaise = aggregates._sum.discountPaise || 0;

    // 3. Paid vs Pending
    const paymentsSum = await prisma.payment.aggregate({
      where: {
        invoice: activeWhere,
      },
      _sum: {
        amountPaise: true,
      },
    });

    const paidPaise = paymentsSum._sum.amountPaise || 0;
    const pendingPaise = Math.max(0, totalAmountPaise - paidPaise);
    const avgBillPaise = invoiceCount > 0 ? Math.round(totalAmountPaise / invoiceCount) : 0;

    // 4. Channel Breakdown
    const channelGroup = await prisma.invoice.groupBy({
      by: ["channel"],
      where: activeWhere,
      _count: { id: true },
      _sum: { totalPaise: true },
    });

    const channelBreakdown = {
      shop: { count: 0, totalPaise: 0 },
      van: { count: 0, totalPaise: 0 },
      online: { count: 0, totalPaise: 0 },
    };

    for (const g of channelGroup) {
      if (g.channel === InvoiceChannel.SHOP) {
        channelBreakdown.shop = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      } else if (g.channel === InvoiceChannel.VAN) {
        channelBreakdown.van = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      } else if (g.channel === InvoiceChannel.ONLINE) {
        channelBreakdown.online = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      }
    }

    // 5. Payment Status Breakdown
    const statusGroup = await prisma.invoice.groupBy({
      by: ["paymentStatus"],
      where: activeWhere,
      _count: { id: true },
      _sum: { totalPaise: true },
    });

    const paymentStatusBreakdown = {
      paid: { count: 0, totalPaise: 0 },
      pending: { count: 0, totalPaise: 0 },
      partial: { count: 0, totalPaise: 0 },
    };

    for (const g of statusGroup) {
      if (g.paymentStatus === PaymentStatus.PAID) {
        paymentStatusBreakdown.paid = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      } else if (g.paymentStatus === PaymentStatus.PENDING) {
        paymentStatusBreakdown.pending = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      } else if (g.paymentStatus === PaymentStatus.PARTIAL) {
        paymentStatusBreakdown.partial = { count: g._count.id, totalPaise: g._sum.totalPaise || 0 };
      }
    }

    return {
      invoiceCount,
      totalAmountPaise,
      taxablePaise,
      taxPaise,
      discountPaise,
      paidPaise,
      pendingPaise,
      avgBillPaise,
      cancelledCount,
      channelBreakdown,
      paymentStatusBreakdown,
    };
  }
}

export const invoiceTotalsService = new InvoiceTotalsService();
