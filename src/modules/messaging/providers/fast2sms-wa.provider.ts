import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";
import { prisma } from "@/lib/prisma";

/**
 * Fast2SMS WhatsApp Provider
 * Sends pre-approved WhatsApp templates via Fast2SMS WhatsApp API.
 * Endpoint: https://www.fast2sms.com/dev/whatsapp
 */
export class Fast2SmsWhatsAppProvider implements IMessageProvider {
  readonly channel = MessageChannel.WHATSAPP;
  readonly providerType = MessageProviderType.FAST2SMS;

  private async getCredentials(): Promise<{ apiKey: string; messageId: string; phoneNumberId?: string }> {
    let apiKey = process.env.FAST2SMS_API_KEY || "";
    let messageId = process.env.FAST2SMS_WA_MESSAGE_ID || "";
    let phoneNumberId = process.env.FAST2SMS_WA_PHONE_NUMBER_ID || "";

    try {
      const settings = await prisma.setting.findMany({
        where: {
          key: {
            in: [
              "messaging_fast2sms_api_key",
              "messaging_fast2sms_wa_message_id",
              "messaging_fast2sms_wa_phone_id",
            ],
          },
        },
      });
      for (const s of settings) {
        if (s.key === "messaging_fast2sms_api_key") apiKey = (s.value as string) || apiKey;
        if (s.key === "messaging_fast2sms_wa_message_id") messageId = (s.value as string) || messageId;
        if (s.key === "messaging_fast2sms_wa_phone_id") phoneNumberId = (s.value as string) || phoneNumberId;
      }
    } catch {
      // ignore
    }

    return { apiKey, messageId, phoneNumberId };
  }

  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length > 10) return digits.slice(-10);
    return digits;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { apiKey, messageId, phoneNumberId } = await this.getCredentials();

    if (!apiKey) {
      return {
        success: false,
        error: "Fast2SMS API key missing in .env or settings.",
      };
    }

    const cleanedPhone = this.cleanPhone(params.toPhone);
    if (cleanedPhone.length !== 10) {
      return {
        success: false,
        error: `Invalid Indian mobile number: ${params.toPhone}`,
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const url = new URL("https://www.fast2sms.com/dev/whatsapp");
      if (messageId) url.searchParams.set("message_id", messageId);
      if (phoneNumberId) url.searchParams.set("phone_number_id", phoneNumberId);
      url.searchParams.set("numbers", cleanedPhone);
      url.searchParams.set("variables_values", params.body);

      const res = await fetch(url.toString(), {
        headers: { authorization: apiKey.trim() },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.return === false || data.status === false) {
        const errorMsg =
          (Array.isArray(data.message) ? data.message.join(", ") : data.message) ||
          data.errors?.message_id?.[0] ||
          `Fast2SMS WhatsApp HTTP ${res.status}`;
        return {
          success: false,
          error: `Fast2SMS WhatsApp: ${errorMsg}`,
        };
      }

      return {
        success: true,
        externalMessageId: data.request_id || `f2swa_${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === "AbortError" ? "Fast2SMS WhatsApp timed out (10s)" : err.message || "Network failure",
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const { apiKey } = await this.getCredentials();
    if (!apiKey) {
      return {
        ok: false,
        status: "STANDBY",
        details: { message: "Fast2SMS API key not configured." },
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
          details: { wallet: data.wallet, message: `Fast2SMS active. Wallet: ₹${data.wallet}` },
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
        details: { message: err.message || "Failed to reach Fast2SMS" },
      };
    }
  }
}
