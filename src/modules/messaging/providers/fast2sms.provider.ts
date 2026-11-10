import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";
import { prisma } from "@/lib/prisma";

/**
 * Fast2SMS Provider
 * Popular Indian SMS Gateway with free signup credits and instant developer API.
 * Supports quick transactional SMS to Indian 10-digit mobile numbers without complex DLT approval during testing.
 */
export class Fast2SmsProvider implements IMessageProvider {
  readonly channel = MessageChannel.SMS;
  readonly providerType = MessageProviderType.FAST2SMS;

  private apiKeyOverride?: string;

  constructor(apiKey?: string) {
    this.apiKeyOverride = apiKey;
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKeyOverride) return this.apiKeyOverride;
    if (process.env.FAST2SMS_API_KEY) return process.env.FAST2SMS_API_KEY;

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: "messaging_fast2sms_api_key" },
      });
      return (setting?.value as string) || "";
    } catch {
      return "";
    }
  }

  /**
   * Cleans Indian mobile number to 10 digits
   */
  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) {
      return digits.slice(2);
    }
    if (digits.length > 10) {
      return digits.slice(-10);
    }
    return digits;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return {
        success: false,
        error: "Fast2SMS API key not configured. Please add FAST2SMS_API_KEY in Admin Settings or env.",
      };
    }

    const cleanedPhone = this.cleanPhone(params.toPhone);
    if (cleanedPhone.length !== 10) {
      return {
        success: false,
        error: `Invalid Indian mobile number: ${params.toPhone} (must be 10 digits)`,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      // Fast2SMS bulkV2 Quick SMS ("q" route) or DLT route
      const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey.trim(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          route: "q",
          message: params.body,
          language: "english",
          flash: 0,
          numbers: cleanedPhone,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.return === false) {
        const errorMsg =
          (Array.isArray(data.message) ? data.message.join(", ") : data.message) ||
          `Fast2SMS HTTP ${res.status}`;
        return {
          success: false,
          error: `Fast2SMS error: ${errorMsg}`,
        };
      }

      const reqId = data.request_id || `f2s_${Date.now()}`;
      return {
        success: true,
        externalMessageId: String(reqId),
      };
    } catch (err: any) {
      return {
        success: false,
        error:
          err.name === "AbortError"
            ? "Fast2SMS request timed out (10s)"
            : err.message || "Fast2SMS network failure",
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return {
        ok: false,
        status: "STANDBY",
        details: { message: "Fast2SMS API key is not configured." },
      };
    }

    try {
      const res = await fetch("https://www.fast2sms.com/dev/wallet", {
        headers: { authorization: apiKey.trim() },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.wallet !== undefined) {
        return {
          ok: true,
          status: "CONNECTED",
          details: { wallet: data.wallet, message: `Wallet balance: ₹${data.wallet}` },
        };
      }
      return {
        ok: false,
        status: "DISCONNECTED",
        details: { message: data.message || `HTTP ${res.status}` },
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "DISCONNECTED",
        details: { message: err.message || "Failed to reach Fast2SMS API" },
      };
    }
  }
}
