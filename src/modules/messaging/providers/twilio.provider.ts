import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";
import { prisma } from "@/lib/prisma";

/**
 * Twilio SMS Provider
 * Standard global SMS provider with $15.50 free trial credits on sign up.
 */
export class TwilioSmsProvider implements IMessageProvider {
  readonly channel = MessageChannel.SMS;
  readonly providerType = MessageProviderType.TWILIO;

  private async getCredentials(): Promise<{ accountSid: string; authToken: string; fromPhone: string }> {
    let accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    let authToken = process.env.TWILIO_AUTH_TOKEN || "";
    let fromPhone = process.env.TWILIO_FROM_PHONE || "";

    if (!accountSid || !authToken || !fromPhone) {
      try {
        const settings = await prisma.setting.findMany({
          where: {
            key: { in: ["messaging_twilio_sid", "messaging_twilio_token", "messaging_twilio_from"] },
          },
        });
        for (const s of settings) {
          if (s.key === "messaging_twilio_sid") accountSid = (s.value as string) || accountSid;
          if (s.key === "messaging_twilio_token") authToken = (s.value as string) || authToken;
          if (s.key === "messaging_twilio_from") fromPhone = (s.value as string) || fromPhone;
        }
      } catch {
        // ignore
      }
    }

    return { accountSid, authToken, fromPhone };
  }

  private cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return `+${digits}`;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const { accountSid, authToken, fromPhone } = await this.getCredentials();

    if (!accountSid || !authToken || !fromPhone) {
      return {
        success: false,
        error: "Twilio credentials missing. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE in Admin Settings or env.",
      };
    }

    const toFormatted = this.cleanPhone(params.toPhone);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

      const formBody = new URLSearchParams({
        To: toFormatted,
        From: fromPhone,
        Body: params.body,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formBody.toString(),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          error: `Twilio error ${data.code || res.status}: ${data.message || "Failed to send SMS"}`,
        };
      }

      return {
        success: true,
        externalMessageId: data.sid || `tw_${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.name === "AbortError" ? "Twilio request timed out (10s)" : err.message || "Twilio network error",
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    const { accountSid, authToken } = await this.getCredentials();
    if (!accountSid || !authToken) {
      return {
        ok: false,
        status: "STANDBY",
        details: { message: "Twilio credentials not configured." },
      };
    }

    try {
      const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
        headers: { Authorization: authHeader },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "active") {
        return {
          ok: true,
          status: "CONNECTED",
          details: { status: data.status, friendlyName: data.friendly_name || "" },
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
        details: { message: err.message || "Failed to reach Twilio API" },
      };
    }
  }
}
