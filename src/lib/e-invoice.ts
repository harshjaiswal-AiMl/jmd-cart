import { InvoiceWithDetails } from "@/modules/billing/billing.types";
import { BusinessDetails } from "@/modules/settings/settings.types";

/**
 * Result returned by E-Invoice IRN generation.
 */
export interface EInvoiceGenerationResult {
  success: boolean;
  irn?: string;
  qrCode?: string;
  ackNo?: string;
  ackDate?: string;
  status: "GENERATED" | "SKIPPED" | "FAILED";
  message?: string;
  error?: string;
}

/**
 * Result returned by E-Invoice cancellation.
 */
export interface EInvoiceCancellationResult {
  success: boolean;
  irn: string;
  cancelledAt?: string;
  status: "CANCELLED" | "FAILED";
  message?: string;
  error?: string;
}

/**
 * Pluggable interface for E-Invoice Service Provider (GSP / IRP adapter).
 * Per PRD Section 5.10 & 11:
 * "Compliance: client is GST registered with FSSAI. Turnover is high enough that
 * e-invoice (IRN/QR) likely applies; integration happens once client supplies GSP credentials."
 *
 * Designed to remain a no-op adapter until GSP credentials are supplied by the client.
 */
export interface EInvoiceProvider {
  readonly name: string;
  readonly isLive: boolean;

  /**
   * Determine whether an invoice is eligible for E-Invoicing.
   * Typically B2B / SEZ supplies with registered buyer GSTIN.
   */
  isEligible(invoice: InvoiceWithDetails): boolean;

  /**
   * Generate IRN and signed QR code for an invoice.
   */
  generateIrn(
    invoice: InvoiceWithDetails,
    business: BusinessDetails
  ): Promise<EInvoiceGenerationResult>;

  /**
   * Cancel an existing IRN (e.g., when invoice is cancelled).
   */
  cancelIrn(
    irn: string,
    reason: string,
    remarks?: string
  ): Promise<EInvoiceCancellationResult>;
}

/**
 * No-Op E-Invoice Provider.
 * Safely active by default until real GSP credentials (e.g., ClearTax / Cygnet / NIC) are configured.
 * Does not make external network requests.
 * Emits informational logs and returns deterministic results.
 */
export class NoopEInvoiceProvider implements EInvoiceProvider {
  public readonly name = "noop";
  public readonly isLive = false;

  private static generationLog: Array<{
    invoiceNumber: string;
    timestamp: Date;
    result: EInvoiceGenerationResult;
  }> = [];

  private static cancellationLog: Array<{
    irn: string;
    reason: string;
    timestamp: Date;
    result: EInvoiceCancellationResult;
  }> = [];

  /**
   * Check eligibility:
   * Only B2B invoices (where party exists and has a valid 15-character GSTIN) qualify for E-Invoicing.
   * B2C invoices (no GSTIN) are exempt from IRN requirements.
   */
  isEligible(invoice: InvoiceWithDetails): boolean {
    const partyGstin = invoice.party?.gstin?.trim();
    if (!partyGstin || partyGstin.length !== 15) {
      return false;
    }
    return true;
  }

  async generateIrn(
    invoice: InvoiceWithDetails,
    business: BusinessDetails
  ): Promise<EInvoiceGenerationResult> {
    if (!this.isEligible(invoice)) {
      const skippedResult: EInvoiceGenerationResult = {
        success: true,
        status: "SKIPPED",
        message: "Invoice is B2C or buyer does not have a valid 15-digit GSTIN; E-Invoice skipped.",
      };
      NoopEInvoiceProvider.generationLog.push({
        invoiceNumber: invoice.number,
        timestamp: new Date(),
        result: skippedResult,
      });
      return skippedResult;
    }

    // In no-op mode, acknowledge eligibility and provide simulated metadata when in test/dev
    const mockIrn = `NOOP-IRN-${invoice.number.replace(/[^A-Za-z0-9]/g, "")}-${Date.now().toString(36).toUpperCase()}`;
    const mockQr = `https://idms.local/qr/einvoice/${invoice.number}?irn=${mockIrn}&seller=${business.gstin || "10AAAAA0000A1Z5"}&buyer=${invoice.party?.gstin}&amt=${invoice.totalPaise}`;

    const result: EInvoiceGenerationResult = {
      success: true,
      irn: mockIrn,
      qrCode: mockQr,
      ackNo: `ACK-${Date.now()}`,
      ackDate: new Date().toISOString(),
      status: "GENERATED",
      message: "E-Invoice processed via No-Op adapter (Awaiting client GSP credentials).",
    };

    NoopEInvoiceProvider.generationLog.push({
      invoiceNumber: invoice.number,
      timestamp: new Date(),
      result,
    });

    if (process.env.NODE_ENV !== "test") {
      console.log(
        `[E-Invoice:NoopProvider] Invoice ${invoice.number} (Party: ${invoice.party?.name || "B2B"}) - Simulated IRN: ${mockIrn}`
      );
    }

    return result;
  }

  async cancelIrn(
    irn: string,
    reason: string,
    remarks?: string
  ): Promise<EInvoiceCancellationResult> {
    const result: EInvoiceCancellationResult = {
      success: true,
      irn,
      cancelledAt: new Date().toISOString(),
      status: "CANCELLED",
      message: `IRN ${irn} cancellation recorded via No-Op adapter: ${reason}${remarks ? ` (${remarks})` : ""}`,
    };

    NoopEInvoiceProvider.cancellationLog.push({
      irn,
      reason,
      timestamp: new Date(),
      result,
    });

    if (process.env.NODE_ENV !== "test") {
      console.log(`[E-Invoice:NoopProvider] Cancelled IRN ${irn}: ${reason}`);
    }

    return result;
  }

  static getGenerationLog() {
    return [...NoopEInvoiceProvider.generationLog];
  }

  static getCancellationLog() {
    return [...NoopEInvoiceProvider.cancellationLog];
  }

  static clearLogs() {
    NoopEInvoiceProvider.generationLog = [];
    NoopEInvoiceProvider.cancellationLog = [];
  }
}

/**
 * Production-ready GSP Adapter Skeleton.
 * Ready to be instantiated as soon as client procures GSP API credentials
 * (Client ID, Secret, Username, Password, Auth Token).
 */
export interface GspCredentials {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  gstin: string;
  username: string;
  password?: string;
}

export class GenericGspEInvoiceProvider implements EInvoiceProvider {
  public readonly name = "gsp-live";
  public readonly isLive = true;

  constructor(private readonly creds: GspCredentials) {}

  isEligible(invoice: InvoiceWithDetails): boolean {
    const partyGstin = invoice.party?.gstin?.trim();
    return Boolean(partyGstin && partyGstin.length === 15);
  }

  async generateIrn(
    invoice: InvoiceWithDetails,
    business: BusinessDetails
  ): Promise<EInvoiceGenerationResult> {
    if (!this.isEligible(invoice)) {
      return {
        success: true,
        status: "SKIPPED",
        message: "Invoice not eligible for B2B e-invoicing.",
      };
    }

    if (!this.creds.clientId || !this.creds.clientSecret) {
      throw new Error("GSP credentials are incomplete; cannot generate IRN.");
    }

    // When client provides live GSP endpoint, payload mapping per NIC schema schema v1.03
    // is executed here. Currently returns stubbed failure if called without real endpoint.
    return {
      success: false,
      status: "FAILED",
      error: "GSP endpoint connectivity pending client production activation.",
    };
  }

  async cancelIrn(
    irn: string,
    reason: string,
    remarks?: string
  ): Promise<EInvoiceCancellationResult> {
    if (!this.creds.clientId || !this.creds.clientSecret) {
      throw new Error("GSP credentials are incomplete; cannot cancel IRN.");
    }

    return {
      success: false,
      irn,
      status: "FAILED",
      error: "GSP endpoint connectivity pending client production activation.",
    };
  }
}

/**
 * Global provider registry and factory.
 */
let activeEInvoiceProvider: EInvoiceProvider = new NoopEInvoiceProvider();

export function getEInvoiceProvider(): EInvoiceProvider {
  return activeEInvoiceProvider;
}

export function setEInvoiceProvider(provider: EInvoiceProvider): void {
  activeEInvoiceProvider = provider;
}

export function resetEInvoiceProvider(): void {
  activeEInvoiceProvider = new NoopEInvoiceProvider();
  NoopEInvoiceProvider.clearLogs();
}
