import { prisma } from "@/lib/prisma";
import {
  IncentiveRule,
  IncentiveEntry,
  IncentivePayout,
  IncentiveEntryType,
  IncentiveEntryStatus,
  IncentivePayoutStatus,
  Prisma,
} from "@prisma/client";
import {
  CreateIncentiveRuleInput,
  IncentiveLedgerFilter,
} from "./incentive.types";

export class IncentiveRepository {
  async createRule(
    data: CreateIncentiveRuleInput,
    tx: Prisma.TransactionClient = prisma
  ): Promise<IncentiveRule> {
    return tx.incentiveRule.create({
      data: {
        scope: data.scope,
        agentUserId: data.agentUserId || null,
        companyId: data.companyId || null,
        categoryId: data.categoryId || null,
        productId: data.productId || null,
        percentBp: data.percentBp,
        validFrom: data.validFrom,
        validTo: data.validTo || null,
        active: data.active ?? true,
        note: data.note || null,
      },
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true } },
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, shortCode: true } },
      },
    });
  }

  async updateRule(
    id: string,
    data: Partial<CreateIncentiveRuleInput>,
    tx: Prisma.TransactionClient = prisma
  ): Promise<IncentiveRule> {
    return tx.incentiveRule.update({
      where: { id },
      data: {
        scope: data.scope,
        agentUserId: data.agentUserId,
        companyId: data.companyId,
        categoryId: data.categoryId,
        productId: data.productId,
        percentBp: data.percentBp,
        validFrom: data.validFrom,
        validTo: data.validTo,
        active: data.active,
        note: data.note,
      },
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true } },
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, shortCode: true } },
      },
    });
  }

  async deleteRule(id: string, tx: Prisma.TransactionClient = prisma): Promise<IncentiveRule> {
    return tx.incentiveRule.delete({ where: { id } });
  }

  async listRules(filters?: { active?: boolean }): Promise<IncentiveRule[]> {
    const where: Prisma.IncentiveRuleWhereInput = {};
    if (filters?.active !== undefined) {
      where.active = filters.active;
    }
    return prisma.incentiveRule.findMany({
      where,
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true } },
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, shortCode: true } },
      },
    });
  }

  async getActiveRulesForDate(date: Date = new Date()): Promise<IncentiveRule[]> {
    return prisma.incentiveRule.findMany({
      where: {
        active: true,
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gte: date } }],
      },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true } },
        company: { select: { id: true, name: true } },
        category: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, shortCode: true } },
      },
    });
  }

  async createEntry(
    data: Prisma.IncentiveEntryUncheckedCreateInput,
    tx: Prisma.TransactionClient = prisma
  ): Promise<IncentiveEntry> {
    return tx.incentiveEntry.create({ data });
  }

  async listEntries(filters: IncentiveLedgerFilter = {}): Promise<any[]> {
    const where: Prisma.IncentiveEntryWhereInput = {};
    if (filters.period) where.period = filters.period;
    if (filters.agentUserId) where.agentUserId = filters.agentUserId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.invoiceId) where.invoiceId = filters.invoiceId;

    if (filters.startDate || filters.endDate) {
      where.triggeredAt = {};
      if (filters.startDate) where.triggeredAt.gte = filters.startDate;
      if (filters.endDate) where.triggeredAt.lte = filters.endDate;
    }

    return prisma.incentiveEntry.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      include: {
        agentUser: { select: { id: true, name: true, agentCode: true, role: true } },
        invoice: {
          select: {
            id: true,
            number: true,
            channel: true,
            totalPaise: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getPayout(agentUserId: string, period: string): Promise<IncentivePayout | null> {
    return prisma.incentivePayout.findUnique({
      where: {
        agentUserId_period: { agentUserId, period },
      },
    });
  }

  async upsertPayout(
    agentUserId: string,
    period: string,
    data: {
      totalPaise: number;
      status?: IncentivePayoutStatus;
      method?: string | null;
      reference?: string | null;
      paidAt?: Date | null;
      paidBy?: string | null;
      note?: string | null;
    },
    tx: Prisma.TransactionClient = prisma
  ): Promise<IncentivePayout> {
    return tx.incentivePayout.upsert({
      where: { agentUserId_period: { agentUserId, period } },
      create: {
        agentUserId,
        period,
        totalPaise: data.totalPaise,
        status: data.status || IncentivePayoutStatus.DRAFT,
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt,
        paidBy: data.paidBy,
        note: data.note,
      },
      update: {
        totalPaise: data.totalPaise,
        status: data.status,
        method: data.method,
        reference: data.reference,
        paidAt: data.paidAt,
        paidBy: data.paidBy,
        note: data.note,
      },
    });
  }
}

export const incentiveRepository = new IncentiveRepository();
