import { MessageChannel, MessageProviderType } from "@prisma/client";

export interface SendMessageParams {
  toPhone: string;
  body: string;
  billUrl?: string;
  pdfUrl?: string;
  invoiceNumber?: string;
}

export interface SendMessageResult {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

export interface ProviderHealth {
  ok: boolean;
  status: "CONNECTED" | "NEEDS_QR_SCAN" | "DISCONNECTED" | "STANDBY";
  details?: Record<string, any>;
}

export interface IMessageProvider {
  readonly channel: MessageChannel;
  readonly providerType: MessageProviderType;

  send(params: SendMessageParams): Promise<SendMessageResult>;
  checkHealth(): Promise<ProviderHealth>;
}
