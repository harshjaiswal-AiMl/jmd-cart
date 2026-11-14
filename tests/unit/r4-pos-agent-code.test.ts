import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { billingService } from "@/modules/billing/billing.service";
import { InvoiceEditService } from "@/modules/billing/invoice-edit.service";
import { buildInvoiceViewModel } from "@/modules/billing/invoice-view-model";
import { renderDirectPrintHtml } from "@/lib/printing/bill-html";
import { settingsService, DEFAULT_INVOICE_PRINT_SETTINGS } from "@/modules/settings/settings.service";
import { settingsRepository } from "@/modules/settings/settings.repository";
import { UserRole, LocationType, PartyType, InvoiceChannel, PaymentStatus } from "@prisma/client";

describe("R4: Agent Code on Shop POS Bill", () => {
  it("validates agent code format ^[A-Z0-9-]{1,10}$", () => {
    const validCodes = ["A001", "AG-99", "PRO-1", "AGENT10", "X"];
    const invalidCodes = ["a001", "AGENT_01", "TOOLONGA12345", "AG@1", ""];
    const regex = /^[A-Z0-9-]{1,10}$/;

    for (const c of validCodes) {
      expect(regex.test(c), `expected ${c} to be valid`).toBe(true);
    }
    for (const c of invalidCodes) {
      expect(regex.test(c), `expected ${c} to be invalid`).toBe(false);
    }
  });

  it("finalizes bill with agentCodeSnapshot and links agentUserId when matching user exists", async () => {
    // 1. Get or create agent user
    let agentUser = await prisma.user.findFirst({
      where: { agentCode: "A001" },
    });
    if (!agentUser) {
      agentUser = await prisma.user.create({
        data: {
          phone: "9876540001",
          name: "Test Agent Staff",
          role: UserRole.SALESPERSON,
          agentCode: "A001",
          passwordHash: "dummy",
        },
      });
    }

    const shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    expect(shopLoc).toBeDefined();

    const product = await prisma.product.findFirst({
      where: { active: true },
    });
    expect(product).toBeDefined();

    // 2. Finalize invoice with agentCode: "A001"
    const inv = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLoc!.id,
        items: [{ productId: product!.id, qty: 1 }],
        payments: [{ mode: "CASH", amountPaise: product!.priceAPaise || product!.mrpPaise || 1000 }],
        paymentStatus: PaymentStatus.PAID,
        idempotencyKey: `test_r4_agent_${Date.now()}_1`,
        agentCode: "A001",
      },
      agentUser!.id
    );

    expect(inv.agentCodeSnapshot).toBe("A001");
    expect(inv.agentUserId).toBe(agentUser!.id);

    // 3. Check ViewModel and A5 rendering: stored value equals printed A5 value
    const vm = buildInvoiceViewModel(inv, undefined, { showAgentCode: true });
    const agentRow = vm.customer.rows.find((r) => r.label === "Agent Code");
    expect(agentRow).toBeDefined();
    expect(agentRow?.value).toBe("A001");

    // 4. Check thermal bill does NOT include agent code
    const thermalHtml = renderDirectPrintHtml(inv, undefined as any, "thermal");
    expect(thermalHtml).not.toContain("A001");
  });

  it("supports free agent code if no matching user exists", async () => {
    const shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const product = await prisma.product.findFirst({
      where: { active: true },
    });

    const inv = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLoc!.id,
        items: [{ productId: product!.id, qty: 1 }],
        payments: [{ mode: "CASH", amountPaise: product!.priceAPaise || product!.mrpPaise || 1000 }],
        paymentStatus: PaymentStatus.PAID,
        idempotencyKey: `test_r4_agent_${Date.now()}_free`,
        agentCode: "EXT-88",
      }
    );

    expect(inv.agentCodeSnapshot).toBe("EXT-88");
  });

  it("blocks finalize when pos.agentRequired is true and agentCode is missing", async () => {
    await settingsRepository.setSetting("pos.agentRequired", true);

    const shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const product = await prisma.product.findFirst({
      where: { active: true },
    });

    await expect(
      billingService.finalizeInvoice(
        UserRole.SHOP,
        {
          channel: InvoiceChannel.SHOP,
          locationId: shopLoc!.id,
          items: [{ productId: product!.id, qty: 1 }],
          payments: [{ mode: "CASH", amountPaise: product!.priceAPaise || product!.mrpPaise || 1000 }],
          paymentStatus: PaymentStatus.PAID,
          idempotencyKey: `test_r4_agent_${Date.now()}_req_fail`,
        }
      )
    ).rejects.toThrow(/agent code is required/i);

    // Reset setting
    await settingsRepository.setSetting("pos.agentRequired", false);
  });

  it("carries agent code through edit revisions and audits agent changes", async () => {
    const shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const product = await prisma.product.findFirst({
      where: { active: true },
    });

    // Create initial invoice with A001
    const inv = await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLoc!.id,
        items: [{ productId: product!.id, qty: 1 }],
        payments: [{ mode: "CASH", amountPaise: product!.priceAPaise || product!.mrpPaise || 1000 }],
        paymentStatus: PaymentStatus.PAID,
        idempotencyKey: `test_r4_agent_${Date.now()}_rev_init`,
        agentCode: "A001",
      }
    );
    expect(inv.agentCodeSnapshot).toBe("A001");

    // Modify invoice with new agent code "A002"
    const editService = new InvoiceEditService();
    const updated = await editService.modifyInvoice(
      UserRole.ADMIN,
      {
        invoiceId: inv.id,
        expectedVersion: inv.version,
        reason: "Customer credited sale to agent A002",
        agentCode: "A002",
        items: [{ productId: product!.id, qty: 1 }],
      }
    );

    expect(updated.agentCodeSnapshot).toBe("A002");

    // Check revision audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: inv.id },
      orderBy: { createdAt: "desc" },
    });
    const editLog = auditLogs.find((l) => l.action === "INVOICE_MODIFIED");
    expect(editLog).toBeDefined();
    const afterData = editLog?.after as any;
    expect(afterData?.agentCodeDiff?.before || afterData?.agentCodeBefore).toBe("A001");
    expect(afterData?.agentCodeDiff?.after || afterData?.agentCodeAfter).toBe("A002");
  });

  it("includes agentCodeSnapshot in billingService.listInvoices", async () => {
    const shopLoc = await prisma.location.findFirst({
      where: { type: LocationType.SHOP, active: true },
    });
    const product = await prisma.product.findFirst({
      where: { active: true },
    });
    await billingService.finalizeInvoice(
      UserRole.SHOP,
      {
        channel: InvoiceChannel.SHOP,
        locationId: shopLoc!.id,
        items: [{ productId: product!.id, qty: 1 }],
        payments: [{ mode: "CASH", amountPaise: product!.priceAPaise || product!.mrpPaise || 1000 }],
        paymentStatus: PaymentStatus.PAID,
        idempotencyKey: `test_r4_agent_${Date.now()}_list`,
        agentCode: "A001",
      }
    );

    const res = await billingService.listInvoices({ limit: 10 });
    expect(res.items.length).toBeGreaterThan(0);
    expect("agentCodeSnapshot" in res.items[0]).toBe(true);
  });
});
