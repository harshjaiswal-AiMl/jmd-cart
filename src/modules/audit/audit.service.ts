import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface LogAuditEventParams {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  branchId?: number;
}

/**
 * Recursively mask sensitive fields (passwords, tokens, phone numbers) before persisting in audit logs.
 */
export function maskSensitiveData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token")
    ) {
      result[key] = "[REDACTED]";
    } else if (lowerKey === "phone" && typeof value === "string") {
      // Mask phone numbers to preserve privacy: e.g. "9876543210" -> "98****3210"
      if (value.length === 10) {
        result[key] = `${value.slice(0, 2)}****${value.slice(6)}`;
      } else {
        result[key] = "[MASKED_PHONE]";
      }
    } else if (typeof value === "object" && value !== null) {
      result[key] = maskSensitiveData(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

export class AuditService {
  /**
   * Write an immutable audit log entry.
   */
  async log(params: LogAuditEventParams) {
    const {
      actorId = null,
      action,
      entity,
      entityId = null,
      before,
      after,
      ip = null,
      branchId = 1,
    } = params;

    const maskedBefore = before !== undefined ? (maskSensitiveData(before) as Prisma.InputJsonValue) : Prisma.JsonNull;
    const maskedAfter = after !== undefined ? (maskSensitiveData(after) as Prisma.InputJsonValue) : Prisma.JsonNull;

    return prisma.auditLog.create({
      data: {
        branchId,
        actorId,
        action,
        entity,
        entityId,
        before: maskedBefore,
        after: maskedAfter,
        ip,
      },
    });
  }

  /**
   * Retrieve audit logs with optional filtering.
   */
  async getLogs(filter?: { entity?: string; entityId?: string; actorId?: string; limit?: number; offset?: number }) {
    const { entity, entityId, actorId, limit = 50, offset = 0 } = filter ?? {};

    return prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(entityId ? { entityId } : {}),
        ...(actorId ? { actorId } : {}),
      },
      include: {
        actor: {
          select: { id: true, name: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }
}

export const auditService = new AuditService();
