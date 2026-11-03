import { MessageChannel, MessageProviderType, MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BillTokenService } from "./bill-token.service";
import { IMessageProvider } from "./message-provider.interface";
import { WhatsAppOpenWaGateway } from "./providers/open-wa.provider";
import { SmsAndroidGateway } from "./providers/android-sms.provider";
import { WaMeLinkProvider } from "./providers/wame-link.provider";

export interface QueueInvoiceMessageOptions {
  invoiceId: string;
  channels?: MessageChannel[];
  phoneOverride?: string;
  actorUserId?: string;
}

export interface QueueResult {
  queuedCount: number;
  skipped: boolean;
  reason?: string;
  phone?: string;
  billUrl?: string;
  waMeUrl?: string;
  messageIds: string[];
}

export class MessagingService {
  private static openWaProvider = new WhatsAppOpenWaGateway();
  private static smsProvider = new SmsAndroidGateway();
  private static waMeProvider = new WaMeLinkProvider();

  /**
   * Renders the transactional bill SMS / WhatsApp template
   */
  static renderBillTemplate(params: {
    customerName: string;
    invoiceNo: string;
    totalPaise: number;
    balanceDuePaise?: number;
    isGst?: boolean;
    billUrl: string;
  }): string {
    const amountRupees = (params.totalPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    let gstTag = params.isGst ? " (GST Bill)" : "";
    let balanceTag = "";

    if (params.balanceDuePaise && params.balanceDuePaise > 0) {
      const balRupees = (params.balanceDuePaise / 100).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      balanceTag = ` Baqi Rashi: ₹${balRupees}.`;
    }

    return `Namaste ${params.customerName}, JMD Cart se aapka bill ${params.invoiceNo}${gstTag} ₹${amountRupees} ka. Bill dekhein: ${params.billUrl}.${balanceTag} Dhanyavaad! Bharosa Ghar Tak.`;
  }

  /**
   * Queues bill message for an invoice. Never blocks or throws to prevent billing failure.
   */
  static async queueInvoiceMessage(options: QueueInvoiceMessageOptions): Promise<QueueResult> {
    try {
      const invoice = await prisma.invoice.findUnique({
        where: { id: options.invoiceId },
        include: {
          party: true,
          payments: true,
        },
      });

      if (!invoice) {
        return { queuedCount: 0, skipped: true, reason: "INVOICE_NOT_FOUND", messageIds: [] };
      }

      // Determine phone number
      const targetPhone = (options.phoneOverride || invoice.party?.phone || invoice.customerPhone || "").trim();
      const cleanedDigits = targetPhone.replace(/\D/g, "");

      if (cleanedDigits.length < 10) {
        return { queuedCount: 0, skipped: true, reason: "NO_VALID_PHONE", messageIds: [] };
      }

      // Check opt-out
      const optOut = await prisma.messagingOptOut.findUnique({
        where: { phone: cleanedDigits },
      });

      if (optOut) {
        return {
          queuedCount: 0,
          skipped: true,
          reason: "OPTED_OUT",
          phone: cleanedDigits,
          messageIds: [],
        };
      }

      // Check party messaging preference
      if (invoice.party?.messagingPreference === "NEVER") {
        return {
          queuedCount: 0,
          skipped: true,
          reason: "PARTY_PREFERENCE_NEVER",
          phone: cleanedDigits,
          messageIds: [],
        };
      }

      // Generate or retrieve bill token
      const billToken = await BillTokenService.createBillToken(invoice.id);

      // Compute balance due if any
      const totalPaidPaise = invoice.payments.reduce((acc, p) => acc + p.amountPaise, 0);
      const balanceDuePaise = Math.max(0, invoice.totalPaise - totalPaidPaise);
      const isGst = invoice.documentType === "TAX_INVOICE" || (invoice.party?.gstin ? invoice.party.gstin.length > 5 : false);
      const customerName = invoice.party?.name || invoice.customerName || "Customer";

      const renderedBody = this.renderBillTemplate({
        customerName,
        invoiceNo: invoice.number,
        totalPaise: invoice.totalPaise,
        balanceDuePaise,
        isGst,
        billUrl: billToken.url,
      });

      const waMeUrl = WaMeLinkProvider.generateUrl(cleanedDigits, renderedBody);

      // Default channels to WHATSAPP & SMS if not specified
      const channels = options.channels && options.channels.length > 0
        ? options.channels
        : [MessageChannel.WHATSAPP, MessageChannel.SMS];

      const messageIds: string[] = [];

      for (const ch of channels) {
        const idempotencyKey = `${invoice.id}_${ch}_FINAL`;
        const providerType = ch === MessageChannel.WHATSAPP ? MessageProviderType.OPEN_WA : MessageProviderType.ANDROID_SMS;

        const outbound = await prisma.outboundMessage.upsert({
          where: { idempotencyKey },
          update: {
            phone: cleanedDigits,
            renderedContent: renderedBody,
            billToken: billToken.rawToken,
            status: MessageStatus.QUEUED,
          },
          create: {
            invoiceId: invoice.id,
            partyId: invoice.partyId,
            phone: cleanedDigits,
            channel: ch,
            provider: providerType,
            status: MessageStatus.QUEUED,
            templateName: "BILL_SUMMARY",
            renderedContent: renderedBody,
            billToken: billToken.rawToken,
            idempotencyKey,
            scheduledFor: new Date(),
          },
        });

        messageIds.push(outbound.id);
      }

      // Trigger asynchronous background dispatch (non-blocking, disabled in tests to avoid race conditions with DB cleanups)
      if (process.env.NODE_ENV !== "test") {
        this.processOutboundQueue().catch((err) => {
          console.error("[MessagingService] Background worker error:", err);
        });
      }

      return {
        queuedCount: messageIds.length,
        skipped: false,
        phone: cleanedDigits,
        billUrl: billToken.url,
        waMeUrl,
        messageIds,
      };
    } catch (err: any) {
      console.error("[MessagingService] queueInvoiceMessage failed safely:", err);
      return {
        queuedCount: 0,
        skipped: true,
        reason: err.message || "INTERNAL_ERROR",
        messageIds: [],
      };
    }
  }

  /**
   * Worker that processes pending outbound messages with rate limiting & jitter
   */
  static async processOutboundQueue(limit: number = 20): Promise<{ processed: number; sent: number; failed: number }> {
    let sentCount = 0;
    let failedCount = 0;

    const pending = await prisma.outboundMessage.findMany({
      where: {
        status: MessageStatus.QUEUED,
        scheduledFor: { lte: new Date() },
        attempts: { lt: 3 },
      },
      take: limit,
      orderBy: { scheduledFor: "asc" },
    });

    for (const msg of pending) {
      try {
        // 1. Mark as SENDING
        await prisma.outboundMessage.update({
          where: { id: msg.id },
          data: {
            status: MessageStatus.SENDING,
            attempts: { increment: 1 },
          },
        });

        // 2. Select provider
        const provider: IMessageProvider =
          msg.channel === MessageChannel.WHATSAPP ? this.openWaProvider : this.smsProvider;

        const result = await provider.send({
          toPhone: msg.phone,
          body: msg.renderedContent,
          invoiceNumber: msg.invoiceId || undefined,
        });

        if (result.success) {
          sentCount++;
          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: MessageStatus.SENT,
              sentAt: new Date(),
              lastError: null,
            },
          });
        } else {
          failedCount++;
          const nextAttempt = msg.attempts + 1;
          const isFinal = nextAttempt >= msg.maxAttempts;

          // Exponential backoff: 1 min, 5 min, etc.
          const backoffMinutes = Math.pow(nextAttempt, 2);
          const scheduledFor = new Date(Date.now() + backoffMinutes * 60 * 1000);

          await prisma.outboundMessage.update({
            where: { id: msg.id },
            data: {
              status: isFinal ? MessageStatus.FAILED : MessageStatus.QUEUED,
              scheduledFor,
              lastError: result.error || "Unknown error",
            },
          });
        }
      } catch (itemErr) {
        // Safe against concurrency or record deletions
        console.warn("[MessagingService] Queue worker item skip:", itemErr);
      }

      // Small jitter pause: 200ms to 600ms in worker loop to avoid bursts
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));
    }

    return {
      processed: pending.length,
      sent: sentCount,
      failed: failedCount,
    };
  }

  /**
   * Handle user unsubscribe / STOP request
   */
  static async handleOptOut(phone: string, reason: string = "USER_REQUEST_STOP", channel?: MessageChannel): Promise<void> {
    const cleaned = phone.replace(/\D/g, "");
    if (!cleaned) return;

    await prisma.messagingOptOut.upsert({
      where: { phone: cleaned },
      update: {
        reason,
        channel,
        optedOutAt: new Date(),
      },
      create: {
        phone: cleaned,
        reason,
        channel,
        optedOutAt: new Date(),
      },
    });

    // Cancel any pending queued messages
    await prisma.outboundMessage.updateMany({
      where: {
        phone: cleaned,
        status: { in: [MessageStatus.QUEUED, MessageStatus.SENDING] },
      },
      data: {
        status: MessageStatus.SKIPPED,
        lastError: "OPTED_OUT",
      },
    });
  }

  /**
   * Get live gateway status for Admin Settings
   */
  static async getGatewaysHealth(): Promise<{
    whatsApp: any;
    sms: any;
    queueStats: {
      queued: number;
      sending: number;
      sent: number;
      failed: number;
    };
  }> {
    const [whatsAppHealth, smsHealth] = await Promise.all([
      this.openWaProvider.checkHealth(),
      this.smsProvider.checkHealth(),
    ]);

    const [queued, sending, sent, failed] = await Promise.all([
      prisma.outboundMessage.count({ where: { status: MessageStatus.QUEUED } }),
      prisma.outboundMessage.count({ where: { status: MessageStatus.SENDING } }),
      prisma.outboundMessage.count({ where: { status: MessageStatus.SENT } }),
      prisma.outboundMessage.count({ where: { status: MessageStatus.FAILED } }),
    ]);

    return {
      whatsApp: whatsAppHealth,
      sms: smsHealth,
      queueStats: { queued, sending, sent, failed },
    };
  }
}
