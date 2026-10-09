import { prisma } from "@/lib/prisma";
import { Prisma, Party, LedgerKind, PartyType } from "@prisma/client";
import {
  CreatePartyInput,
  UpdatePartyInput,
  PartySearchQuery,
  PartyWithOutstanding,
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
}

export const partyRepository = new PartyRepository();
