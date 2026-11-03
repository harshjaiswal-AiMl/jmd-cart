import { MessageChannel, MessageProviderType } from "@prisma/client";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";

export class WaMeLinkProvider implements IMessageProvider {
  readonly channel = MessageChannel.WHATSAPP;
  readonly providerType = MessageProviderType.WA_ME;

  /**
   * Generates a wa.me click-to-chat URL
   */
  static generateUrl(phone: string, text: string): string {
    const digits = phone.replace(/\D/g, "");
    const normalized = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
  }

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    const url = WaMeLinkProvider.generateUrl(params.toPhone, params.body);
    return {
      success: true,
      externalMessageId: `wame_${Date.now()}`,
    };
  }

  async checkHealth(): Promise<ProviderHealth> {
    return {
      ok: true,
      status: "CONNECTED",
      details: {
        type: "MANUAL_CLICK_TO_CHAT",
        banRisk: "ZERO",
      },
    };
  }
}
