export interface SendSmsParams {
  toPhone: string;
  message: string;
  templateId?: string;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SmsProvider {
  name: string;
  sendSms(params: SendSmsParams): Promise<SmsSendResult>;
}

/**
 * Console/Dev SMS Provider.
 * Safely logs SMS messages to console and keeps an in-memory log for local testing.
 * Does not call any external 3rd-party services.
 */
export class ConsoleSmsProvider implements SmsProvider {
  public readonly name = "console";
  private static sentLog: Array<SendSmsParams & { timestamp: Date; id: string }> = [];

  async sendSms(params: SendSmsParams): Promise<SmsSendResult> {
    const id = `sms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const entry = { ...params, timestamp: new Date(), id };
    ConsoleSmsProvider.sentLog.push(entry);

    if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "production") {
      console.log(`[SMS:ConsoleProvider] To: ${params.toPhone} | Msg: ${params.message}`);
    }

    return {
      success: true,
      messageId: id,
    };
  }

  static getSentMessages(phone?: string) {
    if (phone) {
      return ConsoleSmsProvider.sentLog.filter((m) => m.toPhone === phone);
    }
    return [...ConsoleSmsProvider.sentLog];
  }

  static clearSentMessages() {
    ConsoleSmsProvider.sentLog = [];
  }
}

/**
 * Active SMS provider instance.
 * Defaults to ConsoleSmsProvider so system is completely self-contained and local-first.
 */
export const defaultSmsProvider: SmsProvider = new ConsoleSmsProvider();
