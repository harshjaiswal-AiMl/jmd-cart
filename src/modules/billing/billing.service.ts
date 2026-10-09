import {
  InvoiceStatus,
  InvoiceChannel,
  PaymentMode,
  PaymentStatus,
  LedgerKind,
  MovementType,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getNextSequenceNumber } from "@/lib/invoice-number";
import { stockService } from "@/modules/stock/stock.service";
import { pricingService } from "@/modules/pricing/pricing.service";
import { auditService } from "@/modules/audit/audit.service";
import {
  assertPermission,
  hasPermission,
  Permission,
  ForbiddenError,
} from "@/modules/auth/permissions";
import {
  FinalizeInvoiceInput,
  finalizeInvoiceInputSchema,
  CancelInvoiceInput,
  cancelInvoiceInputSchema,
  InvoiceWithDetails,
  InvoiceListFilters,
} from "./billing.types";
import { billingRepository, BillingRepository } from "./billing.repository";
import { partyRepository } from "@/modules/party/party.repository";

export class BillingService {
  constructor(private readonly repo: BillingRepository = billingRepository) {}

  /**
   * Finalize and seal an invoice in a single atomic database transaction:
   * - Assigns next gapless FY invoice number (INV/<FY>/<6 digits>) with row locks
   * - Freezes item prices, slab discounts, taxes, and grand totals
   * - Atomically posts SALE stock deductions via stockService
   * - Records payment transactions
   * - Posts customer ledger entries (debit for sale, credit for payment)
   * - Logs audit trail
   */
  async finalizeInvoice(
    role: UserRole,
    input: FinalizeInvoiceInput,
    actorId?: string,
    ip?: string
  ): Promise<InvoiceWithDetails> {
    // 1. Permission verification
    if (
      !hasPermission(role, Permission.POS_BILL) &&
      !hasPermission(role, Permission.VAN_BILL) &&
      role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenError("Not authorized to finalize invoices");
    }

    const validated = finalizeInvoiceInputSchema.parse(input);

    // 1b. Idempotency deduplication: if already created with this idempotencyKey, return existing invoice
    if (validated.idempotencyKey) {
      const existingInvoice = await prisma.invoice.findUnique({
        where: { idempotencyKey: validated.idempotencyKey },
        include: {
          items: { include: { product: true } },
          payments: true,
          party: true,
          location: true,
          creditNotes: true,
        },
      });

      if (existingInvoice) {
        return existingInvoice as unknown as InvoiceWithDetails;
      }
    }

    // 1c. Van Channel Guard: verify van has active morning load sheet
    if (validated.channel === InvoiceChannel.VAN) {
      const activeVanDay = await prisma.vanDay.findFirst({
        where: {
          vanLocationId: validated.locationId,
          status: "OPEN",
        },
      });

      if (!activeVanDay) {
        throw new Error(
          "Van has no active morning load sheet for today. A load sheet must be dispatched from Godown before issuing bills."
        );
      }
    }

    // 2. Fetch products metadata for HSN mapping
    const productIds = validated.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, hsn: true },
    });
    const hsnMap = new Map(products.map((p) => [p.id, p.hsn]));

    // 3. Compute dynamic order pricing with quantity slabs & order discounts
    const orderPricing = await pricingService.calculateOrderPricing({
      items: validated.items,
      orderDiscountBp: validated.orderDiscountBp,
      isInterState: validated.isInterState,
      userRole: role,
    });

    if (orderPricing.requiresDiscountApproval) {
      throw new Error(
        `Order discount requires Super Admin approval: ${orderPricing.discountApprovalReason}`
      );
    }

    // 4. Payment validation & Credit Policy Enforcement
    const totalPaidPaise = validated.payments.reduce(
      (sum, p) => sum + p.amountPaise,
      0
    );
    const balanceDuePaise = orderPricing.totalPaise - totalPaidPaise;

    let creditOverrideApplied = false;
    let creditOverrideBy: string | null = null;
    let creditOverrideReason: string | null = null;
    let creditBreachReasons: string[] = [];

    if (balanceDuePaise > 0) {
      if (!validated.partyId) {
        throw new Error(
          `Walk-in retail sales must be fully paid at checkout. Total: ₹${(
            orderPricing.totalPaise / 100
          ).toFixed(2)}, Paid: ₹${(totalPaidPaise / 100).toFixed(2)}`
        );
      }

      const party = await prisma.party.findUnique({
        where: { id: validated.partyId },
      });

      if (!party) {
        throw new Error("Specified customer party does not exist");
      }

      const creditStatus = await partyRepository.checkPartyCreditStatus(
        validated.partyId,
        balanceDuePaise
      );

      if (!creditStatus.canProceedWithoutOverride) {
        creditBreachReasons = creditStatus.breachReasons;

        const callerCanOverride = hasPermission(
          role,
          Permission.OVERRIDE_CREDIT_LIMIT
        );

        if (callerCanOverride) {
          creditOverrideApplied = true;
          creditOverrideBy = actorId ?? null;
          creditOverrideReason =
            validated.creditOverride?.reason ||
            validated.notes ||
            "Authorized by Super Admin";
        } else if (validated.creditOverride) {
          const approver = await prisma.user.findUnique({
            where: { id: validated.creditOverride.approvedByUserId },
          });

          if (!approver || !approver.active) {
            throw new ForbiddenError(
              "Credit override approver account is invalid or inactive"
            );
          }

          if (!hasPermission(approver.role, Permission.OVERRIDE_CREDIT_LIMIT)) {
            throw new ForbiddenError(
              `User '${approver.name}' (${approver.role}) does not have permission to override credit limits`
            );
          }

          creditOverrideApplied = true;
          creditOverrideBy = approver.id;
          creditOverrideReason = validated.creditOverride.reason;
        } else {
          throw new Error(
            `Credit sale blocked for '${party.name}': ${creditStatus.breachReasons.join(
              "; "
            )}. Owner override required.`
          );
        }
      }
    }

    // 5. Atomic single transaction
    const finalizedInvoiceId = await prisma.$transaction(
      async (tx) => {
        // A. Assign gapless sequence number
        const { number: invoiceNumber, fy } = await getNextSequenceNumber(
          tx,
          "INV"
        );

        // B. Determine payment status
        let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
        if (totalPaidPaise >= orderPricing.totalPaise) {
          paymentStatus = PaymentStatus.PAID;
        } else if (totalPaidPaise > 0) {
          paymentStatus = PaymentStatus.PARTIAL;
        }

        // C. Create Invoice record with frozen pricing
        const invoice = await tx.invoice.create({
          data: {
            number: invoiceNumber,
            fy,
            status: InvoiceStatus.FINAL,
            channel: validated.channel,
            locationId: validated.locationId,
            idempotencyKey: validated.idempotencyKey ?? null,
            partyId: validated.partyId ?? null,
            buyerType: orderPricing.buyerTag,
            notes: validated.notes ?? null,
            creditOverride: creditOverrideApplied,
            creditOverrideBy,
            creditOverrideReason,
            subtotalPaise: orderPricing.subtotalPaise,
            discountPaise:
              orderPricing.lineDiscountPaise + orderPricing.orderDiscountPaise,
            taxablePaise: orderPricing.taxablePaise,
            cgstPaise: orderPricing.cgstPaise,
            sgstPaise: orderPricing.sgstPaise,
            igstPaise: orderPricing.igstPaise,
            roundOffPaise: orderPricing.roundOffPaise,
            totalPaise: orderPricing.totalPaise,
            paymentStatus,
            createdBy: actorId ?? null,
            finalizedAt: new Date(),
            items: {
              create: orderPricing.lines.map((line) => ({
                productId: line.productId,
                qty: line.qty,
                mrpPaise: line.mrpPaise,
                discountBp: line.effectiveDiscountBp,
                unitPricePaise: line.unitPricePaise,
                taxablePaise: line.taxablePaise,
                gstRateBp: line.gstRateBp,
                taxPaise: line.taxPaise,
                hsn: hsnMap.get(line.productId) || "21069099",
              })),
            },
          },
        });

        // D. Post SALE stock movements for each item
        for (const line of orderPricing.lines) {
          await stockService.postMovement(
            {
              type: MovementType.SALE,
              productId: line.productId,
              fromLocationId: validated.locationId,
              toLocationId: null,
              qty: line.qty,
              referenceType: "INVOICE",
              referenceId: invoice.id,
              reason: `Invoice #${invoiceNumber}`,
              idempotencyKey: `${validated.idempotencyKey}_sale_${line.productId}`,
              actorId,
            },
            tx
          );
        }

        // E. Record Payments
        for (const payment of validated.payments) {
          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              partyId: validated.partyId ?? null,
              mode: payment.mode,
              amountPaise: payment.amountPaise,
              receivedBy: actorId ?? null,
            },
          });
        }

        // F. Ledger Entries for linked parties
        if (validated.partyId) {
          // Debit party for the invoice
          await tx.ledgerEntry.create({
            data: {
              partyId: validated.partyId,
              kind: LedgerKind.INVOICE,
              debitPaise: orderPricing.totalPaise,
              creditPaise: 0,
              referenceType: "INVOICE",
              referenceId: invoice.id,
            },
          });

          // Credit party for immediate payment received
          if (totalPaidPaise > 0) {
            await tx.ledgerEntry.create({
              data: {
                partyId: validated.partyId,
                kind: LedgerKind.RECEIPT,
                debitPaise: 0,
                creditPaise: totalPaidPaise,
                referenceType: "INVOICE",
                referenceId: invoice.id,
              },
            });
          }
        }

        return invoice.id;
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    // 6. Audit logging outside transaction
    await auditService.log({
      actorId: actorId ?? null,
      action: "FINALIZE_INVOICE",
      entity: "Invoice",
      entityId: finalizedInvoiceId,
      after: {
        id: finalizedInvoiceId,
        totalPaise: orderPricing.totalPaise,
        buyerTag: orderPricing.buyerTag,
        itemsCount: validated.items.length,
      },
      ip,
    });

    if (creditOverrideApplied) {
      await auditService.log({
        actorId: actorId ?? null,
        action: "CREDIT_LIMIT_OVERRIDE",
        entity: "Invoice",
        entityId: finalizedInvoiceId,
        after: {
          invoiceId: finalizedInvoiceId,
          partyId: validated.partyId,
          balanceDuePaise,
          breachReasons: creditBreachReasons,
          approvedBy: creditOverrideBy,
          reason: creditOverrideReason,
        },
        ip,
      });
    }

    const fullInvoice = await this.repo.findById(finalizedInvoiceId);
    if (!fullInvoice) {
      throw new Error(`Failed to retrieve finalized invoice ${finalizedInvoiceId}`);
    }
    return fullInvoice;
  }

  /**
   * Cancel a finalized invoice (Admin only):
   * - Finalized invoices are immutable: updates status to CANCELLED
   * - Issues Credit Note (CN/<FY>/<6 digits>) for the invoice total
   * - Posts SALE_CANCEL stock movements returning goods to inventory
   * - Offsets party ledger with CREDIT_NOTE entry
   * - Logs audit trail
   */
  async cancelInvoice(
    role: UserRole,
    input: CancelInvoiceInput,
    actorId?: string,
    ip?: string
  ): Promise<{ invoice: InvoiceWithDetails; creditNoteId: string }> {
    assertPermission(role, Permission.BILL_CANCEL);
    const validated = cancelInvoiceInputSchema.parse(input);

    const existing = await this.repo.findById(validated.invoiceId);
    if (!existing) {
      throw new Error(`Invoice not found with ID ${validated.invoiceId}`);
    }

    if (existing.status !== InvoiceStatus.FINAL) {
      throw new Error(
        `Only FINAL invoices can be cancelled. Current status is ${existing.status}`
      );
    }

    const { creditNoteId } = await prisma.$transaction(
      async (tx) => {
        // A. Assign gapless Credit Note number
        const { number: creditNoteNumber } = await getNextSequenceNumber(
          tx,
          "CN"
        );

        // B. Mark invoice as cancelled
        await tx.invoice.update({
          where: { id: existing.id },
          data: { status: InvoiceStatus.CANCELLED },
        });

        // C. Create Credit Note record
        const creditNote = await tx.creditNote.create({
          data: {
            number: creditNoteNumber,
            invoiceId: existing.id,
            reason: validated.reason,
            totalPaise: existing.totalPaise,
            createdBy: actorId ?? null,
          },
        });

        // D. Post counter-movements SALE_CANCEL to return inventory
        for (const item of existing.items) {
          await stockService.postMovement(
            {
              type: MovementType.SALE_CANCEL,
              productId: item.productId,
              fromLocationId: null,
              toLocationId: existing.locationId,
              qty: item.qty,
              referenceType: "CREDIT_NOTE",
              referenceId: creditNote.id,
              reason: `Invoice Cancellation: ${validated.reason}`,
              idempotencyKey: `cn_${creditNote.id}_return_${item.id}`,
              actorId,
            },
            tx
          );
        }

        // E. Offset party ledger if linked
        if (existing.partyId) {
          await tx.ledgerEntry.create({
            data: {
              partyId: existing.partyId,
              kind: LedgerKind.CREDIT_NOTE,
              debitPaise: 0,
              creditPaise: existing.totalPaise,
              referenceType: "CREDIT_NOTE",
              referenceId: creditNote.id,
            },
          });
        }

        return { creditNoteId: creditNote.id };
      },
      {
        maxWait: 5000,
        timeout: 15000,
      }
    );

    await auditService.log({
      actorId: actorId ?? null,
      action: "CANCEL_INVOICE",
      entity: "Invoice",
      entityId: existing.id,
      before: { status: InvoiceStatus.FINAL },
      after: {
        status: InvoiceStatus.CANCELLED,
        reason: validated.reason,
        creditNoteId,
      },
      ip,
    });

    const updatedInvoice = await this.repo.findById(existing.id);
    if (!updatedInvoice) {
      throw new Error(`Failed to reload cancelled invoice ${existing.id}`);
    }

    return { invoice: updatedInvoice, creditNoteId };
  }

  /**
   * Get invoice by ID.
   */
  async getInvoiceById(id: string): Promise<InvoiceWithDetails | null> {
    return this.repo.findById(id);
  }

  /**
   * Get invoice by FY sequence number.
   */
  async getInvoiceByNumber(number: string): Promise<InvoiceWithDetails | null> {
    return this.repo.findByNumber(number);
  }

  /**
   * List invoices with filters and pagination.
   */
  async listInvoices(filters: InvoiceListFilters = {}) {
    return this.repo.listInvoices(filters);
  }

  /**
   * Check party credit terms and overdue status before finalizing a sale.
   */
  async checkPartyCreditStatus(
    role: UserRole,
    partyId: string,
    additionalDebitPaise: number = 0
  ) {
    assertPermission(role, Permission.VIEW_PARTIES);
    return partyRepository.checkPartyCreditStatus(partyId, additionalDebitPaise);
  }
}

export const billingService = new BillingService();
