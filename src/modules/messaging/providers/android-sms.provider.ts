import { MessageChannel, MessageProviderType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { IMessageProvider, ProviderHealth, SendMessageParams, SendMessageResult } from "../message-provider.interface";

export class SmsAndroidGateway implements IMessageProvider {
  readonly channel = MessageChannel.SMS;
  readonly providerType = MessageProviderType.ANDROID_SMS;

  async send(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      // Clean phone number (last 10 digits for Indian mobiles)
      const digits = params.toPhone.replace(/\D/g, "");
      const normalizedPhone = digits.length >= 10 ? digits.slice(-10) : digits;

      if (normalizedPhone.length !== 10) {
        return {
          success: false,
          error: `Invalid Indian mobile number: ${params.toPhone}`,
        };
      }

      // Check if an active SMS gateway phone has checked in recently
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeDevice = await prisma.smsGatewayDevice.findFirst({
        where: {
          active: true,
          lastSeenAt: { gte: fiveMinutesAgo },
        },
        orderBy: { lastSeenAt: "desc" },
      });

      if (!activeDevice) {
        // Message remains queued in DB for when gateway device polls /api/messaging/sms/pull
        return {
          success: true,
          externalMessageId: `sms_queued_${Date.now()}`,
        };
      }

      return {
        success: true,
        externalMessageId: `sms_device_${activeDevice.id}_${Date.now()}`,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Failed to process SMS via Android gateway",
      };
    }
  }

  async checkHealth(): Promise<ProviderHealth> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const activeDevices = await prisma.smsGatewayDevice.findMany({
        where: {
          active: true,
          lastSeenAt: { gte: fiveMinutesAgo },
        },
      });

      if (activeDevices.length > 0) {
        return {
          ok: true,
          status: "CONNECTED",
          details: {
            activeCount: activeDevices.length,
            devices: activeDevices.map((d) => ({
              label: d.deviceLabel,
              lastSeen: d.lastSeenAt,
              dailySent: d.dailySentCount,
            })),
          },
        };
      }

      // Check if any device is registered at all
      const anyDevice = await prisma.smsGatewayDevice.findFirst({
        orderBy: { lastSeenAt: "desc" },
      });

      return {
        ok: false,
        status: anyDevice ? "DISCONNECTED" : "STANDBY",
        details: {
          message: anyDevice
            ? `Device '${anyDevice.deviceLabel}' last seen at ${anyDevice.lastSeenAt.toISOString()}`
            : "No Android SMS gateway device registered yet",
        },
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
