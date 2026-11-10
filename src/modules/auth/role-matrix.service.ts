import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ForbiddenError,
  Permission,
  ROLE_PERMISSIONS,
  setRuntimeRolePermissions,
} from "./permissions";
import { auditService } from "@/modules/audit/audit.service";

export const ROLE_MATRIX_SETTING_KEY = "rbac.rolePermissions";

export const SUPER_ADMIN_LOCKED_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.SYSTEM_ADMIN,
  Permission.MANAGE_USERS,
  Permission.MANAGE_SETTINGS,
]);

export const SENSITIVE_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.SYSTEM_ADMIN,
  Permission.MANAGE_USERS,
  Permission.MANAGE_SETTINGS,
]);

export class RoleMatrixSafeguardError extends Error {
  public readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "RoleMatrixSafeguardError";
  }
}

export interface RoleChangelogItem {
  id: string;
  action: string;
  role: string;
  permission: string;
  beforeEnabled: boolean | null;
  afterEnabled: boolean | null;
  actorName: string;
  actorRole: string;
  createdAt: string;
}

const CACHE_TTL_MS = 3000;
let cachedMatrix: Record<UserRole, Permission[]> | null = null;
let cacheLoadedAt = 0;

export function buildDefaultRoleMatrix(): Record<UserRole, Permission[]> {
  const out = {} as Record<UserRole, Permission[]>;
  for (const role of Object.values(UserRole)) {
    out[role] = [...(ROLE_PERMISSIONS[role] || [])];
  }
  return out;
}

function normalizeMatrix(raw: unknown): Record<UserRole, Permission[]> {
  const defaults = buildDefaultRoleMatrix();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }

  const validPermissions = new Set<string>(Object.values(Permission));
  const record = raw as Record<string, unknown>;
  const out = {} as Record<UserRole, Permission[]>;

  for (const role of Object.values(UserRole)) {
    if (Array.isArray(record[role])) {
      const filtered = Array.from(
        new Set(
          (record[role] as unknown[]).filter(
            (p): p is Permission => typeof p === "string" && validPermissions.has(p)
          )
        )
      );
      out[role] = filtered;
    } else {
      out[role] = [...defaults[role]];
    }
  }

  // Enforce Super Admin baseline lock invariant on read too
  for (const locked of SUPER_ADMIN_LOCKED_PERMISSIONS) {
    if (!out[UserRole.SUPER_ADMIN].includes(locked)) {
      out[UserRole.SUPER_ADMIN].push(locked);
    }
  }

  return out;
}

export function invalidateRolePermissionsCache(): void {
  cachedMatrix = null;
  cacheLoadedAt = 0;
}

export async function getEffectiveRoleMatrix(
  forceFresh = false
): Promise<Record<UserRole, Permission[]>> {
  const now = Date.now();
  if (!forceFresh && cachedMatrix && now - cacheLoadedAt < CACHE_TTL_MS) {
    setRuntimeRolePermissions(cachedMatrix);
    return cachedMatrix;
  }

  const setting = await prisma.setting.findUnique({
    where: { key: ROLE_MATRIX_SETTING_KEY },
  });

  const normalized = normalizeMatrix(setting?.value);
  cachedMatrix = normalized;
  cacheLoadedAt = now;
  setRuntimeRolePermissions(normalized);
  return normalized;
}

export async function ensureRolePermissionsLoaded(): Promise<Record<UserRole, Permission[]>> {
  return getEffectiveRoleMatrix(false);
}

export async function hasPermissionAsync(
  role: UserRole,
  permission: Permission
): Promise<boolean> {
  const matrix = await getEffectiveRoleMatrix(false);
  return (matrix[role] || []).includes(permission);
}

export async function assertPermissionAsync(
  role: UserRole,
  permission: Permission
): Promise<void> {
  const ok = await hasPermissionAsync(role, permission);
  if (!ok) {
    throw new ForbiddenError(
      `Role '${role}' is not authorized to perform action requiring '${permission}'`
    );
  }
}

export async function getRoleChangelog(limit = 50): Promise<RoleChangelogItem[]> {
  const logs = await prisma.auditLog.findMany({
    where: { entity: "RolePermission" },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: {
        select: { name: true, role: true },
      },
    },
  });

  return logs.map((log) => {
    const beforeObj = (log.before as Record<string, unknown> | null) || {};
    const afterObj = (log.after as Record<string, unknown> | null) || {};
    return {
      id: log.id,
      action: log.action,
      role: String(afterObj.role || beforeObj.role || ""),
      permission: String(afterObj.permission || beforeObj.permission || ""),
      beforeEnabled:
        typeof beforeObj.enabled === "boolean" ? beforeObj.enabled : null,
      afterEnabled:
        typeof afterObj.enabled === "boolean" ? afterObj.enabled : null,
      actorName: log.actor?.name || "System",
      actorRole: log.actor?.role || "SUPER_ADMIN",
      createdAt: log.createdAt.toISOString(),
    };
  });
}

export async function getRoleMatrixSnapshot() {
  const [matrix, changelog] = await Promise.all([
    getEffectiveRoleMatrix(true),
    getRoleChangelog(50),
  ]);
  return { matrix, changelog };
}

export async function toggleRolePermission(input: {
  actorId: string;
  actorRole: UserRole;
  targetRole: UserRole;
  permission: Permission;
  enabled: boolean;
  ip?: string | null;
}) {
  if (input.actorRole !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError("Only Super Admin can modify role permissions");
  }

  if (!Object.values(UserRole).includes(input.targetRole)) {
    throw new RoleMatrixSafeguardError(`Invalid role: ${input.targetRole}`);
  }
  if (!Object.values(Permission).includes(input.permission)) {
    throw new RoleMatrixSafeguardError(`Invalid permission: ${input.permission}`);
  }

  if (
    input.targetRole === UserRole.SUPER_ADMIN &&
    !input.enabled &&
    SUPER_ADMIN_LOCKED_PERMISSIONS.has(input.permission)
  ) {
    throw new RoleMatrixSafeguardError(
      `Super Admin cannot lose ${input.permission}`
    );
  }

  // Safeguard: at least one active Super Admin must always retain core governance rights
  const activeSuperAdmins = await prisma.user.count({
    where: { role: UserRole.SUPER_ADMIN, active: true },
  });
  if (activeSuperAdmins < 1) {
    throw new RoleMatrixSafeguardError(
      "At least one active Super Admin must exist to hold system administration rights"
    );
  }

  const updatedMatrix = await prisma.$transaction(async (tx) => {
    const existingSetting = await tx.setting.findUnique({
      where: { key: ROLE_MATRIX_SETTING_KEY },
    });
    const current = normalizeMatrix(existingSetting?.value);
    const prevPerms = current[input.targetRole] || [];
    const wasEnabled = prevPerms.includes(input.permission);

    if (wasEnabled === input.enabled) {
      return { matrix: current, wasEnabled, changed: false };
    }

    const nextPerms = input.enabled
      ? Array.from(new Set([...prevPerms, input.permission]))
      : prevPerms.filter((p) => p !== input.permission);

    const nextMatrix: Record<UserRole, Permission[]> = {
      ...current,
      [input.targetRole]: nextPerms,
    };

    await tx.setting.upsert({
      where: { key: ROLE_MATRIX_SETTING_KEY },
      update: { value: nextMatrix as unknown as Prisma.InputJsonValue },
      create: {
        key: ROLE_MATRIX_SETTING_KEY,
        value: nextMatrix as unknown as Prisma.InputJsonValue,
      },
    });

    return { matrix: nextMatrix, wasEnabled, changed: true };
  });

  if (updatedMatrix.changed) {
    await auditService.log({
      actorId: input.actorId,
      action: input.enabled ? "ROLE_PERMISSION_GRANTED" : "ROLE_PERMISSION_REVOKED",
      entity: "RolePermission",
      entityId: `${input.targetRole}:${input.permission}`,
      before: {
        role: input.targetRole,
        permission: input.permission,
        enabled: updatedMatrix.wasEnabled,
      },
      after: {
        role: input.targetRole,
        permission: input.permission,
        enabled: input.enabled,
      },
      ip: input.ip ?? null,
    });
  }

  invalidateRolePermissionsCache();
  cachedMatrix = updatedMatrix.matrix;
  cacheLoadedAt = Date.now();
  setRuntimeRolePermissions(updatedMatrix.matrix);

  const changelog = await getRoleChangelog(50);
  return {
    matrix: updatedMatrix.matrix,
    changelog,
  };
}
