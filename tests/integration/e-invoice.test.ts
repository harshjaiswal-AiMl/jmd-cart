import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  NoopEInvoiceProvider,
  getEInvoiceProvider,
  setEInvoiceProvider,
  resetEInvoiceProvider,
  GenericGspEInvoiceProvider,
} from "@/lib/e-invoice";
import { billingService } from "@/modules/billing/billing.service";
import { settingsService } from "@/modules/settings/settings.service";
import { UserRole, InvoiceStatus, PaymentMode } from "@prisma/client";

describe("E-Invoice Adapter & Integration (Task 4.4)", () => {
  beforeEach(async () => {
    resetEInvoiceProvider();
    await prisma.setting.deleteMany({
      where: { key: "einvoice_settings" },
    });
  });

  it("provider defaults to No-Op provider and reports correct metadata", () => {
    const provider = getEInvoiceProvider();
    expect(provider).toBeInstanceOf(NoopEInvoiceProvider);
    expect(provider.name).toBe("noop");
    expect(provider.isLive).toBe(false);
  });

  it("determines eligibility based on B2B GSTIN presence", () => {
    const provider = getEInvoiceProvider();

    // Mock B2C invoice (no party)
    const b2cInvoice: any = {
      id: "inv-b2c",
      number: "INV/26-27/000001",
      party: null,
    };
    expect(provider.isEligible(b2cInvoice)).toBe(false);

    // Mock B2C party (party with no GSTIN or short GSTIN)
    const partyNoGstin: any = {
      id: "inv-nogst",
      number: "INV/26-27/000002",
      party: { gstin: null },
    };
    expect(provider.isEligible(partyNoGstin)).toBe(false);

    // Mock B2B party with valid 15-digit GSTIN
    const b2bInvoice: any = {
      id: "inv-b2b",
      number: "INV/26-27/000003",
      party: { gstin: "10ABCDE1234F1Z5", name: "Gupta Traders" },
    };
    expect(provider.isEligible(b2bInvoice)).toBe(true);
  });

  it("NoopProvider generates deterministic mock IRN and QR for eligible B2B invoices and skips B2C", async () => {
    const provider = getEInvoiceProvider();
    const business = await settingsService.getBusinessDetails();

    // Test B2C skip
    const b2cInvoice: any = {
      id: "inv-1",
      number: "INV/26-27/000001",
      totalPaise: 10000,
      party: null,
    };
    const b2cResult = await provider.generateIrn(b2cInvoice, business);
    expect(b2cResult.success).toBe(true);
    expect(b2cResult.status).toBe("SKIPPED");
    expect(b2cResult.irn).toBeUndefined();

    // Test B2B generation
    const b2bInvoice: any = {
      id: "inv-2",
      number: "INV/26-27/000002",
      totalPaise: 250000,
      party: { gstin: "10ABCDE1234F1Z5", name: "Gupta Kirana" },
    };
    const b2bResult = await provider.generateIrn(b2bInvoice, business);
    expect(b2bResult.success).toBe(true);
    expect(b2bResult.status).toBe("GENERATED");
    expect(b2bResult.irn).toContain("NOOP-IRN-INV2627000002");
    expect(b2bResult.qrCode).toContain("irn=");
    expect(b2bResult.ackNo).toBeDefined();

    // Check cancellation
    const cancelResult = await provider.cancelIrn(b2bResult.irn!, "Wrong GST slab");
    expect(cancelResult.success).toBe(true);
    expect(cancelResult.status).toBe("CANCELLED");
    expect(cancelResult.irn).toBe(b2bResult.irn);
  });

  it("generic GSP provider requires credentials and blocks without live configuration", async () => {
    const liveGsp = new GenericGspEInvoiceProvider({
      baseUrl: "https://gsp.nic.in",
      clientId: "",
      clientSecret: "",
      gstin: "10AAAAA0000A1Z5",
      username: "user",
    });

    const b2bInvoice: any = {
      number: "INV/26-27/000010",
      party: { gstin: "10ABCDE1234F1Z5" },
    };
    const business = await settingsService.getBusinessDetails();

    await expect(liveGsp.generateIrn(b2bInvoice, business)).rejects.toThrow(
      "GSP credentials are incomplete"
    );
  });

  it("end-to-end: finalizeInvoice generates IRN for B2B invoice and cancelInvoice triggers cancelIrn", async () => {
    // 1. Prepare product and party
    const product = await prisma.product.findFirst({ where: { active: true } });
    if (!product) throw new Error("No active product");

    let party = await prisma.party.findFirst({
      where: { gstin: { not: null } },
    });
    if (!party) {
      party = await prisma.party.create({
        data: {
          name: "Test E-Invoice B2B Party",
          type: "RETAILER",
          phone: "9876599999",
          gstin: "10ABCDE1234F1Z5",
          creditLimitPaise: 5000000,
          creditDays: 30,
        },
      });
    }

    const shopLoc = await prisma.location.findFirst({ where: { type: "SHOP" } });
    if (!shopLoc) throw new Error("No shop location");

    // Add stock to shop
    await prisma.stockBalance.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: shopLoc.id,
        },
      },
      update: { qty: { increment: 50 } },
      create: {
        productId: product.id,
        locationId: shopLoc.id,
        qty: 50,
      },
    });

    const admin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!admin) throw new Error("No super admin found");

    // 2. Finalize B2B invoice
    const idempotencyKey = `einv_test_${Date.now()}`;
    const finalized = await billingService.finalizeInvoice(
      UserRole.SUPER_ADMIN,
      {
        channel: "SHOP",
        locationId: shopLoc.id,
        partyId: party.id,
        idempotencyKey,
        items: [{ productId: product.id, qty: 5 }],
        payments: [{ mode: PaymentMode.CASH, amountPaise: 500 }],
      },
      admin.id,
      "127.0.0.1"
    );

    // Verify invoice has IRN generated by adapter
    expect(finalized.irn).toBeDefined();
    expect(finalized.irn).toContain("NOOP-IRN");
    expect(finalized.qr).toBeDefined();

    // 3. Cancel invoice
    const cancelRes = await billingService.cancelInvoice(
      UserRole.SUPER_ADMIN,
      {
        invoiceId: finalized.id,
        reason: "Customer cancelled B2B order",
      },
      admin.id,
      "127.0.0.1"
    );

    expect(cancelRes.invoice.status).toBe(InvoiceStatus.CANCELLED);

    // Verify No-Op cancellation log recorded the IRN cancellation
    const cancelLogs = NoopEInvoiceProvider.getCancellationLog();
    const matchingLog = cancelLogs.find((l) => l.irn === finalized.irn);
    expect(matchingLog).toBeDefined();
    expect(matchingLog?.reason).toBe("Customer cancelled B2B order");
  });

  it("admin can configure e-invoice settings and retrieve them", async () => {
    const admin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!admin) throw new Error("No super admin found");

    const original = await settingsService.getEInvoiceSettings();
    expect(original.provider).toBe("noop");

    const updated = await settingsService.updateEInvoiceSettings(
      UserRole.SUPER_ADMIN,
      admin.id,
      {
        enabled: true,
        provider: "clear_tax",
        gspClientId: "ct_client_123",
        gspClientSecret: "ct_secret_456",
        gspUsername: "jmd_api_user",
        gspBaseUrl: "https://api.cleartax.in/einvoice",
        autoGenerateOnFinalize: true,
      }
    );

    expect(updated.enabled).toBe(true);
    expect(updated.provider).toBe("clear_tax");
    expect(updated.gspClientId).toBe("ct_client_123");

    // Restore default
    await settingsService.updateEInvoiceSettings(
      UserRole.SUPER_ADMIN,
      admin.id,
      original
    );
  });
});
