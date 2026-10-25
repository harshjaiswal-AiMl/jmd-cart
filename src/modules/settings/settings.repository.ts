import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export class SettingsRepository {
  async getSetting<T>(key: string): Promise<T | null> {
    const record = await prisma.setting.findUnique({
      where: { key },
    });
    return record ? (record.value as T) : null;
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value: value as Prisma.InputJsonValue },
      create: { key, value: value as Prisma.InputJsonValue },
    });
  }
}

export const settingsRepository = new SettingsRepository();
