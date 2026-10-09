import { prisma } from "@/lib/prisma";
import { Prisma, Party, LedgerKind, PartyType, PaymentMode } from "@prisma/client";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import {
  CreatePartyInput,
  UpdatePartyInput,
  PartySearchQuery,
  PartyWithOutstanding,
  RecordCollectionInput,
  CollectionReceipt,
  PartyLedgerFilter,
  PartyLedgerRow,
  PartyLedgerStatement,
} from "./party.types";

export class PartyRepository {
  async getPartyById(id: string): Promise<PartyWithOutstanding | null> {
    const party = await prisma.party.findUnique({
      where: { id },
    });

    if (!party) {
      return null;
    }

    const outstandingPaise = await this.getPartyOutstanding(id);
    return {
      ...party,
      outstandingPaise,
    };
  }

  async findPartyByTallyRef(tallyRef: string): Promise<Party | null> {
    if (!tallyRef) return null;
    return prisma.party.findFirst({
      where: { tallyRef },
    });
  }

  async findPartyByNameAndPhone(name: string, phone?: string | null): Promise<Party | null> {
    if (phone) {
      const byPhone = await prisma.party.findFirst({
        where: { phone },
      });
      if (byPhone) return byPhone;
    }

    return prisma.party.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
      },
    });
  }

  async getPartyOutstanding(partyId: string, tx?: Prisma.TransactionClient): Promise<number> {
    const client = tx || prisma;
    const aggregate = await client.ledgerEntry.aggregate({
      where: { partyId },
      _sum: {
        debitPaise: true,
        creditPaise: true,
      },
    });

    const totalDebit = aggregate._sum.debitPaise ?? 0;
    const totalCredit = aggregate._sum.creditPaise ?? 0;
    return totalDebit - totalCredit;
  }

  async createParty(
    input: CreatePartyInput,
    tx?: Prisma.TransactionClient
  ): Promise<PartyWithOutstanding> {
    const execute = async (client: Prisma.TransactionClient) => {
      const { openingOutstandingPaise = 0, ...data } = input;

      const party = await client.party.create({
        data: {
          name: data.name.trim(),
          type: data.type ?? PartyType.CUSTOMER,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
          gstin: data.gstin?.trim() || null,
          address: data.address?.trim() || null,
          creditEnabled: data.creditEnabled ?? false,
          creditLimitPaise: data.creditLimitPaise ?? 0,
          creditDays: data.creditDays ?? 0,
          tallyRef: data.tallyRef?.trim() || null,
          active: data.active ?? true,
        },
      });

      if (openingOutstandingPaise !== 0) {
        await client.ledgerEntry.create({
          data: {
            partyId: party.id,
            kind: LedgerKind.ADJUSTMENT,
            debitPaise: openingOutstandingPaise > 0 ? openingOutstandingPaise : 0,
            creditPaise: openingOutstandingPaise < 0 ? Math.abs(openingOutstandingPaise) : 0,
            referenceType: "OPENING_BALANCE",
            referenceId: party.id,
          },
        });
      }

      return {
        ...party,
        outstandingPaise: openingOutstandingPaise,
      };
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  async updateParty(
    input: UpdatePartyInput,
    tx?: Prisma.TransactionClient
  ): Promise<PartyWithOutstanding> {
    const execute = async (client: Prisma.TransactionClient) => {
      const { id, openingOutstandingPaise, ...data } = input;

      const updateData: Prisma.PartyUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name.trim();
      if (data.type !== undefined) updateData.type = data.type;
      if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
      if (data.email !== undefined) updateData.email = data.email?.trim() || null;
      if (data.gstin !== undefined) updateData.gstin = data.gstin?.trim() || null;
      if (data.address !== undefined) updateData.address = data.address?.trim() || null;
      if (data.creditEnabled !== undefined) updateData.creditEnabled = data.creditEnabled;
      if (data.creditLimitPaise !== undefined) updateData.creditLimitPaise = data.creditLimitPaise;
      if (data.creditDays !== undefined) updateData.creditDays = data.creditDays;
      if (data.tallyRef !== undefined) updateData.tallyRef = data.tallyRef?.trim() || null;
      if (data.active !== undefined) updateData.active = data.active;

      const party = await client.party.update({
        where: { id },
        data: updateData,
      });

      if (openingOutstandingPaise !== undefined) {
        const existingOpening = await client.ledgerEntry.findFirst({
          where: {
            partyId: id,
            referenceType: "OPENING_BALANCE",
          },
        });

        if (openingOutstandingPaise === 0) {
          if (existingOpening) {
            await client.ledgerEntry.delete({ where: { id: existingOpening.id } });
          }
        } else if (existingOpening) {
          await client.ledgerEntry.update({
            where: { id: existingOpening.id },
            data: {
              debitPaise: openingOutstandingPaise > 0 ? openingOutstandingPaise : 0,
              creditPaise: openingOutstandingPaise < 0 ? Math.abs(openingOutstandingPaise) : 0,
            },
          });
        } else {
          await client.ledgerEntry.create({
            data: {
              partyId: id,
              kind: LedgerKind.ADJUSTMENT,
              debitPaise: openingOutstandingPaise > 0 ? openingOutstandingPaise : 0,
              creditPaise: openingOutstandingPaise < 0 ? Math.abs(openingOutstandingPaise) : 0,
              referenceType: "OPENING_BALANCE",
              referenceId: id,
            },
          });
        }
      }

      const outstandingPaise = await this.getPartyOutstanding(id, client);
      return {
        ...party,
        outstandingPaise,
      };
    };

    if (tx) {
      return execute(tx);
    }
    return prisma.$transaction(execute);
  }

  async searchParties(
    query: PartySearchQuery
  ): Promise<{ parties: PartyWithOutstanding[]; total: number }> {
    const where: Prisma.PartyWhereInput = {};

    if (query.activeOnly) {
      where.active = true;
    }

    if (query.type) {
      where.type = query.type;
    }

    if (query.creditOnly) {
      where.creditEnabled = true;
    }

    if (query.q && query.q.trim().length > 0) {
      const tokens = query.q.trim().split(/\s+/).filter(Boolean);
      where.AND = tokens.map((token) => ({
        OR: [
          { name: { contains: token, mode: "insensitive" } },
          { phone: { contains: token, mode: "insensitive" } },
          { gstin: { contains: token, mode: "insensitive" } },
          { tallyRef: { contains: token, mode: "insensitive" } },
        ],
      }));
    }

    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        orderBy: { name: "asc" },
        take: query.limit,
        skip: query.offset,
        include: {
          ledgerEntries: {
            select: {
              debitPaise: true,
              creditPaise: true,
            },
          },
        },
      }),
      prisma.party.count({ where }),
    ]);

    const partiesWithOutstanding: PartyWithOutstanding[] = parties.map((p) => {
      const totalDebit = p.ledgerEntries.reduce((acc, entry) => acc + entry.debitPaise, 0);
      const totalCredit = p.ledgerEntries.reduce((acc, entry) => acc + entry.creditPaise, 0);
      const { ledgerEntries, ...rest } = p;
      return {
        ...rest,
        outstandingPaise: totalDebit - totalCredit,
      };
    });

    return {
      parties: partiesWithOutstanding,
      total,
    };
  }

  async recordCollection(
    input: RecordCollectionInput,
    actorId: string
  ): Promise<CollectionReceipt> {
    return prisma.$transaction(async (tx) => {
      const party = await tx.party.findUnique({
        where: { id: input.partyId },
      });
      if (!party) {
        throw new Error(`Party '${input.partyId}' not found`);
      }

      const prevOutstanding = await this.getPartyOutstanding(input.partyId, tx);

      // Assign gapless sequence number for receipt voucher
      const { number: receiptNo } = await getNextSequenceNumber(tx, "REC");

      const payment = await tx.payment.create({
        data: {
          partyId: input.partyId,
          receiptNo,
          mode: input.mode as PaymentMode,
          amountPaise: input.amountPaise,
          notes: input.notes?.trim() || null,
          vanLocationId: input.vanLocationId || null,
          receivedBy: actorId,
        },
        include: {
          party: true,
          receiver: true,
          vanLocation: true,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          partyId: input.partyId,
          kind: LedgerKind.RECEIPT,
          debitPaise: 0,
          creditPaise: input.amountPaise,
          referenceType: "RECEIPT",
          referenceId: receiptNo,
        },
      });

      const currentOutstanding = prevOutstanding - input.amountPaise;

      return {
        id: payment.id,
        receiptNo,
        partyId: party.id,
        partyName: party.name,
        partyPhone: party.phone,
        amountPaise: input.amountPaise,
        mode: input.mode,
        vanLocationId: input.vanLocationId || null,
        vanName: payment.vanLocation?.name || null,
        notes: payment.notes,
        collectedById: actorId,
        collectedByName: payment.receiver?.name || null,
        previousOutstandingPaise: prevOutstanding,
        currentOutstandingPaise: currentOutstanding,
        createdAt: payment.createdAt,
      };
    });
  }

  async getPartyLedgerStatement(
    filter: PartyLedgerFilter
  ): Promise<PartyLedgerStatement> {
    const party = await this.getPartyById(filter.partyId);
    if (!party) {
      throw new Error(`Party '${filter.partyId}' not found`);
    }

    let openingBalancePaise = 0;
    if (filter.startDate) {
      const priorAggregate = await prisma.ledgerEntry.aggregate({
        where: {
          partyId: filter.partyId,
          createdAt: { lt: filter.startDate },
        },
        _sum: {
          debitPaise: true,
          creditPaise: true,
        },
      });
      const priorDebit = priorAggregate._sum.debitPaise ?? 0;
      const priorCredit = priorAggregate._sum.creditPaise ?? 0;
      openingBalancePaise = priorDebit - priorCredit;
    }

    const dateWhere: Prisma.DateTimeFilter = {};
    if (filter.startDate) dateWhere.gte = filter.startDate;
    if (filter.endDate) dateWhere.lte = filter.endDate;

    const where: Prisma.LedgerEntryWhereInput = {
      partyId: filter.partyId,
      ...(Object.keys(dateWhere).length > 0 ? { createdAt: dateWhere } : {}),
    };

    const rawEntries = await prisma.ledgerEntry.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: filter.limit,
      skip: filter.offset,
    });

    let running = openingBalancePaise;
    let totalDebitPaise = 0;
    let totalCreditPaise = 0;

    const entries: PartyLedgerRow[] = rawEntries.map((entry) => {
      totalDebitPaise += entry.debitPaise;
      totalCreditPaise += entry.creditPaise;
      running += entry.debitPaise - entry.creditPaise;

      return {
        id: entry.id,
        createdAt: entry.createdAt,
        kind: entry.kind,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        debitPaise: entry.debitPaise,
        creditPaise: entry.creditPaise,
        runningBalancePaise: running,
      };
    });

    const closingBalancePaise = openingBalancePaise + totalDebitPaise - totalCreditPaise;

    return {
      party,
      openingBalancePaise,
      entries,
      totalDebitPaise,
      totalCreditPaise,
      closingBalancePaise,
    };
  }

  async getRecentCollections(
    filters: { vanLocationId?: string; actorId?: string; limit?: number } = {}
  ): Promise<CollectionReceipt[]> {
    const where: Prisma.PaymentWhereInput = {
      receiptNo: { not: null },
    };
    if (filters.vanLocationId) where.vanLocationId = filters.vanLocationId;
    if (filters.actorId) where.receivedBy = filters.actorId;

    const payments = await prisma.payment.findMany({
      where,
      include: {
        party: true,
        receiver: true,
        vanLocation: true,
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
    });

    return payments.map((p) => ({
      id: p.id,
      receiptNo: p.receiptNo!,
      partyId: p.partyId!,
      partyName: p.party?.name || "Customer",
      partyPhone: p.party?.phone || null,
      amountPaise: p.amountPaise,
      mode: p.mode as "CASH" | "UPI" | "CARD",
      vanLocationId: p.vanLocationId,
      vanName: p.vanLocation?.name || null,
      notes: p.notes,
      collectedById: p.receivedBy,
      collectedByName: p.receiver?.name || null,
      previousOutstandingPaise: 0,
      currentOutstandingPaise: 0,
      createdAt: p.createdAt,
    }));
  }

  async getCollectionById(receiptId: string): Promise<CollectionReceipt | null> {
    const p = await prisma.payment.findFirst({
      where: {
        OR: [{ id: receiptId }, { receiptNo: receiptId }],
      },
      include: {
        party: true,
        receiver: true,
        vanLocation: true,
      },
    });

    if (!p || !p.receiptNo) return null;

    const partyOutstanding = p.partyId ? await this.getPartyOutstanding(p.partyId) : 0;

    return {
      id: p.id,
      receiptNo: p.receiptNo,
      partyId: p.partyId || "",
      partyName: p.party?.name || "Customer",
      partyPhone: p.party?.phone || null,
      amountPaise: p.amountPaise,
      mode: p.mode as "CASH" | "UPI" | "CARD",
      vanLocationId: p.vanLocationId,
      vanName: p.vanLocation?.name || null,
      notes: p.notes,
      collectedById: p.receivedBy,
      collectedByName: p.receiver?.name || null,
      previousOutstandingPaise: partyOutstanding + p.amountPaise,
      currentOutstandingPaise: partyOutstanding,
      createdAt: p.createdAt,
    };
  }
}

export const partyRepository = new PartyRepository();
