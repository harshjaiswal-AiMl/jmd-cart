import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";

export class WhatsAppOpenWaGateway implements IMessageProvider {
  readonly channel = MessageChannel.WHATSAPP;
  readonly providerType = MessageProviderType.OPEN_WA;

  private gatewayUrl: string;
  private secretKey: string;

  constructor() {
    this.gatewayUrl = (process.env.OPENWA_GATEWAY_URL || "http://127.0.0.1:8080").replace(/\/+$/, "");
    this.secretKey = process.env.OPENWA_SECRET_KEY || "jmd_openwa_secret_2026";
  }

  /**
   * Formats Indian mobile number to WhatsApp chatId (e.g. 919876543210@c.us)
   */
  private formatChatId(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    return `${normalized}@c.us`;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      const chatId = this.formatChatId(params.toPhone);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${this.gatewayUrl}/api/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.secretKey,
        },
        body: JSON.stringify({
          chatId,
          content: params.body,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        return {
          success: false,
          error: `OpenWA returned HTTP ${res.status}: ${errorText.slice(0, 100)}`,
        };
      }

      const json = await res.json().catch(() => ({}));
      return {
        success: true,
        externalMessageId: json.id || json.messageId || `wa_${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === "AbortError" ? "OpenWA request timed out (8s)" : (err.message || "Failed to reach OpenWA gateway"),
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${this.gatewayUrl}/api/status`, {
        method: "GET",
        headers: {
          "x-api-key": this.secretKey,
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        return {
          ok: false,
          status: "DISCONNECTED",
          details: { httpStatus: res.status },
        };
      }

      const data = await res.json().catch(() => ({ status: "UNKNOWN" }));
      if (data.status === "CONNECTED" || data.status === "isLogged") {
        return {
          ok: true,
          status: "CONNECTED",
          details: data,
        };
      } else if (data.status === "UNPAIRED" || data.status === "NEEDS_QR" || data.qr) {
        return {
          ok: false,
          status: "NEEDS_QR_SCAN",
          details: data,
        };
      }

      return {
        ok: false,
        status: "DISCONNECTED",
        details: data,
      };
    } catch (err: any) {
      return {
        ok: false,
        status: "DISCONNECTED",
        details: { error: err.message },
      };
    }
  }
}
