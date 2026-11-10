import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";
import { prisma } from "@/lib/prisma";

/**
 * Meta WhatsApp Cloud API Provider
 * Official WhatsApp Business API by Meta.
 * Provides 1,000 free service conversations per month without requiring a phone to stay on or connected.
 */
export class MetaWhatsAppCloudProvider implements IMessageProvider {
  readonly channel = MessageChannel.WHATSAPP;
  readonly providerType = MessageProviderType.CLOUD_API;

  private async getCredentials(): Promise<{ phoneNumberId: string; accessToken: string }> {
    let phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    let accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";

    if (!phoneNumberId || !accessToken) {
      try {
        const settings = await prisma.setting.findMany({
          where: {
            key: { in: ["messaging_whatsapp_phone_number_id", "messaging_whatsapp_access_token"] },
          },
        });
        for (const s of settings) {
          if (s.key === "messaging_whatsapp_phone_number_id") phoneNumberId = (s.value as string) || phoneNumberId;
          if (s.key === "messaging_whatsapp_access_token") accessToken = (s.value as string) || accessToken;
        }
      } catch {
        // ignore
      }
    }

    return { phoneNumberId, accessToken };
  }

  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { phoneNumberId, accessToken } = await this.getCredentials();

    if (!phoneNumberId || !accessToken) {
      return {
        success: false,
        error: "Meta WhatsApp credentials missing. Configure WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in Admin Settings or env.",
      };
    }

    const toFormatted = this.cleanPhone(params.toPhone);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: toFormatted,
          type: "text",
          text: {
            preview_url: true,
            body: params.body,
          },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const errObj = data.error || {};
        return {
          success: false,
          error: `WhatsApp Cloud API error (${errObj.code || res.status}): ${errObj.message || "Failed to send WhatsApp message"}`,
        };
      }

      const msgId = data.messages?.[0]?.id || `wamid_${Date.now()}`;
      return {
        success: true,
        externalMessageId: msgId,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === "AbortError" ? "Meta WhatsApp request timed out (10s)" : err.message || "Meta WhatsApp network error",
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const { phoneNumberId, accessToken } = await this.getCredentials();
    if (!phoneNumberId || !accessToken) {
      return {
        ok: false,
        status: "STANDBY",
        details: { message: "Meta WhatsApp credentials not configured." },
      };
    }

    try {
      const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.id) {
        return {
          ok: true,
          status: "CONNECTED",
          details: {
            verifiedName: data.verified_name || "Business",
            displayPhone: data.display_phone_number || phoneNumberId,
            message: `Connected (${data.display_phone_number || phoneNumberId})`,
          },
        };
      }
      return {
        ok: false,
        status: "DISCONNECTED",
        details: { message: data.error?.message || `HTTP ${res.status}` },
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "DISCONNECTED",
        details: { message: err.message || "Failed to reach Meta WhatsApp API" },
      };
    }
  }
}
