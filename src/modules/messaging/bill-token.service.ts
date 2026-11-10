import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export interface BillTokenResult {
  rawToken: string;
  tokenHash: string;
  url: string;
  expiresAt: Date;
}

export interface CustomerInvoiceItem {
  id: string;
  productName: string;
  shortCode?: string | null;
  qty: number;
  unit?: string | null;
  packSize: number;
  mrpPaise: number;
  ratePaise: number;
  amountPaise: number;
  hsn?: string | null;
  gstRate: number;
}

export interface CustomerInvoiceViewModel {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  documentType: string;
  paymentStatus: string;
  buyerType: string;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  partyGstin?: string | null;
  subtotalPaise: number;
  discountPaise: number;
  taxablePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  totalPaise: number;
  items: CustomerInvoiceItem[];
  payments: Array<{
    mode: string;
    amountPaise: number;
    reference?: string | null;
    createdAt: string;
  }>;
  businessDetails: {
    name: string;
    legalName: string;
    address: string;
    phone: string;
    gstin: string;
    fssai: string;
  };
}

export class BillTokenService {
  /**
   * Generates a 128-bit cryptographically secure token for an invoice.
   * Stored as a SHA-256 hash in the database.
   */
  static async createBillToken(
    invoiceId: string,
    expiryDays: number = 90,
    baseUrl: string = process.env.NEXT_PUBLIC_APP_URL || "https://jmdcart.com"
  ): Promise<BillTokenResult> {
    // 16 bytes = 128 bits of entropy
    const rawToken = crypto.randomBytes(16).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenPreview = rawToken.slice(0, 8) + "...";
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    await prisma.billToken.upsert({
      where: { invoiceId },
      update: {
        tokenHash,
        tokenPreview,
        expiresAt,
        revoked: false,
      },
      create: {
        invoiceId,
        tokenHash,
        tokenPreview,
        expiresAt,
        revoked: false,
      },
    });

    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const url = `${cleanBaseUrl}/b/${rawToken}`;

    return {
      rawToken,
      tokenHash,
      url,
      expiresAt,
    };
  }

  /**
   * Verifies a raw token, increments access counter, and returns the sanitized customer-facing invoice.
   */
  static async verifyAndGetBill(rawToken: string): Promise<CustomerInvoiceViewModel | null> {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 16) {
      return null;
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    const billToken = await prisma.billToken.findUnique({
      where: { tokenHash },
      include: {
        invoice: {
          include: {
            items: {
              include: {
                product: true,
              },
            },
            party: true,
            payments: true,
          },
        },
      },
    });

    if (!billToken || !billToken.invoice) {
      return null;
    }

    // Check revocation
    if (billToken.revoked) {
      return null;
    }

    // Check expiry
    if (new Date() > billToken.expiresAt) {
      return null;
    }

    // Increment access counter asynchronously
    await prisma.billToken.update({
      where: { id: billToken.id },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date(),
      },
    }).catch(() => {}); // non-blocking

    const inv = billToken.invoice;

    // Fetch business details from settings if available
    const settingsRecord = await prisma.setting.findUnique({
      where: { key: "business_details" },
    }).catch(() => null);

    const businessDetails = (settingsRecord?.value as any) || {
      name: "JMD Cart",
      legalName: "JMD Cart Enterprise",
      address: "Saharsa, Bihar 852201",
      phone: "+91 99310 00000",
      gstin: "10XXXXX0000X1Z5",
      fssai: "1042XXXXXXXXXX",
    };

    return {
      id: inv.id,
      invoiceNumber: inv.number,
      invoiceDate: (inv.invoiceDate || inv.createdAt).toISOString(),
      documentType: inv.documentType || "RETAIL",
      paymentStatus: inv.paymentStatus,
      buyerType: inv.buyerType,
      customerName: inv.party?.name || inv.customerName || "Customer",
      customerPhone: inv.party?.phone || inv.customerPhone,
      customerAddress: inv.party?.address || inv.customerAddress,
      partyGstin: inv.party?.gstin,
      subtotalPaise: inv.subtotalPaise,
      discountPaise: inv.discountPaise,
      taxablePaise: inv.taxablePaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      igstPaise: inv.igstPaise,
      roundOffPaise: inv.roundOffPaise,
      totalPaise: inv.totalPaise,
      items: inv.items.map((it) => {
        const amountPaise = it.taxablePaise + it.taxPaise;
        const ratePaise = it.unitPricePaise || (it.qty > 0 ? Math.round(amountPaise / it.qty) : 0);
        return {
          id: it.id,
          productName: it.product?.name || "Product",
          shortCode: it.product?.shortCode,
          qty: it.qty,
          unit: it.unitLabel || "PCS",
          packSize: it.product?.packSize || 1,
          mrpPaise: it.mrpPaise,
          ratePaise,
          amountPaise,
          hsn: it.hsn || it.product?.hsn,
          gstRate: (it.gstRateBp || 0) / 100,
        };
      }),
      payments: inv.payments.map((p) => ({
        mode: p.mode,
        amountPaise: p.amountPaise,
        reference: p.receiptNo || p.notes,
        createdAt: p.createdAt.toISOString(),
      })),
      businessDetails: {
        name: businessDetails.name || "JMD Cart",
        legalName: businessDetails.legalName || "JMD Cart",
        address: businessDetails.address || "Saharsa, Bihar",
        phone: businessDetails.phone || "",
        gstin: businessDetails.gstin || "",
        fssai: businessDetails.fssai || "",
      },
    };
  }

  /**
   * Revokes a bill token.
   */
  static async revokeBillToken(invoiceId: string): Promise<boolean> {
    try {
      await prisma.billToken.update({
        where: { invoiceId },
        data: { revoked: true },
      });
      return true;
    } catch {
      return false;
    }
  }
}
