import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InvoiceWithDetails, InvoiceListFilters } from "./billing.types";

export class BillingRepository {
  /**
   * Find an invoice by its unique internal ID.
   */
  async findById(
    id: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<InvoiceWithDetails | null> {
    const invoice = await client.invoice.findUnique({
      where: { id },
      include: {
        location: true,
        party: true,
        creator: {
          select: { id: true, name: true, role: true },
        },
        creditOverrideUser: {
          select: { id: true, name: true, role: true },
        },
        agentUser: {
          select: { id: true, name: true, role: true, agentCode: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                weight: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
        payments: true,
        creditNotes: true,
        revisions: {
          include: { editor: { select: { id: true, name: true, role: true } } },
          orderBy: { revisionNumber: "desc" },
        },
      },
    });

    return invoice as InvoiceWithDetails | null;
  }

  /**
   * Find an invoice by its unique FY sequence number (e.g., INV/26-27/000001).
   */
  async findByNumber(
    number: string,
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<InvoiceWithDetails | null> {
    const invoice = await client.invoice.findUnique({
      where: { number },
      include: {
        location: true,
        party: true,
        creator: {
          select: { id: true, name: true, role: true },
        },
        creditOverrideUser: {
          select: { id: true, name: true, role: true },
        },
        agentUser: {
          select: { id: true, name: true, role: true, agentCode: true },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                shortCode: true,
                packSize: true,
                packLabel: true,
              },
            },
          },
        },
        payments: true,
        creditNotes: true,
      },
    });

    return invoice as InvoiceWithDetails | null;
  }

  /**
   * List invoices with filtering, pagination, and sorting.
   */
  async listInvoices(
    filters: InvoiceListFilters = {},
    client: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<{ items: InvoiceWithDetails[]; total: number }> {
    const where: Prisma.InvoiceWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.locationId) where.locationId = filters.locationId;
    if (filters.partyId) where.partyId = filters.partyId;
    if (filters.channel) where.channel = filters.channel;

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = filters.dateFrom;
      if (filters.dateTo) where.createdAt.lte = filters.dateTo;
    }

    if (filters.search && filters.search.trim().length > 0) {
      const term = filters.search.trim();
      where.OR = [
        { number: { contains: term, mode: "insensitive" } },
        { party: { name: { contains: term, mode: "insensitive" } } },
        { party: { phone: { contains: term } } },
      ];
    }

    const [items, total] = await Promise.all([
      client.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: filters.limit ?? 50,
        skip: filters.offset ?? 0,
        include: {
          location: true,
          party: true,
          creator: {
            select: { id: true, name: true, role: true },
          },
          creditOverrideUser: {
            select: { id: true, name: true, role: true },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  shortCode: true,
                  packSize: true,
                  packLabel: true,
                },
              },
            },
          },
          payments: true,
          creditNotes: true,
        },
      }),
      client.invoice.count({ where }),
    ]);

    return { items: items as InvoiceWithDetails[], total };
  }
}

export const billingRepository = new BillingRepository();
