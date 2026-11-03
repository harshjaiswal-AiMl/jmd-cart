import { describe, it, expect, vi, beforeEach } from "vitest";
import { BillTokenService } from "@/modules/messaging/bill-token.service";
import { MessagingService } from "@/modules/messaging/messaging.service";
import { WaMeLinkProvider } from "@/modules/messaging/providers/wame-link.provider";
import { MessageChannel, MessageProviderType, MessageStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

describe("Part B — Bill Messaging Pipeline & Token Security", () => {
  beforeEach(async () => {
    // Clear test tables
    await prisma.outboundMessage.deleteMany().catch(() => {});
    await prisma.billToken.deleteMany().catch(() => {});
    await prisma.messagingOptOut.deleteMany().catch(() => {});
  });

  describe("B4. Bill Token Security & Customer View Model", () => {
    it("generates an unguessable 128-bit token with SHA-256 hash", async () => {
      // 1. Create a dummy location, party, and invoice in test db
      const location = await prisma.location.findFirst() || await prisma.location.create({
        data: { name: "Test Shop", type: "SHOP" },
      });

      const user = await prisma.user.findFirst() || await prisma.user.create({
        data: {
          phone: "9199999999",
          name: "Test Staff",
          passwordHash: "hash",
          role: "PRO",
        },
      });

      const invoice = await prisma.invoice.create({
        data: {
          number: `TEST-INV-${Date.now()}`,
          fy: "26-27",
          locationId: location.id,
          subtotalPaise: 100000,
          totalPaise: 100000,
          taxablePaise: 100000,
          agentCodeSnapshot: "PRO-SECRET-007",
          agentUserId: user.id,
          customerName: "Ramesh Kirana",
          customerPhone: "9876543210",
        },
      });

      const tokenResult = await BillTokenService.createBillToken(invoice.id, 90);

      expect(tokenResult.rawToken).toHaveLength(32); // 16 bytes hex = 32 chars
      expect(tokenResult.tokenHash).toHaveLength(64); // SHA-256 hex = 64 chars
      expect(tokenResult.url).toContain(`/b/${tokenResult.rawToken}`);
      expect(tokenResult.expiresAt.getTime()).toBeGreaterThan(Date.now() + 89 * 24 * 60 * 60 * 1000);

      // Verify token in DB
      const dbToken = await prisma.billToken.findUnique({
        where: { tokenHash: tokenResult.tokenHash },
      });
      expect(dbToken).not.toBeNull();
      expect(dbToken?.invoiceId).toBe(invoice.id);
      expect(dbToken?.revoked).toBe(false);

      // Verify customer view model sanitization: NO agent code, NO agent user id leaked!
      const customerBill = await BillTokenService.verifyAndGetBill(tokenResult.rawToken);
      expect(customerBill).not.toBeNull();
      expect(customerBill?.invoiceNumber).toBe(invoice.number);
      expect(customerBill?.customerName).toBe("Ramesh Kirana");
      expect((customerBill as any).agentCodeSnapshot).toBeUndefined();
      expect((customerBill as any).agentUserId).toBeUndefined();

      // Revocation test
      await BillTokenService.revokeBillToken(invoice.id);
      const revokedCheck = await BillTokenService.verifyAndGetBill(tokenResult.rawToken);
      expect(revokedCheck).toBeNull();
    });

    it("returns null for expired bill token", async () => {
      const location = await prisma.location.findFirst();
      const invoice = await prisma.invoice.create({
        data: {
          number: `TEST-EXP-${Date.now()}`,
          fy: "26-27",
          locationId: location!.id,
          subtotalPaise: 50000,
          totalPaise: 50000,
          taxablePaise: 50000,
        },
      });

      // Expired token (-1 day)
      const tokenResult = await BillTokenService.createBillToken(invoice.id, -1);
      const bill = await BillTokenService.verifyAndGetBill(tokenResult.rawToken);
      expect(bill).toBeNull();
    });
  });

  describe("B1 & B5. Template Rendering & Idempotency", () => {
    it("renders clean Hinglish bill template with correct formatting", () => {
      const text = MessagingService.renderBillTemplate({
        customerName: "Sachin General Store",
        invoiceNo: "INV/26-27/000123",
        totalPaise: 1245050,
        balanceDuePaise: 500000,
        isGst: true,
        billUrl: "https://jmdcart.com/b/testtoken123",
      });

      expect(text).toContain("Namaste Sachin General Store");
      expect(text).toContain("INV/26-27/000123 (GST Bill)");
      expect(text).toContain("₹12,450.50");
      expect(text).toContain("Baqi Rashi: ₹5,000.00");
      expect(text).toContain("https://jmdcart.com/b/testtoken123");
      expect(text).toContain("Bharosa Ghar Tak");
    });

    it("generates instant wa.me click-to-chat links with zero ban risk", () => {
      const url = WaMeLinkProvider.generateUrl("9876543210", "Hello Test");
      expect(url).toBe("https://wa.me/919876543210?text=Hello%20Test");
    });

    it("is strictly idempotent: repeated queue calls never duplicate outbound messages", async () => {
      const location = await prisma.location.findFirst();
      const invoice = await prisma.invoice.create({
        data: {
          number: `TEST-IDEMP-${Date.now()}`,
          fy: "26-27",
          locationId: location!.id,
          subtotalPaise: 25000,
          totalPaise: 25000,
          taxablePaise: 25000,
          customerPhone: "9876543210",
        },
      });

      // Call 1
      const res1 = await MessagingService.queueInvoiceMessage({
        invoiceId: invoice.id,
        channels: [MessageChannel.WHATSAPP, MessageChannel.SMS],
      });
      expect(res1.skipped).toBe(false);
      expect(res1.queuedCount).toBe(2);

      // Call 2 (Duplicate)
      const res2 = await MessagingService.queueInvoiceMessage({
        invoiceId: invoice.id,
        channels: [MessageChannel.WHATSAPP, MessageChannel.SMS],
      });
      expect(res2.skipped).toBe(false);
      expect(res2.queuedCount).toBe(2);

      // DB should contain exactly 2 messages (1 WhatsApp, 1 SMS), NOT 4!
      const totalMessages = await prisma.outboundMessage.count({
        where: { invoiceId: invoice.id },
      });
      expect(totalMessages).toBe(2);
    });

    it("silently skips walk-in customers with no phone number", async () => {
      const location = await prisma.location.findFirst();
      const invoice = await prisma.invoice.create({
        data: {
          number: `TEST-NOPHONE-${Date.now()}`,
          fy: "26-27",
          locationId: location!.id,
          subtotalPaise: 10000,
          totalPaise: 10000,
          taxablePaise: 10000,
          customerPhone: null,
        },
      });

      const res = await MessagingService.queueInvoiceMessage({
        invoiceId: invoice.id,
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("NO_VALID_PHONE");
      expect(res.queuedCount).toBe(0);
    });

    it("strictly respects customer opt-out", async () => {
      const location = await prisma.location.findFirst();
      const optedOutPhone = "9988776655";

      await MessagingService.handleOptOut(optedOutPhone, "USER_REQUEST_STOP");

      const invoice = await prisma.invoice.create({
        data: {
          number: `TEST-OPTOUT-${Date.now()}`,
          fy: "26-27",
          locationId: location!.id,
          subtotalPaise: 15000,
          totalPaise: 15000,
          taxablePaise: 15000,
          customerPhone: optedOutPhone,
        },
      });

      const res = await MessagingService.queueInvoiceMessage({
        invoiceId: invoice.id,
      });

      expect(res.skipped).toBe(true);
      expect(res.reason).toBe("OPTED_OUT");
      expect(res.queuedCount).toBe(0);
    });
  });
});
