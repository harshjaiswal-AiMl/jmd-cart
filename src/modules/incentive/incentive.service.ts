import { prisma } from "@/lib/prisma";
import {
  IncentiveRule,
  IncentiveEntry,
  IncentivePayout,
  IncentiveRuleScope,
  IncentiveEntryType,
  IncentiveEntryStatus,
  IncentivePayoutStatus,
  InvoiceChannel,
  UserRole,
  Prisma,
} from "@prisma/client";
import { settingsRepository } from "@/modules/settings/settings.repository";
import { auditService } from "@/modules/audit/audit.service";
import { ForbiddenError } from "@/modules/auth/permissions";
import {
  IncentiveSettings,
  DEFAULT_INCENTIVE_SETTINGS,
  incentiveSettingsSchema,
  CreateIncentiveRuleInput,
  IncentiveCalculationResult,
  IncentiveLedgerFilter,
  MonthlyStatementSummary,
} from "./incentive.types";
import { incentiveRepository } from "./incentive.repository";

export class IncentiveService {
  /**
   * Retrieves incentive settings from the settings table.
   */
  async getSettings(): Promise<IncentiveSettings> {
    const data = await settingsRepository.getSetting<IncentiveSettings>("incentive_settings");
    if (!data) return DEFAULT_INCENTIVE_SETTINGS;
    const parsed = incentiveSettingsSchema.safeParse(data);
    return parsed.success ? parsed.data : DEFAULT_INCENTIVE_SETTINGS;
  }

  /**
   * Updates incentive settings with RBAC check and audit log.
   */
  async updateSettings(
    data: unknown,
    actorId: string,
    actorRole: UserRole,
    ip?: string
  ): Promise<IncentiveSettings> {
    if (actorRole !== UserRole.SUPER_ADMIN && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenError("Only Administrators can update incentive settings");
    }
    const parsed = incentiveSettingsSchema.parse(data);
    const before = await this.getSettings();
    await settingsRepository.setSetting("incentive_settings", parsed);

    await auditService.log({
      actorId,
      action: "SETTINGS_INCENTIVE_UPDATED",
      entity: "Setting",
      entityId: "incentive_settings",
      before,
      after: parsed,
      ip,
    });

    return parsed;
  }

  /**
   * Resolves the winning incentive rule using the strict precedence cascade:
   * agent+product > agent+brand > agent+category > product > brand > category > agent default > global default.
   * Ties broken by latest validFrom.
   */
  resolveRule(
    activeRules: IncentiveRule[],
    params: {
      agentUserId?: string | null;
      productId?: string | null;
      companyId?: string | null;
      categoryId?: string | null;
      defaultPercentBp: number;
    }
  ): { ruleId: string | null; ruleScope: string; percentBp: number; explanation: string } {
    const { agentUserId, productId, companyId, categoryId, defaultPercentBp } = params;

    // 1. Agent + Product
    if (agentUserId && productId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.PRODUCT &&
          r.agentUserId === agentUserId &&
          r.productId === productId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "AGENT_PRODUCT",
          percentBp: match.percentBp,
          explanation: `Specific rule for agent and product (${match.percentBp / 100}%)`,
        };
      }
    }

    // 2. Agent + Brand (Company)
    if (agentUserId && companyId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.BRAND &&
          r.agentUserId === agentUserId &&
          r.companyId === companyId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "AGENT_BRAND",
          percentBp: match.percentBp,
          explanation: `Agent brand rule (${match.percentBp / 100}%)`,
        };
      }
    }

    // 3. Agent + Category
    if (agentUserId && categoryId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.CATEGORY &&
          r.agentUserId === agentUserId &&
          r.categoryId === categoryId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "AGENT_CATEGORY",
          percentBp: match.percentBp,
          explanation: `Agent category rule (${match.percentBp / 100}%)`,
        };
      }
    }

    // 4. Product (Global)
    if (productId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.PRODUCT &&
          !r.agentUserId &&
          r.productId === productId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "PRODUCT",
          percentBp: match.percentBp,
          explanation: `Product standard rule (${match.percentBp / 100}%)`,
        };
      }
    }

    // 5. Brand (Company Global)
    if (companyId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.BRAND &&
          !r.agentUserId &&
          r.companyId === companyId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "BRAND",
          percentBp: match.percentBp,
          explanation: `Brand standard rule (${match.percentBp / 100}%)`,
        };
      }
    }

    // 6. Category (Global)
    if (categoryId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.CATEGORY &&
          !r.agentUserId &&
          r.categoryId === categoryId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "CATEGORY",
          percentBp: match.percentBp,
          explanation: `Category standard rule (${match.percentBp / 100}%)`,
        };
      }
    }

    // 7. Agent Default
    if (agentUserId) {
      const match = activeRules.find(
        (r) =>
          r.scope === IncentiveRuleScope.AGENT &&
          r.agentUserId === agentUserId
      );
      if (match) {
        return {
          ruleId: match.id,
          ruleScope: "AGENT",
          percentBp: match.percentBp,
          explanation: `Agent default rate (${match.percentBp / 100}%)`,
        };
      }
    }

    // 8. Global Rule
    const globalMatch = activeRules.find(
      (r) => r.scope === IncentiveRuleScope.GLOBAL
    );
    if (globalMatch) {
      return {
        ruleId: globalMatch.id,
        ruleScope: "GLOBAL",
        percentBp: globalMatch.percentBp,
        explanation: `Global incentive rule (${globalMatch.percentBp / 100}%)`,
      };
    }

    // 9. Fallback Setting
    return {
      ruleId: null,
      ruleScope: "DEFAULT_SETTING",
      percentBp: defaultPercentBp,
      explanation: `System default setting rate (${defaultPercentBp / 100}%)`,
    };
  }

  /**
   * Test calculation box: picks agent + product + base amount and explains winning rule.
   */
  async testCalculation(params: {
    agentUserId?: string | null;
    productId?: string | null;
    baseAmountPaise: number;
    date?: Date;
  }): Promise<IncentiveCalculationResult> {
    const settings = await this.getSettings();
    const targetDate = params.date || new Date();
    const activeRules = await incentiveRepository.getActiveRulesForDate(targetDate);

    let companyId: string | null = null;
    let categoryId: string | null = null;

    if (params.productId) {
      const product = await prisma.product.findUnique({
        where: { id: params.productId },
        select: { companyId: true, categoryId: true },
      });
      if (product) {
        companyId = product.companyId;
        categoryId = product.categoryId;
      }
    }

    const resolution = this.resolveRule(activeRules, {
      agentUserId: params.agentUserId,
      productId: params.productId,
      companyId,
      categoryId,
      defaultPercentBp: settings.defaultPercentBp,
    });

    // Exact half-up rounding in integer paise: (basePaise * percentBp) / 10000
    const amountPaise = Math.round((params.baseAmountPaise * resolution.percentBp) / 10000);

    return {
      ruleId: resolution.ruleId,
      ruleScope: resolution.ruleScope,
      percentBp: resolution.percentBp,
      baseAmountPaise: params.baseAmountPaise,
      amountPaise,
      explanation: resolution.explanation,
    };
  }

  /**
   * Called when an invoice is created/finalized.
   * Snapshots ruleId & percentBp and records append-only IncentiveEntry.
   */
  async onInvoiceCreated(
    invoiceId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<IncentiveEntry[]> {
    const settings = await this.getSettings();
    if (!settings.enabled) return [];

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        agentUser: { select: { id: true, role: true, agentCode: true } },
        items: {
          include: {
            product: { select: { id: true, companyId: true, categoryId: true } },
          },
        },
      },
    });

    if (!invoice) return [];

    const agentUserId = invoice.agentUserId || invoice.createdBy;
    if (!agentUserId) return [];

    const agentUser =
      invoice.agentUser ||
      (await tx.user.findUnique({
        where: { id: agentUserId },
        select: { id: true, role: true, agentCode: true },
      }));

    if (!agentUser || !settings.eligibleRoles.includes(agentUser.role)) {
      return [];
    }

    // Credit timing: Counter & Van sales credit immediately at billing;
    // Dispatch/Store orders create PENDING entries.
    const isInstantCredit =
      invoice.channel === InvoiceChannel.SHOP ||
      invoice.channel === InvoiceChannel.VAN;

    const entryStatus = isInstantCredit
      ? IncentiveEntryStatus.CREDITED
      : IncentiveEntryStatus.PENDING;

    // Period: YYYY-MM based on invoice creation date (IST)
    const createdAt = invoice.createdAt;
    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, "0");
    const period = `${year}-${month}`;

    const activeRules = await tx.incentiveRule.findMany({
      where: {
        active: true,
        validFrom: { lte: createdAt },
        OR: [{ validTo: null }, { validTo: { gte: createdAt } }],
      },
      orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
    });

    const entriesCreated: IncentiveEntry[] = [];

    // Calculate line by line
    if (invoice.items.length > 0) {
      for (const line of invoice.items) {
        // Base amount: PAYABLE (line total with tax/discount) or TAXABLE
        const lineBasePaise =
          settings.base === "TAXABLE"
            ? line.taxablePaise
            : line.taxablePaise + line.taxPaise;

        if (lineBasePaise <= 0) continue;

        const resolution = this.resolveRule(activeRules, {
          agentUserId,
          productId: line.productId,
          companyId: line.product?.companyId,
          categoryId: line.product?.categoryId,
          defaultPercentBp: settings.defaultPercentBp,
        });

        const amountPaise = Math.round((lineBasePaise * resolution.percentBp) / 10000);
        if (amountPaise <= 0 && resolution.percentBp <= 0) continue;

        const entry = await tx.incentiveEntry.upsert({
          where: {
            invoiceId_invoiceLineId_type: {
              invoiceId: invoice.id,
              invoiceLineId: line.id,
              type: IncentiveEntryType.ACCRUAL,
            },
          },
          create: {
            agentUserId,
            invoiceId: invoice.id,
            invoiceLineId: line.id,
            type: IncentiveEntryType.ACCRUAL,
            status: entryStatus,
            baseAmountPaise: lineBasePaise,
            percentBp: resolution.percentBp,
            amountPaise,
            ruleId: resolution.ruleId,
            triggerEvent: isInstantCredit ? "INVOICE_CREATE" : "ORDER_PENDING",
            triggeredAt: createdAt,
            period,
            note: `${resolution.explanation} (${line.product?.id || "Line"})`,
            createdBy: agentUserId,
          },
          update: {},
        });
        entriesCreated.push(entry);
      }
    } else {
      // Whole-invoice fallback if no items populated
      const basePaise =
        settings.base === "TAXABLE" ? invoice.taxablePaise : invoice.totalPaise;
      const resolution = this.resolveRule(activeRules, {
        agentUserId,
        defaultPercentBp: settings.defaultPercentBp,
      });
      const amountPaise = Math.round((basePaise * resolution.percentBp) / 10000);

      const entry = await tx.incentiveEntry.upsert({
        where: {
          invoiceId_invoiceLineId_type: {
            invoiceId: invoice.id,
            invoiceLineId: null as any,
            type: IncentiveEntryType.ACCRUAL,
          },
        },
        create: {
          agentUserId,
          invoiceId: invoice.id,
          invoiceLineId: null,
          type: IncentiveEntryType.ACCRUAL,
          status: entryStatus,
          baseAmountPaise: basePaise,
          percentBp: resolution.percentBp,
          amountPaise,
          ruleId: resolution.ruleId,
          triggerEvent: isInstantCredit ? "INVOICE_CREATE" : "ORDER_PENDING",
          triggeredAt: createdAt,
          period,
          note: `Whole invoice fallback (${resolution.explanation})`,
          createdBy: agentUserId,
        },
        update: {},
      });
      entriesCreated.push(entry);
    }

    return entriesCreated;
  }

  /**
   * Called when a dispatch run is handed over to the delivery driver.
   * If creditTrigger is HANDOVER, transitions PENDING entries to CREDITED.
   */
  async onDispatchHandover(
    orderIds: string[],
    tx: Prisma.TransactionClient = prisma
  ): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.enabled || settings.creditTrigger !== "HANDOVER") {
      return 0;
    }

    const orders = await tx.order.findMany({
      where: { id: { in: orderIds }, invoiceId: { not: null } },
      select: { invoiceId: true },
    });

    const invoiceIds = orders.map((o) => o.invoiceId!).filter(Boolean);
    if (invoiceIds.length === 0) return 0;

    const res = await tx.incentiveEntry.updateMany({
      where: {
        invoiceId: { in: invoiceIds },
        status: IncentiveEntryStatus.PENDING,
      },
      data: {
        status: IncentiveEntryStatus.CREDITED,
        triggerEvent: "ORDER_HANDOVER",
        triggeredAt: new Date(),
      },
    });

    return res.count;
  }

  /**
   * Called when an order is officially marked DELIVERED.
   * If creditTrigger is DELIVERED, transitions PENDING entries to CREDITED.
   */
  async onOrderDelivered(
    orderId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<number> {
    const settings = await this.getSettings();
    if (!settings.enabled || settings.creditTrigger !== "DELIVERED") {
      return 0;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { invoiceId: true },
    });

    if (!order || !order.invoiceId) return 0;

    const res = await tx.incentiveEntry.updateMany({
      where: {
        invoiceId: order.invoiceId,
        status: IncentiveEntryStatus.PENDING,
      },
      data: {
        status: IncentiveEntryStatus.CREDITED,
        triggerEvent: "ORDER_DELIVERED",
        triggeredAt: new Date(),
      },
    });

    return res.count;
  }

  /**
   * Called when a delivery fails or returns to godown.
   * Voids pending entries or creates reversals for credited entries.
   */
  async onDeliveryFailed(
    orderId: string,
    reason: string,
    actorId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<void> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { invoiceId: true },
    });
    if (!order || !order.invoiceId) return;

    // Void any pending entries
    await tx.incentiveEntry.updateMany({
      where: {
        invoiceId: order.invoiceId,
        status: IncentiveEntryStatus.PENDING,
      },
      data: {
        status: IncentiveEntryStatus.VOID,
        note: `Voided due to failed delivery: ${reason}`,
      },
    });

    // Reverse any credited entries
    const credited = await tx.incentiveEntry.findMany({
      where: {
        invoiceId: order.invoiceId,
        status: IncentiveEntryStatus.CREDITED,
        type: IncentiveEntryType.ACCRUAL,
      },
    });

    for (const entry of credited) {
      await tx.incentiveEntry.upsert({
        where: {
          invoiceId_invoiceLineId_type: {
            invoiceId: entry.invoiceId,
            invoiceLineId: entry.invoiceLineId || "",
            type: IncentiveEntryType.REVERSAL,
          },
        },
        create: {
          agentUserId: entry.agentUserId,
          invoiceId: entry.invoiceId,
          invoiceLineId: entry.invoiceLineId,
          orderId,
          type: IncentiveEntryType.REVERSAL,
          status: IncentiveEntryStatus.REVERSED,
          baseAmountPaise: entry.baseAmountPaise,
          percentBp: entry.percentBp,
          amountPaise: -Math.abs(entry.amountPaise),
          ruleId: entry.ruleId,
          triggerEvent: "DELIVERY_FAILED",
          triggeredAt: new Date(),
          period: entry.period,
          note: `Reversal: Delivery failed (${reason})`,
          createdBy: actorId,
        },
        update: {},
      });
    }
  }

  /**
   * Called when an invoice is cancelled.
   * Cancels/voids pending entries and posts append-only reversals for credited ones.
   */
  async onInvoiceCancelled(
    invoiceId: string,
    reason: string,
    actorId: string,
    tx: Prisma.TransactionClient = prisma
  ): Promise<void> {
    // 1. Mark pending entries as VOID
    await tx.incentiveEntry.updateMany({
      where: {
        invoiceId,
        status: IncentiveEntryStatus.PENDING,
      },
      data: {
        status: IncentiveEntryStatus.VOID,
        note: `Voided on invoice cancellation: ${reason}`,
      },
    });

    // 2. For credited accruals, append a REVERSAL entry
    const credited = await tx.incentiveEntry.findMany({
      where: {
        invoiceId,
        status: IncentiveEntryStatus.CREDITED,
        type: IncentiveEntryType.ACCRUAL,
      },
    });

    for (const entry of credited) {
      await tx.incentiveEntry.upsert({
        where: {
          invoiceId_invoiceLineId_type: {
            invoiceId: entry.invoiceId,
            invoiceLineId: entry.invoiceLineId || "",
            type: IncentiveEntryType.REVERSAL,
          },
        },
        create: {
          agentUserId: entry.agentUserId,
          invoiceId: entry.invoiceId,
          invoiceLineId: entry.invoiceLineId,
          type: IncentiveEntryType.REVERSAL,
          status: IncentiveEntryStatus.REVERSED,
          baseAmountPaise: entry.baseAmountPaise,
          percentBp: entry.percentBp,
          amountPaise: -Math.abs(entry.amountPaise),
          ruleId: entry.ruleId,
          triggerEvent: "INVOICE_CANCEL",
          triggeredAt: new Date(),
          period: entry.period,
          note: `Reversal on invoice cancel: ${reason}`,
          createdBy: actorId,
        },
        update: {},
      });
    }
  }

  /**
   * Reassigns an invoice to a new agent.
   * Posts reversals for old agent entries and creates new accruals for new agent.
   */
  async reassignInvoiceAgent(params: {
    invoiceId: string;
    newAgentUserId: string;
    reason: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<{ success: boolean; entriesReversed: number; entriesCreated: number }> {
    if (
      params.actorRole !== UserRole.SUPER_ADMIN &&
      params.actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenError("Only Administrators can reassign invoice agents");
    }

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: params.invoiceId },
        include: {
          items: {
            include: {
              product: { select: { id: true, companyId: true, categoryId: true } },
            },
          },
        },
      });

      if (!invoice) throw new Error("Invoice not found");

      const newAgent = await tx.user.findUnique({
        where: { id: params.newAgentUserId },
        select: { id: true, name: true, role: true, agentCode: true },
      });

      if (!newAgent) throw new Error("New agent user not found");
      if (!newAgent.agentCode) throw new Error("New agent must have an agentCode");

      // 1. Reverse old entries
      const oldEntries = await tx.incentiveEntry.findMany({
        where: {
          invoiceId: invoice.id,
          type: IncentiveEntryType.ACCRUAL,
          status: { in: [IncentiveEntryStatus.CREDITED, IncentiveEntryStatus.PENDING] },
        },
      });

      for (const old of oldEntries) {
        if (old.status === IncentiveEntryStatus.PENDING) {
          await tx.incentiveEntry.update({
            where: { id: old.id },
            data: { status: IncentiveEntryStatus.VOID, note: `Reassigned: ${params.reason}` },
          });
        } else {
          await tx.incentiveEntry.create({
            data: {
              agentUserId: old.agentUserId,
              invoiceId: invoice.id,
              invoiceLineId: old.invoiceLineId,
              type: IncentiveEntryType.REVERSAL,
              status: IncentiveEntryStatus.REVERSED,
              baseAmountPaise: old.baseAmountPaise,
              percentBp: old.percentBp,
              amountPaise: -Math.abs(old.amountPaise),
              ruleId: old.ruleId,
              triggerEvent: "AGENT_REASSIGNMENT",
              triggeredAt: new Date(),
              period: old.period,
              note: `Reversed for reassignment to ${newAgent.name} (${newAgent.agentCode}): ${params.reason}`,
              createdBy: params.actorId,
            },
          });
        }
      }

      // 2. Update invoice agent snapshot
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          agentUserId: newAgent.id,
          agentCodeSnapshot: newAgent.agentCode,
        },
      });

      // 3. Create new entries for new agent
      const settings = await this.getSettings();
      const isInstantCredit =
        invoice.channel === InvoiceChannel.SHOP ||
        invoice.channel === InvoiceChannel.VAN;

      const entryStatus = isInstantCredit
        ? IncentiveEntryStatus.CREDITED
        : IncentiveEntryStatus.PENDING;

      const year = invoice.createdAt.getFullYear();
      const month = String(invoice.createdAt.getMonth() + 1).padStart(2, "0");
      const period = `${year}-${month}`;

      const activeRules = await tx.incentiveRule.findMany({
        where: {
          active: true,
          validFrom: { lte: invoice.createdAt },
          OR: [{ validTo: null }, { validTo: { gte: invoice.createdAt } }],
        },
        orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
      });

      let createdCount = 0;
      for (const line of invoice.items) {
        const lineBasePaise =
          settings.base === "TAXABLE"
            ? line.taxablePaise
            : line.taxablePaise + line.taxPaise;

        if (lineBasePaise <= 0) continue;

        const resolution = this.resolveRule(activeRules, {
          agentUserId: newAgent.id,
          productId: line.productId,
          companyId: line.product?.companyId,
          categoryId: line.product?.categoryId,
          defaultPercentBp: settings.defaultPercentBp,
        });

        const amountPaise = Math.round((lineBasePaise * resolution.percentBp) / 10000);

        await tx.incentiveEntry.create({
          data: {
            agentUserId: newAgent.id,
            invoiceId: invoice.id,
            invoiceLineId: line.id,
            type: IncentiveEntryType.ACCRUAL,
            status: entryStatus,
            baseAmountPaise: lineBasePaise,
            percentBp: resolution.percentBp,
            amountPaise,
            ruleId: resolution.ruleId,
            triggerEvent: "AGENT_REASSIGNMENT",
            triggeredAt: new Date(),
            period,
            note: `Reassigned accrual: ${params.reason}`,
            createdBy: params.actorId,
          },
        });
        createdCount++;
      }

      await auditService.log({
        actorId: params.actorId,
        action: "INVOICE_AGENT_REASSIGNED",
        entity: "Invoice",
        entityId: invoice.id,
        before: { agentUserId: invoice.agentUserId, agentCode: invoice.agentCodeSnapshot },
        after: { agentUserId: newAgent.id, agentCode: newAgent.agentCode },
      });

      return {
        success: true,
        entriesReversed: oldEntries.length,
        entriesCreated: createdCount,
      };
    });
  }

  /**
   * Generates a monthly statement summary for an agent.
   */
  async getMonthlyStatement(
    agentUserId: string,
    period: string
  ): Promise<MonthlyStatementSummary & { entries: any[] }> {
    const agent = await prisma.user.findUnique({
      where: { id: agentUserId },
      select: { id: true, name: true, agentCode: true },
    });

    if (!agent) throw new Error("Agent user not found");

    const entries = await prisma.incentiveEntry.findMany({
      where: { agentUserId, period },
      orderBy: { triggeredAt: "desc" },
      include: {
        invoice: { select: { number: true, totalPaise: true, channel: true } },
      },
    });

    const payout = await incentiveRepository.getPayout(agentUserId, period);

    let totalPendingPaise = 0;
    let totalCreditedPaise = 0;
    let totalReversedPaise = 0;
    let totalAdjustmentsPaise = 0;

    for (const e of entries) {
      if (e.status === IncentiveEntryStatus.PENDING) {
        totalPendingPaise += e.amountPaise;
      } else if (
        e.status === IncentiveEntryStatus.CREDITED ||
        e.status === IncentiveEntryStatus.APPROVED ||
        e.status === IncentiveEntryStatus.PAID ||
        e.status === IncentiveEntryStatus.REVERSED
      ) {
        if (e.type === IncentiveEntryType.ACCRUAL) {
          totalCreditedPaise += e.amountPaise;
        } else if (e.type === IncentiveEntryType.REVERSAL) {
          totalReversedPaise += e.amountPaise;
        } else if (e.type === IncentiveEntryType.ADJUSTMENT) {
          totalAdjustmentsPaise += e.amountPaise;
        }
      }
    }

    const netPayablePaise = totalCreditedPaise + totalReversedPaise + totalAdjustmentsPaise;
    const isLocked = payout?.status === IncentivePayoutStatus.PAID;

    return {
      period,
      agentUserId: agent.id,
      agentName: agent.name,
      agentCode: agent.agentCode || "NO_CODE",
      totalPendingPaise,
      totalCreditedPaise,
      totalReversedPaise,
      totalAdjustmentsPaise,
      netPayablePaise,
      status: payout?.status || IncentivePayoutStatus.DRAFT,
      isLocked,
      payoutId: payout?.id || null,
      paidAt: payout?.paidAt || null,
      paidMethod: payout?.method || null,
      paidReference: payout?.reference || null,
      entries,
    };
  }

  /**
   * Approves a draft statement for payout.
   */
  async approvePayout(
    agentUserId: string,
    period: string,
    actorId: string,
    actorRole: UserRole
  ): Promise<IncentivePayout> {
    if (actorRole !== UserRole.SUPER_ADMIN && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenError("Only Administrators can approve payouts");
    }

    const statement = await this.getMonthlyStatement(agentUserId, period);
    if (statement.isLocked) {
      throw new Error(`Period ${period} is locked and already paid.`);
    }

    const payout = await incentiveRepository.upsertPayout(agentUserId, period, {
      totalPaise: statement.netPayablePaise,
      status: IncentivePayoutStatus.APPROVED,
    });

    await prisma.incentiveEntry.updateMany({
      where: {
        agentUserId,
        period,
        status: IncentiveEntryStatus.CREDITED,
      },
      data: {
        status: IncentiveEntryStatus.APPROVED,
        payoutId: payout.id,
      },
    });

    return payout;
  }

  /**
   * Marks payout as paid. Locks the period for this agent.
   */
  async markPayoutPaid(params: {
    agentUserId: string;
    period: string;
    method: string;
    reference: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<IncentivePayout> {
    if (
      params.actorRole !== UserRole.SUPER_ADMIN &&
      params.actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenError("Only Administrators can process payouts");
    }

    const statement = await this.getMonthlyStatement(params.agentUserId, params.period);
    if (statement.isLocked) {
      throw new Error(`Period ${params.period} is already locked and marked as paid.`);
    }

    const payout = await incentiveRepository.upsertPayout(
      params.agentUserId,
      params.period,
      {
        totalPaise: statement.netPayablePaise,
        status: IncentivePayoutStatus.PAID,
        method: params.method,
        reference: params.reference,
        paidAt: new Date(),
        paidBy: params.actorId,
      }
    );

    await prisma.incentiveEntry.updateMany({
      where: {
        agentUserId: params.agentUserId,
        period: params.period,
        status: { in: [IncentiveEntryStatus.APPROVED, IncentiveEntryStatus.CREDITED] },
      },
      data: {
        status: IncentiveEntryStatus.PAID,
        payoutId: payout.id,
      },
    });

    return payout;
  }

  /**
   * Records a manual adjustment (plus or minus) for an agent in a non-locked period.
   */
  async recordAdjustment(params: {
    agentUserId: string;
    period: string;
    amountPaise: number;
    reason: string;
    actorId: string;
    actorRole: UserRole;
  }): Promise<IncentiveEntry> {
    if (
      params.actorRole !== UserRole.SUPER_ADMIN &&
      params.actorRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenError("Only Administrators can add incentive adjustments");
    }

    const payout = await incentiveRepository.getPayout(params.agentUserId, params.period);
    if (payout?.status === IncentivePayoutStatus.PAID) {
      throw new Error(`Cannot add adjustments to locked period ${params.period}.`);
    }

    // Find any invoice for dummy relation or create adjustment entry
    const sampleInvoice = await prisma.invoice.findFirst({
      select: { id: true },
    });
    if (!sampleInvoice) throw new Error("No invoices exist in database");

    return prisma.incentiveEntry.create({
      data: {
        agentUserId: params.agentUserId,
        invoiceId: sampleInvoice.id,
        type: IncentiveEntryType.ADJUSTMENT,
        status: IncentiveEntryStatus.CREDITED,
        baseAmountPaise: Math.abs(params.amountPaise),
        percentBp: 0,
        amountPaise: params.amountPaise,
        triggerEvent: "MANUAL_ADJUSTMENT",
        triggeredAt: new Date(),
        period: params.period,
        note: `Manual adjustment: ${params.reason}`,
        createdBy: params.actorId,
      },
    });
  }

  /**
   * Preview backfill tool: previews entries that would be generated for invoices without modifying DB.
   */
  async previewBackfill(startDate: Date): Promise<{
    eligibleInvoicesCount: number;
    totalGrossPaise: number;
    estimatedIncentivePaise: number;
    sampleRows: Array<{
      invoiceNumber: string;
      channel: string;
      date: string;
      agentName: string;
      agentCode: string;
      payablePaise: number;
      incentivePaise: number;
    }>;
  }> {
    const settings = await this.getSettings();
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" as any },
      },
      include: {
        agentUser: { select: { id: true, name: true, role: true, agentCode: true } },
        items: {
          include: {
            product: { select: { id: true, companyId: true, categoryId: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const activeRules = await incentiveRepository.getActiveRulesForDate(new Date());

    let eligibleCount = 0;
    let totalGrossPaise = 0;
    let totalIncentivePaise = 0;
    const sampleRows: any[] = [];

    for (const inv of invoices) {
      const agent = inv.agentUser;
      if (!agent || !agent.agentCode || !settings.eligibleRoles.includes(agent.role)) {
        continue;
      }

      // Check if invoice already has an entry
      const existing = await prisma.incentiveEntry.findFirst({
        where: { invoiceId: inv.id },
      });
      if (existing) continue;

      eligibleCount++;
      totalGrossPaise += inv.totalPaise;

      let invIncentive = 0;
      for (const item of inv.items) {
        const lineBase =
          settings.base === "TAXABLE"
            ? item.taxablePaise
            : item.taxablePaise + item.taxPaise;
        const resolution = this.resolveRule(activeRules, {
          agentUserId: agent.id,
          productId: item.productId,
          companyId: item.product?.companyId,
          categoryId: item.product?.categoryId,
          defaultPercentBp: settings.defaultPercentBp,
        });
        invIncentive += Math.round((lineBase * resolution.percentBp) / 10000);
      }

      totalIncentivePaise += invIncentive;

      if (sampleRows.length < 10) {
        sampleRows.push({
          invoiceNumber: inv.number,
          channel: inv.channel,
          date: inv.createdAt.toISOString().split("T")[0],
          agentName: agent.name,
          agentCode: agent.agentCode,
          payablePaise: inv.totalPaise,
          incentivePaise: invIncentive,
        });
      }
    }

    return {
      eligibleInvoicesCount: eligibleCount,
      totalGrossPaise,
      estimatedIncentivePaise: totalIncentivePaise,
      sampleRows,
    };
  }

  /**
   * Applies the backfill idempotently.
   */
  async applyBackfill(startDate: Date, actorId: string): Promise<{ createdCount: number }> {
    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: startDate },
        status: { not: "CANCELLED" as any },
      },
      select: { id: true },
    });

    let count = 0;
    for (const inv of invoices) {
      const existing = await prisma.incentiveEntry.findFirst({
        where: { invoiceId: inv.id },
      });
      if (!existing) {
        const created = await this.onInvoiceCreated(inv.id);
        count += created.length;
      }
    }

    return { createdCount: count };
  }

  /**
   * Staff self-view: "My Incentives". Returns read-only data for the logged-in staff member.
   */
  async getMyIncentives(
    userId: string,
    period?: string
  ): Promise<MonthlyStatementSummary & { entries: any[] }> {
    const currentPeriod =
      period ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    return this.getMonthlyStatement(userId, currentPeriod);
  }
}

export const incentiveService = new IncentiveService();
